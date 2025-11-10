import sys
import pandas as pd
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')
from core.db_manager import DatabaseManager

db_path = r'C:\Project\SambioHRR\sambio_human.db'
db = DatabaseManager(db_path)
conn = db.get_connection()

print('=== 1-6월 claim_data 근무시간 패턴 확인 ===\n')

# 1월 데이터 조회
df = pd.read_sql_query("""
    SELECT * FROM claim_data
    WHERE substr(근무일자, 1, 7) IN ('2025-01', '2025-02', '2025-03')
    LIMIT 100
""", conn)

print('1. 컬럼 목록:')
print(df.columns.tolist())

print('\n2. 샘플 데이터 (처음 5건):')
print(df.head())

print('\n3. 근무시간 컬럼 값 분포:')
print(df['근무시간'].value_counts().head(10))

print('\n4. 1월 1일 데이터 샘플:')
jan1 = df[df['근무일자'] == '2025-01-01']
print(f'1월 1일 총 {len(jan1)}건')
if len(jan1) > 0:
    print(jan1[['사번', '성명', '근무시간', '휴가_연차', '출장']].head(10))

db.close()
