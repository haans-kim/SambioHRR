import pandas as pd
import sys

# UTF-8 출력 설정
sys.stdout.reconfigure(encoding='utf-8')

file_path = r"C:\Users\haans\Downloads\Sambio 8-10 Data\25년도 8-10 Claim Data.xlsx"

print("=== 새 파일 (8-10월) ===")
df_new = pd.read_excel(file_path, nrows=0)
print(f"컬럼 개수: {len(df_new.columns)}")
print("컬럼 목록:")
for i, col in enumerate(df_new.columns, 1):
    print(f"  {i}. {col}")

print("\n=== 기존 claim_data 테이블 ===")
import sqlite3
conn = sqlite3.connect(r'C:\Project\SambioHRR\sambio_human.db')
cursor = conn.cursor()
info = cursor.execute('PRAGMA table_info(claim_data)').fetchall()
print(f"컬럼 개수: {len(info)}")
print("컬럼 목록:")
for i, col in enumerate(info, 1):
    print(f"  {i}. {col[1]}")
conn.close()

print("\n=== 차이점 분석 ===")
new_cols = set(df_new.columns)
db_cols = set([col[1] for col in info])

print(f"\n새 파일에만 있는 컬럼: {new_cols - db_cols}")
print(f"DB에만 있는 컬럼: {db_cols - new_cols}")
