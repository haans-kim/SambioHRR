#!/usr/bin/env python3
"""Check which DB path Streamlit will use"""
from pathlib import Path
import os

# 환경 변수에서 DB 경로 가져오기 (Electron에서 설정)
db_path_from_env = os.environ.get('DB_PATH')

if db_path_from_env and Path(db_path_from_env).exists():
    # Electron에서 환경 변수로 전달한 DB 경로 사용
    DB_PATH = Path(db_path_from_env)
    print(f"Using DB path from environment variable: {DB_PATH}")
else:
    # 개발 모드 - 상위 디렉토리의 sambio_human.db 참조
    DB_PATH = Path(__file__).parent.parent / "sambio_human.db"
    print(f"Using dev DB path: {DB_PATH}")

print(f"\nDB_PATH configured: {DB_PATH}")
print(f"Absolute path: {DB_PATH.absolute()}")
print(f"Exists: {DB_PATH.exists()}")

if DB_PATH.exists():
    import sqlite3
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # Check meal_data months
    cursor.execute("""
        SELECT strftime('%Y-%m', 취식일시) as month, COUNT(*) as count
        FROM meal_data
        GROUP BY month
        ORDER BY month
    """)

    print("\nmeal_data 월별 건수:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]:,}건")

    conn.close()
