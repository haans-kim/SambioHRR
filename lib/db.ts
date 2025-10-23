import Database from 'better-sqlite3';
import path from 'path';

// Electron 환경 감지
const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;

// Next.js 빌드 타임 감지
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

// 데이터베이스 파일 경로 결정
let dbPath: string;

if (isElectron) {
  // Electron 환경
  try {
    const { app } = require('electron');
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
      // 개발 모드: 프로젝트 루트
      dbPath = path.join(process.cwd(), 'sambio_human.db');
    } else {
      // 프로덕션: 사용자 데이터 폴더
      const userDataPath = app.getPath('userData');
      dbPath = path.join(userDataPath, 'sambio_human.db');

      // 초기 실행 시 DB가 없으면 앱 내부에서 복사
      const fs = require('fs');
      if (!fs.existsSync(dbPath)) {
        const bundledDbPath = path.join((process as any).resourcesPath, 'sambio_human.db');
        if (fs.existsSync(bundledDbPath)) {
          fs.copyFileSync(bundledDbPath, dbPath);
          console.log('Database copied to user data folder:', dbPath);
        }
      }
    }
  } catch (error) {
    // Electron 모듈을 찾을 수 없는 경우 (Next.js 빌드 시)
    dbPath = path.join(process.cwd(), 'sambio_human.db');
  }
} else {
  // 일반 Node.js 환경 (웹 서버)
  dbPath = path.join(process.cwd(), 'sambio_human.db');
}

console.log('Database path:', dbPath);

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