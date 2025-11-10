import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

from core.db_manager import DatabaseManager

db_path = r'C:\Project\SambioHRR\sambio_human.db'
db_manager = DatabaseManager(db_path)
conn = db_manager.get_connection()
cursor = conn.cursor()

print("=== claim_data 월별 데이터 확인 ===\n")

# 전체 조회 후 파이썬에서 월별 집계
cursor.execute("SELECT * FROM claim_data")
all_data = cursor.fetchall()

month_counts = {}
for row in all_data:
    date_val = str(row[0])
    if '2025-' in date_val:
        month = date_val[:7]  # '2025-07'
        month_counts[month] = month_counts.get(month, 0) + 1

print("월별 데이터 건수:")
for month in sorted(month_counts.keys()):
    print(f"  {month}: {month_counts[month]:,}건")

print(f"\n전체: {len(all_data):,}건")

# 7월 샘플 확인
print("\n7월 샘플 데이터 (처음 3건):")
count = 0
for row in all_data:
    if '2025-07' in str(row[0]):
        print(f"  근무일자: {row[0]}, 사번: {row[3]}, 근무시간: {row[7]}, WORKSCHDTYPNM: {row[6]}")
        count += 1
        if count >= 3:
            break

db_manager.close()
print("\n=== 완료 ===")
