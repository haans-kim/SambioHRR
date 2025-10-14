"""
Streamlit Excel Upload App
Standalone app for uploading Excel files to sambio_human.db
Matches Next.js UI styling
"""
import streamlit as st
import pandas as pd
from pathlib import Path
import sys
import json
from datetime import datetime

# Add current directory to path for imports
sys.path.append(str(Path(__file__).parent))

from models.data_types import DATA_TYPES
from core.db_manager import DatabaseManager
from core.excel_loader import ExcelLoader
from handlers.data_transformers import get_transformer

# Page configuration
st.set_page_config(
    page_title="Excel 데이터 업로드",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS to match Next.js styling
st.markdown("""
<style>
    /* Main container */
    .main {
        padding: 2rem 3rem;
    }

    /* Title styling */
    h1 {
        font-size: 2rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
    }

    /* Card-like containers */
    .stContainer {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
    }

    /* Data type selector */
    .stRadio > label {
        font-weight: 500;
        font-size: 1rem;
        margin-bottom: 0.5rem;
    }

    .stRadio > div {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .stRadio > div > label {
        padding: 0.75rem 1rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s;
        background: white;
    }

    .stRadio > div > label:hover {
        background: #f9fafb;
        border-color: #d1d5db;
    }

    .stRadio > div > label[data-baseweb="radio"] > div:first-child {
        display: flex;
        align-items: center;
    }

    /* File uploader styling */
    .stFileUploader {
        border: 2px dashed #d1d5db;
        border-radius: 0.5rem;
        padding: 2rem;
        text-align: center;
        transition: border-color 0.2s;
    }

    .stFileUploader:hover {
        border-color: #000;
    }

    /* Button styling */
    .stButton > button {
        background-color: #000;
        color: white;
        font-weight: 500;
        padding: 0.5rem 1.5rem;
        border-radius: 0.375rem;
        border: none;
        width: 100%;
        transition: background-color 0.2s;
    }

    .stButton > button:hover {
        background-color: #374151;
    }

    /* Progress bar */
    .stProgress > div > div {
        background-color: #000;
    }

    /* Success message */
    .stSuccess {
        background-color: #f0fdf4;
        border: 1px solid #86efac;
        border-radius: 0.375rem;
        padding: 1rem;
        color: #166534;
    }

    /* Error message */
    .stError {
        background-color: #fef2f2;
        border: 1px solid #fca5a5;
        border-radius: 0.375rem;
        padding: 1rem;
        color: #991b1b;
    }

    /* Info box */
    .stInfo {
        background-color: #dbeafe;
        border: 1px solid #93c5fd;
        border-radius: 0.375rem;
        padding: 1rem;
        color: #1e40af;
    }
</style>
""", unsafe_allow_html=True)

# Database path
DB_PATH = Path(__file__).parent.parent / "sambio_human.db"

# Initialize database manager and excel loader
@st.cache_resource
def get_db_manager():
    return DatabaseManager(str(DB_PATH))

@st.cache_resource
def get_excel_loader():
    return ExcelLoader()

db_manager = get_db_manager()
excel_loader = get_excel_loader()

# Header
st.title("📊 Excel 데이터 업로드")
st.caption("sambio_human.db로 Excel 파일 업로드")

st.markdown("---")

# Main container
with st.container():
    st.markdown("### 📁 데이터 타입 선택")
    st.caption("업로드할 데이터의 종류를 선택하세요")

    # Create radio options with descriptions
    data_type_options = {}
    for dt_id, dt_info in DATA_TYPES.items():
        label = f"{dt_info.label} - {dt_info.description}"
        data_type_options[label] = dt_id

    selected_label = st.radio(
        "데이터 타입",
        options=list(data_type_options.keys()),
        label_visibility="collapsed"
    )

    selected_type = data_type_options[selected_label]
    selected_data_type = DATA_TYPES[selected_type]

# Show selected data type info
if selected_type:
    with st.container():
        col1, col2, col3 = st.columns([1, 1, 1])

        with col1:
            st.metric("테이블명", selected_data_type.table_name)

        with col2:
            st.metric("우선순위", selected_data_type.priority.upper())

        with col3:
            st.metric("파일 형식", selected_data_type.file_pattern)

        with st.expander("샘플 컬럼 보기"):
            st.code(", ".join(selected_data_type.sample_columns))

st.markdown("---")

# File upload section
with st.container():
    st.markdown("### 📤 Excel 파일 업로드")

    uploaded_file = st.file_uploader(
        "Excel 파일을 선택하거나 드래그하세요",
        type=["xlsx", "xls"],
        help=f"예상 형식: {selected_data_type.file_pattern}"
    )

    if uploaded_file:
        st.info(f"📄 선택된 파일: **{uploaded_file.name}** ({uploaded_file.size:,} bytes)")

        # Upload button
        if st.button("🚀 업로드 시작", type="primary", use_container_width=True):
            try:
                # Progress indicators
                progress_bar = st.progress(0)
                status_text = st.empty()

                status_text.text("파일 읽는 중...")
                progress_bar.progress(10)

                # Save uploaded file temporarily
                temp_path = Path(f"/tmp/{uploaded_file.name}")
                with open(temp_path, "wb") as f:
                    f.write(uploaded_file.getbuffer())

                status_text.text("Excel 데이터 로드 중...")
                progress_bar.progress(20)

                # Load Excel file
                df = excel_loader.load_excel(str(temp_path))

                if df is None or df.empty:
                    st.error("❌ Excel 파일을 읽을 수 없습니다")
                    temp_path.unlink()
                    st.stop()

                total_rows = len(df)
                status_text.text(f"데이터 변환 중... ({total_rows:,}행)")
                progress_bar.progress(40)

                # Transform data
                transformer = get_transformer(selected_type)
                if transformer:
                    df = transformer(df)

                status_text.text(f"데이터베이스에 저장 중... (0/{total_rows:,})")
                progress_bar.progress(50)

                # Insert to database with progress
                rows_inserted = 0
                chunk_size = 1000

                for i in range(0, total_rows, chunk_size):
                    chunk = df.iloc[i:i + chunk_size]
                    db_manager.insert_dataframe(
                        selected_data_type.table_name,
                        chunk
                    )
                    rows_inserted += len(chunk)

                    # Update progress
                    progress_pct = 50 + int((rows_inserted / total_rows) * 45)
                    progress_bar.progress(progress_pct)
                    status_text.text(f"데이터베이스에 저장 중... ({rows_inserted:,}/{total_rows:,})")

                # Complete
                progress_bar.progress(100)
                status_text.text("완료!")

                # Cleanup
                temp_path.unlink()

                # Success message
                st.success(f"""
                ✅ **업로드 완료!**

                - 파일명: {uploaded_file.name}
                - 데이터 타입: {selected_data_type.label}
                - 테이블: {selected_data_type.table_name}
                - 저장된 행 수: {rows_inserted:,}
                - 완료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                """)

                # Show sample of uploaded data
                with st.expander("업로드된 데이터 미리보기 (처음 10행)"):
                    st.dataframe(df.head(10), use_container_width=True)

            except Exception as e:
                st.error(f"❌ 업로드 중 오류가 발생했습니다: {str(e)}")
                if temp_path.exists():
                    temp_path.unlink()

# Footer
st.markdown("---")
st.markdown("""
<div style="text-align: center; color: #6b7280; font-size: 0.875rem; padding: 1rem 0;">
    업로드가 완료되면 Next.js 앱에서 데이터 현황을 확인하세요
</div>
""", unsafe_allow_html=True)
