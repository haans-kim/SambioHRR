import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

from core.db_manager import DatabaseManager

db_path = r'C:\Project\SambioHRR\sambio_human.db'

print('=== 8-10월 tag_data 확인 ===\n')

db_manager = DatabaseManager(db_path)
conn = db_manager.get_connection()
cursor = conn.cursor()

# 8-10월 tag_data 존재 확인
for month in ['08', '09', '10']:
    cursor.execute(f'''
        SELECT COUNT(*)
        FROM tag_data
        WHERE ENTE_DT >= 2025{month}01 AND ENTE_DT <= 2025{month}31
    ''')
    count = cursor.fetchone()[0]
    print(f'{month}월 tag_data: {count:,}건')

# 날짜 범위 확인
cursor.execute('''
    SELECT MIN(ENTE_DT), MAX(ENTE_DT), COUNT(*)
    FROM tag_data
    WHERE ENTE_DT >= 20250801 AND ENTE_DT <= 20251031
''')
result = cursor.fetchone()
print(f'\n전체 8-10월:')
print(f'  최소 날짜: {result[0]}')
print(f'  최대 날짜: {result[1]}')
print(f'  총 건수: {result[2]:,}건')

db_manager.close()
