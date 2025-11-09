import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

import pandas as pd
from handlers.data_transformers import DataTransformers
from core.db_manager import DatabaseManager
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

print("=== Claim Data 업로드 시작 ===\n")

# 1. 파일 로드
file_path = r"C:\Users\haans\Downloads\Sambio 8-10 Data\25년도 8-10 Claim Data.xlsx"
db_path = r'C:\Project\SambioHRR\sambio_human.db'

logger.info(f"파일 로드: {file_path}")
df = pd.read_excel(file_path)
logger.info(f"원본 데이터: {len(df):,}행 x {len(df.columns)}컬럼")

# 2. 데이터 변환
logger.info("데이터 변환 시작...")
df_transformed = DataTransformers.transform_claim_data(df)
logger.info(f"변환 완료: {len(df_transformed):,}행 x {len(df_transformed.columns)}컬럼")

# 3. DB 업로드
logger.info("DB 업로드 시작...")
db_manager = DatabaseManager(db_path)

try:
    rows_inserted = db_manager.insert_dataframe('claim_data', df_transformed, if_exists='append')
    logger.info(f"✅ 업로드 완료: {rows_inserted:,}행")

    # 4. 검증
    logger.info("\n=== 업로드 검증 ===")
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    for month in ['2025-08', '2025-09', '2025-10']:
        cursor.execute("SELECT COUNT(*) FROM claim_data WHERE 근무일 LIKE ?", (f'{month}%',))
        count = cursor.fetchone()[0]
        logger.info(f"{month}: {count:,}건")

    db_manager.close()

except Exception as e:
    logger.error(f"❌ 업로드 실패: {e}")
    import traceback
    traceback.print_exc()
    db_manager.close()
    sys.exit(1)

print("\n=== 업로드 완료 ===")
