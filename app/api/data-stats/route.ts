import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Detect database path based on environment
function getDbPath(): string {
  // Check if running in Electron packaged mode
  const productionDbPath = 'C:\\SambioHRData\\sambio_human.db';
  if (existsSync(productionDbPath)) {
    return productionDbPath;
  }

  // Development mode
  return path.join(process.cwd(), 'sambio_human.db');
}

const DB_PATH = getDbPath();

interface DataStats {
  data_type: string;
  table_name: string;
  row_count: number;
  date_range: { min: string; max: string } | null;
}

const DATA_TYPE_CONFIG: Record<string, { table: string; dateColumn?: string; dateFormat?: 'number' | 'datetime' }> = {
  'tag_data': { table: 'tag_data', dateColumn: 'ENTE_DT', dateFormat: 'number' },
  'meal_data': { table: 'meal_data', dateColumn: '취식일시', dateFormat: 'datetime' },
  'claim_data': { table: 'claim_data', dateColumn: '근무일', dateFormat: 'datetime' },
  'knox_approval_data': { table: 'knox_approval_data', dateColumn: 'Timestamp', dateFormat: 'datetime' },
  'knox_mail_data': { table: 'knox_mail_data', dateColumn: '발신일시_GMT9', dateFormat: 'datetime' },
  'knox_pims_data': { table: 'knox_pims_data', dateColumn: 'start_time', dateFormat: 'datetime' },
  'eam_data': { table: 'eam_data', dateColumn: 'ATTEMPTDATE', dateFormat: 'datetime' },
  'equis_data': { table: 'equis_data', dateColumn: 'Timestamp', dateFormat: 'datetime' },
  'lams_data': { table: 'lams_data', dateColumn: 'DATE', dateFormat: 'datetime' },
  'mes_data': { table: 'mes_data', dateColumn: 'login_time', dateFormat: 'datetime' },
  'mdm_data': { table: 'mdm_data', dateColumn: 'Timestap', dateFormat: 'datetime' },
};

export async function GET() {
  try {
    if (!existsSync(DB_PATH)) {
      return NextResponse.json(
        { error: 'Database not found' },
        { status: 404 }
      );
    }

    const db = new Database(DB_PATH, { readonly: true });
    const stats: DataStats[] = [];

    for (const [dataType, config] of Object.entries(DATA_TYPE_CONFIG)) {
      try {
        // Check if table exists
        const tableExists = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
          .get(config.table);

        if (!tableExists) {
          continue;
        }

        // Get row count
        const countResult = db
          .prepare(`SELECT COUNT(*) as count FROM ${config.table}`)
          .get() as { count: number };

        // Get date range if date column exists
        let dateRange: { min: string; max: string } | null = null;
        if (config.dateColumn) {
          const dateResult = db
            .prepare(
              `SELECT
                MIN(${config.dateColumn}) as min,
                MAX(${config.dateColumn}) as max
              FROM ${config.table}`
            )
            .get() as { min: string | number | null; max: string | number | null };

          if (dateResult.min && dateResult.max) {
            let minStr = String(dateResult.min);
            let maxStr = String(dateResult.max);

            // Convert number format (20250101) to date string (2025-01-01)
            if (config.dateFormat === 'number') {
              minStr = minStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
              maxStr = maxStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
            }
            // Extract date from datetime format
            else if (config.dateFormat === 'datetime') {
              minStr = minStr.split(' ')[0];
              maxStr = maxStr.split(' ')[0];
            }

            dateRange = {
              min: minStr,
              max: maxStr,
            };
          }
        }

        stats.push({
          data_type: dataType,
          table_name: config.table,
          row_count: countResult.count,
          date_range: dateRange,
        });
      } catch (err) {
        console.error(`Error getting stats for ${dataType}:`, err);
      }
    }

    db.close();

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error in data-stats API:', error);
    return NextResponse.json(
      { error: 'Failed to get database statistics' },
      { status: 500 }
    );
  }
}
