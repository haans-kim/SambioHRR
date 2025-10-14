#!/usr/bin/env npx tsx
/**
 * 데이터베이스 정리 실행 도구
 * 1. 백업 생성
 * 2. 사용하지 않는 컬럼 제거
 * 3. VACUUM으로 데이터베이스 최적화
 *
 * 사용법: npx tsx scripts/cleanup-databases.ts [--dry-run]
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DRY_RUN = process.argv.includes('--dry-run');

interface CleanupTask {
  tableName: string;
  columns: string[];
}

const cleanupTasks = {
  'sambio_human.db': [
    {
      tableName: 'processing_log',
      columns: ['processed_records', 'error_count'],
    },
    {
      tableName: 'daily_analysis_results',
      columns: [
        'equipment_minutes',
        'training_minutes',
        'breakfast_minutes',
        'lunch_minutes',
        'dinner_minutes',
        'midnight_meal_minutes',
        'fitness_minutes',
        'commute_in_minutes',
        'commute_out_minutes',
        'preparation_minutes',
        'work_area_minutes',
        'non_work_area_minutes',
        'gate_area_minutes',
        'activity_count',
        'meal_count',
        'tag_count',
        'anomaly_score',
        'business_trip_hours',
      ],
    },
    {
      tableName: 'organization_daily_stats',
      columns: ['elastic_work_count', 'avg_meal_hours', 'avg_movement_hours', 'min_work_efficiency'],
    },
    {
      tableName: 'batch_jobs',
      columns: ['failure_count', 'skip_count', 'avg_processing_time', 'total_processing_time', 'batch_size'],
    },
    {
      tableName: 'batch_job_checkpoints',
      columns: ['failure_count'],
    },
    {
      tableName: 'daily_work_data',
      columns: ['rest_time', 'non_work_time', 'meal_time', 'dinner_time', 'midnight_meal_time'],
    },
    {
      tableName: 'team_characteristics',
      columns: ['morning_t1_rate', 'lunch_t1_rate', 'evening_t1_rate'],
    },
  ] as CleanupTask[],
  'sambio_analytics.db': [
    {
      tableName: 'master_events_table',
      columns: ['team_same_tag_count', 'team_total_count', 'team_tag_ratio', 'team_work_intensity', 'anomaly_score'],
    },
  ] as CleanupTask[],
};

function createBackup(dbPath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupPath = dbPath.replace('.db', `_backup_${timestamp}.db`);

  console.log(`📦 백업 생성 중: ${path.basename(backupPath)}`);

  if (DRY_RUN) {
    console.log(`   [DRY-RUN] 백업을 건너뜁니다.`);
    return backupPath;
  }

  fs.copyFileSync(dbPath, backupPath);

  const originalSize = fs.statSync(dbPath).size;
  const backupSize = fs.statSync(backupPath).size;

  if (originalSize !== backupSize) {
    throw new Error('백업 파일 크기가 원본과 다릅니다!');
  }

  console.log(`   ✅ 백업 완료: ${(backupSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
  return backupPath;
}

function dropColumn(db: Database.Database, tableName: string, columnName: string): void {
  console.log(`   - ${columnName} 제거 중...`);

  if (DRY_RUN) {
    console.log(`     [DRY-RUN] 컬럼 제거를 건너뜁니다.`);
    return;
  }

  try {
    // SQLite는 DROP COLUMN을 지원하지만, 일부 버전에서는 테이블 재생성이 필요할 수 있음
    db.prepare(`ALTER TABLE "${tableName}" DROP COLUMN "${columnName}"`).run();
    console.log(`     ✅ 제거 완료`);
  } catch (error: any) {
    if (error.message.includes('no such column')) {
      console.log(`     ⚠️  컬럼이 이미 존재하지 않습니다.`);
    } else {
      console.error(`     ❌ 오류: ${error.message}`);
      throw error;
    }
  }
}

function cleanupDatabase(dbPath: string, tasks: CleanupTask[]): void {
  const dbName = path.basename(dbPath);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧹 정리 중: ${dbName}`);
  console.log('='.repeat(80));

  if (!fs.existsSync(dbPath)) {
    console.log(`⚠️  데이터베이스 파일을 찾을 수 없습니다: ${dbPath}`);
    return;
  }

  // 백업 생성
  const backupPath = createBackup(dbPath);

  // 데이터베이스 열기
  const db = new Database(dbPath, { readonly: DRY_RUN });

  try {
    // 각 테이블의 컬럼 제거
    for (const task of tasks) {
      console.log(`\n📋 테이블: ${task.tableName}`);
      console.log(`   제거할 컬럼: ${task.columns.length}개`);

      for (const columnName of task.columns) {
        dropColumn(db, task.tableName, columnName);
      }
    }

    // VACUUM으로 데이터베이스 최적화
    if (!DRY_RUN) {
      console.log(`\n🔧 데이터베이스 최적화 중 (VACUUM)...`);
      const beforeSize = fs.statSync(dbPath).size;

      db.prepare('VACUUM').run();

      const afterSize = fs.statSync(dbPath).size;
      const savedSize = beforeSize - afterSize;
      const savedPercent = ((savedSize / beforeSize) * 100).toFixed(2);

      console.log(`   ✅ 최적화 완료`);
      console.log(`   이전 크기: ${(beforeSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
      console.log(`   현재 크기: ${(afterSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
      console.log(`   절약된 용량: ${(savedSize / 1024 / 1024).toFixed(2)} MB (${savedPercent}%)`);
    } else {
      console.log(`\n🔧 [DRY-RUN] VACUUM을 건너뜁니다.`);
    }

    db.close();
  } catch (error) {
    console.error(`\n❌ 오류 발생:`, error);
    db.close();

    if (!DRY_RUN) {
      console.log(`\n🔄 백업에서 복구 중...`);
      fs.copyFileSync(backupPath, dbPath);
      console.log(`   ✅ 복구 완료`);
    }

    throw error;
  }
}

function deleteEmptyTables(dbPath: string): void {
  const dbName = path.basename(dbPath);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🗑️  빈 테이블 확인: ${dbName}`);
  console.log('='.repeat(80));

  const db = new Database(dbPath, { readonly: true });

  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];

    const emptyTables: string[] = [];

    for (const { name: tableName } of tables) {
      const result = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as { count: number };
      if (result.count === 0) {
        emptyTables.push(tableName);
      }
    }

    if (emptyTables.length > 0) {
      console.log(`\n빈 테이블 ${emptyTables.length}개 발견:`);
      emptyTables.forEach(table => console.log(`   - ${table}`));
      console.log(`\n⚠️  수동으로 확인 후 제거를 고려하세요:`);
      emptyTables.forEach(table => {
        console.log(`   DROP TABLE IF EXISTS "${table}";`);
      });
    } else {
      console.log(`\n✅ 빈 테이블이 없습니다.`);
    }

    db.close();
  } catch (error) {
    console.error(`\n❌ 오류 발생:`, error);
    db.close();
  }
}

function main() {
  console.log('🚀 데이터베이스 정리 시작\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY-RUN 모드: 실제 변경은 수행하지 않습니다.\n');
  }

  const projectRoot = process.cwd();

  // 각 데이터베이스 정리
  for (const [dbName, tasks] of Object.entries(cleanupTasks)) {
    const dbPath = path.join(projectRoot, dbName);
    cleanupDatabase(dbPath, tasks);
  }

  // 빈 테이블 확인
  console.log('\n\n');
  for (const dbName of Object.keys(cleanupTasks)) {
    const dbPath = path.join(projectRoot, dbName);
    deleteEmptyTables(dbPath);
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('✅ 데이터베이스 정리 완료');
  console.log('='.repeat(80));

  if (!DRY_RUN) {
    console.log('\n백업 파일들은 프로젝트 루트에 저장되었습니다.');
    console.log('정상 동작을 확인한 후 백업 파일들을 삭제하세요.');
  }
}

main();
