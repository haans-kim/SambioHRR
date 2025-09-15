#!/usr/bin/env npx tsx
import Database from 'better-sqlite3';

const db = new Database('./sambio_human.db');

console.log('📊 Starting leave_hours synchronization from claim_data to daily_analysis_results...');

// 1. 먼저 현재 상태 확인
const beforeStats = db.prepare(`
  SELECT
    COUNT(*) as total_records,
    COUNT(CASE WHEN leave_hours > 0 THEN 1 END) as leave_records,
    SUM(leave_hours) as total_leave_hours
  FROM daily_analysis_results
  WHERE analysis_date BETWEEN '2025-01-01' AND '2025-06-30'
`).get() as any;

console.log('\n📈 Before sync:');
console.log(`Total records: ${beforeStats.total_records}`);
console.log(`Records with leave: ${beforeStats.leave_records}`);
console.log(`Total leave hours: ${beforeStats.total_leave_hours || 0}`);

// 2. claim_data의 휴가_연차 데이터를 DAR로 동기화
const updateQuery = `
  UPDATE daily_analysis_results
  SET
    leave_hours = (
      SELECT COALESCE(SUM(c.휴가_연차), 0)
      FROM claim_data c
      WHERE CAST(c.사번 AS TEXT) = daily_analysis_results.employee_id
        AND DATE(c.근무일) = DATE(daily_analysis_results.analysis_date)
    ),
    leave_type = (
      SELECT GROUP_CONCAT(DISTINCT c.근태명)
      FROM claim_data c
      WHERE CAST(c.사번 AS TEXT) = daily_analysis_results.employee_id
        AND DATE(c.근무일) = DATE(daily_analysis_results.analysis_date)
        AND c.휴가_연차 > 0
    )
  WHERE analysis_date BETWEEN '2025-01-01' AND '2025-06-30'
`;

console.log('\n🔄 Syncing leave_hours from claim_data...');
const result = db.prepare(updateQuery).run();
console.log(`Updated ${result.changes} records`);

// 3. 동기화 후 상태 확인
const afterStats = db.prepare(`
  SELECT
    COUNT(*) as total_records,
    COUNT(CASE WHEN leave_hours > 0 THEN 1 END) as leave_records,
    SUM(leave_hours) as total_leave_hours,
    ROUND(AVG(CASE WHEN leave_hours > 0 THEN leave_hours END), 1) as avg_leave_hours
  FROM daily_analysis_results
  WHERE analysis_date BETWEEN '2025-01-01' AND '2025-06-30'
`).get() as any;

console.log('\n✅ After sync:');
console.log(`Total records: ${afterStats.total_records}`);
console.log(`Records with leave: ${afterStats.leave_records}`);
console.log(`Total leave hours: ${afterStats.total_leave_hours || 0}`);
console.log(`Average leave hours (when > 0): ${afterStats.avg_leave_hours || 0}`);

// 4. 월별 통계
const monthlyStats = db.prepare(`
  SELECT
    SUBSTR(analysis_date, 1, 7) as month,
    COUNT(CASE WHEN leave_hours > 0 THEN 1 END) as leave_records,
    ROUND(SUM(leave_hours), 0) as total_leave_hours,
    ROUND(AVG(CASE WHEN leave_hours > 0 THEN leave_hours END), 1) as avg_leave_hours
  FROM daily_analysis_results
  WHERE analysis_date BETWEEN '2025-01-01' AND '2025-06-30'
  GROUP BY SUBSTR(analysis_date, 1, 7)
  ORDER BY month
`).all() as any[];

console.log('\n📅 Monthly leave statistics:');
console.log('Month    | Leave Records | Total Hours | Avg Hours');
console.log('---------|---------------|-------------|----------');
monthlyStats.forEach(row => {
  console.log(`${row.month} | ${String(row.leave_records).padStart(13)} | ${String(row.total_leave_hours).padStart(11)} | ${String(row.avg_leave_hours).padStart(9)}`);
});

// 5. 휴가 유형별 통계
const leaveTypes = db.prepare(`
  SELECT
    leave_type,
    COUNT(*) as count,
    ROUND(SUM(leave_hours), 0) as total_hours,
    ROUND(AVG(leave_hours), 1) as avg_hours
  FROM daily_analysis_results
  WHERE leave_type IS NOT NULL
    AND analysis_date BETWEEN '2025-01-01' AND '2025-06-30'
  GROUP BY leave_type
  ORDER BY count DESC
  LIMIT 10
`).all() as any[];

console.log('\n🏖️ Top 10 leave types:');
console.log('Leave Type                         | Count | Total Hours | Avg Hours');
console.log('-----------------------------------|-------|-------------|----------');
leaveTypes.forEach(row => {
  const leaveType = row.leave_type.substring(0, 35).padEnd(35);
  console.log(`${leaveType} | ${String(row.count).padStart(5)} | ${String(row.total_hours).padStart(11)} | ${String(row.avg_hours).padStart(9)}`);
});

db.close();
console.log('\n✨ Synchronization completed successfully!');