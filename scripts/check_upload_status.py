import sqlite3
import sys
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect(r'C:\Project\SambioHRR\sambio_human.db')
cursor = conn.cursor()

print("=== Claim Data 업로드 확인 ===\n")

# 1. 전체 데이터 현황
print("1. claim_data 테이블 현황")
cursor.execute("SELECT COUNT(*) FROM claim_data")
total_count = cursor.fetchone()[0]
print(f"   총 데이터: {total_count:,}건")

# 2. 최근 업로드 확인
cursor.execute("""
    SELECT
        DATE(uploaded_at) as upload_date,
        COUNT(*) as count
    FROM claim_data
    WHERE uploaded_at IS NOT NULL
    GROUP BY DATE(uploaded_at)
    ORDER BY upload_date DESC
    LIMIT 5
""")
recent_uploads = cursor.fetchall()
print(f"\n   최근 업로드 내역:")
for date, count in recent_uploads:
    print(f"     {date}: {count:,}건")

# 3. 8-10월 데이터 확인
print(f"\n2. 8-10월 데이터 확인")
for month in ['2025-08', '2025-09', '2025-10']:
    cursor.execute("""
        SELECT COUNT(*)
        FROM claim_data
        WHERE 근무일 LIKE ?
    """, (f'{month}%',))
    count = cursor.fetchone()[0]
    print(f"   {month}: {count:,}건")

# 4. 통계 테이블 확인
print(f"\n3. 통계 계산 확인 (organization_monthly_stats)")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='organization_monthly_stats'")
if cursor.fetchone():
    cursor.execute("""
        SELECT
            month,
            COUNT(*) as org_count
        FROM organization_monthly_stats
        WHERE month IN ('2025-08', '2025-09', '2025-10')
        GROUP BY month
        ORDER BY month
    """)
    stats = cursor.fetchall()

    if stats:
        print(f"   ✓ 통계 데이터 존재:")
        for month, org_count in stats:
            print(f"     {month}: {org_count:,}개 조직")
    else:
        print(f"   ⚠️  8-10월 통계 데이터 없음")
else:
    print(f"   ✗ organization_monthly_stats 테이블 없음")

# 5. daily_analysis_results 확인
print(f"\n4. 일별 분석 데이터 확인 (daily_analysis_results)")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='daily_analysis_results'")
if cursor.fetchone():
    for month in ['2025-08', '2025-09', '2025-10']:
        cursor.execute("""
            SELECT COUNT(DISTINCT 사번) as employees, COUNT(*) as records
            FROM daily_analysis_results
            WHERE work_date LIKE ?
        """, (f'{month}%',))
        emp_count, record_count = cursor.fetchone()
        print(f"   {month}: {emp_count:,}명, {record_count:,}건")
else:
    print(f"   ✗ daily_analysis_results 테이블 없음")

# 6. 최근 조직 정보 매칭 확인
print(f"\n5. 조직 정보 매칭 확인")
cursor.execute("""
    SELECT
        COUNT(*) as total,
        COUNT(부서) as has_dept,
        COUNT(employee_level) as has_level
    FROM claim_data
    WHERE uploaded_at >= date('now', '-1 day')
""")
total, has_dept, has_level = cursor.fetchone()
if total > 0:
    print(f"   최근 업로드: {total:,}건")
    print(f"   부서 정보: {has_dept:,}건 ({has_dept/total*100:.1f}%)")
    print(f"   직급 레벨: {has_level:,}건 ({has_level/total*100:.1f}%)")
else:
    print(f"   최근 업로드 없음")

conn.close()

print(f"\n=== 확인 완료 ===")
