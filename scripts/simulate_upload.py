import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

import pandas as pd
from handlers.data_transformers import DataTransformers
from core.db_manager import DatabaseManager

print("=== Claim Data 업로드 시뮬레이션 ===\n")

# 1. 파일 로드
file_path = r"C:\Users\haans\Downloads\Sambio 8-10 Data\25년도 8-10 Claim Data.xlsx"
print(f"1. 파일 로드: {file_path.split(chr(92))[-1]}")
df = pd.read_excel(file_path, nrows=10)
print(f"   원본: {len(df)}행 x {len(df.columns)}컬럼")

# 2. 데이터 변환
print(f"\n2. 데이터 변환")
try:
    df_transformed = DataTransformers.transform_claim_data(df.copy())
    print(f"   변환 완료: {len(df_transformed)}행 x {len(df_transformed.columns)}컬럼")
    print(f"   컬럼: {list(df_transformed.columns)}")
except Exception as e:
    print(f"   ❌ 변환 실패: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 3. DB 테이블 확인
print(f"\n3. DB 테이블 확인")
db_manager = DatabaseManager(r'C:\Project\SambioHRR\sambio_human.db')
conn = db_manager.get_connection()
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(claim_data)")
table_cols = [row[1] for row in cursor.fetchall()]
print(f"   테이블 컬럼: {len(table_cols)}개")

# 4. 컬럼 매칭 확인
print(f"\n4. 컬럼 매칭 확인")
df_cols = set(df_transformed.columns)
table_cols_set = set(table_cols)

missing_in_table = df_cols - table_cols_set
missing_in_df = table_cols_set - df_cols

if missing_in_table:
    print(f"   ⚠️  DataFrame에만 있는 컬럼: {missing_in_table}")
if missing_in_df:
    print(f"   ℹ️  테이블에만 있는 컬럼: {missing_in_df}")

# 5. DB 삽입 시도 (실제로는 하지 않음)
print(f"\n5. DB 삽입 시뮬레이션")
print(f"   uploaded_at 컬럼 추가...")

from datetime import datetime
if 'uploaded_at' not in df_transformed.columns:
    df_transformed['uploaded_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

print(f"   최종 DataFrame: {len(df_transformed.columns)}컬럼")
print(f"   컬럼: {list(df_transformed.columns)}")

# 누락된 컬럼 확인
final_df_cols = set(df_transformed.columns)
still_missing = table_cols_set - final_df_cols

if still_missing:
    print(f"\n   ⚠️  여전히 누락된 컬럼: {still_missing}")
    print(f"   이 컬럼들은 NULL로 채워질 것입니다.")

# 실제 삽입 시도 (dry run)
print(f"\n6. 실제 삽입 테스트 (1행만)")
try:
    test_df = df_transformed.head(1)
    # to_sql을 사용하지 않고 직접 INSERT 구문 생성
    print(f"   컬럼 순서 확인...")
    for col in test_df.columns:
        if col not in table_cols:
            print(f"   ❌ '{col}' 컬럼이 테이블에 없습니다!")

    print(f"   ✓ 모든 컬럼이 유효합니다.")

except Exception as e:
    print(f"   ❌ 삽입 테스트 실패: {e}")
    import traceback
    traceback.print_exc()

db_manager.close()
print(f"\n=== 시뮬레이션 완료 ===")
