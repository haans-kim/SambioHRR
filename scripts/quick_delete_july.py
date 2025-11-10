import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')
from core.db_manager import DatabaseManager

db_path = r'C:\Project\SambioHRR\sambio_human.db'
db_manager = DatabaseManager(db_path)
conn = db_manager.get_connection()

print('7월 데이터 삭제 중...')
conn.execute("DELETE FROM tag_data WHERE ENTE_DT >= 20250701 AND ENTE_DT <= 20250731")
conn.commit()

cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM tag_data WHERE ENTE_DT >= 20250701 AND ENTE_DT <= 20250731")
print(f'7월 데이터: {cursor.fetchone()[0]:,}건')

db_manager.close()
print('완료')
