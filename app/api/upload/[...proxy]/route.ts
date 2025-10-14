/**
 * Proxy route for FastAPI upload server
 * Routes /api/upload/* requests to FastAPI at localhost:8000/api/*
 */
import { NextRequest, NextResponse } from 'next/server';

const FASTAPI_BASE_URL = 'http://localhost:8000';

/**
 * Proxy all methods to FastAPI
 */
async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ proxy: string[] }> }
) {
  try {
    // Await params in Next.js 15+
    const { proxy } = await context.params;

    // Build target URL
    const proxyPath = proxy.join('/');
    const targetUrl = `${FASTAPI_BASE_URL}/api/${proxyPath}`;

    // Get search params
    const searchParams = request.nextUrl.searchParams.toString();
    const fullUrl = searchParams ? `${targetUrl}?${searchParams}` : targetUrl;

    console.log(`[Upload Proxy] ${request.method} ${fullUrl}`);

    // Forward the request to FastAPI
    const response = await fetch(fullUrl, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        // Remove Next.js specific headers
        'x-middleware-subrequest': '',
      },
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.arrayBuffer()
        : undefined,
    });

    // Get response body
    const data = await response.json();

    // Return proxied response
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('[Upload Proxy] Error:', error);

    // Check if it's a connection error (server not running)
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
      return NextResponse.json(
        {
          error: 'Upload server not running',
          message: 'Please start the upload server first',
          code: 'SERVER_NOT_RUNNING'
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: 'Proxy error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ proxy: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ proxy: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ proxy: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ proxy: string[] }> }
) {
  return proxyRequest(request, context);
}
