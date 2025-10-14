"""
Excel file loader with multi-sheet support
Based on SambioHR5/Data_Uploader/core/data_loader.py
"""
import pandas as pd
import logging
from pathlib import Path
from typing import List

logger = logging.getLogger(__name__)


class ExcelLoader:
    """Excel file loader with automatic sheet merging"""

    def __init__(self):
        self.logger = logger

    def load_excel_file(self, file_path: Path, auto_merge_sheets: bool = True) -> pd.DataFrame:
        """
        Load Excel file and optionally merge multiple sheets

        Args:
            file_path: Path to Excel file
            auto_merge_sheets: If True, merge all sheets into one DataFrame

        Returns:
            Loaded DataFrame
        """
        self.logger.info(f"Loading Excel file: {file_path.name}")
        file_size_mb = file_path.stat().st_size / (1024 * 1024)
        self.logger.info(f"File size: {file_size_mb:.2f} MB")

        try:
            # Check sheets in file
            excel_file = pd.ExcelFile(file_path)
            sheet_names = excel_file.sheet_names
            self.logger.info(f"Sheets found: {sheet_names}")

            if len(sheet_names) == 1:
                # Single sheet mode
                self.logger.info("Single sheet mode")
                df = pd.read_excel(file_path, sheet_name=0)
                return self._optimize_datatypes(df)

            elif auto_merge_sheets and len(sheet_names) > 1:
                # Multi-sheet merge mode
                self.logger.info(f"Multi-sheet mode: merging {len(sheet_names)} sheets")
                return self._merge_multiple_sheets(file_path, sheet_names)

            else:
                # Load only first sheet
                df = pd.read_excel(file_path, sheet_name=0)
                return self._optimize_datatypes(df)

        except Exception as e:
            self.logger.error(f"Failed to load Excel file: {e}")
            raise

    def _merge_multiple_sheets(self, file_path: Path, sheet_names: List[str]) -> pd.DataFrame:
        """
        Merge multiple sheets into one DataFrame

        Args:
            file_path: Path to Excel file
            sheet_names: List of sheet names to merge

        Returns:
            Merged DataFrame
        """
        self.logger.info(f"Merging {len(sheet_names)} sheets: {sheet_names}")

        dfs = []
        original_total = 0

        for i, sheet_name in enumerate(sheet_names):
            self.logger.info(f"[{i+1}/{len(sheet_names)}] Loading sheet: {sheet_name}")

            try:
                df = pd.read_excel(file_path, sheet_name=sheet_name)
                df = self._optimize_datatypes(df)
                dfs.append(df)
                original_total += len(df)
                self.logger.info(f"  {sheet_name}: {len(df):,} rows loaded")

            except Exception as e:
                self.logger.error(f"Failed to load sheet {sheet_name}: {e}")
                continue

        if not dfs:
            raise ValueError("No sheets could be loaded")

        # Concatenate all sheets
        self.logger.info("Concatenating sheets...")
        combined_df = pd.concat(dfs, ignore_index=True)

        self.logger.info(f"Merge complete: {len(combined_df):,} rows (original: {original_total:,})")
        return combined_df

    def _optimize_datatypes(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Optimize DataFrame datatypes to reduce memory usage

        Args:
            df: Input DataFrame

        Returns:
            Optimized DataFrame
        """
        for col in df.columns:
            if df[col].dtype == 'object':
                try:
                    # Try to convert to numeric
                    df[col] = pd.to_numeric(df[col], errors='ignore')
                except:
                    pass
            elif df[col].dtype == 'int64':
                # Downcast int64 to int32 if possible
                if df[col].min() >= -2147483648 and df[col].max() <= 2147483647:
                    df[col] = df[col].astype('int32')

        return df

    def get_excel_info(self, file_path: Path) -> dict:
        """
        Get basic information about an Excel file without loading all data

        Args:
            file_path: Path to Excel file

        Returns:
            Dictionary with file information
        """
        try:
            excel_file = pd.ExcelFile(file_path)
            sheet_names = excel_file.sheet_names

            # Get first few rows from first sheet for column detection
            sample_df = pd.read_excel(file_path, sheet_name=0, nrows=5)

            return {
                "file_name": file_path.name,
                "file_size_mb": file_path.stat().st_size / (1024 * 1024),
                "sheet_count": len(sheet_names),
                "sheet_names": sheet_names,
                "sample_columns": list(sample_df.columns),
                "sample_row_count": len(sample_df)
            }

        except Exception as e:
            self.logger.error(f"Failed to get Excel info: {e}")
            return {
                "error": str(e)
            }
