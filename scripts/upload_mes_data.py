import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

import pandas as pd
from handlers.data_transformers import DataTransformers
from core.db_manager import DatabaseManager
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def upload_mes_file(file_path, db_path):
    """Upload a single MES data file to the database"""
    logger.info(f"\n파일 로드: {file_path}")
    df = pd.read_excel(file_path)
    logger.info(f"원본 데이터: {len(df):,}행 x {len(df.columns)}컬럼")

    # 데이터 변환
    logger.info("데이터 변환 시작...")
    df_transformed = DataTransformers.transform_mes_data(df)
    logger.info(f"변환 완료: {len(df_transformed):,}행 x {len(df_transformed.columns)}컬럼")

    # uploaded_at 컬럼 추가
    df_transformed['uploaded_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # DB 업로드
    logger.info("DB 업로드 시작...")
    db_manager = DatabaseManager(db_path)

    try:
        rows_inserted = db_manager.insert_dataframe('mes_data', df_transformed, if_exists='append')
        logger.info(f"✅ 업로드 완료: {rows_inserted:,}행")
        db_manager.close()
        return rows_inserted
    except Exception as e:
        logger.error(f"❌ 업로드 실패: {e}")
        import traceback
        traceback.print_exc()
        db_manager.close()
        raise

def main():
    print("=== MES Data 업로드 시작 ===\n")

    db_path = r'C:\Project\SambioHRR\sambio_human.db'

    # 업로드할 파일 목록
    files = [
        r"C:\Users\haans\Downloads\Sambio 8-10 Data\장비데이터\SYS-MES-002 MES_20251104.xlsx",
        r"C:\Users\haans\Downloads\Sambio 8-10 Data\장비데이터\SYS-MES-005 MES 1.0_20251104.xlsx"
    ]

    total_rows = 0
    for file_path in files:
        try:
            rows = upload_mes_file(file_path, db_path)
            total_rows += rows
        except Exception as e:
            logger.error(f"파일 업로드 실패: {file_path}")
            continue

    # 검증
    logger.info("\n=== 업로드 검증 ===")
    db_manager = DatabaseManager(db_path)
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    for month in ['2025-08', '2025-09', '2025-10']:
        cursor.execute("SELECT COUNT(*) FROM mes_data WHERE strftime('%Y-%m', login_time) = ?", (month,))
        count = cursor.fetchone()[0]
        logger.info(f"{month}: {count:,}건")

    # 전체 건수
    cursor.execute("SELECT COUNT(*) FROM mes_data")
    total = cursor.fetchone()[0]
    logger.info(f"\n전체 mes_data: {total:,}건")

    db_manager.close()

    print(f"\n=== 업로드 완료: 총 {total_rows:,}행 ===")

if __name__ == '__main__':
    main()
