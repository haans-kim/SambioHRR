import { NextRequest, NextResponse } from 'next/server';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

let streamlitProcess: any = null;
const isWindows = os.platform() === 'win32';

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'start') {
      // Check if already running
      if (streamlitProcess) {
        return NextResponse.json({
          success: true,
          message: 'Streamlit server is already running',
          url: 'http://localhost:8501'
        });
      }

      // Check if port 8501 is in use (cross-platform)
      try {
        const checkPortCmd = isWindows
          ? 'netstat -ano | findstr :8501'
          : 'lsof -ti:8501';
        const { stdout } = await execAsync(checkPortCmd);
        if (stdout.trim()) {
          return NextResponse.json({
            success: true,
            message: 'Streamlit server is already running on port 8501',
            url: 'http://localhost:8501'
          });
        }
      } catch (error) {
        // Port is not in use, continue
      }

      // Start Streamlit server (cross-platform)
      const serverPath = path.join(process.cwd(), 'excel-upload-server');
      const venvBin = isWindows
        ? path.join(serverPath, 'venv', 'Scripts', 'streamlit.exe')
        : path.join(serverPath, 'venv', 'bin', 'streamlit');
      const appPath = path.join(serverPath, 'streamlit_app.py');

      streamlitProcess = spawn(venvBin, [
        'run',
        appPath,
        '--server.port',
        '8501',
        '--server.address',
        'localhost',
        '--server.headless',
        'true'
      ], {
        cwd: serverPath,
        detached: false,
        stdio: 'ignore'
      });

      streamlitProcess.on('error', (error: Error) => {
        console.error('Failed to start Streamlit:', error);
        streamlitProcess = null;
      });

      streamlitProcess.on('exit', (code: number) => {
        console.log(`Streamlit server exited with code ${code}`);
        streamlitProcess = null;
      });

      // Wait a bit for server to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      return NextResponse.json({
        success: true,
        message: 'Streamlit server started successfully',
        url: 'http://localhost:8501'
      });

    } else if (action === 'stop') {
      if (streamlitProcess) {
        streamlitProcess.kill();
        streamlitProcess = null;
        return NextResponse.json({
          success: true,
          message: 'Streamlit server stopped'
        });
      }

      // Try to kill any process on port 8501 (cross-platform)
      try {
        if (isWindows) {
          const { stdout } = await execAsync('netstat -ano | findstr :8501');
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
              await execAsync(`taskkill /F /PID ${pid}`);
            }
          }
        } else {
          // macOS/Linux: use lsof to find and kill
          const { stdout } = await execAsync('lsof -ti:8501');
          const pid = stdout.trim();
          if (pid) {
            await execAsync(`kill -9 ${pid}`);
          }
        }
        return NextResponse.json({
          success: true,
          message: 'Streamlit server stopped'
        });
      } catch (error) {
        return NextResponse.json({
          success: true,
          message: 'No Streamlit server running'
        });
      }

    } else if (action === 'status') {
      // Check if port 8501 is in use (cross-platform)
      try {
        const checkPortCmd = isWindows
          ? 'netstat -ano | findstr :8501'
          : 'lsof -ti:8501';
        const { stdout } = await execAsync(checkPortCmd);
        const isRunning = stdout.trim().length > 0;
        return NextResponse.json({
          success: true,
          running: isRunning,
          url: isRunning ? 'http://localhost:8501' : null
        });
      } catch (error) {
        return NextResponse.json({
          success: true,
          running: false,
          url: null
        });
      }
    }

    return NextResponse.json({
      success: false,
      message: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Streamlit server control error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  // Check server status (cross-platform)
  try {
    const checkPortCmd = isWindows
      ? 'netstat -ano | findstr :8501'
      : 'lsof -ti:8501';
    const { stdout } = await execAsync(checkPortCmd);
    const isRunning = stdout.trim().length > 0;
    return NextResponse.json({
      success: true,
      running: isRunning,
      url: isRunning ? 'http://localhost:8501' : null
    });
  } catch (error) {
    return NextResponse.json({
      success: true,
      running: false,
      url: null
    });
  }
}
