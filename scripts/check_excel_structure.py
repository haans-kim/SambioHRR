import pandas as pd
import os

file_path = r"C:\Users\haans\Downloads\Sambio 8-10 Data\25년도 8-10 Claim Data.xlsx"

xl = pd.ExcelFile(file_path)
filename = os.path.basename(file_path)
print(f"=== Excel 파일: {filename} ===\n")
print(f"Sheet names: {xl.sheet_names}\n")

for sheet_name in xl.sheet_names[:3]:  # 처음 3개 시트만
    print(f"=== Sheet: {sheet_name} ===")
    df = pd.read_excel(xl, sheet_name=sheet_name, nrows=2)
    print(f"Columns ({len(df.columns)}개):")
    for i, col in enumerate(df.columns, 1):
        print(f"  {i}. {col}")
    print(f"Shape: {df.shape}")
    print()
