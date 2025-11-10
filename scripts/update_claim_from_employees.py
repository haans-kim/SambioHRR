import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

from core.db_manager import DatabaseManager
import pandas as pd

db_path = r'C:\Project\SambioHRR\sambio_human.db'

print('=== claim_data 정보 업데이트 (employees 기준) ===\n')

# DB 연결
db_manager = DatabaseManager(db_path)
conn = db_manager.get_connection()
cursor = conn.cursor()

# 1. employees 테이블에서 사번별 매핑 생성
print('1. employees 테이블에서 사번별 정보 로드 중...')
cursor.execute('''
    SELECT employee_id, employee_name, position, job_grade,
           center_name, team_name, group_name
    FROM employees
''')

employee_map = {}
for row in cursor.fetchall():
    emp_id = str(int(row[0])) if row[0] else None
    if emp_id:
        # job_grade를 employee_level로 변환
        # G1-G4, S1-S4, E1-E4 -> Lv.1-Lv.4
        job_grade = row[3]
        employee_level = None
        if job_grade:
            # "G3" -> "Lv.3", "S4" -> "Lv.4"
            level_num = job_grade[-1]  # 마지막 숫자
            if level_num in '1234':
                employee_level = f'Lv.{level_num}'

        employee_map[emp_id] = {
            'employee_name': row[1],
            'position': row[2],
            'employee_level': employee_level,
            'center_name': row[4],
            'team_name': row[5],
            'group_name': row[6]
        }

print(f'   매핑 생성 완료: {len(employee_map):,}명')

# 2. claim_data에서 업데이트 대상 확인
print('\n2. claim_data 현황 확인...')
cursor.execute('SELECT COUNT(*) FROM claim_data')
total_count = cursor.fetchone()[0]
print(f'   전체 claim_data: {total_count:,}건')

# employee_level이 없는 건수
cursor.execute('SELECT COUNT(*) FROM claim_data WHERE employee_level IS NULL')
null_level_count = cursor.fetchone()[0]
print(f'   employee_level NULL: {null_level_count:,}건')

# 직급이 없는 건수
cursor.execute('SELECT COUNT(*) FROM claim_data WHERE 직급 IS NULL')
null_position_count = cursor.fetchone()[0]
print(f'   직급 NULL: {null_position_count:,}건')

# 3. 업데이트 실행
print('\n3. claim_data 업데이트 중...')

# claim_data 전체 로드 (사번, rowid만)
cursor.execute('SELECT rowid, 사번, 직급, employee_level FROM claim_data')
all_records = cursor.fetchall()

update_count = 0
updates = []

for record in all_records:
    rowid = record[0]
    emp_no = str(int(record[1])) if record[1] else None
    current_position = record[2]
    current_level = record[3]

    if emp_no and emp_no in employee_map:
        emp_info = employee_map[emp_no]

        # 업데이트가 필요한지 확인
        needs_update = False
        new_position = current_position
        new_level = current_level

        # 직급이 없으면 업데이트
        if not current_position and emp_info['position']:
            new_position = emp_info['position']
            needs_update = True

        # employee_level이 없으면 업데이트
        if not current_level and emp_info['employee_level']:
            new_level = emp_info['employee_level']
            needs_update = True

        if needs_update:
            updates.append((new_position, new_level, rowid))
            update_count += 1

print(f'   업데이트 대상: {update_count:,}건')

# 배치 업데이트
if updates:
    print('   데이터베이스 업데이트 중...')
    batch_size = 1000
    for i in range(0, len(updates), batch_size):
        batch = updates[i:i+batch_size]
        cursor.executemany('''
            UPDATE claim_data
            SET 직급 = ?, employee_level = ?
            WHERE rowid = ?
        ''', batch)
        if (i + batch_size) % 10000 == 0:
            print(f'   진행: {i + batch_size:,}/{len(updates):,}')

    conn.commit()
    print(f'   [OK] 업데이트 완료: {update_count:,}건')
else:
    print('   업데이트 대상 없음')

# 4. 결과 확인
print('\n4. 업데이트 결과 확인...')

cursor.execute('SELECT COUNT(*) FROM claim_data WHERE employee_level IS NOT NULL')
level_count = cursor.fetchone()[0]
print(f'   employee_level 있음: {level_count:,}건 ({level_count/total_count*100:.1f}%)')

cursor.execute('SELECT COUNT(*) FROM claim_data WHERE 직급 IS NOT NULL')
position_count = cursor.fetchone()[0]
print(f'   직급 있음: {position_count:,}건 ({position_count/total_count*100:.1f}%)')

# 7월 데이터 샘플 확인
print('\n5. 7월 데이터 샘플 (업데이트 후):')
cursor.execute('''
    SELECT 근무일자, 사번, 성명, 직급, employee_level, 근무시간
    FROM claim_data
    WHERE 근무일자 LIKE '2025-07%'
    LIMIT 10
''')

for row in cursor.fetchall():
    print(f'   근무일: {row[0]}, 사번: {row[1]}, 이름: {row[2]}, '
          f'직급: {row[3]}, employee_level: {row[4]}, 근무시간: {row[5]}')

db_manager.close()
print('\n=== 완료 ===')
