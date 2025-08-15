import Database from 'better-sqlite3';
import path from 'path';

// 데이터베이스 파일 경로
const dbPath = path.join(process.cwd(), 'sambio_human.db');

// 데이터베이스 연결
const db = new Database(dbPath, { 
  readonly: false,
  fileMustExist: true 
});

// 성능 최적화
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 10000');
db.pragma('foreign_keys = ON');
db.pragma('temp_store = MEMORY');

// 프로세스 종료시 데이터베이스 연결 종료
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});

export default db;