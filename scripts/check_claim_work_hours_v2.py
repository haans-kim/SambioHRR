import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')
from core.db_manager import DatabaseManager

db_path = r'C:\Project\SambioHRR\sambio_human.db'
db = DatabaseManager(db_path)
conn = db.get_connection()
cursor = conn.cursor()

print('=== 1-6월 claim_data 근무시간 패턴 확인 ===\n')

# 1. 1월 날짜별 평균 근무시간
print('1. 1월 날짜별 평균 근무시간')
cursor.execute("""
    SELECT 
        근무일자,
        COUNT(*) as 직원수,
        AVG(CAST(근무시간 AS FLOAT)) as 평균근무시간,
        SUM(CASE WHEN CAST(근무시간 AS FLOAT) = 0 THEN 1 ELSE 0 END) as 근무시간0명,
        SUM(CASE WHEN CAST(근무시간 AS FLOAT) = 8 THEN 1 ELSE 0 END) as 근무시간8명,
        SUM(CASE WHEN 휴가_연차 > 0 THEN 1 ELSE 0 END) as 휴가자수
    FROM claim_data
    WHERE 근무일자 >= '2025-01-01' AND 근무일자 <= '2025-01-31'
    GROUP BY 근무일자
    ORDER BY 근무일자
""")

for row in cursor.fetchall():
    날짜, 직원수, 평균근무시간, 근무시간0명, 근무시간8명, 휴가자수 = row
    print(f'{날짜}: {직원수}명, 평균 {평균근무시간:.1f}h, 0h={근무시간0명}명, 8h={근무시간8명}명, 휴가={휴가자수}명')

print('\n2. 근무시간 분포 (1-6월 전체)')
cursor.execute("""
    SELECT 
        근무시간,
        COUNT(*) as 건수,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM claim_data WHERE 근무일자 >= '2025-01-01' AND 근무일자 <= '2025-06-30'), 2) as 비율
    FROM claim_data
    WHERE 근무일자 >= '2025-01-01' AND 근무일자 <= '2025-06-30'
    GROUP BY 근무시간
    ORDER BY CAST(근무시간 AS FLOAT)
""")

for row in cursor.fetchall():
    print(f'근무시간 {row[0]}h: {row[1]:,}건 ({row[2]}%)')

print('\n3. 주말/공휴일 추정 (근무시간=0인 날)')
cursor.execute("""
    SELECT 근무일자, COUNT(*) as 직원수
    FROM claim_data
    WHERE 근무일자 >= '2025-01-01' AND 근무일자 <= '2025-06-30'
    AND CAST(근무시간 AS FLOAT) = 0
    GROUP BY 근무일자
    HAVING COUNT(*) > 1000
    ORDER BY 근무일자
""")

print('근무시간=0인 직원이 1000명 이상인 날 (공휴일/주말 추정):')
for row in cursor.fetchall():
    print(f'  {row[0]}: {row[1]:,}명')

db.close()
