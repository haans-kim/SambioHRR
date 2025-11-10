"""
7-9월 Ground Rules 분석 진행 상황 확인
"""
import sqlite3

db_path = r'C:\Project\SambioHRR\sambio_human.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('='*80)
print('7-9월 Ground Rules 분석 진행 상황')
print('='*80)

months = [
    ('2025-07', '7월'),
    ('2025-08', '8월'),
    ('2025-09', '9월')
]

for month, name in months:
    print(f'\n[{name}]')

    # daily_analysis_results 확인
    cursor.execute("""
        SELECT COUNT(*)
        FROM daily_analysis_results
        WHERE strftime('%Y-%m', analysis_date) = ?
    """, (month,))
    dar_count = cursor.fetchone()[0]

    # claim_data 확인 (예상 건수)
    cursor.execute("""
        SELECT COUNT(*)
        FROM claim_data
        WHERE strftime('%Y-%m', 근무일) = ?
        AND 실제근무시간 IS NOT NULL
        AND 실제근무시간 > 0
    """, (month,))
    claim_count = cursor.fetchone()[0]

    # 센터별 분포
    cursor.execute("""
        SELECT e.center_name, COUNT(*) as cnt
        FROM daily_analysis_results dar
        JOIN employees e ON e.employee_id = dar.employee_id
        WHERE strftime('%Y-%m', dar.analysis_date) = ?
        GROUP BY e.center_name
        ORDER BY cnt DESC
        LIMIT 3
    """, (month,))
    top_centers = cursor.fetchall()

    progress = (dar_count / claim_count * 100) if claim_count > 0 else 0

    print(f'  분석 완료: {dar_count:,}건')
    print(f'  예상 건수: {claim_count:,}건')
    print(f'  진행률: {progress:.1f}%')

    if top_centers:
        print(f'  상위 센터:')
        for center, cnt in top_centers:
            print(f'    - {center}: {cnt:,}건')

    if dar_count == 0:
        print(f'  [대기] 분석 시작 안됨')
    elif progress < 100:
        print(f'  [진행중] 분석 진행 중...')
    else:
        print(f'  [완료] 분석 완료!')

conn.close()

print('\n'+'='*80)
print('완료!')
print('='*80)
