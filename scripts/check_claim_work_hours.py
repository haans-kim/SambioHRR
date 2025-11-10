import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')
from core.db_manager import DatabaseManager

db_path = r'C:\Project\SambioHRR\sambio_human.db'
db = DatabaseManager(db_path)
conn = db.get_connection()
cursor = conn.cursor()

print('=== 1-6월 claim_data 근무시간 패턴 확인 ===\n')

# 1. 공휴일/주말 패턴 확인
print('1. 날짜별 평균 근무시간 (1-6월)')
cursor.execute("""
    SELECT 
        날짜,
        COUNT(*) as 직원수,
        AVG(근무시간) as 평균근무시간,
        SUM(CASE WHEN 근무시간 = 0 THEN 1 ELSE 0 END) as 근무시간0명,
        SUM(CASE WHEN 근무시간 = 8 THEN 1 ELSE 0 END) as 근무시간8명,
        SUM(CASE WHEN 휴가_연차 > 0 THEN 1 ELSE 0 END) as 휴가자수
    FROM claim_data
    WHERE 날짜 >= '2025-01-01' AND 날짜 <= '2025-01-31'
    GROUP BY 날짜
    ORDER BY 날짜
""")

for row in cursor.fetchall():
    날짜, 직원수, 평균근무시간, 근무시간0명, 근무시간8명, 휴가자수 = row
    print(f'{날짜}: {직원수}명, 평균 {평균근무시간:.1f}h, 0h={근무시간0명}명, 8h={근무시간8명}명, 휴가={휴가자수}명')

print('\n2. 특정 직원의 1월 근무시간 상세')
cursor.execute("""
    SELECT 날짜, 근무시간, 휴가_연차, 출장, leave_type
    FROM claim_data
    WHERE 사번 = (SELECT 사번 FROM claim_data WHERE 날짜 >= '2025-01-01' LIMIT 1)
    AND 날짜 >= '2025-01-01' AND 날짜 <= '2025-01-31'
    ORDER BY 날짜
""")

for row in cursor.fetchall():
    print(f'{row[0]}: 근무={row[1]}h, 휴가={row[2]}h, 출장={row[3]}h, 휴가타입={row[4]}')

print('\n3. 근무시간 분포 (1-6월 전체)')
cursor.execute("""
    SELECT 
        근무시간,
        COUNT(*) as 건수,
        COUNT(DISTINCT 사번) as 직원수,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM claim_data WHERE 날짜 >= '2025-01-01' AND 날짜 <= '2025-06-30'), 2) as 비율
    FROM claim_data
    WHERE 날짜 >= '2025-01-01' AND 날짜 <= '2025-06-30'
    GROUP BY 근무시간
    ORDER BY 근무시간
""")

for row in cursor.fetchall():
    print(f'근무시간 {row[0]}h: {row[1]:,}건 ({row[2]}명, {row[3]}%)')

db.close()
