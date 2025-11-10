import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

from core.db_manager import DatabaseManager
import pandas as pd
from datetime import datetime

file_path = r"C:\Users\haans\Downloads\Sambio 8-10 Data\(참고) 250805_7월 나의 근무현황.xlsx"
db_path = r'C:\Project\SambioHRR\sambio_human.db'

print("=== 7월 근무현황 데이터 업로드 ===\n")

db_manager = DatabaseManager(db_path)
conn = db_manager.get_connection()
cursor = conn.cursor()

# 1. 기존 7월 데이터 삭제
print("1. 기존 7월 데이터 확인 및 삭제")

# 전체 데이터 조회 후 파이썬에서 필터링
cursor.execute("SELECT rowid, * FROM claim_data")
all_data = cursor.fetchall()

july_rowids = []
for row in all_data:
    rowid = row[0]
    date_val = str(row[1])  # 첫번째 컬럼이 근무일자
    if '2025-07' in date_val:
        july_rowids.append(rowid)

print(f"   기존 7월 데이터: {len(july_rowids):,}건")

if july_rowids:
    # 100개씩 나눠서 삭제
    for i in range(0, len(july_rowids), 100):
        batch = july_rowids[i:i+100]
        placeholders = ','.join('?' * len(batch))
        cursor.execute(f"DELETE FROM claim_data WHERE rowid IN ({placeholders})", batch)
    conn.commit()
    print(f"   삭제 완료: {len(july_rowids):,}건")

# 2. 새 7월 데이터 업로드
print("\n2. 새 7월 데이터 업로드")
xl = pd.ExcelFile(file_path)
sheet_name = xl.sheet_names[0]
print(f"   시트: {sheet_name}")

df = pd.read_excel(file_path, sheet_name=sheet_name)

# Unnamed 컬럼 제거
df = df.drop(columns=[col for col in df.columns if 'Unnamed' in str(col)], errors='ignore')

print(f"   읽은 행 수: {len(df):,}행")
print(f"   Excel 컬럼: {list(df.columns)}")

# 첫번째 컬럼이 날짜이므로 인덱스로 접근
date_col = df.columns[0]
print(f"   날짜 컬럼명: {date_col}")

# 근무일자를 DATETIME 형식으로 변환
df[date_col] = pd.to_datetime(df[date_col].astype(str), format='%Y%m%d')

# Excel 컬럼명 → DB 컬럼명 매핑
df = df.rename(columns={
    df.columns[0]: '근무일자',          # 날짜
    df.columns[1]: '사번',               # 사번
    df.columns[2]: '근무시간',           # 근무시간(분)
    df.columns[3]: '시작시간',           # 근무시작
    df.columns[4]: '종료시간',           # 근무종료
    df.columns[5]: '점심시간',           # 점심시간
    df.columns[6]: '휴가',               # 휴가
    df.columns[7]: 'WORKSCHDTYPNM'      # 근무유형구분
})

# uploaded_at 추가
df['uploaded_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

print(f"   매핑 후 컬럼: {list(df.columns)}")

# 데이터베이스에 저장
df.to_sql('claim_data', conn, if_exists='append', index=False)
inserted = len(df)

print(f"   업로드 완료: {inserted:,}건")

# 3. 확인 (전체 조회 후 파이썬에서 필터링)
cursor.execute("SELECT * FROM claim_data")
all_data_after = cursor.fetchall()

july_count = sum(1 for row in all_data_after if '2025-07' in str(row[0]))
print(f"\n3. 업로드 후 7월 데이터: {july_count:,}건")

# 샘플 확인
print("\n샘플 (처음 5건):")
count = 0
for row in all_data_after:
    if '2025-07' in str(row[0]):
        print(f"  근무일자: {row[0]}, 사번: {row[3]}, 근무시간: {row[7]}")
        count += 1
        if count >= 5:
            break

db_manager.close()
print("\n=== 완료 ===")
