import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let nextServerProcess: ChildProcess | null = null;
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'SambioHRR',
  });

  // 개발 모드에서는 localhost:3003 사용
  // 프로덕션에서는 Next.js 서버를 내부에서 실행
  if (isDev) {
    mainWindow.loadURL('http://localhost:3003');
    mainWindow.webContents.openDevTools();
  } else {
    // 프로덕션: Next.js standalone 서버 시작
    startNextServer();
    mainWindow.loadURL('http://localhost:3003');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startNextServer() {
  // 프로덕션: Next.js를 개발 모드로 실행 (빌드 문제 회피)
  const appPath = path.join(process.resourcesPath, 'app');
  const nextBin = path.join(appPath, 'node_modules', '.bin', 'next');

  nextServerProcess = spawn(nextBin, ['dev', '-p', '3003'], {
    cwd: appPath,
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
    shell: true,
  });

  nextServerProcess.stdout?.on('data', (data) => {
    console.log(`Next.js: ${data}`);
  });

  nextServerProcess.stderr?.on('data', (data) => {
    console.error(`Next.js Error: ${data}`);
  });
}

app.on('ready', () => {
  // 개발 모드가 아니면 서버가 준비될 때까지 대기
  if (!isDev) {
    setTimeout(createWindow, 3000);
  } else {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (nextServerProcess) {
    nextServerProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('process-excel', async (event, filePath: string) => {
  // 나중에 Python 프로세스 실행 구현
  return { success: true, message: 'Excel processing not yet implemented' };
});
