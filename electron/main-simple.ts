import { app, BrowserWindow } from 'electron';

console.log('Electron starting...');

app.on('ready', () => {
  console.log('App is ready');
  const win = new BrowserWindow({
    width: 800,
    height: 600
  });
  win.loadURL('https://www.google.com');
});

app.on('window-all-closed', () => {
  app.quit();
});
