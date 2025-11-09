import sqlite3
import sys

sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect(r'C:\Project\SambioHRR\sambio_human.db')
cursor = conn.cursor()

print("=== claim_data 테이블 구조 ===\n")
info = cursor.execute('PRAGMA table_info(claim_data)').fetchall()

print(f"총 {len(info)}개 컬럼:\n")
for col in info:
    cid, name, type_, notnull, default, pk = col
    print(f"{cid:2d}. {name:20s} {type_:15s} {'NOT NULL' if notnull else ''}")

print("\n=== '일자' 컬럼 확인 ===")
col_names = [col[1] for col in info]
if '일자' in col_names:
    print("✓ '일자' 컬럼이 테이블에 존재합니다!")
    idx = col_names.index('일자')
    print(f"   위치: {idx+1}번째")
    print(f"   타입: {info[idx][2]}")
else:
    print("✗ '일자' 컬럼이 테이블에 없습니다.")

if '근무일' in col_names:
    print("✓ '근무일' 컬럼이 테이블에 존재합니다!")
    idx = col_names.index('근무일')
    print(f"   위치: {idx+1}번째")
    print(f"   타입: {info[idx][2]}")
else:
    print("✗ '근무일' 컬럼이 테이블에 없습니다.")

# 샘플 데이터 확인
print("\n=== 샘플 데이터 (최근 5건) ===")
try:
    cursor.execute("SELECT * FROM claim_data ORDER BY uploaded_at DESC LIMIT 5")
    rows = cursor.fetchall()
    print(f"조회된 행: {len(rows)}개")
    if rows:
        print(f"컬럼 수: {len(rows[0])}개")
except Exception as e:
    print(f"샘플 데이터 조회 실패: {e}")

conn.close()
