import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

import pandas as pd
from handlers.data_transformers import DataTransformers
from core.db_manager import DatabaseManager
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def upload_mdm_sheet(file_path, sheet_name, db_path):
    """Upload MDM data sheet to the database"""
    logger.info(f"\n파일 로드: {file_path}")
    logger.info(f"시트: {sheet_name}")

    df = pd.read_excel(file_path, sheet_name=sheet_name)
    logger.info(f"원본 데이터: {len(df):,}행 x {len(df.columns)}컬럼")

    # 데이터 변환
    logger.info("데이터 변환 시작...")
    df_transformed = DataTransformers.transform_mdm_data(df)
    logger.info(f"변환 완료: {len(df_transformed):,}행 x {len(df_transformed.columns)}컬럼")

    # uploaded_at 컬럼 추가
    df_transformed['uploaded_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # DB 업로드
    logger.info("DB 업로드 시작...")
    db_manager = DatabaseManager(db_path)

    try:
        rows_inserted = db_manager.insert_dataframe('mdm_data', df_transformed, if_exists='append')
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
    print("=== MDM Data 업로드 시작 ===\n")

    db_path = r'C:\Project\SambioHRR\sambio_human.db'
    file_path = r"C:\Users\haans\Downloads\Sambio 8-10 Data\장비데이터\MDM_DATA_20251104.xlsx"

    sheets = ['MDM_refined_8월', '9월', '10월']
    total_rows = 0

    for sheet_name in sheets:
        try:
            rows = upload_mdm_sheet(file_path, sheet_name, db_path)
            total_rows += rows
        except Exception as e:
            logger.error(f"{sheet_name} 업로드 실패: {e}")
            continue

    # 검증
    logger.info("\n=== 업로드 검증 ===")
    db_manager = DatabaseManager(db_path)
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    for month in ['2025-08', '2025-09', '2025-10']:
        cursor.execute("SELECT COUNT(*) FROM mdm_data WHERE strftime('%Y-%m', Timestap) = ?", (month,))
        count = cursor.fetchone()[0]
        logger.info(f"{month}: {count:,}건")

    # 전체 건수
    cursor.execute("SELECT COUNT(*) FROM mdm_data")
    total = cursor.fetchone()[0]
    logger.info(f"\n전체 mdm_data: {total:,}건")

    db_manager.close()

    print(f"\n=== 업로드 완료: 총 {total_rows:,}행 ===")

if __name__ == '__main__':
    main()
