import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

from core.db_manager import DatabaseManager

db_path = r'C:\Project\SambioHRR\sambio_human.db'

print('=== 7월 tag_data 중복 제거 ===\n')

db_manager = DatabaseManager(db_path)
conn = db_manager.get_connection()
cursor = conn.cursor()

# 현재 7월 데이터 건수
cursor.execute("SELECT COUNT(*) FROM tag_data WHERE ENTE_DT >= 20250701 AND ENTE_DT <= 20250731")
before_count = cursor.fetchone()[0]
print(f'삭제 전 7월 데이터: {before_count:,}건')

# 7월 데이터 삭제
print('\n7월 tag_data 삭제 중...')
cursor.execute("DELETE FROM tag_data WHERE ENTE_DT >= 20250701 AND ENTE_DT <= 20250731")
conn.commit()

# 확인
cursor.execute("SELECT COUNT(*) FROM tag_data WHERE ENTE_DT >= 20250701 AND ENTE_DT <= 20250731")
after_count = cursor.fetchone()[0]
print(f'[OK] 삭제 후 7월 데이터: {after_count:,}건')
print(f'삭제된 건수: {before_count - after_count:,}건')

# 전체 tag_data 건수
cursor.execute("SELECT COUNT(*) FROM tag_data")
total_count = cursor.fetchone()[0]
print(f'\n현재 전체 tag_data: {total_count:,}건')

db_manager.close()
print('\n=== 삭제 완료 ===')
