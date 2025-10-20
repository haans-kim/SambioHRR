#!/usr/bin/env python3
"""
SAMBIO HRR Data Uploader  
Excel 데이터 업로드 및 관리 애플리케이션
SambioHR5 스타일 적용

실행 방법:
cd excel-upload-server
./venv/bin/streamlit run streamlit_app.py --server.port 8501
"""

import streamlit as st
import pandas as pd
from pathlib import Path
import sys
import logging
from datetime import datetime
import tempfile
import os
from st_aggrid import AgGrid, GridOptionsBuilder, GridUpdateMode

# 현재 디렉토리를 Python 경로에 추가
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

from models.data_types import DATA_TYPES
from core.db_manager import DatabaseManager
from core.excel_loader import ExcelLoader
from handlers.data_transformers import get_transformer

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database path
DB_PATH = Path("/Users/hanskim/Projects/SambioHRR/sambio_human.db")

def init_session_state():
    """세션 상태 초기화"""
    # 세션 상태는 필요할 때 동적으로 생성됨
    pass

def get_data_stats():
    """데이터베이스 통계 가져오기"""
    try:
        db_manager = DatabaseManager(str(DB_PATH))
        stats = []

        # 각 데이터 타입별 날짜 컬럼 매핑 (Next.js API와 동일)
        date_column_map = {
            "tag_data": ("ENTE_DT", "number"),  # 20250101 형식
            "claim_data": ("근무일", "number"),  # 20250701 형식
            "meal_data": ("취식일시", "datetime"),
            "knox_approval": ("Timestamp", "datetime"),
            "knox_mail": ("발신일시_GMT9", "datetime"),
            "knox_pims": ("start_time", "datetime"),
            "eam_data": ("ATTEMPTDATE", "datetime"),
            "equis_data": ("Timestamp", "datetime"),
            "lams_data": ("DATE", "datetime"),
            "mes_data": ("login_time", "datetime"),
            "mdm_data": ("Timestap", "datetime"),
        }

        # 스크린샷과 동일한 순서로 정렬
        ordered_data_types = [
            "tag_data", "claim_data", "meal_data",
            "knox_approval", "knox_mail", "knox_pims",
            "eam_data", "equis_data", "lams_data", "mes_data", "mdm_data"
        ]

        for data_type_id in ordered_data_types:
            if data_type_id not in DATA_TYPES:
                continue

            data_type_info = DATA_TYPES[data_type_id]
            table_name = data_type_info.table_name

            # 테이블 존재 여부 확인
            if not db_manager.table_exists(table_name):
                stats.append({
                    "데이터 유형": data_type_info.label,
                    "테이블명": table_name,
                    "데이터 기간": "-",
                    "마지막 업로드": "-",
                    "데이터 수": "-"
                })
                continue

            # 행 수 가져오기
            row_count = db_manager.get_row_count(table_name)

            # 데이터 기간 조회
            date_range = "-"
            last_upload = "-"
            if row_count > 0 and data_type_id in date_column_map:
                try:
                    date_col, date_format = date_column_map[data_type_id]

                    # claim_data는 혼합 형식이므로 별도 처리
                    if table_name == "claim_data":
                        # Integer와 Text 형식 모두 고려
                        query = f"""
                        SELECT
                            MIN(CASE WHEN typeof({date_col}) = 'integer' THEN {date_col}
                                     WHEN typeof({date_col}) = 'text' THEN substr(replace({date_col}, '-', ''), 1, 8)
                                END) as min_date,
                            MAX(CASE WHEN typeof({date_col}) = 'integer' THEN {date_col}
                                     WHEN typeof({date_col}) = 'text' THEN substr(replace({date_col}, '-', ''), 1, 8)
                                END) as max_date
                        FROM {table_name} WHERE {date_col} IS NOT NULL
                        """
                    else:
                        query = f"SELECT MIN({date_col}) as min_date, MAX({date_col}) as max_date FROM {table_name} WHERE {date_col} IS NOT NULL"

                    result = db_manager.conn.execute(query).fetchone()

                    if result and result[0]:
                        min_date = str(result[0])
                        max_date = str(result[1])

                        # 숫자 형식 (20250101) -> 날짜 문자열 (2025-01-01)
                        if date_format == "number":
                            # 혼합 형식 처리 (숫자 또는 datetime 문자열)
                            if len(min_date) == 8 and min_date.isdigit():
                                min_date = f"{min_date[:4]}-{min_date[4:6]}-{min_date[6:8]}"
                            elif ' ' in min_date:
                                min_date = min_date.split(' ')[0]

                            if len(max_date) == 8 and max_date.isdigit():
                                max_date = f"{max_date[:4]}-{max_date[4:6]}-{max_date[6:8]}"
                            elif ' ' in max_date:
                                max_date = max_date.split(' ')[0]
                        # datetime 형식에서 날짜만 추출
                        elif date_format == "datetime":
                            min_date = min_date.split(' ')[0]
                            max_date = max_date.split(' ')[0]

                        date_range = f"{min_date} ~ {max_date}"

                except Exception as e:
                    logger.debug(f"날짜 조회 실패 ({table_name}): {e}")

            # 실제 업로드 날짜 조회 (uploaded_at 컬럼)
            if row_count > 0:
                try:
                    upload_query = f"SELECT MAX(uploaded_at) FROM {table_name} WHERE uploaded_at IS NOT NULL"
                    upload_result = db_manager.conn.execute(upload_query).fetchone()
                    if upload_result and upload_result[0]:
                        # YYYY-MM-DD HH:MM:SS -> YYYY-MM-DD만 추출
                        last_upload = str(upload_result[0]).split(' ')[0]
                except Exception as e:
                    logger.debug(f"업로드 날짜 조회 실패 ({table_name}): {e}")

            stats.append({
                "데이터 유형": data_type_info.label,
                "테이블명": table_name,
                "데이터 기간": date_range,
                "마지막 업로드": last_upload,
                "데이터 수": f"{row_count:,}" if row_count > 0 else "-"
            })

        return pd.DataFrame(stats)

    except Exception as e:
        logger.error(f"데이터 통계 조회 실패: {e}")
        return pd.DataFrame()

def render_data_status_table():
    """데이터 상태 테이블 렌더링 - AgGrid 사용"""
    st.markdown("## SAMBIO 데이터 업로드 관리")
    st.markdown("### 데이터 업로드 및 관리")

    # AgGrid 테이블 헤더 폰트 조정 (데이터와 동일한 폰트)
    st.markdown("""
        <style>
        /* 모든 가능한 AgGrid 헤더 선택자 */
        [class*="ag-header"] [class*="ag-header-cell"],
        [class*="ag-header-cell"],
        [class*="ag-header"] span,
        .ag-header-cell,
        .ag-header-cell-label,
        .ag-header-cell-text,
        .ag-header-group-cell,
        div[col-id] .ag-header-cell-label,
        div[role="columnheader"] {
            font-size: 18px !important;
            font-weight: 400 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }

        /* 헤더 중앙 정렬 */
        [class*="ag-header-cell"],
        .ag-header-cell,
        div[role="columnheader"] {
            text-align: center !important;
            justify-content: center !important;
        }

        [class*="ag-header"] [class*="ag-cell-label-container"] {
            justify-content: center !important;
        }

        /* AgGrid 셀 폰트 */
        [class*="ag-cell"],
        .ag-cell {
            font-size: 18px !important;
            font-weight: 400 !important;
            padding: 12px 16px !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }
        </style>
    """, unsafe_allow_html=True)

    df_status = get_data_stats()

    if not df_status.empty:
        # 테이블을 안쪽으로 들여쓰기 (좌우 여백 추가)
        col1, col2, col3 = st.columns([1, 18, 1])

        with col2:
            # GridOptionsBuilder로 컬럼 설정
            gb = GridOptionsBuilder.from_dataframe(df_status)

            # 각 컬럼을 퍼센트로 균등 분배 (페이지 전체 폭 사용)
            gb.configure_column("데이터 유형",
                              cellStyle={'textAlign': 'left', 'fontSize': '18px', 'padding': '16px 24px'},
                              headerStyle={'textAlign': 'center'},
                              wrapText=False,
                              autoHeight=False)
            gb.configure_column("테이블명",
                              cellStyle={'textAlign': 'left', 'fontSize': '18px', 'padding': '16px 24px'},
                              headerStyle={'textAlign': 'center'},
                              wrapText=False,
                              autoHeight=False)
            gb.configure_column("데이터 기간",
                              cellStyle={'textAlign': 'center', 'fontSize': '18px', 'padding': '16px 24px'},
                              headerStyle={'textAlign': 'center'},
                              wrapText=False,
                              autoHeight=False)
            gb.configure_column("마지막 업로드",
                              cellStyle={'textAlign': 'center', 'fontSize': '18px', 'padding': '16px 24px'},
                              headerStyle={'textAlign': 'center'},
                              wrapText=False,
                              autoHeight=False)
            gb.configure_column("데이터 수",
                              cellStyle={'textAlign': 'right', 'fontSize': '18px', 'padding': '16px 24px'},
                              headerStyle={'textAlign': 'center'},
                              wrapText=False,
                              autoHeight=False)

            # 행 선택 가능하도록 설정
            gb.configure_selection(selection_mode='single', use_checkbox=False)

            # 기타 옵션 - 페이지 폭에 맞춰 균등 분배
            gb.configure_grid_options(
                enableCellTextSelection=True,
                ensureDomOrder=True,
                suppressMovableColumns=True,
                rowHeight=56,
                domLayout='normal'
            )

            # defaultColDef로 전역 헤더 스타일 설정
            gb.configure_default_column(
                headerClass='custom-header',
                cellStyle={'fontSize': '18px', 'fontWeight': '400'},
            )

            gridOptions = gb.build()

            # gridOptions에 직접 헤더 스타일 추가
            gridOptions['defaultColDef'] = {
                **gridOptions.get('defaultColDef', {}),
                'headerClass': 'custom-header',
            }

            # 커스텀 CSS를 AgGrid에 직접 주입
            custom_css = {
                ".ag-header-cell-text": {"font-size": "18px", "font-weight": "400", "text-align": "center"},
                ".ag-header-cell": {"text-align": "center", "justify-content": "center"},
                ".ag-header-cell-label": {"text-align": "center", "justify-content": "center", "width": "100%"},
                ".ag-header-group-cell-label": {"text-align": "center", "justify-content": "center"},
                ".ag-cell": {"font-size": "18px", "font-weight": "400"}
            }

            grid_response = AgGrid(
                df_status,
                gridOptions=gridOptions,
                height=len(df_status) * 56 + 65,
                fit_columns_on_grid_load=True,
                update_mode=GridUpdateMode.SELECTION_CHANGED,
                theme='streamlit',
                custom_css=custom_css
            )

            # 선택된 행이 있으면 세션에 저장
            selected_rows = grid_response.get('selected_rows', None)
            if selected_rows is not None and not selected_rows.empty:
                # DataFrame이므로 iloc로 접근
                selected_label = selected_rows.iloc[0]['데이터 유형']

                # 데이터 유형 레이블로 ID 찾기
                for dt_id, dt_info in DATA_TYPES.items():
                    if dt_info.label == selected_label:
                        st.session_state['selected_data_type'] = dt_id
                        break
    else:
        st.warning("데이터 상태를 불러올 수 없습니다.")

def render_file_upload_section():
    """파일 업로드 섹션 렌더링"""
    st.markdown("---")

    # 테이블에서 선택된 데이터 타입 가져오기
    selected_type = st.session_state.get('selected_data_type', None)

    if not selected_type:
        # 테이블과 동일하게 들여쓰기
        col1, col2, col3 = st.columns([1, 18, 1])
        with col2:
            st.info("💡 위 테이블에서 데이터 유형을 선택하면 파일 업로드가 가능합니다.")
        return

    data_type_info = DATA_TYPES[selected_type]

    # 테이블과 동일하게 들여쓰기
    col1, col2, col3 = st.columns([1, 18, 1])

    with col2:
        st.markdown(f"#### 📁 {data_type_info.label} 업로드")

        # 파일 업로더 스타일
        st.markdown("""
            <style>
            /* Browse files 버튼 크기 및 스타일 */
            [data-testid="stFileUploader"] section button {
                font-size: 18px !important;
                padding: 16px 32px !important;
                height: auto !important;
                min-height: 56px !important;
                font-weight: 500 !important;
            }
            </style>
        """, unsafe_allow_html=True)

        # 파일 업로더
        uploaded_files = st.file_uploader(
            "Select Files (Excel 파일 복수 선택 가능)",
            type=['xlsx', 'xls'],
            accept_multiple_files=True,
            key=f"file_uploader_{selected_type}",
            label_visibility="visible"
        )

        # 선택된 파일이 있으면 세션에 저장
        if uploaded_files:
            st.session_state['uploaded_files'] = uploaded_files

            # 선택된 파일 목록 표시
            st.markdown(f"**선택된 파일: {len(uploaded_files)}개**")
            for file in uploaded_files:
                st.text(f"📄 {file.name} ({file.size / (1024*1024):.2f} MB)")

def render_action_buttons():
    """액션 버튼 렌더링"""

    # 테이블에서 선택된 데이터 타입 가져오기
    selected_type = st.session_state.get('selected_data_type', None)
    uploaded_files = st.session_state.get('uploaded_files', None)

    if not selected_type or not uploaded_files:
        return

    # 테이블과 동일한 들여쓰기 적용
    _, col_btn, _ = st.columns([1, 18, 1])

    with col_btn:
        # 검은색 버튼 스타일 적용
        st.markdown("""
        <style>
        div.stButton > button {
            background-color: #000000 !important;
            color: white !important;
            border: none !important;
            padding: 0.75rem 1rem !important;
            font-size: 18px !important;
            font-weight: 500 !important;
        }
        div.stButton > button:hover {
            background-color: #1a1a1a !important;
        }
        </style>
        """, unsafe_allow_html=True)

        if st.button("📤 데이터 업로드", use_container_width=True):
            load_data(selected_type, uploaded_files)
            st.rerun()

def load_data(selected_type, uploaded_files):
    """데이터 로드 처리"""
    progress_bar = st.progress(0)
    status_text = st.empty()

    try:
        data_type_info = DATA_TYPES[selected_type]

        if not uploaded_files:
            st.warning("파일을 선택해주세요.")
            return

        status_text.text(f"📊 {data_type_info.label} 로딩 중...")
        progress_bar.progress(0.1)

        excel_loader = ExcelLoader()
        db_manager = DatabaseManager(str(DB_PATH))

        all_dfs = []
        temp_files_to_delete = []

        total_files = len(uploaded_files)
        for idx, uploaded_file in enumerate(uploaded_files):
            status_text.text(f"📖 파일 로딩 중: {uploaded_file.name} ({idx+1}/{total_files})")
            progress = 0.1 + (idx / total_files) * 0.4
            progress_bar.progress(progress)

            with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
                tmp_file.write(uploaded_file.getbuffer())
                tmp_path = tmp_file.name

            try:
                from pathlib import Path
                df = excel_loader.load_excel_file(Path(tmp_path))
                if df is not None and not df.empty:
                    all_dfs.append(df)
                temp_files_to_delete.append(tmp_path)
            except Exception as e:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                raise e

        if all_dfs:
            status_text.text("🔄 데이터 병합 중...")
            progress_bar.progress(0.6)

            combined_df = pd.concat(all_dfs, ignore_index=True)
            logger.info(f"데이터 병합 완료: {len(combined_df):,}행")

            transformer = get_transformer(selected_type)
            if transformer:
                status_text.text("🔄 데이터 변환 중...")
                progress_bar.progress(0.7)
                combined_df = transformer(combined_df)

            # 날짜 범위 기반 중복 방지: 업로드할 데이터의 날짜 범위에 해당하는 기존 데이터 삭제
            date_column_map = {
                "tag_data": ("ENTE_DT", "number"),
                "claim_data": ("근무일", "datetime"),
                "meal_data": ("취식일시", "datetime"),
                "knox_approval": ("Timestamp", "datetime"),
                "knox_mail": ("발신일시_GMT9", "datetime"),
                "knox_pims": ("start_time", "datetime"),
                "eam_data": ("ATTEMPTDATE", "datetime"),
                "equis_data": ("Timestamp", "datetime"),
                "lams_data": ("DATE", "datetime"),
                "mes_data": ("login_time", "datetime"),
                "mdm_data": ("Timestap", "datetime"),
            }

            # 해당 데이터 타입의 날짜 컬럼 확인
            if selected_type in date_column_map and not combined_df.empty:
                date_column, date_format = date_column_map[selected_type]

                if date_column in combined_df.columns:
                    try:
                        status_text.text("🗑️ 기존 데이터 중복 제거 중...")
                        progress_bar.progress(0.75)

                        # 업로드할 데이터의 날짜 범위 추출
                        if date_format == "number":
                            # 숫자 형식 (20250101)
                            min_date = str(int(combined_df[date_column].min()))
                            max_date = str(int(combined_df[date_column].max()))
                            # YYYYMMDD -> YYYY-MM-DD 형식으로 변환
                            min_date_formatted = f"{min_date[:4]}-{min_date[4:6]}-{min_date[6:8]}"
                            max_date_formatted = f"{max_date[:4]}-{max_date[4:6]}-{max_date[6:8]}"
                        else:
                            # datetime 형식
                            min_date_formatted = pd.to_datetime(combined_df[date_column]).min().strftime('%Y-%m-%d')
                            max_date_formatted = pd.to_datetime(combined_df[date_column]).max().strftime('%Y-%m-%d')

                        # 해당 날짜 범위의 기존 데이터 삭제
                        deleted_rows = db_manager.delete_by_date_range(
                            table_name=data_type_info.table_name,
                            date_column=date_column,
                            min_date=min_date_formatted,
                            max_date=max_date_formatted,
                            date_format=date_format
                        )

                        if deleted_rows > 0:
                            logger.info(f"중복 방지: {deleted_rows:,}행 삭제 완료 ({min_date_formatted} ~ {max_date_formatted})")

                    except Exception as e:
                        logger.warning(f"날짜 범위 삭제 실패 (계속 진행): {e}")

            status_text.text("💾 데이터베이스 저장 중...")
            progress_bar.progress(0.8)

            db_manager.insert_dataframe(data_type_info.table_name, combined_df)

            # tag_data 업로드 시 Master 테이블 자동 마이그레이션 (비활성화)
            # 이유: 시간이 오래 걸리고 진행률 피드백이 없어서 사용자 경험이 나쁨
            # 필요시 터미널에서 수동 실행: npx tsx scripts/migrate-complete-master.ts YYYYMMDD YYYYMMDD
            # if selected_type == "tag_data" and not combined_df.empty:
            #     ... (마이그레이션 코드 비활성화)

            progress_bar.progress(1.0)
            status_text.text("✅ 로드 완료!")

            # 세션 정리
            if 'uploaded_files' in st.session_state:
                del st.session_state['uploaded_files']
            if 'selected_data_type' in st.session_state:
                del st.session_state['selected_data_type']

            for tmp_path in temp_files_to_delete:
                try:
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
                except Exception as del_error:
                    logger.warning(f"임시 파일 삭제 실패: {tmp_path} - {del_error}")

            st.success(f"🎉 {data_type_info.label} 업로드 완료! ({len(combined_df):,}행)")

        else:
            st.warning("로드된 데이터가 없습니다.")

    except Exception as e:
        st.error(f"❌ 로드 실패: {e}")
        logger.error(f"데이터 로드 오류: {e}")
    finally:
        progress_bar.empty()
        status_text.empty()

def main():
    """메인 애플리케이션"""
    st.set_page_config(
        page_title="SAMBIO HRR Data Uploader",
        page_icon="📊",
        layout="wide",
        initial_sidebar_state="collapsed"
    )

    init_session_state()

    with st.sidebar:
        st.markdown("## 📊 SAMBIO HRR Data Uploader")
        st.markdown("---")
        st.markdown("### 🎯 주요 기능")
        st.markdown("""
        - **Excel 파일 업로드**: 대용량 데이터 처리
        - **자동 병합**: 여러 시트 자동 통합
        - **DB 저장**: SQLite 데이터베이스 관리
        - **데이터 조회**: 실시간 데이터 확인
        """)

        st.markdown("---")
        st.markdown("### ℹ️ 사용법")
        st.markdown("""
        1. **파일 등록**: Excel 파일 선택 및 추가
        2. **데이터 로드**: 버튼 클릭으로 처리 시작
        3. **상태 확인**: 실시간 진행률 모니터링
        4. **새로고침**: 테이블 업데이트
        """)

        st.markdown("---")
        if DB_PATH.exists():
            st.success(f"✅ DB 연결됨")
            st.caption(f"📁 {DB_PATH.name}")
        else:
            st.warning("⚠️ DB 파일 없음")

    try:
        render_data_status_table()
        render_file_upload_section()
        render_action_buttons()

    except Exception as e:
        st.error(f"❌ 애플리케이션 오류: {e}")
        logger.error(f"애플리케이션 오류: {e}", exc_info=True)

if __name__ == "__main__":
    main()
