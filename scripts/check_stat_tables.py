import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

from core.db_manager import DatabaseManager

db_path = r'C:\Project\SambioHRR\sambio_human.db'
db_manager = DatabaseManager(db_path)
conn = db_manager.get_connection()
cursor = conn.cursor()

print("=== 통계 관련 테이블 확인 ===\n")

cursor.execute("""
    SELECT name FROM sqlite_master
    WHERE type='table'
    AND (name LIKE '%stat%' OR name LIKE '%month%' OR name LIKE '%analysis%' OR name LIKE '%daily%')
    ORDER BY name
""")

tables = cursor.fetchall()
print("통계 테이블 목록:")
for table in tables:
    table_name = table[0]
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    count = cursor.fetchone()[0]
    print(f"  {table_name}: {count:,}건")

db_manager.close()
print("\n=== 완료 ===")
