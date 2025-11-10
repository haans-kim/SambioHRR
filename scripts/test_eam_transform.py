import sys
sys.path.insert(0, r'C:\Project\SambioHRR\excel-upload-server')

import pandas as pd
from handlers.data_transformers import DataTransformers

file_path = r'C:\Users\haans\Downloads\Sambio 8-10 Data\장비데이터\장비데이터 요청정리_EAM_20251104.xlsx'

print("=== Excel 파일 로드 (EAM_refined 시트) ===")
df = pd.read_excel(file_path, sheet_name='EAM_refined', nrows=10)
print(f"원본 데이터: {len(df)}행 x {len(df.columns)}컬럼")
print("\n원본 컬럼:")
print(df.columns.tolist())
print("\n원본 샘플:")
print(df.head(3))

print("\n=== 데이터 변환 ===")
df_transformed = DataTransformers.transform_eam_data(df)
print(f"변환 완료: {len(df_transformed)}행 x {len(df_transformed.columns)}컬럼")
print("\n변환 후 컬럼:")
print(df_transformed.columns.tolist())
print("\n변환 후 샘플:")
print(df_transformed.head(3))

print("\n=== 데이터 타입 확인 ===")
print(df_transformed.dtypes)
