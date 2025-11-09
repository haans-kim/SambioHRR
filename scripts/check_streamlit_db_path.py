import os
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

print("=== Streamlit DB 경로 확인 ===\n")

# Streamlit 앱과 동일한 로직
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')
os.chdir(r'C:\Project\SambioHRR\excel-upload-server')

# streamlit_app.py의 로직 재현
db_path_from_env = os.environ.get('DB_PATH')

if db_path_from_env and Path(db_path_from_env).exists():
    DB_PATH = Path(db_path_from_env)
    print(f"✓ 환경 변수 DB_PATH 사용: {DB_PATH}")
else:
    # streamlit_app.py 파일 위치 기준
    streamlit_app_file = Path(r'C:\Project\SambioHRR\excel-upload-server\streamlit_app.py')
    DB_PATH = streamlit_app_file.parent.parent / "sambio_human.db"
    print(f"✓ 개발 모드 DB 경로 사용: {DB_PATH}")

print(f"\n경로 존재 여부: {DB_PATH.exists()}")
print(f"절대 경로: {DB_PATH.absolute()}")

if DB_PATH.exists():
    size = DB_PATH.stat().st_size
    print(f"파일 크기: {size:,} bytes ({size / 1024 / 1024 / 1024:.2f} GB)")

    # DB 연결 테스트
    import sqlite3
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM claim_data")
    count = cursor.fetchone()[0]
    print(f"\nclaim_data 레코드 수: {count:,}건")

    cursor.execute("SELECT COUNT(*) FROM claim_data WHERE 근무일 LIKE '2025-10%'")
    oct_count = cursor.fetchone()[0]
    print(f"2025-10월 데이터: {oct_count:,}건")

    conn.close()

# data_transformers.py의 DB 경로도 확인
print(f"\n=== data_transformers.py DB 경로 ===")
transformer_file = Path(r'C:\Project\SambioHRR\excel-upload-server\handlers\data_transformers.py')
transformer_db_path = transformer_file.parent.parent.parent / "sambio_human.db"
print(f"경로: {transformer_db_path}")
print(f"존재: {transformer_db_path.exists()}")
print(f"동일 파일: {DB_PATH.absolute() == transformer_db_path.absolute()}")
