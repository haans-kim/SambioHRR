const Database = require('better-sqlite3');
const db = new Database('C:\\SambioHRData\\sambio_human.db');

console.log('=== Available months in tag_data ===');
const tagMonths = db.prepare(`
  SELECT
    substr(ENTE_DT, 1, 6) as month_yyyymm,
    COUNT(*) as record_count,
    MIN(ENTE_DT) as first_date,
    MAX(ENTE_DT) as last_date
  FROM tag_data
  GROUP BY substr(ENTE_DT, 1, 6)
  ORDER BY month_yyyymm DESC
  LIMIT 20
`).all();

tagMonths.forEach(row => {
  const ym = row.month_yyyymm;
  const formatted = `${ym.substring(0,4)}-${ym.substring(4,6)}`;
  console.log(`${formatted}: ${row.record_count.toLocaleString()} records (${row.first_date} ~ ${row.last_date})`);
});

console.log('\n=== Check specific months (July-Sep 2025) ===');
const julyToSep = db.prepare(`
  SELECT
    substr(ENTE_DT, 1, 6) as month_yyyymm,
    COUNT(*) as record_count
  FROM tag_data
  WHERE substr(ENTE_DT, 1, 6) IN ('202507', '202508', '202509')
  GROUP BY substr(ENTE_DT, 1, 6)
  ORDER BY month_yyyymm
`).all();

console.log(JSON.stringify(julyToSep, null, 2));

db.close();
