import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = r"C:\Users\haans\Downloads\Sambio 8-10 Data\25년도 8-10 Claim Data.xlsx"

print("=== 엑셀 파일 월별 데이터 확인 ===\n")

df = pd.read_excel(file_path)
print(f"전체 데이터: {len(df):,}건\n")

# 근무일을 문자열로 변환하고 월 추출
df['근무일_str'] = df['근무일'].astype(str)
df['월'] = df['근무일_str'].str[:6]  # YYYYMM

months = df['월'].value_counts().sort_index()

print("월별 데이터:")
for month, count in months.items():
    print(f"  {month}: {count:,}건")

# DB와 비교
import sqlite3
conn = sqlite3.connect(r'C:\Project\SambioHRR\sambio_human.db')
cursor = conn.cursor()

print("\n=== DB claim_data 월별 데이터 ===\n")
for month in ['2025-08', '2025-09', '2025-10']:
    cursor.execute("SELECT COUNT(*) FROM claim_data WHERE 근무일 LIKE ?", (f'{month}%',))
    count = cursor.fetchone()[0]
    print(f"  {month}: {count:,}건")

conn.close()
