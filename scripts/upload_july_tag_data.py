import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

import pandas as pd
from handlers.data_transformers import DataTransformers
from core.db_manager import DatabaseManager
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def upload_tag_file(file_path, db_path):
    """Upload all sheets from July Tag Data file to tag_data table"""
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

            logger.info(f"  {sheet_name}: 원본 {len(df):,}행")

            # 데이터 변환 (tag_data 포맷으로)
            df_transformed = DataTransformers.transform_tag_data(df)

            # uploaded_at 컬럼 추가
            df_transformed['uploaded_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            # DB 업로드 (tag_data 테이블에)
            rows_inserted = db_manager.insert_dataframe('tag_data', df_transformed, if_exists='append')
            total_rows += rows_inserted
            logger.info(f"  {sheet_name}: {rows_inserted:,}행 업로드 완료")

        except Exception as e:
            logger.error(f"  {sheet_name} 업로드 실패: {e}")
            import traceback
            traceback.print_exc()
            continue

    db_manager.close()
    return total_rows

def main():
    print("=== 7월 Tag Data 업로드 시작 ===\n")

    db_path = r'C:\Project\SambioHRR\sambio_human.db'
    file_path = r"C:\Users\haans\Downloads\Sambio 7-9 Data\입출문기록(25.7).xlsx"

    try:
        rows = upload_tag_file(file_path, db_path)
        logger.info(f"\n파일 합계: {rows:,}행")
    except Exception as e:
        logger.error(f"파일 업로드 실패: {e}")
        import traceback
        traceback.print_exc()
        return

    # 검증
    logger.info("\n=== 업로드 검증 ===")
    db_manager = DatabaseManager(db_path)
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    # 7월 데이터 건수
    cursor.execute("SELECT COUNT(*) FROM tag_data WHERE ENTE_DT >= 20250701 AND ENTE_DT <= 20250731")
    july_count = cursor.fetchone()[0]
    logger.info(f"7월 tag_data: {july_count:,}건")

    # 전체 건수
    cursor.execute("SELECT COUNT(*) FROM tag_data")
    total = cursor.fetchone()[0]
    logger.info(f"전체 tag_data: {total:,}건")

    # 날짜 범위
    cursor.execute("SELECT MIN(ENTE_DT), MAX(ENTE_DT) FROM tag_data WHERE ENTE_DT >= 20250701 AND ENTE_DT <= 20250731")
    date_range = cursor.fetchone()
    logger.info(f"7월 날짜 범위: {date_range[0]} ~ {date_range[1]}")

    db_manager.close()

    print(f"\n=== 업로드 완료: 총 {rows:,}행 ===")

if __name__ == '__main__':
    main()
