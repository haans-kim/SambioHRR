const Database = require('better-sqlite3');
const db = new Database('C:\\SambioHRData\\sambio_human.db');

console.log('=== Checking daily_analysis_results for Aug-Sep 2025 ===');
const tagDataCheck = db.prepare(`
  SELECT COUNT(*) as count, MIN(analysis_date) as min_date, MAX(analysis_date) as max_date
  FROM daily_analysis_results
  WHERE analysis_date BETWEEN '2025-08-01' AND '2025-09-30'
`).get();
console.log(JSON.stringify(tagDataCheck, null, 2));

console.log('\n=== Checking monthly_grade_stats for Aug-Sep 2025 ===');
const monthlyStats = db.prepare(`
  SELECT month, grade_level, center_name, weekly_claimed_hours, weekly_adjusted_hours
  FROM monthly_grade_stats
  WHERE substr(month, 1, 4) = '2025' AND substr(month, 6, 2) IN ('08', '09')
  LIMIT 20
`).all();
console.log(JSON.stringify(monthlyStats, null, 2));

console.log('\n=== Checking for July 2025 (should have data) ===');
const julyCheck = db.prepare(`
  SELECT COUNT(*) as count, MIN(analysis_date) as min_date, MAX(analysis_date) as max_date
  FROM daily_analysis_results
  WHERE analysis_date BETWEEN '2025-07-01' AND '2025-07-31'
`).get();
console.log(JSON.stringify(julyCheck, null, 2));

db.close();
