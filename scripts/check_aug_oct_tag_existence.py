import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')
from core.db_manager import DatabaseManager

db_path = r'C:\Project\SambioHRR\sambio_human.db'
db = DatabaseManager(db_path)
conn = db.get_connection()
cursor = conn.cursor()

print('=== 8-10월 tag_data 존재 확인 ===\n')

for month in ['08', '09', '10']:
    cursor.execute(f"SELECT COUNT(*) FROM tag_data WHERE ENTE_DT >= 2025{month}01 AND ENTE_DT <= 2025{month}31")
    count = cursor.fetchone()[0]
    print(f'{month}월: {count:,}건')

db.close()
