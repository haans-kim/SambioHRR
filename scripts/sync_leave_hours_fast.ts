#!/usr/bin/env npx tsx
import Database from 'better-sqlite3';

const db = new Database('./sambio_human.db');

console.log('📊 Fast leave_hours synchronization...');

// 한 달씩 처리
const months = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'];

for (const month of months) {
  console.log(`\n🔄 Processing ${month}...`);

  // 임시 테이블 생성
  db.exec(`
    DROP TABLE IF EXISTS temp_leave_data;
    CREATE TEMP TABLE temp_leave_data AS
    SELECT
      CAST(사번 AS TEXT) as employee_id,
      DATE(근무일) as work_date,
      SUM(휴가_연차) as leave_hours,
      GROUP_CONCAT(DISTINCT CASE WHEN 휴가_연차 > 0 THEN 근태명 END) as leave_type
    FROM claim_data
    WHERE 근무일 LIKE '${month}%'
    GROUP BY 사번, DATE(근무일)
    HAVING SUM(휴가_연차) > 0
  `);

  // 인덱스 생성
  db.exec(`CREATE INDEX idx_temp_leave ON temp_leave_data(employee_id, work_date)`);

  // UPDATE 실행
  const result = db.prepare(`
    UPDATE daily_analysis_results
    SET
      leave_hours = COALESCE((
        SELECT leave_hours
        FROM temp_leave_data t
        WHERE t.employee_id = daily_analysis_results.employee_id
          AND t.work_date = DATE(daily_analysis_results.analysis_date)
      ), 0),
      leave_type = (
        SELECT leave_type
        FROM temp_leave_data t
        WHERE t.employee_id = daily_analysis_results.employee_id
          AND t.work_date = DATE(daily_analysis_results.analysis_date)
      )
    WHERE analysis_date LIKE '${month}%'
  `).run();

  console.log(`  Updated ${result.changes} records`);

  // 통계 확인
  const stats = db.prepare(`
    SELECT
      COUNT(CASE WHEN leave_hours > 0 THEN 1 END) as leave_records,
      ROUND(SUM(leave_hours), 0) as total_hours
    FROM daily_analysis_results
    WHERE analysis_date LIKE '${month}%'
  `).get() as any;

  console.log(`  Leave records: ${stats.leave_records}, Total hours: ${stats.total_hours || 0}`);
}

// 최종 통계
const finalStats = db.prepare(`
  SELECT
    COUNT(*) as total_records,
    COUNT(CASE WHEN leave_hours > 0 THEN 1 END) as leave_records,
    ROUND(SUM(leave_hours), 0) as total_leave_hours,
    ROUND(AVG(CASE WHEN leave_hours > 0 THEN leave_hours END), 1) as avg_leave_hours
  FROM daily_analysis_results
  WHERE analysis_date BETWEEN '2025-01-01' AND '2025-06-30'
`).get() as any;

console.log('\n✅ Final statistics:');
console.log(`Total records: ${finalStats.total_records}`);
console.log(`Records with leave: ${finalStats.leave_records}`);
console.log(`Total leave hours: ${finalStats.total_leave_hours || 0}`);
console.log(`Average leave hours: ${finalStats.avg_leave_hours || 0}`);

db.close();
console.log('\n✨ Synchronization completed!');