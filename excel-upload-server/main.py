"""
FastAPI Server for Excel Data Upload
On-Demand server spawned by Next.js
"""
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path
import logging
import tempfile
import uvicorn
from typing import List
import os

from models.data_types import DATA_TYPES, UploadStatus, DataStats
from core.db_manager import DatabaseManager
from core.excel_loader import ExcelLoader
from handlers.data_transformers import get_transformer

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="SambioHRR Excel Upload Server",
    description="On-Demand FastAPI server for uploading Excel data to sambio_human.db",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3003", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database path (relative to project root)
DB_PATH = Path(__file__).parent.parent / "sambio_human.db"
db_manager = DatabaseManager(str(DB_PATH))
excel_loader = ExcelLoader()

# Upload progress tracking
upload_progress = {}


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "server": "SambioHRR Excel Upload Server",
        "version": "1.0.0"
    }


@app.get("/api/data-types")
async def get_data_types():
    """Get list of all supported data types"""
    return {
        "data_types": [
            {
                "id": dt.id,
                "label": dt.label,
                "description": dt.description,
                "priority": dt.priority,
                "file_pattern": dt.file_pattern,
                "sample_columns": dt.sample_columns
            }
            for dt in DATA_TYPES.values()
        ]
    }


@app.get("/api/stats")
async def get_database_stats():
    """Get current database statistics for all data types"""
    stats_list = []

    for data_type_id, data_type_info in DATA_TYPES.items():
        table_stats = db_manager.get_table_stats(
            data_type_info.table_name,
            data_type_info.date_column
        )

        stats_list.append(DataStats(
            data_type=data_type_id,
            table_name=data_type_info.table_name,
            row_count=table_stats.get("row_count", 0),
            date_range=table_stats.get("date_range"),
            last_updated=None  # TODO: Get from metadata if available
        ))

    return {"stats": stats_list}


@app.get("/api/stats/{data_type}")
async def get_data_type_stats(data_type: str):
    """Get statistics for a specific data type"""
    if data_type not in DATA_TYPES:
        raise HTTPException(status_code=404, detail=f"Data type not found: {data_type}")

    data_type_info = DATA_TYPES[data_type]
    table_stats = db_manager.get_table_stats(
        data_type_info.table_name,
        data_type_info.date_column
    )

    return DataStats(
        data_type=data_type,
        table_name=data_type_info.table_name,
        row_count=table_stats.get("row_count", 0),
        date_range=table_stats.get("date_range"),
        last_updated=None
    )


@app.post("/api/upload/{data_type}")
async def upload_excel(
    data_type: str,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Upload Excel file for a specific data type

    Args:
        data_type: Type of data being uploaded (e.g., 'tag_data', 'claim_data')
        file: Excel file to upload
    """
    logger.info(f"Upload request received: data_type={data_type}, file={file.filename}")

    # Validate data type
    if data_type not in DATA_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid data type: {data_type}")

    # Validate file extension
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")

    # Initialize upload progress
    upload_id = f"{data_type}_{file.filename}"
    upload_progress[upload_id] = UploadStatus(
        file_name=file.filename,
        data_type=data_type,
        total_rows=0,
        processed_rows=0,
        progress=0.0,
        status="processing",
        message="Reading Excel file..."
    )

    try:
        # Save uploaded file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_file:
            temp_path = Path(temp_file.name)
            content = await file.read()
            temp_file.write(content)

        logger.info(f"Temporary file saved: {temp_path}")

        # Load Excel file
        upload_progress[upload_id].message = "Loading Excel file..."
        df = excel_loader.load_excel_file(temp_path, auto_merge_sheets=True)
        upload_progress[upload_id].total_rows = len(df)

        logger.info(f"Excel loaded: {len(df):,} rows, {len(df.columns)} columns")

        # Transform data
        upload_progress[upload_id].message = "Transforming data..."
        transformer = get_transformer(data_type)
        df_transformed = transformer(df)

        # Insert into database
        upload_progress[upload_id].message = "Inserting into database..."
        data_type_info = DATA_TYPES[data_type]
        rows_inserted = db_manager.dataframe_to_table(
            df_transformed,
            data_type_info.table_name,
            if_exists='append',  # Always append by default
            chunk_size=5000
        )

        # Update progress
        upload_progress[upload_id].processed_rows = rows_inserted
        upload_progress[upload_id].progress = 100.0
        upload_progress[upload_id].status = "completed"
        upload_progress[upload_id].message = f"Successfully uploaded {rows_inserted:,} rows"

        # Clean up temp file
        temp_path.unlink()

        logger.info(f"Upload complete: {rows_inserted:,} rows inserted into {data_type_info.table_name}")

        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data_type": data_type,
                "file_name": file.filename,
                "rows_inserted": rows_inserted,
                "table_name": data_type_info.table_name
            }
        )

    except Exception as e:
        logger.error(f"Upload failed: {e}", exc_info=True)

        # Update progress with error
        if upload_id in upload_progress:
            upload_progress[upload_id].status = "error"
            upload_progress[upload_id].error = str(e)
            upload_progress[upload_id].message = f"Upload failed: {str(e)}"

        # Clean up temp file if it exists
        if 'temp_path' in locals() and temp_path.exists():
            temp_path.unlink()

        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/upload-progress/{upload_id}")
async def get_upload_progress(upload_id: str):
    """Get progress of an upload"""
    if upload_id not in upload_progress:
        raise HTTPException(status_code=404, detail="Upload not found")

    return upload_progress[upload_id]


@app.post("/api/validate-file")
async def validate_excel_file(file: UploadFile = File(...)):
    """
    Validate an Excel file before upload
    Returns file info and detected data type
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")

    try:
        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_file:
            temp_path = Path(temp_file.name)
            content = await file.read()
            temp_file.write(content)

        # Get file info
        file_info = excel_loader.get_excel_info(temp_path)

        # Try to detect data type from filename or columns
        detected_type = None
        for dt_id, dt_info in DATA_TYPES.items():
            # Check filename pattern
            if any(pattern in file.filename for pattern in dt_info.file_pattern.split('*')):
                detected_type = dt_id
                break
            # Check column names
            if file_info.get('sample_columns'):
                matching_cols = sum(
                    1 for col in dt_info.sample_columns
                    if col in file_info['sample_columns']
                )
                if matching_cols >= len(dt_info.sample_columns) * 0.7:  # 70% match
                    detected_type = dt_id
                    break

        # Clean up
        temp_path.unlink()

        return {
            "file_info": file_info,
            "detected_type": detected_type,
            "confidence": "high" if detected_type else "low"
        }

    except Exception as e:
        if 'temp_path' in locals() and temp_path.exists():
            temp_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on server shutdown"""
    logger.info("Shutting down Excel upload server...")
    db_manager.close()


def start_server(port: int = 8000, host: str = "127.0.0.1"):
    """Start the FastAPI server"""
    logger.info(f"Starting Excel upload server on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    # Get port from environment or default to 8000
    port = int(os.getenv("PORT", "8000"))
    start_server(port=port)
