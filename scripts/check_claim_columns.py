import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')
from core.db_manager import DatabaseManager

db_path = r'C:\Project\SambioHRR\sambio_human.db'
db = DatabaseManager(db_path)
conn = db.get_connection()
cursor = conn.cursor()

print('=== claim_data 테이블 구조 ===\n')
cursor.execute("PRAGMA table_info(claim_data)")
for row in cursor.fetchall():
    print(f'{row[1]}: {row[2]}')

print('\n=== 샘플 데이터 (1-6월) ===\n')
cursor.execute("SELECT * FROM claim_data WHERE date >= '2025-01-01' AND date <= '2025-01-31' LIMIT 5")
for row in cursor.fetchall():
    print(row)

db.close()
