import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

from core.db_manager import DatabaseManager

db_path = r'C:\Project\SambioHRR\sambio_human.db'

print('=== 7월 tag_data 업로드 현황 확인 ===\n')

db_manager = DatabaseManager(db_path)
conn = db_manager.get_connection()
cursor = conn.cursor()

# 7월 데이터 건수
cursor.execute("SELECT COUNT(*) FROM tag_data WHERE ENTE_DT >= 20250701 AND ENTE_DT <= 20250731")
july_count = cursor.fetchone()[0]
print(f'7월 tag_data: {july_count:,}건')

if july_count > 0:
    # 날짜 범위
    cursor.execute("SELECT MIN(ENTE_DT), MAX(ENTE_DT) FROM tag_data WHERE ENTE_DT >= 20250701 AND ENTE_DT <= 20250731")
    date_range = cursor.fetchone()
    print(f'날짜 범위: {date_range[0]} ~ {date_range[1]}')

    # 샘플 데이터
    cursor.execute("""
        SELECT ENTE_DT, 사번, NAME, DR_NM, 출입시각
        FROM tag_data
        WHERE ENTE_DT >= 20250701 AND ENTE_DT <= 20250731
        LIMIT 5
    """)
    print(f'\n샘플 데이터:')
    for row in cursor.fetchall():
        print(f'  날짜: {row[0]}, 사번: {row[1]}, 이름: {row[2]}, 위치: {row[3]}, 시각: {row[4]}')

db_manager.close()
