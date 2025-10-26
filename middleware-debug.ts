// middleware-debug.ts
// HTTP 요청 처리 시간을 측정하기 위한 미들웨어

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

let requestCount = 0;

export function middleware(request: NextRequest) {
  requestCount++;
  const requestStart = Date.now();
  const requestId = requestCount;

  console.log(`[REQUEST-${requestId}] ========================================`);
  console.log(`[REQUEST-${requestId}] Incoming request at ${new Date().toISOString()}`);
  console.log(`[REQUEST-${requestId}] URL: ${request.url}`);
  console.log(`[REQUEST-${requestId}] Method: ${request.method}`);
  console.log(`[REQUEST-${requestId}] Headers:`, Object.fromEntries(request.headers));

  const response = NextResponse.next();

  // 응답 후 로깅
  const duration = Date.now() - requestStart;
  console.log(`[REQUEST-${requestId}] Response completed in ${duration}ms`);
  console.log(`[REQUEST-${requestId}] ========================================`);

  return response;
}

export const config = {
  matcher: '/:path*',
}
