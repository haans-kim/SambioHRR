"""
월별 daily_analysis_results 확인
"""
import sqlite3

db_path = r'C:\Project\SambioHRR\sambio_human.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('='*80)
print('월별 daily_analysis_results 현황')
print('='*80)

cursor.execute("""
    SELECT strftime('%Y-%m', analysis_date) as month, COUNT(*) as count
    FROM daily_analysis_results
    GROUP BY month
    ORDER BY month DESC
    LIMIT 10
""")

results = cursor.fetchall()
print(f'\n{"월":^10} {"레코드 수":>15}')
print('-'*80)
for month, count in results:
    print(f'{month:^10} {count:>15,}')

conn.close()

print('\n'+'='*80)
print('완료!')
print('='*80)
