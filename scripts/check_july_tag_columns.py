import pandas as pd

file_path = r"C:\Users\haans\Downloads\Sambio 7-9 Data\입출문기록(25.7).xlsx"

print('=== 7월 Tag Data Excel 파일 구조 확인 ===\n')

xl = pd.ExcelFile(file_path)
print(f'시트 목록: {xl.sheet_names}\n')

for sheet_name in xl.sheet_names:
    print(f'=== {sheet_name} ===')
    df = pd.read_excel(file_path, sheet_name=sheet_name, nrows=5)

    print(f'컬럼 ({len(df.columns)}개):')
    for i, col in enumerate(df.columns):
        print(f'  {i+1}. {col}')

    print(f'\n데이터 샘플 (첫 3행):')
    print(df.head(3).to_string())
    print('\n')
