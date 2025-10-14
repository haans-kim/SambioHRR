/**
 * Next.js API route to control the FastAPI upload server
 * Spawns Python FastAPI server on-demand
 */
import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

// Global server instance tracker
let uploadServer: ChildProcess | null = null;
let serverPort = 8000;
let idleTimeout: NodeJS.Timeout | null = null;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Start the FastAPI upload server
 */
function startUploadServer(): Promise<{ success: boolean; port: number; message: string }> {
  return new Promise((resolve, reject) => {
    if (uploadServer) {
      // Server already running
      resetIdleTimeout();
      resolve({
        success: true,
        port: serverPort,
        message: 'Server already running'
      });
      return;
    }

    const serverPath = path.join(process.cwd(), 'excel-upload-server');
    // Use venv Python to ensure dependencies are available
    const pythonExec = path.join(serverPath, 'venv', 'bin', 'python');

    console.log('[Upload Server] Starting FastAPI server...');
    console.log('[Upload Server] Server path:', serverPath);
    console.log('[Upload Server] Python executable:', pythonExec);

    // Spawn Python FastAPI server
    uploadServer = spawn(pythonExec, ['-m', 'uvicorn', 'main:app', '--port', String(serverPort), '--host', '127.0.0.1'], {
      cwd: serverPath,
      env: {
        ...process.env,
        PORT: String(serverPort),
        PYTHONUNBUFFERED: '1'
      }
    });

    let startupComplete = false;

    // Handle stdout
    uploadServer.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('[Upload Server]', output);

      // Check if server is ready - look for startup complete message
      if (!startupComplete && output.includes('Application startup complete')) {
        startupComplete = true;
        resetIdleTimeout();
        resolve({
          success: true,
          port: serverPort,
          message: 'Server started successfully'
        });
      }
    });

    // Handle stderr (uvicorn logs go to stderr)
    uploadServer.stderr?.on('data', (data) => {
      const output = data.toString();
      console.error('[Upload Server Error]', output);

      // Check if server is ready - uvicorn logs go to stderr
      if (!startupComplete && output.includes('Application startup complete')) {
        startupComplete = true;
        resetIdleTimeout();
        resolve({
          success: true,
          port: serverPort,
          message: 'Server started successfully'
        });
      }
    });

    // Handle process exit
    uploadServer.on('exit', (code) => {
      console.log(`[Upload Server] Process exited with code ${code}`);
      uploadServer = null;
      clearIdleTimeout();
    });

    // Handle errors
    uploadServer.on('error', (error) => {
      console.error('[Upload Server] Failed to start:', error);
      uploadServer = null;
      clearIdleTimeout();
      if (!startupComplete) {
        reject(new Error(`Failed to start server: ${error.message}`));
      }
    });

    // Timeout if server doesn't start within 10 seconds
    setTimeout(() => {
      if (!startupComplete) {
        stopUploadServer();
        reject(new Error('Server startup timeout'));
      }
    }, 10000);
  });
}

/**
 * Stop the FastAPI upload server
 */
function stopUploadServer(): void {
  if (uploadServer) {
    console.log('[Upload Server] Stopping server...');
    uploadServer.kill();
    uploadServer = null;
  }
  clearIdleTimeout();
}

/**
 * Reset idle timeout
 */
function resetIdleTimeout(): void {
  clearIdleTimeout();

  idleTimeout = setTimeout(() => {
    console.log('[Upload Server] Idle timeout reached, stopping server...');
    stopUploadServer();
  }, IDLE_TIMEOUT_MS);
}

/**
 * Clear idle timeout
 */
function clearIdleTimeout(): void {
  if (idleTimeout) {
    clearTimeout(idleTimeout);
    idleTimeout = null;
  }
}

/**
 * Check if server is running and healthy
 */
async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${serverPort}/`, {
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * POST /api/upload-server/control
 * Control the upload server (start/stop/status)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'start':
        try {
          const result = await startUploadServer();
          return NextResponse.json(result);
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              message: error instanceof Error ? error.message : 'Failed to start server'
            },
            { status: 500 }
          );
        }

      case 'stop':
        stopUploadServer();
        return NextResponse.json({
          success: true,
          message: 'Server stopped'
        });

      case 'status':
        const isRunning = uploadServer !== null;
        const isHealthy = isRunning ? await checkServerHealth() : false;

        return NextResponse.json({
          success: true,
          status: isRunning ? (isHealthy ? 'running' : 'unhealthy') : 'stopped',
          port: isRunning ? serverPort : null
        });

      default:
        return NextResponse.json(
          { success: false, message: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Upload Server Control] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload-server/control
 * Get server status
 */
export async function GET() {
  const isRunning = uploadServer !== null;
  const isHealthy = isRunning ? await checkServerHealth() : false;

  return NextResponse.json({
    status: isRunning ? (isHealthy ? 'running' : 'unhealthy') : 'stopped',
    port: isRunning ? serverPort : null,
    uptime: isRunning ? process.uptime() : null
  });
}

// Cleanup on process termination
process.on('exit', () => {
  stopUploadServer();
});

process.on('SIGINT', () => {
  stopUploadServer();
  process.exit();
});

process.on('SIGTERM', () => {
  stopUploadServer();
  process.exit();
});
