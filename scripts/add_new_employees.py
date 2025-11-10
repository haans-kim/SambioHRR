import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

import pandas as pd
from core.db_manager import DatabaseManager

# 10월 인력구성 파일 로드
file_path = r'C:\Users\haans\Downloads\Sambio 8-10 Data\삼바 10월 인력 구성.xlsx'
df_oct = pd.read_excel(file_path)
df_oct = df_oct.drop(columns=[col for col in df_oct.columns if 'Unnamed' in str(col)], errors='ignore')

print('=== 신규 입사자 추가 ===\n')

# DB 연결
db_path = r'C:\Project\SambioHRR\sambio_human.db'
db_manager = DatabaseManager(db_path)
conn = db_manager.get_connection()
cursor = conn.cursor()

# 기존 사번 목록
cursor.execute('SELECT employee_id FROM employees')
existing_employees = set()
for row in cursor.fetchall():
    if row[0]:
        try:
            existing_employees.add(str(int(float(row[0]))))
        except:
            pass

print(f'기존 employees: {len(existing_employees):,}명')

# 10월 Excel 컬럼 구조:
# 0: NO., 1: 사번, 2: 성명, 3: 호봉명, 4: 정규입사일,
# 5: 소속명, 6: 담당, 7: BU, 8: 팀, 9: 그룹, 10: 유닛

# employees 테이블 컬럼:
# employee_id, employee_name, center_id, center_name,
# group_id, group_name, team_id, team_name, position, job_grade

new_records = []
for idx, row in df_oct.iterrows():
    emp_no_raw = row.iloc[1]  # 사번
    if pd.notna(emp_no_raw):
        try:
            emp_no = str(int(float(emp_no_raw)))

            # 신규 입사자만 처리
            if emp_no not in existing_employees:
                employee_name = row.iloc[2] if pd.notna(row.iloc[2]) else None  # 성명
                position = row.iloc[3] if pd.notna(row.iloc[3]) else None  # 호봉명

                # 조직 정보 (Excel에서 가져옴)
                center_name = row.iloc[7] if pd.notna(row.iloc[7]) else None  # BU -> center_name
                team_name = row.iloc[8] if pd.notna(row.iloc[8]) else None  # 팀
                group_name = row.iloc[9] if pd.notna(row.iloc[9]) else None  # 그룹

                # ID는 name과 동일하게 설정 (기존 데이터 패턴 유지)
                center_id = center_name
                team_id = team_name
                group_id = group_name

                # job_grade 추출 (호봉명에서 G1, S2, E3 등 추출)
                job_grade = None
                if position:
                    # "G3(Lead Specialist)" -> "G3"
                    # "S4(Principal Scientist)" -> "S4"
                    import re
                    match = re.match(r'^([GSEP]\d+)', position)
                    if match:
                        job_grade = match.group(1)

                new_records.append({
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
            print(f'Error processing row {idx}: {e}')
            continue

print(f'신규 입사자: {len(new_records):,}명')

if new_records:
    print('\n샘플 (처음 5명):')
    for i, rec in enumerate(new_records[:5], 1):
        print(f'{i}. 사번: {rec["employee_id"]}, 이름: {rec["employee_name"]}, '
              f'직급: {rec["position"]}, job_grade: {rec["job_grade"]}, '
              f'센터: {rec["center_name"]}, 팀: {rec["team_name"]}')

    # DataFrame으로 변환
    df_new = pd.DataFrame(new_records)

    # DB에 추가
    print(f'\n데이터베이스에 {len(df_new):,}명 추가 중...')
    rows_inserted = db_manager.insert_dataframe('employees', df_new, if_exists='append')
    print(f'[OK] 추가 완료: {rows_inserted:,}명')

    # 검증
    cursor.execute('SELECT COUNT(*) FROM employees')
    total = cursor.fetchone()[0]
    print(f'\n최종 employees 수: {total:,}명')
else:
    print('신규 입사자가 없습니다.')

db_manager.close()
print('\n=== 완료 ===')
