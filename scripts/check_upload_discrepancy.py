import pandas as pd
import sqlite3
import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = r"C:\Users\haans\Downloads\Sambio 8-10 Data\25년도 8-10 Claim Data.xlsx"

print("=== 업로드 데이터 불일치 원인 분석 ===\n")

# 엑셀 파일 로드
df = pd.read_excel(file_path)
print(f"엑셀 전체: {len(df):,}건")

# 데이터 변환 시뮬레이션
print("\n1. 데이터 정제 과정:")

# NULL 데이터 확인
null_count = df.isnull().any(axis=1).sum()
print(f"  NULL 값 있는 행: {null_count:,}건")

# 사번이 없는 데이터
no_empno = df['사번'].isna().sum()
print(f"  사번 없는 행: {no_empno:,}건")

# 근무일이 없는 데이터
no_date = df['근무일'].isna().sum()
print(f"  근무일 없는 행: {no_date:,}건")

# DB 연결
conn = sqlite3.connect(r'C:\Project\SambioHRR\sambio_human.db')

print("\n2. DB 업로드 데이터 확인:")

# uploaded_at이 최근인 데이터 확인
cursor = conn.cursor()
cursor.execute("""
    SELECT
        DATE(uploaded_at) as upload_date,
        COUNT(*) as count,
        MIN(근무일) as min_date,
        MAX(근무일) as max_date
    FROM claim_data
    WHERE uploaded_at >= date('now', '-2 days')
    GROUP BY DATE(uploaded_at)
    ORDER BY upload_date DESC
""")

uploads = cursor.fetchall()
print("  최근 업로드:")
for date, count, min_d, max_d in uploads:
    print(f"    {date}: {count:,}건 (날짜 범위: {min_d} ~ {max_d})")

# 8-9월만 업로드되고 10월이 안 된 이유 확인
print("\n3. 10월 데이터가 업로드 안 된 이유:")

# 엑셀에서 10월 데이터만 추출
df['근무일_str'] = df['근무일'].astype(str)
df_oct = df[df['근무일_str'].str.startswith('202510')]

print(f"  엑셀 10월 데이터: {len(df_oct):,}건")
print(f"  샘플 10월 데이터:")
for idx, row in df_oct.head(3).iterrows():
    print(f"    근무일: {row['근무일']}, 사번: {row['사번']}, 성명: {row['성명']}")

# 변환 후 형식 확인
from datetime import datetime

def parse_date(date_val):
    if pd.isna(date_val):
        return None
    date_str = str(date_val).strip()

    if '-' in date_str and len(date_str) >= 10:
        return date_str if ' ' in date_str else date_str + ' 00:00:00'

    if len(date_str) == 8 and date_str.isdigit():
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]} 00:00:00"

    return None

df_oct_sample = df_oct.head(5).copy()
df_oct_sample['근무일_변환'] = df_oct_sample['근무일'].apply(parse_date)

print(f"\n  변환 후 형식:")
for idx, row in df_oct_sample.iterrows():
    print(f"    {row['근무일']} → {row['근무일_변환']}")

conn.close()

print("\n=== 분석 완료 ===")
