import sqlite3
import sys

sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect(r'C:\Project\SambioHRR\sambio_human.db')
cursor = conn.cursor()

print("=== 조직 정보를 가져올 수 있는 테이블 확인 ===\n")

# 1. organization_master 테이블 확인
print("1. organization_master 테이블")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='organization_master'")
if cursor.fetchone():
    cursor.execute("PRAGMA table_info(organization_master)")
    cols = cursor.fetchall()
    print(f"   ✓ 존재 ({len(cols)}개 컬럼)")
    for col in cols[:10]:
        print(f"      - {col[1]}")

    cursor.execute("SELECT COUNT(*), COUNT(DISTINCT 사번) FROM organization_master")
    total, unique_empno = cursor.fetchone()
    print(f"   데이터: {total:,}행, {unique_empno:,}명")
else:
    print("   ✗ 존재하지 않음")

# 2. employee_info 테이블 확인
print("\n2. employee_info 테이블")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='employee_info'")
if cursor.fetchone():
    cursor.execute("PRAGMA table_info(employee_info)")
    cols = cursor.fetchall()
    print(f"   ✓ 존재 ({len(cols)}개 컬럼)")
    for col in cols[:10]:
        print(f"      - {col[1]}")

    cursor.execute("SELECT COUNT(*), COUNT(DISTINCT 사번) FROM employee_info")
    total, unique_empno = cursor.fetchone()
    print(f"   데이터: {total:,}행, {unique_empno:,}명")
else:
    print("   ✗ 존재하지 않음")

# 3. 새 claim_data 파일의 샘플 사번으로 조직 정보 조회 테스트
print("\n3. 조직 정보 조회 테스트 (샘플 사번)")
import pandas as pd
file_path = r"C:\Users\haans\Downloads\Sambio 8-10 Data\25년도 8-10 Claim Data.xlsx"
df = pd.read_excel(file_path, nrows=5)
sample_empnos = df['사번'].unique()[:3]

print(f"   샘플 사번: {list(sample_empnos)}")

for empno in sample_empnos:
    print(f"\n   사번 {empno}:")

    # organization_master에서 조회
    cursor.execute("""
        SELECT 사번, 이름, 센터, 담당, 팀, 그룹, 직급
        FROM organization_master
        WHERE 사번 = ?
        LIMIT 1
    """, (int(empno),))

    row = cursor.fetchone()
    if row:
        print(f"      organization_master: {row[1]} / {row[2]} / {row[3] or '-'} / {row[4]} / {row[5] or '-'} / {row[6]}")
    else:
        print(f"      organization_master: ✗ 없음")

    # employee_info에서 조회
    cursor.execute("""
        SELECT 사번, 이름, 센터, 담당, 팀, 그룹, 직급
        FROM employee_info
        WHERE 사번 = ?
        LIMIT 1
    """, (int(empno),))

    row = cursor.fetchone()
    if row:
        print(f"      employee_info: {row[1]} / {row[2]} / {row[3] or '-'} / {row[4]} / {row[5] or '-'} / {row[6]}")
    else:
        print(f"      employee_info: ✗ 없음")

conn.close()

print("\n=== 조직 정보 테이블 확인 완료 ===")
