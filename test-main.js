const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const logPath = path.join(path.dirname(process.execPath), 'test-electron.log');
fs.writeFileSync(logPath, 'Test log started\n');

app.on('ready', () => {
  fs.appendFileSync(logPath, 'App ready\n');
  
  const win = new BrowserWindow({
    width: 800,
    height: 600
  });
  
  fs.appendFileSync(logPath, 'Window created\n');
  
  win.loadURL('https://www.google.com');
  
  fs.appendFileSync(logPath, 'URL loaded\n');
});
