const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'release', 'win-unpacked', 'sambio_human.db');
console.log('Testing DB at:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });
  
  // List all tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('\nTables found:', tables.length);
  tables.forEach(t => console.log(' -', t.name));
  
  // Try to query daily_analysis_results
  try {
    const count = db.prepare("SELECT COUNT(*) as count FROM daily_analysis_results").get();
    console.log('\ndaily_analysis_results rows:', count.count);
  } catch (err) {
    console.error('\nError querying daily_analysis_results:', err.message);
  }
  
  db.close();
} catch (err) {
  console.error('Error opening database:', err);
}
