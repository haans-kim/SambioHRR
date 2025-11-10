import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

from core.db_manager import DatabaseManager

db_path = r'C:\Project\SambioHRR\sambio_human.db'
db_manager = DatabaseManager(db_path)
conn = db_manager.get_connection()
cursor = conn.cursor()

print("=== 7월 데이터 확인 ===\n")

cursor.execute("SELECT * FROM claim_data")
all_data = cursor.fetchall()

# 7월 데이터 통계
july_rows = [row for row in all_data if '2025-07' in str(row[0])]

print(f"7월 전체: {len(july_rows):,}건")

# 근무시간 통계
try:
    has_work_hours = sum(1 for row in july_rows if row[7] is not None and float(row[7]) > 0)
except:
    has_work_hours = 0

has_level = sum(1 for row in july_rows if row[17] is not None)

print(f"근무시간 > 0: {has_work_hours:,}건")
print(f"employee_level 있음: {has_level:,}건")

# 첫 10건 샘플
print("\n샘플 (처음 10건):")
for i, row in enumerate(july_rows[:10]):
    print(f"  근무일자: {row[0]}, 사번: {row[3]}, 직급: {row[5]}, employee_level: {row[17]}, 근무시간: {row[7]}, 실근무시간: {row[16]}")

db_manager.close()
