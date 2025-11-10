"""
10월 dar_count와 total_count 확인
"""
import sqlite3

db_path = r'C:\Project\SambioHRR\sambio_human.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('='*80)
print('10월 센터별 DAR 커버리지 확인')
print('='*80)

# precompute-stats.ts의 adjusted CTE 로직 재현
cursor.execute("""
    SELECT
        e.center_name,
        COUNT(dar.employee_id) as dar_count,
        COUNT(*) as total_count,
        ROUND(COUNT(dar.employee_id) * 100.0 / COUNT(*), 1) as coverage_pct
    FROM claim_data c
    LEFT JOIN daily_analysis_results dar
        ON dar.employee_id = CAST(c.사번 AS TEXT)
        AND DATE(dar.analysis_date) = DATE(c.근무일)
    JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
    WHERE DATE(c.근무일) BETWEEN '2025-10-01' AND '2025-10-31'
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND c.사번 NOT IN ('20190287', '20200207', '20120150')
    GROUP BY e.center_name
    ORDER BY e.center_name
""")

centers = cursor.fetchall()
print(f'\n센터별 커버리지:')
print(f'{"센터명":<25} {"DAR 건수":>10} {"전체 건수":>10} {"커버리지":>10} {"50% 이상":>8}')
print('-'*80)

for center, dar_count, total_count, coverage in centers:
    passed = 'YES' if dar_count >= total_count * 0.5 else 'NO'
    print(f'{center:<25} {dar_count:>10,} {total_count:>10,} {coverage:>9.1f}% {passed:>8}')

# 전체 통계
cursor.execute("""
    SELECT
        COUNT(dar.employee_id) as dar_count,
        COUNT(*) as total_count
    FROM claim_data c
    LEFT JOIN daily_analysis_results dar
        ON dar.employee_id = CAST(c.사번 AS TEXT)
        AND DATE(dar.analysis_date) = DATE(c.근무일)
    JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
    WHERE DATE(c.근무일) BETWEEN '2025-10-01' AND '2025-10-31'
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND c.사번 NOT IN ('20190287', '20200207', '20120150')
""")

dar_count, total_count = cursor.fetchone()
coverage = dar_count * 100.0 / total_count if total_count > 0 else 0

print('-'*80)
print(f'{"전체":<25} {dar_count:>10,} {total_count:>10,} {coverage:>9.1f}%')

conn.close()

print('\n'+'='*80)
print('완료!')
print('='*80)
