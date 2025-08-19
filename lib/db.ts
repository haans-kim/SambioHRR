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
// WAL 모드 비활성화 - DELETE 모드 사용 (기본 rollback journal)
// journal_mode 변경 전에 체크포인트 실행
try {
  // 먼저 현재 journal mode 확인
  const currentMode = db.pragma('journal_mode') as { journal_mode: string };
  console.log('Current journal mode:', currentMode);
  
  // WAL 모드였다면 체크포인트 실행
  if (currentMode.journal_mode === 'wal') {
    db.pragma('wal_checkpoint(TRUNCATE)');
  }
  
  // DELETE 모드로 변경 (WAL 비활성화)
  db.pragma('journal_mode = DELETE');
  console.log('Journal mode changed to DELETE');
} catch (error) {
  console.error('Error changing journal mode:', error);
}

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