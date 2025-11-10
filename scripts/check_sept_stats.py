"""
9월 통계 확인
"""
import sqlite3

db_path = r'C:\Project\SambioHRR\sambio_human.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('='*80)
print('9월 monthly_center_stats 확인')
print('='*80)

cursor.execute("""
    SELECT center_name, weekly_claimed_hours, weekly_adjusted_hours
    FROM monthly_center_stats
    WHERE month = '2025-09'
    ORDER BY center_name
""")

results = cursor.fetchall()
print(f'\n{"센터명":<25} {"주간 근태시간":>15} {"주간 근무추정시간":>20}')
print('-'*80)
for center, claimed, adjusted in results:
    claimed_str = f'{claimed}h' if claimed is not None else 'NULL'
    adjusted_str = f'{adjusted}h' if adjusted is not None else 'NULL'
    print(f'{center:<25} {claimed_str:>15} {adjusted_str:>20}')

print(f'\n총 {len(results)}건')

# daily_analysis_results에 9월 데이터 확인
cursor.execute("""
    SELECT COUNT(*) as count,
           COUNT(ground_rules_work_hours) as has_gr
    FROM daily_analysis_results
    WHERE strftime('%Y-%m', analysis_date) = '2025-09'
""")
dar_count, has_gr = cursor.fetchone()
print(f'\n9월 daily_analysis_results: {dar_count}건 (Ground Rules: {has_gr}건)')

conn.close()

print('\n'+'='*80)
print('완료!')
print('='*80)
