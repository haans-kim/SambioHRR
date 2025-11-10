import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

import pandas as pd
from core.db_manager import DatabaseManager

# 10월 인력구성 파일 로드
file_path = r'C:\Users\haans\Downloads\Sambio 8-10 Data\삼바 10월 인력 구성.xlsx'
df_oct = pd.read_excel(file_path)

# Unnamed 컬럼 제거
df_oct = df_oct.drop(columns=[col for col in df_oct.columns if 'Unnamed' in str(col)], errors='ignore')

print('=== 10월 인력구성 데이터 ===')
print(f'총 인원: {len(df_oct):,}명')
print(f'컬럼: {list(df_oct.columns)}')
print()
print('샘플 (처음 5명):')
for idx, row in df_oct.head(5).iterrows():
    print(f'  {list(row.values)}')
print()

# DB 연결
db_path = r'C:\Project\SambioHRR\sambio_human.db'
db_manager = DatabaseManager(db_path)
conn = db_manager.get_connection()
cursor = conn.cursor()

# employees 테이블 확인
cursor.execute('PRAGMA table_info(employees)')
db_columns = [col[1] for col in cursor.fetchall()]
print(f'employees 테이블 컬럼 ({len(db_columns)}개):')
print(f'  {db_columns}')
print()

# 기존 사번 목록
cursor.execute('SELECT employee_id FROM employees')
existing_employees = set()
for row in cursor.fetchall():
    if row[0]:
        try:
            existing_employees.add(str(int(float(row[0]))))
        except:
            pass

print(f'기존 employees 수: {len(existing_employees):,}명')

# 10월 인력구성 사번 목록 (두 번째 컬럼이 사번)
oct_employees = set()
oct_data_map = {}  # 사번 -> 전체 데이터

for idx, row in df_oct.iterrows():
    emp_no_raw = row.iloc[1]  # 두 번째 컬럼 (사번)
    if pd.notna(emp_no_raw):
        try:
            emp_no = str(int(float(emp_no_raw)))
            oct_employees.add(emp_no)
            oct_data_map[emp_no] = row.values
        except:
            pass

print(f'10월 인력구성 수: {len(oct_employees):,}명')
print()

# 신규 입사자 확인
new_employees = oct_employees - existing_employees
print(f'[신규] 신규 입사자: {len(new_employees):,}명')

# 퇴사자 확인
left_employees = existing_employees - oct_employees
print(f'[퇴사] 퇴사자: {len(left_employees):,}명')
print()

if new_employees:
    print('=' * 80)
    print('신규 입사자 상세 정보:')
    print('=' * 80)
    for i, emp_no in enumerate(sorted(new_employees)[:20], 1):
        data = oct_data_map.get(emp_no, [])
        print(f'{i}. 사번: {emp_no}')
        print(f'   전체 데이터: {data}')
        print()

    if len(new_employees) > 20:
        print(f'... 외 {len(new_employees) - 20}명')

db_manager.close()
