# Excel Upload Server

FastAPI server for uploading Excel data files to sambio_human.db

## Overview

This is an on-demand FastAPI server that is spawned by Next.js when Excel data upload is needed. It provides REST API endpoints for:
- Uploading 12 different data types (tag_data, claim_data, employees, meal_data, Knox systems, equipment systems)
- Data transformation and validation
- Database statistics and monitoring

## Installation

```bash
cd excel-upload-server
pip install -r requirements.txt
```

## Supported Data Types

### Critical Priority
1. **tag_data** - RFID 출입 태그 데이터
2. **claim_data** - 근무시간 신고 데이터
3. **employees** - 조직/직원 마스터 데이터

### High Priority
4. **meal_data** - 식사 태그 데이터
5. **knox_approval** - Knox 전자결재 로그
6. **knox_mail** - Knox 메일 로그
7. **knox_pims** - Knox PIMS 회의실 예약

### Medium/Low Priority
8. **eam_data** - EAM 안전설비시스템
9. **equis_data** - Equis 장비관리
10. **lams_data** - LAMS 실험실관리
11. **mes_data** - MES 생산시스템
12. **mdm_data** - MDM 마스터데이터

## API Endpoints

### Server Control
- **GET** `/` - Health check
- **GET** `/api/stats` - Get all database statistics
- **GET** `/api/stats/{data_type}` - Get stats for specific data type
- **GET** `/api/data-types` - List all supported data types

### Upload Operations
- **POST** `/api/upload/{data_type}` - Upload Excel file
- **POST** `/api/validate-file` - Validate Excel file before upload
- **GET** `/api/upload-progress/{upload_id}` - Get upload progress

## Data Transformation

Each data type has a specific transformation function that:
1. Renames columns to match DB schema
2. Converts data types (dates, numbers, etc.)
3. Validates data integrity
4. Applies business rules

Transformers are defined in [handlers/data_transformers.py](handlers/data_transformers.py)

## Usage from Next.js

The server is controlled via Next.js API routes:

```typescript
// Start server
await fetch('/api/upload-server/control', {
  method: 'POST',
  body: JSON.stringify({ action: 'start' })
});

// Upload file
const formData = new FormData();
formData.append('file', file);

await fetch('/api/upload/tag_data', {
  method: 'POST',
  body: formData
});
```

## Auto-Shutdown

The server automatically shuts down after 5 minutes of inactivity to conserve resources.

## Manual Testing

Start the server manually for testing:

```bash
cd excel-upload-server
python -m uvicorn main:app --port 8000 --reload
```

Then access the API docs at: http://localhost:8000/docs

## Architecture

```
Next.js (Port 3003)
  ├─ API Routes (/api/upload-server/control)
  │   └─ Spawns/Controls FastAPI Server
  │
  └─ Proxy Routes (/api/upload/*)
      └─ Forwards to FastAPI (Port 8000)
          ├─ Excel Loading (core/excel_loader.py)
          ├─ Data Transformation (handlers/data_transformers.py)
          └─ Database Insertion (core/db_manager.py)
```

## Database Schema

All uploads target `sambio_human.db` with table schemas defined in [DATA_TABLES_COMPLETE_MAPPING.md](../DATA_TABLES_COMPLETE_MAPPING.md)

## Error Handling

- Invalid file formats return 400 Bad Request
- Server unavailable returns 503 Service Unavailable
- Upload failures roll back database transactions
- All errors are logged with stack traces

## Development Notes

- Based on SambioHR5/Data_Uploader architecture
- Uses pandas for Excel processing
- SQLite transactions with 5000-row batching
- Progress tracking for long uploads
- Automatic data type detection from filenames/columns
