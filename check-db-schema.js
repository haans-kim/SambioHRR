const Database = require('better-sqlite3');
const db = new Database('./sambio_human.db', { readonly: true });

console.log('=== DATABASE TABLES ===\n');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
tables.forEach(t => console.log(`- ${t.name}`));

console.log('\n\n=== TABLE SCHEMAS ===\n');
tables.forEach(table => {
  console.log(`\n### ${table.name}`);
  const info = db.prepare(`PRAGMA table_info(${table.name})`).all();
  console.log('Columns:');
  info.forEach(col => {
    const nullable = col.notnull ? 'NOT NULL' : 'NULL';
    const pk = col.pk ? ' PRIMARY KEY' : '';
    console.log(`  ${col.name} (${col.type}) ${nullable}${pk}`);
  });

  // Row count
  try {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
    console.log(`Rows: ${count.count.toLocaleString()}`);
  } catch (e) {
    console.log(`Rows: Error counting`);
  }
});

// Indexes
console.log('\n\n=== INDEXES ===\n');
const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name").all();
indexes.forEach(idx => {
  console.log(`${idx.tbl_name}: ${idx.name}`);
});

db.close();
