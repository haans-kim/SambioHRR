import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

from core.db_manager import DatabaseManager

db_path = r'C:\Project\SambioHRR\sambio_human.db'
db_manager = DatabaseManager(db_path)
conn = db_manager.get_connection()
cursor = conn.cursor()

print("=== 8-10월 ENTE_DT를 정수 형식으로 변환 ===\n")

# 변환 전 확인
cursor.execute("""
    SELECT 출입시각, ENTE_DT, typeof(ENTE_DT)
    FROM tag_data
    WHERE 출입시각 LIKE '2025-08%'
       OR 출입시각 LIKE '2025-09%'
       OR 출입시각 LIKE '2025-10%'
    LIMIT 5
""")
print("변환 전 샘플:")
for row in cursor.fetchall():
    print(f"  출입시각: {row[0]}, ENTE_DT: {row[1]} ({row[2]})")

# ENTE_DT를 YYYY-MM-DD → YYYYMMDD 정수로 변환
print("\n변환 중...")
cursor.execute("""
    UPDATE tag_data
    SET ENTE_DT = CAST(REPLACE(ENTE_DT, '-', '') AS INTEGER)
    WHERE (출입시각 LIKE '2025-08%'
        OR 출입시각 LIKE '2025-09%'
        OR 출입시각 LIKE '2025-10%')
      AND typeof(ENTE_DT) = 'text'
""")

updated = cursor.rowcount
conn.commit()
print(f"변환 완료: {updated:,}건")

# 변환 후 확인
cursor.execute("""
    SELECT 출입시각, ENTE_DT, typeof(ENTE_DT)
    FROM tag_data
    WHERE 출입시각 LIKE '2025-08%'
       OR 출입시각 LIKE '2025-09%'
       OR 출입시각 LIKE '2025-10%'
    LIMIT 5
""")
print("\n변환 후 샘플:")
for row in cursor.fetchall():
    print(f"  출입시각: {row[0]}, ENTE_DT: {row[1]} ({row[2]})")

# 전체 타입 분포 확인
cursor.execute("""
    SELECT typeof(ENTE_DT) as type, COUNT(*) as cnt
    FROM tag_data
    GROUP BY type
""")
print("\n전체 ENTE_DT 타입 분포:")
for row in cursor.fetchall():
    print(f"  {row[0]}: {row[1]:,}건")

db_manager.close()
print(f"\n=== 완료: 8-10월 ENTE_DT를 정수로 변환했습니다 ===")
