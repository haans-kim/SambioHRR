"""
Database manager for sambio_human.db operations
"""
import sqlite3
import pandas as pd
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class DatabaseManager:
    """SQLite database manager"""

    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        if not self.db_path.exists():
            raise FileNotFoundError(f"Database not found: {db_path}")

        self.conn = None
        logger.info(f"Database manager initialized: {db_path}")

    def get_connection(self) -> sqlite3.Connection:
        """Get or create database connection"""
        if self.conn is None:
            self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self.conn.execute("PRAGMA journal_mode = DELETE")
            self.conn.execute("PRAGMA synchronous = NORMAL")
            self.conn.execute("PRAGMA cache_size = -64000")
        return self.conn

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            self.conn = None

    def get_table_stats(self, table_name: str, date_column: Optional[str] = None) -> Dict[str, Any]:
        """Get statistics for a table"""
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            # Check if table exists
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table_name,)
            )
            if not cursor.fetchone():
                return {
                    "exists": False,
                    "row_count": 0,
                    "date_range": None
                }

            # Get row count
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            row_count = cursor.fetchone()[0]

            # Get date range if date column exists
            date_range = None
            if date_column:
                try:
                    cursor.execute(
                        f"SELECT MIN({date_column}), MAX({date_column}) FROM {table_name}"
                    )
                    min_date, max_date = cursor.fetchone()
                    if min_date and max_date:
                        # Format date string: 20250101 -> 2025-01-01 or 2025-01-01 00:00:00 -> 2025-01-01
                        def format_date(date_str):
                            date_str = str(date_str)

                            # If already in YYYY-MM-DD format (with optional time), extract date part
                            if '-' in date_str:
                                return date_str[:10]  # 2025-01-01 00:00:00 -> 2025-01-01

                            # If in YYYYMMDD format, convert to YYYY-MM-DD
                            date_str = date_str[:8]  # Take first 8 characters
                            if len(date_str) == 8 and date_str.isdigit():
                                return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"

                            return date_str

                        date_range = {
                            "min": format_date(min_date),
                            "max": format_date(max_date)
                        }
                except Exception as e:
                    logger.warning(f"Could not get date range for {table_name}: {e}")

            return {
                "exists": True,
                "row_count": row_count,
                "date_range": date_range
            }

        except Exception as e:
            logger.error(f"Error getting stats for {table_name}: {e}")
            return {
                "exists": False,
                "row_count": 0,
                "date_range": None,
                "error": str(e)
            }

    def dataframe_to_table(
        self,
        df: pd.DataFrame,
        table_name: str,
        if_exists: str = "append",
        chunk_size: int = 5000
    ) -> int:
        """
        Insert DataFrame into SQLite table with chunking

        Args:
            df: DataFrame to insert
            table_name: Target table name
            if_exists: 'append', 'replace', or 'fail'
            chunk_size: Number of rows per batch

        Returns:
            Number of rows inserted
        """
        conn = self.get_connection()

        try:
            # Get total rows
            total_rows = len(df)
            logger.info(f"Inserting {total_rows:,} rows into {table_name} (mode: {if_exists})")

            # Insert in chunks
            rows_inserted = 0
            for i in range(0, total_rows, chunk_size):
                chunk = df.iloc[i:i + chunk_size]
                chunk.to_sql(
                    table_name,
                    conn,
                    if_exists=if_exists if i == 0 else 'append',
                    index=False
                )
                rows_inserted += len(chunk)

                if (i + chunk_size) % (chunk_size * 4) == 0:  # Log every 4 chunks
                    logger.info(f"Progress: {rows_inserted:,}/{total_rows:,} rows ({rows_inserted/total_rows*100:.1f}%)")

            conn.commit()
            logger.info(f"Insert complete: {rows_inserted:,} rows into {table_name}")
            return rows_inserted

        except Exception as e:
            conn.rollback()
            logger.error(f"Error inserting data into {table_name}: {e}")
            raise

    def execute_query(self, query: str, params: tuple = ()) -> list:
        """Execute a SELECT query"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor.fetchall()

    def execute_update(self, query: str, params: tuple = ()) -> int:
        """Execute an UPDATE/DELETE query"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        return cursor.rowcount

    def table_exists(self, table_name: str) -> bool:
        """Check if table exists in database"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,)
        )
        return cursor.fetchone() is not None

    def get_row_count(self, table_name: str) -> int:
        """Get row count for a table"""
        if not self.table_exists(table_name):
            return 0

        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        return cursor.fetchone()[0]

    def insert_dataframe(self, table_name: str, df: pd.DataFrame, if_exists: str = "append") -> int:
        """Insert DataFrame into table (alias for dataframe_to_table)"""
        # Add uploaded_at timestamp if column exists
        if 'uploaded_at' not in df.columns:
            df = df.copy()
            df['uploaded_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        return self.dataframe_to_table(df, table_name, if_exists)

    def delete_by_date_range(
        self,
        table_name: str,
        date_column: str,
        min_date: str,
        max_date: str,
        date_format: str = "number"
    ) -> int:
        """
        Delete rows within a date range

        Args:
            table_name: Target table name
            date_column: Date column name
            min_date: Minimum date (YYYYMMDD or YYYY-MM-DD format)
            max_date: Maximum date (YYYYMMDD or YYYY-MM-DD format)
            date_format: "number" (20250101) or "datetime" (2025-01-01)

        Returns:
            Number of rows deleted
        """
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            # Convert dates to appropriate format for comparison
            if date_format == "number":
                # Remove dashes for number format (2025-01-01 -> 20250101)
                min_date_val = int(min_date.replace('-', '')[:8])
                max_date_val = int(max_date.replace('-', '')[:8])
            else:
                # Keep datetime format as string
                min_date_val = min_date[:10] if len(min_date) > 10 else min_date
                max_date_val = max_date[:10] if len(max_date) > 10 else max_date

            # Count rows to delete (handle mixed type formats)
            if date_format == "number":
                # Handle both integer (20250701) and text ('2025-07-01') formats
                cursor.execute(
                    f"""SELECT COUNT(*) FROM {table_name}
                    WHERE CAST(
                        CASE
                            WHEN typeof({date_column}) = 'integer' THEN {date_column}
                            WHEN typeof({date_column}) = 'text' THEN CAST(substr(replace({date_column}, '-', ''), 1, 8) AS INTEGER)
                        END AS INTEGER
                    ) >= ? AND CAST(
                        CASE
                            WHEN typeof({date_column}) = 'integer' THEN {date_column}
                            WHEN typeof({date_column}) = 'text' THEN CAST(substr(replace({date_column}, '-', ''), 1, 8) AS INTEGER)
                        END AS INTEGER
                    ) <= ?""",
                    (min_date_val, max_date_val)
                )
            else:
                cursor.execute(
                    f"SELECT COUNT(*) FROM {table_name} WHERE date({date_column}) >= ? AND date({date_column}) <= ?",
                    (min_date_val, max_date_val)
                )

            rows_to_delete = cursor.fetchone()[0]

            if rows_to_delete == 0:
                logger.info(f"No rows to delete from {table_name} for date range {min_date} ~ {max_date}")
                return 0

            logger.info(f"Deleting {rows_to_delete:,} rows from {table_name} for date range {min_date} ~ {max_date}")

            # Delete rows (handle mixed type formats)
            if date_format == "number":
                # Handle both integer (20250701) and text ('2025-07-01') formats
                cursor.execute(
                    f"""DELETE FROM {table_name}
                    WHERE CAST(
                        CASE
                            WHEN typeof({date_column}) = 'integer' THEN {date_column}
                            WHEN typeof({date_column}) = 'text' THEN CAST(substr(replace({date_column}, '-', ''), 1, 8) AS INTEGER)
                        END AS INTEGER
                    ) >= ? AND CAST(
                        CASE
                            WHEN typeof({date_column}) = 'integer' THEN {date_column}
                            WHEN typeof({date_column}) = 'text' THEN CAST(substr(replace({date_column}, '-', ''), 1, 8) AS INTEGER)
                        END AS INTEGER
                    ) <= ?""",
                    (min_date_val, max_date_val)
                )
            else:
                cursor.execute(
                    f"DELETE FROM {table_name} WHERE date({date_column}) >= ? AND date({date_column}) <= ?",
                    (min_date_val, max_date_val)
                )

            conn.commit()
            logger.info(f"Deleted {rows_to_delete:,} rows from {table_name}")
            return rows_to_delete

        except Exception as e:
            conn.rollback()
            logger.error(f"Error deleting data from {table_name}: {e}")
            raise
