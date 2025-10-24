const Database = require('better-sqlite3');
const db = new Database('C:\\SambioHRData\\sambio_human.db');

console.log('=== monthly_grade_stats for 2025 ===');
const gradeStats = db.prepare(`
  SELECT month, center_name, grade_level,
         weekly_claimed_hours, weekly_adjusted_hours
  FROM monthly_grade_stats
  WHERE substr(month, 1, 4) = '2025'
  ORDER BY month, center_name, grade_level
`).all();

// Group by month
const byMonth = {};
gradeStats.forEach(row => {
  if (!byMonth[row.month]) byMonth[row.month] = [];
  byMonth[row.month].push(row);
});

Object.keys(byMonth).sort().forEach(month => {
  console.log(`\n=== ${month} ===`);
  console.log(`Total records: ${byMonth[month].length}`);
  console.log(`Records with weekly_adjusted_hours NOT NULL: ${byMonth[month].filter(r => r.weekly_adjusted_hours !== null).length}`);
  console.log(`Records with weekly_adjusted_hours NULL: ${byMonth[month].filter(r => r.weekly_adjusted_hours === null).length}`);

  // Show sample
  console.log('\nSample (first 3 records):');
  byMonth[month].slice(0, 3).forEach(r => {
    console.log(`  ${r.center_name} / ${r.grade_level}: claimed=${r.weekly_claimed_hours}, adjusted=${r.weekly_adjusted_hours}`);
  });
});

db.close();
