import sqlite3

conn = sqlite3.connect('sambio_human.db')
cursor = conn.cursor()

print("=== claim_data 테이블 컬럼 ===")
info = cursor.execute('PRAGMA table_info(claim_data)').fetchall()
for col in info:
    print(f"{col[1]} ({col[2]})")

print(f"\n총 {len(info)}개 컬럼")

conn.close()
