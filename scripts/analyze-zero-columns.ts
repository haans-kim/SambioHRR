#!/usr/bin/env npx tsx
/**
 * 데이터베이스 정리 도구: 모든 값이 0인 컬럼 찾기
 * 사용법: npx tsx scripts/analyze-zero-columns.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface TableAnalysis {
  tableName: string;
  totalRows: number;
  zeroColumns: {
    columnName: string;
    columnType: string;
    sampleValues: any[];
  }[];
}

const dbFiles = [
  { name: 'sambio_human.db', path: path.join(process.cwd(), 'sambio_human.db') },
  { name: 'sambio_analytics.db', path: path.join(process.cwd(), 'sambio_analytics.db') },
];

function analyzeDatabase(dbPath: string, dbName: string): TableAnalysis[] {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 분석 중: ${dbName}`);
  console.log('='.repeat(80));

  const db = new Database(dbPath, { readonly: true });
  const results: TableAnalysis[] = [];

  try {
    // 모든 테이블 가져오기
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];

    console.log(`\n총 ${tables.length}개 테이블 발견\n`);

    for (const { name: tableName } of tables) {
      try {
        // 테이블의 행 수 확인
        const countResult = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as { count: number };
        const totalRows = countResult.count;

        if (totalRows === 0) {
          console.log(`⚠️  ${tableName}: 빈 테이블 (행 수: 0)`);
          continue;
        }

        // 컬럼 정보 가져오기
        const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all() as ColumnInfo[];

        // 숫자 타입 컬럼만 필터링 (INTEGER, REAL, NUMERIC, DECIMAL, FLOAT, DOUBLE)
        const numericColumns = columns.filter(col => {
          const type = col.type.toUpperCase();
          return (
            type.includes('INT') ||
            type.includes('REAL') ||
            type.includes('NUMERIC') ||
            type.includes('DECIMAL') ||
            type.includes('FLOAT') ||
            type.includes('DOUBLE') ||
            type === '' // SQLite에서 타입 없는 경우도 체크
          );
        });

        if (numericColumns.length === 0) {
          continue;
        }

        const zeroColumns: TableAnalysis['zeroColumns'] = [];

        // 각 숫자 컬럼에 대해 0이 아닌 값이 있는지 확인
        for (const column of numericColumns) {
          const columnName = column.name;

          // 0이 아닌 값의 개수 확인
          const nonZeroCount = db
            .prepare(
              `SELECT COUNT(*) as count FROM "${tableName}"
               WHERE "${columnName}" IS NOT NULL
               AND "${columnName}" != 0
               AND "${columnName}" != 0.0`
            )
            .get() as { count: number };

          // 모든 값이 0이거나 NULL인 경우
          if (nonZeroCount.count === 0) {
            // 샘플 값 가져오기
            const samples = db
              .prepare(`SELECT "${columnName}" FROM "${tableName}" LIMIT 5`)
              .all() as any[];

            zeroColumns.push({
              columnName,
              columnType: column.type || 'NONE',
              sampleValues: samples.map(s => s[columnName]),
            });
          }
        }

        if (zeroColumns.length > 0) {
          results.push({
            tableName,
            totalRows,
            zeroColumns,
          });

          console.log(`\n📋 ${tableName} (${totalRows.toLocaleString()} 행)`);
          console.log('   사용하지 않는 컬럼 (모두 0 또는 NULL):');
          zeroColumns.forEach(col => {
            console.log(`   - ${col.columnName} (${col.columnType}): ${JSON.stringify(col.sampleValues.slice(0, 3))}`);
          });
        }
      } catch (error) {
        console.error(`❌ 테이블 ${tableName} 분석 중 오류:`, error);
      }
    }

    db.close();
  } catch (error) {
    console.error(`❌ 데이터베이스 분석 중 오류:`, error);
    db.close();
  }

  return results;
}

function generateCleanupSQL(analyses: Map<string, TableAnalysis[]>): string {
  let sql = '-- 데이터베이스 정리 SQL 스크립트\n';
  sql += '-- 생성일: ' + new Date().toISOString() + '\n';
  sql += '-- 주의: 실행 전 반드시 백업을 만드세요!\n\n';

  for (const [dbName, tables] of analyses.entries()) {
    if (tables.length === 0) continue;

    sql += `\n-- ============================================\n`;
    sql += `-- ${dbName}\n`;
    sql += `-- ============================================\n\n`;

    for (const table of tables) {
      if (table.zeroColumns.length === 0) continue;

      sql += `-- 테이블: ${table.tableName} (${table.totalRows.toLocaleString()} 행)\n`;
      sql += `-- 제거할 컬럼: ${table.zeroColumns.length}개\n`;

      for (const col of table.zeroColumns) {
        sql += `-- ALTER TABLE "${table.tableName}" DROP COLUMN "${col.columnName}"; -- ${col.columnType}\n`;
      }

      sql += '\n';
    }
  }

  sql += '\n-- 참고: SQLite는 ALTER TABLE DROP COLUMN을 지원하지만,\n';
  sql += '-- 테이블을 재생성해야 할 수도 있습니다.\n';
  sql += '-- 각 테이블에 대해 수동으로 확인 후 실행하세요.\n';

  return sql;
}

function main() {
  const allAnalyses = new Map<string, TableAnalysis[]>();

  // 각 데이터베이스 분석
  for (const dbFile of dbFiles) {
    const analyses = analyzeDatabase(dbFile.path, dbFile.name);
    allAnalyses.set(dbFile.name, analyses);
  }

  // 요약 출력
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 분석 요약');
  console.log('='.repeat(80));

  let totalZeroColumns = 0;
  for (const [dbName, analyses] of allAnalyses.entries()) {
    const zeroColumnCount = analyses.reduce((sum, table) => sum + table.zeroColumns.length, 0);
    totalZeroColumns += zeroColumnCount;

    console.log(`\n${dbName}:`);
    console.log(`  - 사용하지 않는 컬럼이 있는 테이블: ${analyses.length}개`);
    console.log(`  - 총 사용하지 않는 컬럼 수: ${zeroColumnCount}개`);
  }

  console.log(`\n전체 사용하지 않는 컬럼 수: ${totalZeroColumns}개`);

  // SQL 스크립트 생성
  const sqlScript = generateCleanupSQL(allAnalyses);
  const fs = require('fs');
  const sqlPath = path.join(process.cwd(), 'scripts', 'cleanup-zero-columns.sql');
  fs.writeFileSync(sqlPath, sqlScript, 'utf-8');

  console.log(`\n✅ SQL 정리 스크립트 생성 완료: ${sqlPath}`);
  console.log('\n⚠️  주의: SQL 스크립트를 실행하기 전에 반드시 데이터베이스 백업을 만드세요!');
}

main();
