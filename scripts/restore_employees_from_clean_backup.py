"""
깨끗한 백업 DB에서 employees 테이블 복원 + 신규 입사자 추가
- D:\sambio_human.db (담당 0명, 깨끗한 조직 구조)에서 복원
- 10월 엑셀에서 신규 입사자 추가 (센터 컬럼 사용)
"""
import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

import pandas as pd
import sqlite3
from core.db_manager import DatabaseManager

print('='*80)
print('employees 테이블 복원 (깨끗한 백업 + 신규 입사자)')
print('='*80)

# DB 경로
current_db = r'C:\Project\SambioHRR\sambio_human.db'
clean_backup_db = r'D:\sambio_human.db'
excel_file = r'C:\Users\haans\Downloads\Sambio 8-10 Data\삼바 10월 인력 구성.xlsx'

# 1. 깨끗한 백업 DB에서 기존 직원 데이터 로드
print('\n[1단계] 깨끗한 백업 DB에서 기존 직원 로드...')
backup_conn = sqlite3.connect(clean_backup_db)
df_backup = pd.read_sql('SELECT * FROM employees', backup_conn)
backup_conn.close()
print(f'  백업 DB 직원 수: {len(df_backup):,}명')

# center_name에 담당이 있는지 재확인
wrong_in_backup = df_backup[df_backup['center_name'].str.contains('담당', na=False)]
print(f'  백업 DB의 담당 포함 직원: {len(wrong_in_backup)}명')

# 2. 10월 엑셀 로드
print('\n[2단계] 10월 인력 구성 엑셀 로드...')
df_excel = pd.read_excel(excel_file)
df_excel = df_excel.drop(columns=[col for col in df_excel.columns if 'Unnamed' in str(col)], errors='ignore')
print(f'  엑셀 직원 수: {len(df_excel):,}명')

# 3. 백업 DB에 없는 신규 입사자 찾기
print('\n[3단계] 신규 입사자 확인...')
backup_employee_ids = set(df_backup['employee_id'].astype(str))

new_employees = []
for idx, row in df_excel.iterrows():
    emp_no_raw = row['사번']
    if pd.notna(emp_no_raw):
        try:
            emp_no = str(int(float(emp_no_raw)))

            # 백업 DB에 없는 직원만
            if emp_no not in backup_employee_ids:
                employee_name = row['성명'] if pd.notna(row['성명']) else None
                position = row['직급명'] if pd.notna(row['직급명']) else None

                # 센터 컬럼(6번) 사용
                center_name = row['센터'] if pd.notna(row['센터']) else None
                team_name = row['팀'] if pd.notna(row['팀']) else None
                group_name = row['그룹'] if pd.notna(row['그룹']) else None

                center_id = center_name
                team_id = team_name
                group_id = group_name

                # job_grade 추출
                job_grade = None
                if position:
                    import re
                    match = re.match(r'^([GSEP]\d+)', position)
                    if match:
                        job_grade = match.group(1)

                new_employees.append({
                    'employee_id': emp_no,
                    'employee_name': employee_name,
                    'center_id': center_id,
                    'center_name': center_name,
                    'group_id': group_id,
                    'group_name': group_name,
                    'team_id': team_id,
                    'team_name': team_name,
                    'position': position,
                    'job_grade': job_grade
                })
        except Exception as e:
            print(f'  [경고] Row {idx} 처리 오류: {e}')
            continue

print(f'  신규 입사자: {len(new_employees):,}명')

if new_employees:
    print('\n  샘플 (처음 5명):')
    for i, emp in enumerate(new_employees[:5], 1):
        print(f'    {i}. {emp["employee_id"]} {emp["employee_name"]} - 센터: {emp["center_name"]}, 팀: {emp["team_name"]}')

# 4. 백업 데이터 + 신규 입사자 합치기
print('\n[4단계] 최종 데이터 생성...')
df_new_employees = pd.DataFrame(new_employees)
df_final = pd.concat([df_backup, df_new_employees], ignore_index=True)
print(f'  최종 직원 수: {len(df_final):,}명 (기존 {len(df_backup):,} + 신규 {len(new_employees):,})')

# 5. 현재 DB의 employees 테이블 교체
print('\n[5단계] employees 테이블 교체...')
db_manager = DatabaseManager(current_db)
conn = db_manager.get_connection()

# 기존 테이블 삭제 후 재생성 (DROP 방식)
conn.execute('DROP TABLE IF EXISTS employees')
print('  기존 employees 테이블 삭제 완료')

# 새 데이터로 테이블 생성
rows_inserted = db_manager.insert_dataframe('employees', df_final, if_exists='replace')
print(f'  [OK] 새 테이블 생성 완료: {rows_inserted:,}명')

# 6. 검증
print('\n[6단계] 검증...')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM employees')
total = cursor.fetchone()[0]
print(f'  employees 테이블 총 인원: {total:,}명')

cursor.execute("SELECT COUNT(*) FROM employees WHERE center_name LIKE '%담당%'")
wrong_count = cursor.fetchone()[0]
if wrong_count > 0:
    cursor.execute("SELECT DISTINCT center_name FROM employees WHERE center_name LIKE '%담당%' ORDER BY center_name")
    divisions_in_center = cursor.fetchall()
    print(f'  [경고] center_name에 담당이 여전히 있음: {len(divisions_in_center)}개')
    for div in divisions_in_center:
        cursor.execute("SELECT COUNT(*) FROM employees WHERE center_name = ?", (div[0],))
        count = cursor.fetchone()[0]
        print(f'    - {div[0]}: {count}명')
else:
    print('  [OK] center_name에 담당 없음')

cursor.execute('SELECT center_name, COUNT(*) FROM employees GROUP BY center_name ORDER BY center_name')
center_counts = cursor.fetchall()
print(f'\n  센터별 인원:')
for center, count in center_counts:
    print(f'    - {center}: {count}명')

db_manager.close()

print('\n'+'='*80)
print('완료!')
print('='*80)
