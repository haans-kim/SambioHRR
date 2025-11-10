import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

import os
import pandas as pd
from handlers.data_transformers import DataTransformers
from core.db_manager import DatabaseManager
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def upload_lims_file(file_path, db_path):
    """Upload all date sheets from a LIMS data file"""
    filename = os.path.basename(file_path)
    logger.info(f"\n파일: {filename}")

    xl = pd.ExcelFile(file_path)

    # 날짜 시트만 선택 (YYYYMMDD 형식)
    date_sheets = [s for s in xl.sheet_names if s.isdigit() and len(s) == 8]
    logger.info(f"날짜 시트: {len(date_sheets)}개")

    total_rows = 0
    db_manager = DatabaseManager(db_path)

    for sheet_name in date_sheets:
        try:
            # 데이터 로드
            df = pd.read_excel(file_path, sheet_name=sheet_name)

            if len(df) == 0:
                logger.info(f"  {sheet_name}: 데이터 없음, 스킵")
                continue

            # 데이터 변환
            df_transformed = DataTransformers.transform_lims_data(df)

            # uploaded_at 컬럼 추가
            df_transformed['uploaded_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            # DB 업로드
            rows_inserted = db_manager.insert_dataframe('lims_data', df_transformed, if_exists='append')
            total_rows += rows_inserted
            logger.info(f"  {sheet_name}: {rows_inserted:,}행")

        except Exception as e:
            logger.error(f"  {sheet_name} 업로드 실패: {e}")
            continue

    db_manager.close()
    return total_rows

def main():
    print("=== LIMS Data 업로드 시작 ===\n")

    db_path = r'C:\Project\SambioHRR\sambio_human.db'
    folder = r"C:\Users\haans\Downloads\Sambio 8-10 Data\장비데이터"

    # LIMS 파일 목록
    files = [f for f in os.listdir(folder) if 'LIMS' in f.upper()]
    files.sort()

    logger.info(f"총 {len(files)}개 파일\n")

    grand_total = 0
    for file_name in files:
        file_path = os.path.join(folder, file_name)
        try:
            rows = upload_lims_file(file_path, db_path)
            grand_total += rows
            logger.info(f"파일 합계: {rows:,}행\n")
        except Exception as e:
            logger.error(f"파일 업로드 실패: {e}\n")
            continue

    # 검증
    logger.info("\n=== 업로드 검증 ===")
    db_manager = DatabaseManager(db_path)
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    for month in ['2025-08', '2025-09', '2025-10']:
        cursor.execute("SELECT COUNT(*) FROM lims_data WHERE strftime('%Y-%m', DATE) = ?", (month,))
        count = cursor.fetchone()[0]
        logger.info(f"{month}: {count:,}건")

    # 전체 건수
    cursor.execute("SELECT COUNT(*) FROM lims_data")
    total = cursor.fetchone()[0]
    logger.info(f"\n전체 lims_data: {total:,}건")

    db_manager.close()

    print(f"\n=== 업로드 완료: 총 {grand_total:,}행 ===")

if __name__ == '__main__':
    main()
