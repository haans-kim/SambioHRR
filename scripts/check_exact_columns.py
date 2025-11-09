import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = r"C:\Users\haans\Downloads\Sambio 8-10 Data\25년도 8-10 Claim Data.xlsx"

df = pd.read_excel(file_path, nrows=0)

print("=== 정확한 컬럼명 확인 ===")
print(f"총 {len(df.columns)}개 컬럼\n")

for i, col in enumerate(df.columns, 1):
    print(f"{i}. '{col}' (type: {type(col).__name__})")

print("\n=== '일자' 컬럼 검색 ===")
if '일자' in df.columns:
    print("✓ '일자' 컬럼 발견!")
else:
    print("✗ '일자' 컬럼 없음")

if '근무일' in df.columns:
    print("✓ '근무일' 컬럼 발견!")
else:
    print("✗ '근무일' 컬럼 없음")

# 컬럼명에 '일' 또는 '자'가 포함된 것 찾기
print("\n=== '일' 또는 '자'가 포함된 컬럼 ===")
matching_cols = [col for col in df.columns if '일' in str(col) or '자' in str(col)]
for col in matching_cols:
    print(f"  - {col}")
