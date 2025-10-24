import Database from 'better-sqlite3';
import path from 'path';

let dbInstance: Database.Database | null = null;

function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  // Use DB_PATH environment variable if set (for Electron), otherwise use cwd
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'sambio_human.db');

  console.log('[DB Client] Initializing database...');
  console.log('[DB Client] DB_PATH env:', process.env.DB_PATH);
  console.log('[DB Client] process.cwd():', process.cwd());
  console.log('[DB Client] Using DB path:', dbPath);

  // Check if DB file exists
  const fs = require('fs');
  if (!fs.existsSync(dbPath)) {
    const errorMsg = `[DB Client] Database file not found at: ${dbPath}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const stats = fs.statSync(dbPath);
  console.log('[DB Client] DB file size:', (stats.size / 1024 / 1024 / 1024).toFixed(2), 'GB');

  dbInstance = new Database(dbPath, { readonly: false, fileMustExist: true });

  // Verify tables exist
  const tables = dbInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='daily_analysis_results'").all();
  if (tables.length === 0) {
    console.error('[DB Client] ✗ daily_analysis_results table NOT FOUND!');
    throw new Error('Database table daily_analysis_results not found');
  } else {
    const count = dbInstance.prepare("SELECT COUNT(*) as count FROM daily_analysis_results").get() as any;
    console.log('[DB Client] ✓ daily_analysis_results exists with', count.count, 'rows');
  }

  // Enable foreign keys
  dbInstance.pragma('foreign_keys = ON');

  return dbInstance;
}

// Export getter function disguised as default export
const db = new Proxy({} as Database.Database, {
  get(target, prop) {
    const dbInstance = getDatabase();
    const value = (dbInstance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(dbInstance);
    }
    return value;
  }
});

export default db;