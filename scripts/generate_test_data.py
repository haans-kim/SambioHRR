#!/usr/bin/env python3
"""
Generate test data for July, August, September by copying existing month data with date adjustments.
"""

import pandas as pd
from datetime import datetime, timedelta
import os

# File mappings: source_month -> target_month
ENTRY_EXIT_MAPPINGS = [
    ('입출문기록(25.3).xlsx', '입출문기록(25.7).xlsx', 3, 7),  # March -> July (31 days)
    ('입출문기록(25.5).xlsx', '입출문기록(25.8).xlsx', 5, 8),  # May -> August (31 days)
    ('입출문기록(25.4).xlsx', '입출문기록(25.9).xlsx', 4, 9),  # April -> September (30 days)
]

BASE_DIR = 'Sambio_excel_raw'


def convert_date_column(date_value, source_month, target_month):
    """Convert date from source month to target month"""
    if pd.isna(date_value):
        return date_value

    # Handle both string and integer formats
    date_str = str(int(date_value)) if isinstance(date_value, (int, float)) else str(date_value)

    # Parse YYYYMMDD format
    try:
        year = int(date_str[:4])
        month = int(date_str[4:6])
        day = int(date_str[6:8])

        if month == source_month:
            # Convert to target month
            new_date = f"{year}{target_month:02d}{day:02d}"
            return int(new_date)
        else:
            return date_value
    except (ValueError, IndexError):
        return date_value


def process_entry_exit_file(source_file, target_file, source_month, target_month):
    """Process entry/exit record files"""
    print(f"\n{'='*60}")
    print(f"Processing: {source_file} -> {target_file}")
    print(f"Converting dates from month {source_month} to month {target_month}")
    print(f"{'='*60}")

    source_path = os.path.join(BASE_DIR, source_file)
    target_path = os.path.join(BASE_DIR, target_file)

    # Read Excel file
    print("Reading source file...")
    df = pd.read_excel(source_path)
    print(f"Total rows: {len(df):,}")

    # Convert ENTE_DT column
    print("Converting ENTE_DT dates...")
    df['ENTE_DT'] = df['ENTE_DT'].apply(
        lambda x: convert_date_column(x, source_month, target_month)
    )

    # Update DAY_NM if needed (optional - keeping original day names for simplicity)

    # Save to new file
    print(f"Saving to {target_file}...")
    df.to_excel(target_path, index=False, engine='openpyxl')
    print(f"✅ Successfully created {target_file}")
    print(f"   Rows: {len(df):,}")

    # Show sample
    print("\nSample of converted data:")
    print(df[['ENTE_DT', 'DAY_GB', 'DAY_NM', 'NAME', '출입시각']].head(3))


def process_work_record_file():
    """Process integrated work record file (1~6월 -> 7~9월)"""
    print(f"\n{'='*60}")
    print("Processing integrated work records")
    print(f"{'='*60}")

    source_file = '25년도 1~6월_근무기록_전사.xlsx'
    target_file = '25년도 7~9월_근무기록_전사.xlsx'

    source_path = os.path.join(BASE_DIR, source_file)
    target_path = os.path.join(BASE_DIR, target_file)

    # Read Excel file
    print("Reading source file...")
    df = pd.read_excel(source_path)
    print(f"Total rows: {len(df):,}")

    # Filter and convert data for months 1, 2, 3 -> 7, 8, 9
    print("Converting dates...")

    def convert_work_date(date_value):
        if pd.isna(date_value):
            return date_value

        date_str = str(int(date_value)) if isinstance(date_value, (int, float)) else str(date_value)

        try:
            year = int(date_str[:4])
            month = int(date_str[4:6])
            day = int(date_str[6:8])

            # Convert months 1, 2, 3 to 7, 8, 9
            if month == 1:
                new_month = 7
            elif month == 2:
                new_month = 8
            elif month == 3:
                new_month = 9
            else:
                return None  # Filter out other months

            new_date = f"{year}{new_month:02d}{day:02d}"
            return int(new_date)
        except (ValueError, IndexError):
            return None

    df['근무일_new'] = df['근무일'].apply(convert_work_date)

    # Filter only converted dates (remove None values)
    df_filtered = df[df['근무일_new'].notna()].copy()
    df_filtered['근무일'] = df_filtered['근무일_new']
    df_filtered = df_filtered.drop('근무일_new', axis=1)

    print(f"Filtered rows (Jan-Mar -> Jul-Sep): {len(df_filtered):,}")

    # Save to new file
    print(f"Saving to {target_file}...")
    df_filtered.to_excel(target_path, index=False, engine='openpyxl')
    print(f"✅ Successfully created {target_file}")
    print(f"   Rows: {len(df_filtered):,}")

    # Show sample
    print("\nSample of converted data:")
    print(df_filtered[['근무일', '급여요일', '성명', '사번', '부서']].head(3))


def main():
    print("\n" + "="*60)
    print("TEST DATA GENERATION SCRIPT")
    print("="*60)
    print("\nThis script will create test data for months 7, 8, 9")
    print("by copying and modifying existing month data.\n")

    # Process entry/exit records
    for source_file, target_file, source_month, target_month in ENTRY_EXIT_MAPPINGS:
        try:
            process_entry_exit_file(source_file, target_file, source_month, target_month)
        except Exception as e:
            print(f"❌ Error processing {source_file}: {e}")
            import traceback
            traceback.print_exc()

    # Process integrated work records
    try:
        process_work_record_file()
    except Exception as e:
        print(f"❌ Error processing work records: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "="*60)
    print("COMPLETED")
    print("="*60)


if __name__ == '__main__':
    main()
