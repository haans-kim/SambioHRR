import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

import pandas as pd
from handlers.data_transformers import DataTransformers

# 새 파일 로드
file_path = r"C:\Users\haans\Downloads\Sambio 8-10 Data\25년도 8-10 Claim Data.xlsx"
print(f"=== 파일 로드: {file_path.split(chr(92))[-1]} ===")

df = pd.read_excel(file_path, nrows=10)
print(f"\n원본 Excel 컬럼 ({len(df.columns)}개):")
for i, col in enumerate(df.columns, 1):
    print(f"  {i}. {col}")

# 변환 적용
print(f"\n=== 데이터 변환 적용 ===")
df_transformed = DataTransformers.transform_claim_data(df)

print(f"\n변환 후 컬럼 ({len(df_transformed.columns)}개):")
for i, col in enumerate(df_transformed.columns, 1):
    print(f"  {i}. {col}")

# DB 테이블 컬럼과 비교
import sqlite3
conn = sqlite3.connect(r'C:\Project\SambioHRR\sambio_human.db')
cursor = conn.cursor()
info = cursor.execute('PRAGMA table_info(claim_data)').fetchall()
db_cols = set([col[1] for col in info])
df_cols = set(df_transformed.columns)

print(f"\n=== 차이점 ===")
print(f"DataFrame에만 있는 컬럼: {df_cols - db_cols}")
print(f"DB에만 있는 컬럼: {db_cols - df_cols}")

conn.close()
