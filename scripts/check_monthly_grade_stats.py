import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

from core.db_manager import DatabaseManager

db_path = r'C:\Project\SambioHRR\sambio_human.db'
db_manager = DatabaseManager(db_path)
conn = db_manager.get_connection()
cursor = conn.cursor()

print("=== monthly_grade_stats 구조 및 데이터 확인 ===\n")

# 테이블 구조
cursor.execute("PRAGMA table_info(monthly_grade_stats)")
columns = cursor.fetchall()
print("컬럼 목록:")
for col in columns:
    print(f"  {col[1]} ({col[2]})")

# 월별 데이터 확인
cursor.execute("SELECT DISTINCT month FROM monthly_grade_stats ORDER BY month")
months = cursor.fetchall()
print(f"\n현재 저장된 월: {[m[0] for m in months]}")

# 샘플 데이터
cursor.execute("SELECT * FROM monthly_grade_stats WHERE month LIKE '2025-07%' LIMIT 3")
print("\n7월 샘플:")
for row in cursor.fetchall():
    print(f"  {row}")

# 전체 건수
cursor.execute("SELECT month, COUNT(*) FROM monthly_grade_stats GROUP BY month ORDER BY month")
print("\n월별 통계 건수:")
for row in cursor.fetchall():
    print(f"  {row[0]}: {row[1]}건")

db_manager.close()
print("\n=== 완료 ===")
