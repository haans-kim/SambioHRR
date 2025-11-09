const Database = require('better-sqlite3');
const db = new Database('C:\\Project\\SambioHRR\\sambio_human.db');

console.log('\n=== meal_data 테이블 스키마 ===');
const schema = db.prepare("PRAGMA table_info(meal_data)").all();
console.log('컬럼 목록:');
schema.forEach(col => {
  console.log(`  ${col.name} (${col.type})`);
});

console.log('\n=== 기존 데이터 (4-6월) 샘플 ===');
const oldSample = db.prepare("SELECT * FROM meal_data WHERE strftime('%Y-%m', 취식일시) IN ('2025-04', '2025-05', '2025-06') LIMIT 1").get();
console.log('컬럼과 값:');
if (oldSample) {
  Object.keys(oldSample).forEach(key => {
    console.log(`  ${key}: ${oldSample[key]}`);
  });
}

console.log('\n=== 새로 업로드된 데이터 (8-10월) 샘플 ===');
const newSample = db.prepare("SELECT * FROM meal_data WHERE strftime('%Y-%m', 취식일시) IN ('2025-08', '2025-09', '2025-10') LIMIT 1").get();
console.log('컬럼과 값:');
if (newSample) {
  Object.keys(newSample).forEach(key => {
    console.log(`  ${key}: ${newSample[key]}`);
  });
} else {
  console.log('(아직 업로드 진행중...)');
}

console.log('\n=== 월별 데이터 건수 ===');
const counts = db.prepare(`
  SELECT
    strftime('%Y-%m', 취식일시) as month,
    COUNT(*) as count
  FROM meal_data
  GROUP BY strftime('%Y-%m', 취식일시)
  ORDER BY month
`).all();
counts.forEach(row => {
  console.log(`  ${row.month}: ${row.count.toLocaleString()}건`);
});

db.close();
