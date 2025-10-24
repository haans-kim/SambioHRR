const Database = require('better-sqlite3');
const db = new Database('C:\\SambioHRData\\sambio_human.db');

console.log('=== Available months in claim_data ===');
const claimMonths = db.prepare(`
  SELECT
    substr(DATE(근무일), 1, 7) as month,
    COUNT(*) as record_count,
    MIN(DATE(근무일)) as first_date,
    MAX(DATE(근무일)) as last_date
  FROM claim_data
  GROUP BY substr(DATE(근무일), 1, 7)
  ORDER BY month DESC
  LIMIT 20
`).all();
console.log(JSON.stringify(claimMonths, null, 2));

console.log('\n=== Check if monthly_grade_stats exists for months 7-9 ===');
const stats79 = db.prepare(`
  SELECT month, COUNT(*) as count
  FROM monthly_grade_stats
  WHERE month IN ('2025-07', '2025-08', '2025-09')
  GROUP BY month
`).all();
console.log(JSON.stringify(stats79, null, 2));

db.close();
