import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'sambio_human.db');
const db = new Database(dbPath, { readonly: false });

// Enable foreign keys
db.pragma('foreign_keys = ON');

export default db;