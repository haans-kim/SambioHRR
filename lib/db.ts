import Database from 'better-sqlite3';
import path from 'path';

// Electron 환경 감지
const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;

// Next.js 빌드 타임 감지
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

// 데이터베이스 파일 경로 - C:\SambioHRData 폴더 사용
const DB_DIRECTORY = 'C:\\SambioHRData';
let dbPath: string;

console.log('[DB] Environment check:');
console.log('[DB] process.env.NODE_ENV:', process.env.NODE_ENV);
console.log('[DB] isElectron:', isElectron);
console.log('[DB] isBuildTime:', isBuildTime);

if (isBuildTime) {
  // 빌드 타임: 프로젝트 폴더의 DB 사용
  dbPath = path.join(process.cwd(), 'sambio_human.db');
  console.log('[DB] Build time - using project folder DB:', dbPath);
} else {
  // 런타임: 항상 C:\SambioHRData 사용
  dbPath = path.join(DB_DIRECTORY, 'sambio_human.db');
  console.log('[DB] Runtime - using fixed path:', dbPath);
}

// 빌드 타임에는 더미 DB 사용 (실제 연결 없음)
let db: Database.Database;

if (isBuildTime) {
  // 빌드 타임: 메모리 DB 사용 (실제 쿼리는 실행 안됨)
  db = new Database(':memory:');
  console.log('Using in-memory database for build time');
} else {
  // 런타임: 실제 DB 연결
  db = new Database(dbPath, {
    readonly: false,
    fileMustExist: !isElectron || process.env.NODE_ENV === 'development'
  });
}

// 성능 최적화
// WAL 모드 비활성화 - DELETE 모드 사용 (기본 rollback journal)
// journal_mode 변경 전에 체크포인트 실행
// 빌드 타임에는 스킵
if (!isBuildTime) {
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
}

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