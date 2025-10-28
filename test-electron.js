console.log('=== SambioHRR Electron Test ===');
console.log('process.type:', process.type);
const { app } = require('electron');
console.log('typeof app:', typeof app);
if (!app) {
  console.error('FATAL');
  process.exit(1);
}
console.log('SUCCESS!');
app.quit();
