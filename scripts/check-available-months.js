const Database = require('better-sqlite3');
const db = new Database('C:\\SambioHRData\\sambio_human.db');

console.log('=== Available months in daily_analysis_results ===');
const darMonths = db.prepare(`
  SELECT
    substr(analysis_date, 1, 7) as month,
    COUNT(*) as record_count,
    MIN(analysis_date) as first_date,
    MAX(analysis_date) as last_date
  FROM daily_analysis_results
  GROUP BY substr(analysis_date, 1, 7)
  ORDER BY month DESC
  LIMIT 20
`).all();
console.log(JSON.stringify(darMonths, null, 2));

console.log('\n=== Available months in monthly_grade_stats ===');
const statsMonths = db.prepare(`
  SELECT DISTINCT month, COUNT(*) as record_count
  FROM monthly_grade_stats
  GROUP BY month
  ORDER BY month DESC
  LIMIT 20
`).all();
console.log(JSON.stringify(statsMonths, null, 2));

console.log('\n=== Sample weekly_adjusted_hours values ===');
const samples = db.prepare(`
  SELECT month, grade_level, center_name,
         weekly_claimed_hours, weekly_adjusted_hours
  FROM monthly_grade_stats
  WHERE month IN (
    SELECT DISTINCT month FROM monthly_grade_stats ORDER BY month DESC LIMIT 5
  )
  LIMIT 30
`).all();
console.log(JSON.stringify(samples, null, 2));

db.close();
