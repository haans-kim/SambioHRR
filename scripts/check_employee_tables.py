import sqlite3
import sys

sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect(r'C:\Project\SambioHRR\sambio_human.db')
cursor = conn.cursor()

print("=== 직원 정보가 있는 테이블 찾기 ===\n")

# 사번 컬럼이 있는 테이블 찾기
cursor.execute("""
    SELECT m.name as table_name
    FROM sqlite_master m
    WHERE m.type = 'table'
    AND m.name NOT LIKE 'sqlite_%'
""")

tables = cursor.fetchall()

employee_tables = []
for (table_name,) in tables:
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        cols = [col[1] for col in cursor.fetchall()]

        if '사번' in cols:
            cursor.execute(f"SELECT COUNT(DISTINCT 사번) FROM {table_name}")
            count = cursor.fetchone()[0]
            if count > 0:
                employee_tables.append((table_name, cols, count))
    except:
        pass

print(f"사번 컬럼이 있는 테이블: {len(employee_tables)}개\n")

for table_name, cols, emp_count in employee_tables[:10]:
    print(f"테이블: {table_name}")
    print(f"  사번 수: {emp_count:,}명")

    # 조직 관련 컬럼 찾기
    org_cols = [c for c in cols if c in ['이름', '센터', '담당', '팀', '그룹', '직급', '부서', '직책']]
    if org_cols:
        print(f"  조직 컬럼: {', '.join(org_cols)}")

    print()

# 가장 적합한 테이블 찾기
print("\n=== 조직 정보가 가장 완전한 테이블 ===")
best_table = None
best_score = 0

for table_name, cols, emp_count in employee_tables:
    score = 0
    required_cols = ['이름', '센터', '팀', '직급']
    for col in required_cols:
        if col in cols:
            score += 1

    if score > best_score:
        best_score = score
        best_table = table_name

if best_table:
    print(f"✓ 추천 테이블: {best_table} (점수: {best_score}/4)")

    # 샘플 데이터 확인
    print(f"\n샘플 데이터:")
    import pandas as pd
    file_path = r"C:\Users\haans\Downloads\Sambio 8-10 Data\25년도 8-10 Claim Data.xlsx"
    df = pd.read_excel(file_path, nrows=3)
    sample_empnos = df['사번'].unique()[:2]

    for empno in sample_empnos:
        cursor.execute(f"SELECT * FROM {best_table} WHERE 사번 = ? LIMIT 1", (int(empno),))
        row = cursor.fetchone()
        if row:
            cursor.execute(f"PRAGMA table_info({best_table})")
            col_names = [col[1] for col in cursor.fetchall()]
            print(f"\n  사번 {empno}:")
            for i, col_name in enumerate(col_names[:10]):
                print(f"    {col_name}: {row[i]}")
else:
    print("✗ 적합한 테이블을 찾을 수 없습니다")

conn.close()
