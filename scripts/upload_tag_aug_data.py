import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

import pandas as pd
from handlers.data_transformers import DataTransformers
from core.db_manager import DatabaseManager
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def upload_tag_aug_file(file_path, db_path):
    """Upload all sheets from a Tag Data file"""
    filename = file_path.split('\\')[-1]
    logger.info(f"\n파일: {filename}")

    xl = pd.ExcelFile(file_path)
    logger.info(f"시트: {xl.sheet_names}")

    total_rows = 0
    db_manager = DatabaseManager(db_path)

    for sheet_name in xl.sheet_names:
        try:
            # 데이터 로드
            df = pd.read_excel(file_path, sheet_name=sheet_name)

            if len(df) == 0:
                logger.info(f"  {sheet_name}: 데이터 없음, 스킵")
                continue

            # 데이터 변환
            df_transformed = DataTransformers.transform_tag_data_aug(df)

            # uploaded_at 컬럼 추가
            df_transformed['uploaded_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            # DB 업로드
            rows_inserted = db_manager.insert_dataframe('tag_data_aug', df_transformed, if_exists='append')
            total_rows += rows_inserted
            logger.info(f"  {sheet_name}: {rows_inserted:,}행")

        except Exception as e:
            logger.error(f"  {sheet_name} 업로드 실패: {e}")
            import traceback
            traceback.print_exc()
            continue

    db_manager.close()
    return total_rows

def main():
    print("=== Tag Data (Aug-Oct) 업로드 시작 ===\n")

    db_path = r'C:\Project\SambioHRR\sambio_human.db'

    files = [
        r"C:\Users\haans\Downloads\Sambio 8-10 Data\25년도 8월 태깅 데이터.xlsx",
        r"C:\Users\haans\Downloads\Sambio 8-10 Data\25년도 9월 태깅 데이터.xlsx",
        r"C:\Users\haans\Downloads\Sambio 8-10 Data\25년도 10월 태깅 데이터.xlsx",
    ]

    grand_total = 0
    for file_path in files:
        try:
            rows = upload_tag_aug_file(file_path, db_path)
            grand_total += rows
            logger.info(f"파일 합계: {rows:,}행\n")
        except Exception as e:
            logger.error(f"파일 업로드 실패: {e}\n")
            import traceback
            traceback.print_exc()
            continue

    # 검증
    logger.info("\n=== 업로드 검증 ===")
    db_manager = DatabaseManager(db_path)
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    # 전체 건수
    cursor.execute("SELECT COUNT(*) FROM tag_data_aug")
    total = cursor.fetchone()[0]
    logger.info(f"전체 tag_data_aug: {total:,}건")

    db_manager.close()

    print(f"\n=== 업로드 완료: 총 {grand_total:,}행 ===")

if __name__ == '__main__':
    main()
