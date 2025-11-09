import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

import pandas as pd
from handlers.data_transformers import DataTransformers
from core.db_manager import DatabaseManager
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.stdout.reconfigure(encoding='utf-8')

db_path = r'C:\Project\SambioHRR\sambio_human.db'
file_path = r"C:\Users\haans\Downloads\Sambio 8-10 Data\25년도 8-10 Claim Data.xlsx"

# 1. 기존 8-10월 데이터 삭제
print("=== 1. 기존 8-10월 데이터 삭제 ===\n")

import sqlite3
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 삭제 전 확인
for month in ['2025-08', '2025-09', '2025-10']:
    cursor.execute('SELECT COUNT(*) FROM claim_data WHERE 근무일 LIKE ?', (f'{month}%',))
    count = cursor.fetchone()[0]
    print(f'{month}: {count:,}건')

# 삭제
cursor.execute('DELETE FROM claim_data WHERE 근무일 >= "2025-08-01" AND 근무일 < "2025-11-01"')
deleted = cursor.rowcount
conn.commit()
conn.close()

print(f'\n✅ 삭제 완료: {deleted:,}건\n')

# 2. 파일 로드 및 변환
print("=== 2. 데이터 로드 및 변환 ===\n")

logger.info(f"파일 로드: {file_path}")
df = pd.read_excel(file_path)
logger.info(f"원본 데이터: {len(df):,}행 x {len(df.columns)}컬럼")

logger.info("데이터 변환 시작...")
df_transformed = DataTransformers.transform_claim_data(df)
logger.info(f"변환 완료: {len(df_transformed):,}행 x {len(df_transformed.columns)}컬럼")

# 3. DB 업로드
print("\n=== 3. DB 업로드 ===\n")
db_manager = DatabaseManager(db_path)

try:
    rows_inserted = db_manager.insert_dataframe('claim_data', df_transformed, if_exists='append')
    logger.info(f"✅ 업로드 완료: {rows_inserted:,}행")

    # 4. 검증
    print("\n=== 4. 업로드 검증 ===\n")
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    for month in ['2025-08', '2025-09', '2025-10']:
        cursor.execute("SELECT COUNT(*) FROM claim_data WHERE 근무일 LIKE ?", (f'{month}%',))
        count = cursor.fetchone()[0]
        print(f"{month}: {count:,}건")

    # 근무시간 통계 확인
    print("\n=== 5. 근무시간 통계 ===\n")
    cursor.execute("""
        SELECT
            AVG(근무시간) as avg_hours,
            MIN(근무시간) as min_hours,
            MAX(근무시간) as max_hours
        FROM claim_data
        WHERE 근무일 >= '2025-08-01' AND 근무일 < '2025-11-01'
    """)
    avg, min_h, max_h = cursor.fetchone()
    print(f"평균: {avg:.2f} 시간")
    print(f"최소: {min_h:.2f} 시간")
    print(f"최대: {max_h:.2f} 시간")

    db_manager.close()

except Exception as e:
    logger.error(f"❌ 업로드 실패: {e}")
    import traceback
    traceback.print_exc()
    db_manager.close()
    sys.exit(1)

print("\n=== ✅ 완료 ===")
