#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// 백업 폴더 경로들
const backupDirs = [
  './DB Backup 2025.09.15',
  './DB Backup 2025.09.16 (휴일 반영 전)',
  './DB Backup 2025.0.15'
];

function cleanupDatabase(dbPath) {
  if (!fs.existsSync(dbPath)) {
    console.log(`DB file not found: ${dbPath}`);
    return;
  }

  console.log(`Processing: ${dbPath}`);

  try {
    // 데이터베이스 열기
    const db = new Database(dbPath, {
      readonly: false,
      fileMustExist: true
    });

    // 현재 journal mode 확인
    const currentMode = db.pragma('journal_mode');
    console.log(`  Current journal mode: ${currentMode.journal_mode}`);

    // WAL 모드였다면 체크포인트 실행하고 DELETE 모드로 변경
    if (currentMode.journal_mode === 'wal') {
      console.log('  Executing checkpoint...');
      db.pragma('wal_checkpoint(TRUNCATE)');

      console.log('  Changing to DELETE mode...');
      db.pragma('journal_mode = DELETE');

      const newMode = db.pragma('journal_mode');
      console.log(`  New journal mode: ${newMode.journal_mode}`);
    } else {
      console.log('  Already in DELETE mode');
    }

    // 데이터베이스 닫기
    db.close();

    // SHM과 WAL 파일 삭제
    const shmPath = `${dbPath}-shm`;
    const walPath = `${dbPath}-wal`;

    if (fs.existsSync(shmPath)) {
      fs.unlinkSync(shmPath);
      console.log(`  Deleted: ${path.basename(shmPath)}`);
    }

    if (fs.existsSync(walPath)) {
      fs.unlinkSync(walPath);
      console.log(`  Deleted: ${path.basename(walPath)}`);
    }

    console.log('  ✅ Complete\n');
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}\n`);
  }
}

console.log('=== SQLite SHM/WAL File Cleanup ===\n');

// 각 백업 폴더 처리
backupDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`Directory not found: ${dir}\n`);
    return;
  }

  console.log(`Directory: ${dir}`);

  // 폴더 내의 모든 .db 파일 찾기
  const files = fs.readdirSync(dir);
  const dbFiles = files.filter(file => file.endsWith('.db'));

  dbFiles.forEach(dbFile => {
    const dbPath = path.join(dir, dbFile);
    cleanupDatabase(dbPath);
  });
});

console.log('=== Cleanup Complete ===');