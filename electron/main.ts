import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let nextServerProcess: ChildProcess | null = null;
const isDev = process.env.NODE_ENV === 'development';

// Electron 메인 프로세스 로그 파일 설정
let electronLogStream: fs.WriteStream | null = null;

// 실행 디렉토리 가져오기 (exe 파일이 위치한 디렉토리)
function getAppDataDir(): string {
  if (app.isPackaged) {
    // 패키징된 경우: exe 파일이 있는 디렉토리
    return path.dirname(process.execPath);
  } else {
    // 개발 모드: 프로젝트 루트
    return process.cwd();
  }
}

// 로그 헬퍼 함수
function log(message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message} ${args.map(a => JSON.stringify(a)).join(' ')}\n`;
  console.log(message, ...args);

  // 로그 스트림 초기화
  if (!electronLogStream) {
    try {
      const appDataDir = getAppDataDir();
      const electronLogPath = path.join(appDataDir, 'electron-main.log');
      electronLogStream = fs.createWriteStream(electronLogPath, { flags: 'a' });
      electronLogStream.write(`\n========================================\n`);
      electronLogStream.write(`Electron Main Process Started\n`);
      electronLogStream.write(`Time: ${timestamp}\n`);
      electronLogStream.write(`App Data Dir: ${appDataDir}\n`);
      electronLogStream.write(`========================================\n`);
    } catch (err) {
      console.error('Failed to create log file:', err);
    }
  }

  if (electronLogStream) {
    electronLogStream.write(logMessage);
  }
}

log('=== Electron Main Process Started ===');
log('isDev:', isDev);
log('process.execPath:', process.execPath);

// 전역 에러 핸들러
process.on('uncaughtException', (error) => {
  log('Uncaught Exception:', error);
  try {
    dialog.showErrorBox('Application Error', `Uncaught Exception: ${error.message}\n\nStack: ${error.stack}`);
  } catch (e) {
    console.error('Failed to show error dialog:', e);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  log('Unhandled Rejection at:', promise, 'reason:', reason);
});

function createWindow() {
  log('Creating window...');
  log('isDev:', isDev);
  log('app.isPackaged:', app.isPackaged);
  log('__dirname:', __dirname);
  log('process.resourcesPath:', process.resourcesPath);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // Disable web security for localhost (development/testing only)
    },
    title: 'SambioHRR',
    show: true, // 바로 표시
  });

  // 창이 준비되면 표시
  mainWindow.once('ready-to-show', () => {
    log('Window ready to show');
    mainWindow?.show();
  });

  // 웹 콘텐츠 에러 핸들링
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log('Failed to load:', errorCode, errorDescription, validatedURL);
    dialog.showErrorBox('Page Load Error', `Failed to load page:\nError: ${errorCode}\n${errorDescription}\nURL: ${validatedURL}`);
  });

  // 페이지 로드 성공 이벤트
  mainWindow.webContents.on('did-finish-load', () => {
    log('Page loaded successfully');
  });

  // 항상 dev 서버 사용 (빠른 로딩을 위해)
  startNextServer();
  waitForServer();

  async function waitForServer() {
    log('Waiting for server to be ready...');

    const maxAttempts = 150; // 150 attempts = 5 minutes (2 seconds per attempt)
    const delayBetweenAttempts = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        log(`Checking server readiness... attempt ${attempt}/${maxAttempts}`);

        // Try to fetch from the server
        const response = await fetch('http://localhost:4000', {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000) // 5 second timeout per request
        });

        if (response.ok) {
          log('✓ Server is ready and responding!');

          // Server is ready, now load the page
          try {
            if (!mainWindow) {
              throw new Error('Main window is null');
            }

            log('Loading URL: http://localhost:4000');
            await mainWindow.loadURL('http://localhost:4000');

            log('✓ URL loaded successfully');
            log('Current URL:', mainWindow.webContents.getURL());

            // DevTools는 필요시 수동으로 열기 (Ctrl+Shift+I)
            // mainWindow.webContents.openDevTools();
            return; // Success!

          } catch (error: any) {
            log('✗ Failed to load URL:', error);
            dialog.showErrorBox('Application Load Error', `Failed to load page: ${error.message}`);
            return;
          }
        }
      } catch (error: any) {
        log(`Server not ready yet (attempt ${attempt}): ${error.message}`);
      }

      // Wait before next attempt
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
      }
    }

    // If we get here, server never became ready
    log('✗ Server failed to become ready after 2 minutes');
    const appDataDir = getAppDataDir();
    dialog.showErrorBox('Server Timeout',
      'Next.js server failed to start within 2 minutes.\n\n' +
      `Please check ${path.join(appDataDir, 'nextjs-server.log')} for errors.`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startNextServer() {
  try {
    log('=== Starting Next.js Dev Server ===');

    // DB 경로 설정 - 실행 디렉토리 기준
    const appDataDir = getAppDataDir();
    const dbPath = path.join(appDataDir, 'sambio_human.db');
    log('DB path:', dbPath);
    log('DB exists:', fs.existsSync(dbPath));

    if (!fs.existsSync(dbPath)) {
      const errorMsg = `Database not found at: ${dbPath}\n\nPlease place sambio_human.db in the same directory as SambioHRR.exe`;
      log(errorMsg);
      dialog.showErrorBox('Database Error', errorMsg);
      return;
    }

    const appPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app')
      : path.join(__dirname, '..');

    log('App path:', appPath);
    log('Starting Next.js server...');

    // Next.js CLI 경로 (Windows에서는 .bin 폴더가 패키징에 포함 안됨)
    const nextCli = path.join(appPath, 'node_modules', 'next', 'dist', 'bin', 'next');
    log('Next CLI:', nextCli);
    log('Next CLI exists:', fs.existsSync(nextCli));

    // Node.js 경로 찾기
    let nodePath: string;
    if (app.isPackaged) {
      // 패키징된 경우: 번들된 node.exe 사용
      nodePath = path.join(process.resourcesPath, 'tools', 'node.exe');
      log('Using bundled Node.js:', nodePath);
      log('Bundled Node.js exists:', fs.existsSync(nodePath));
    } else {
      // 개발 모드: 시스템 node 사용
      nodePath = 'node';
      log('Using system Node.js');
    }

    nextServerProcess = spawn(nodePath, [nextCli, 'start', '--port', '4000'], {
      cwd: appPath,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        DB_PATH: dbPath,
      },
      shell: false,
      windowsHide: false,
    });

    if (!nextServerProcess) {
      log('Failed to spawn server process');
      return;
    }

    nextServerProcess.on('error', (error) => {
      log('Failed to start Next.js server:', error);
      dialog.showErrorBox('Server Error', `Failed to start Next.js server.\n\nError: ${error.message}\n\nPlease check if port 4000 is already in use.`);
    });

    nextServerProcess.on('spawn', () => {
      log('Next.js server process spawned successfully');
    });

    nextServerProcess.on('exit', (code, signal) => {
      log(`Next.js server exited with code ${code} and signal ${signal}`);

      if (code !== 0 && code !== null) {
        const appDataDir = getAppDataDir();
        dialog.showErrorBox('Server Crashed',
          `Next.js server stopped unexpectedly.\n\nExit code: ${code}\nSignal: ${signal}\n\n` +
          `Common causes:\n` +
          `- Port 3003 is already in use\n` +
          `- Database connection failed\n\n` +
          `Check log file: ${path.join(appDataDir, 'nextjs-server.log')}`);
      }
    });

    // 로그 파일 경로 - 실행 디렉토리에 저장
    const logPath = path.join(appDataDir, 'nextjs-server.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    log('Next.js server log file:', logPath);

    nextServerProcess.stdout?.on('data', (data) => {
      const msg = data.toString();
      log(`Next.js: ${msg}`);
      logStream.write(`[STDOUT] ${msg}`);
    });

    nextServerProcess.stderr?.on('data', (data) => {
      const msg = data.toString();
      log(`Next.js Error: ${msg}`);
      logStream.write(`[STDERR] ${msg}`);

      // 포트 충돌 감지
      if (msg.includes('EADDRINUSE') || msg.includes('address already in use') || msg.includes('port') && msg.includes('already')) {
        dialog.showErrorBox('Port Conflict',
          `Port 4000 is already in use!\n\n` +
          `Please close any other applications using port 4000.\n\n` +
          `You can find which program is using it by running:\n` +
          `netstat -ano | findstr ":4000"`);
      }

      // 데이터베이스 에러 감지
      if (msg.includes('SQLITE') || msg.includes('database') || msg.includes('DB')) {
        dialog.showErrorBox('Database Error', msg);
      }
    });

    log('Next.js standalone server started');
  } catch (error) {
    log('Error in startNextServer:', error);
    dialog.showErrorBox('Server Error', `Error starting server: ${error}`);
  }
}

app.on('ready', () => {
  log('App ready event fired');
  log('isDev:', isDev);

  // 바로 창 생성 (startNextServer 내부에서 대기)
  createWindow();
});

app.on('window-all-closed', () => {
  if (nextServerProcess) {
    nextServerProcess.kill();
  }
  // Stop Excel Uploader when app closes
  stopExcelUploader();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Excel Uploader Process Management
let excelUploaderProcess: ChildProcess | null = null;

function startExcelUploader() {
  log('=== Starting Excel Uploader ===');

  // 배치 스크립트 경로
  let excelUploaderPath: string;

  if (app.isPackaged) {
    // 프로덕션: extraResources에 포함된 배치 스크립트
    excelUploaderPath = path.join(process.resourcesPath, 'tools', 'excel-uploader', 'start-uploader.bat');
  } else {
    // 개발: 로컬 배치 스크립트
    excelUploaderPath = path.join(__dirname, '..', 'excel-upload-server', 'start-uploader.bat');
  }

  log('Excel Uploader path:', excelUploaderPath);
  log('Exists:', fs.existsSync(excelUploaderPath));

  if (!fs.existsSync(excelUploaderPath)) {
    const errorMsg = `Excel Uploader not found at: ${excelUploaderPath}`;
    log(errorMsg);
    return { success: false, message: errorMsg };
  }

  // Check if already running
  if (excelUploaderProcess && !excelUploaderProcess.killed) {
    log('Excel Uploader already running');
    return { success: true, message: 'Already running', alreadyRunning: true };
  }

  try {
    log('Spawning Excel Uploader process...');

    // DB 경로를 환경 변수로 전달
    const appDataDir = getAppDataDir();
    const dbPath = path.join(appDataDir, 'sambio_human.db');

    // 배치 스크립트 실행
    excelUploaderProcess = spawn('cmd.exe', ['/c', excelUploaderPath], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.dirname(excelUploaderPath),
      env: {
        ...process.env,
        DB_PATH: dbPath,
      },
      windowsHide: false,
    });

    log('Excel Uploader process spawned with PID:', excelUploaderProcess.pid);

    excelUploaderProcess.stdout?.on('data', (data) => {
      const msg = data.toString();
      log(`[ExcelUploader STDOUT] ${msg}`);
    });

    excelUploaderProcess.stderr?.on('data', (data) => {
      const msg = data.toString();
      log(`[ExcelUploader STDERR] ${msg}`);
    });

    excelUploaderProcess.on('error', (error) => {
      log('Excel Uploader process error:', error);
    });

    excelUploaderProcess.on('exit', (code, signal) => {
      log(`Excel Uploader exited with code ${code}, signal ${signal}`);
      excelUploaderProcess = null;
    });

    return { success: true, message: 'Started successfully' };
  } catch (error: any) {
    log('Failed to start Excel Uploader:', error);
    return { success: false, message: error.message || String(error) };
  }
}

function stopExcelUploader() {
  log('=== Stopping Excel Uploader ===');

  if (excelUploaderProcess && !excelUploaderProcess.killed) {
    try {
      // Windows에서는 taskkill로 자식 프로세스까지 종료
      if (process.platform === 'win32' && excelUploaderProcess.pid) {
        spawn('taskkill', ['/pid', excelUploaderProcess.pid.toString(), '/f', '/t']);
      } else {
        excelUploaderProcess.kill();
      }
      excelUploaderProcess = null;
      log('Excel Uploader stopped');
      return { success: true, message: 'Stopped successfully' };
    } catch (error: any) {
      log('Error stopping Excel Uploader:', error);
      return { success: false, message: error.message || String(error) };
    }
  }

  log('Excel Uploader not running');
  return { success: false, message: 'Not running' };
}

function getExcelUploaderStatus() {
  const isRunning = excelUploaderProcess && !excelUploaderProcess.killed;
  return {
    running: isRunning,
    pid: isRunning ? excelUploaderProcess?.pid : null,
  };
}

// IPC Handlers
ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('start-excel-uploader', () => {
  return startExcelUploader();
});

ipcMain.handle('stop-excel-uploader', () => {
  return stopExcelUploader();
});

ipcMain.handle('excel-uploader-status', () => {
  return getExcelUploaderStatus();
});

ipcMain.handle('process-excel', async (event, filePath: string) => {
  // 나중에 Python 프로세스 실행 구현
  return { success: true, message: 'Excel processing not yet implemented' };
});
