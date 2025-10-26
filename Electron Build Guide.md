# Electron + Next.js 빌드 가이드

이 문서는 Next.js 애플리케이션을 Electron으로 패키징할 때 발생하는 주요 문제들과 해결 방법을 정리한 가이드입니다.

## 목차
1. [프로젝트 구조](#프로젝트-구조)
2. [주요 이슈와 해결방법](#주요-이슈와-해결방법)
3. [빌드 설정](#빌드-설정)
4. [로깅 시스템](#로깅-시스템)
5. [데이터베이스 경로 관리](#데이터베이스-경로-관리)
6. [빌드 및 실행](#빌드-및-실행)

---

## 프로젝트 구조

```
project/
├── app/                    # Next.js App Router 페이지
├── components/             # React 컴포넌트
├── contexts/              # React Context
├── hooks/                 # 커스텀 Hook
├── lib/                   # 유틸리티 라이브러리
├── electron/
│   └── main.ts           # Electron 메인 프로세스
├── package.json          # 패키징 설정 포함
├── next.config.ts        # Next.js 설정
└── tsconfig.json
```

---

## 주요 이슈와 해결방법

### 1. 느린 로딩 속도 문제 (6-7분 → 4초)

#### 문제
- Electron 앱이 처음 로드될 때 6-7분이 걸림
- `ready-to-show` 이벤트가 페이지 완전 로드를 기다림

#### 해결방법
**❌ 사용하지 말 것: `output: 'standalone'` 모드**
```typescript
// next.config.ts - 이렇게 하지 마세요!
const nextConfig = {
  output: 'standalone',  // ❌ HTTP 라우팅이 초기화되지 않음
}
```

**✅ 올바른 방법: `next dev` 사용**
```typescript
// electron/main.ts
const nextCli = path.join(appPath, 'node_modules', 'next', 'dist', 'bin', 'next');

nextServerProcess = spawn('node', [nextCli, 'dev', '--port', '3003'], {
  cwd: appPath,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    DB_PATH: dbPath,
  }
});
```

**결과**: 1.5초 서버 시작 + 1.1초 컴파일 = 약 4초 로딩

---

### 2. 패키징 문제 - 필수 파일 누락

#### 문제
- node_modules, 소스 디렉토리가 패키징에 포함되지 않음
- "Module not found" 에러 발생

#### 해결방법
**package.json의 `files` 배열 설정**

```json
{
  "build": {
    "appId": "com.yourcompany.yourapp",
    "productName": "YourApp",
    "asar": false,
    "files": [
      "dist-electron/**/*",
      "app/**/*",
      "components/**/*",
      "contexts/**/*",
      "hooks/**/*",
      "lib/**/*",
      ".next/**/*",
      "node_modules/**/*",
      "public/**/*",
      "package.json",
      "next.config.ts",
      "tsconfig.json",
      "!**/*.db"
    ]
  }
}
```

**중요 사항**:
- `.electronignore` 파일 사용하지 말 것 (package.json files와 충돌)
- `node_modules/**/*` 반드시 포함
- 모든 소스 디렉토리 명시적으로 포함
- 데이터베이스 파일은 제외 (`!**/*.db`)

---

### 3. Windows에서 .bin 경로 문제

#### 문제
```
Error: Cannot find module 'node_modules/.bin/next'
```

Windows에서는 `.bin` 폴더가 symlink이므로 패키징되지 않음.

#### 해결방법
```typescript
// ❌ 잘못된 방법
const nextCli = path.join(appPath, 'node_modules', '.bin', 'next');

// ✅ 올바른 방법
const nextCli = path.join(appPath, 'node_modules', 'next', 'dist', 'bin', 'next');
```

---

## 빌드 설정

### next.config.ts

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ❌ output: 'standalone'를 사용하지 마세요!

  images: {
    unoptimized: process.env.ELECTRON_BUILD === 'true',
  },

  reactStrictMode: true,

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
```

---

## 로깅 시스템

Electron 앱은 console.log가 보이지 않으므로 파일 로깅이 필수입니다.

### 로깅 구현 예제

```typescript
// electron/main.ts
import * as fs from 'fs';
import * as path from 'path';

const LOG_PATH = 'C:\\YourAppData\\electron-main.log';
let electronLogStream: fs.WriteStream | null = null;
let logBuffer: string[] = [];

function initializeLogStream() {
  if (electronLogStream) return;

  try {
    const logDir = path.dirname(LOG_PATH);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    electronLogStream = fs.createWriteStream(LOG_PATH, { flags: 'a' });

    const timestamp = new Date().toISOString();
    electronLogStream.write(`\n========================================\n`);
    electronLogStream.write(`Electron Main Process Started\n`);
    electronLogStream.write(`Time: ${timestamp}\n`);
    electronLogStream.write(`========================================\n`);

    // 버퍼된 로그 플러시
    if (logBuffer.length > 0) {
      logBuffer.forEach(msg => electronLogStream!.write(msg));
      logBuffer = [];
    }
  } catch (err) {
    console.error('Failed to create log file:', err);
  }
}

function log(message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message} ${args.map(a => JSON.stringify(a)).join(' ')}\n`;

  console.log(message, ...args);

  if (electronLogStream) {
    electronLogStream.write(logMessage);
  } else {
    logBuffer.push(logMessage);
  }
}

// 즉시 초기화 (app.ready 이전에)
initializeLogStream();
```

**핵심 포인트**:
- 로그 스트림을 즉시 초기화 (앱 충돌 시에도 로그 보존)
- 버퍼링으로 초기화 전 로그 손실 방지
- 디렉토리 자동 생성

---

## 데이터베이스 경로 관리

### 문제
- 상대 경로 사용 시 패키징 후 데이터베이스를 찾을 수 없음
- 각 API마다 다른 경로 사용

### 해결방법

#### 1. 중앙화된 DB 경로 관리 (lib/db.ts)

```typescript
// lib/db.ts
import Database from 'better-sqlite3';
import path from 'path';

const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';
const DB_DIRECTORY = 'C:\\YourAppData';

let dbPath: string;

if (isBuildTime) {
  // 빌드 타임: 메모리 DB 사용
  dbPath = ':memory:';
} else {
  // 런타임: 고정 경로 사용
  dbPath = path.join(DB_DIRECTORY, 'your_database.db');
}

const db = isBuildTime
  ? new Database(':memory:')
  : new Database(dbPath, { readonly: false });

// DB 경로도 export
export default db;
export { dbPath as DB_PATH };
```

#### 2. API에서 DB_PATH 사용

```typescript
// app/api/example/route.ts
import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { DB_PATH } from '@/lib/db';

export async function GET() {
  // ✅ 올바른 방법
  const db = new Database(DB_PATH, { readonly: true });

  // ❌ 잘못된 방법
  // const db = new Database('./database.db', { readonly: true });
  // const db = new Database('database.db', { readonly: true });

  try {
    const results = db.prepare('SELECT * FROM table').all();
    return NextResponse.json(results);
  } finally {
    db.close();
  }
}
```

#### 3. Electron에서 DB_PATH 환경변수 전달

```typescript
// electron/main.ts
nextServerProcess = spawn('node', [nextCli, 'dev', '--port', '3003'], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    DB_PATH: 'C:\\YourAppData\\your_database.db',
  }
});
```

---

## 빌드 및 실행

### 개발 모드
```bash
npm run dev
```

### Electron 빌드 (Windows)
```bash
# 실행 중인 앱 종료
taskkill /F /IM YourApp.exe

# 빌드 실행
npx electron-builder --win --x64 --dir

# 실행 파일 위치
.\release\win-unpacked\YourApp.exe
```

### 배포 가능한 인스톨러 생성
```bash
npx electron-builder --win --x64
```

---

## 디버깅 팁

### 1. 로그 확인
```bash
# PowerShell
Get-Content 'C:\YourAppData\electron-main.log' | Select-Object -Last 100
```

### 2. 포트 충돌 해결
```bash
# 포트 3003 사용 프로세스 찾기
netstat -ano | findstr :3003

# 프로세스 종료
taskkill /F /PID <PID>
```

### 3. 캐시 문제
```bash
# .next 캐시 삭제
rm -rf .next

# node_modules 재설치
rm -rf node_modules
npm install
```

---

## 체크리스트

빌드 전 확인사항:

- [ ] `next.config.ts`에서 `output: 'standalone'` 제거
- [ ] `package.json`의 `files` 배열에 필요한 모든 디렉토리 포함
- [ ] `.electronignore` 파일 삭제
- [ ] 모든 API에서 `DB_PATH` 사용 (상대 경로 ❌)
- [ ] Windows용 Next.js CLI 경로 사용 (`node_modules/next/dist/bin/next`)
- [ ] 로깅 시스템 구현 및 즉시 초기화
- [ ] 데이터베이스 파일이 올바른 위치에 있는지 확인

---

## 일반적인 에러와 해결

### "unable to open database file"
→ `DB_PATH` 사용, 상대 경로 제거

### "Module not found: Can't resolve '@/...'"
→ `package.json` files 배열에 해당 디렉토리 추가

### "Server Crashed - Exit code: 1"
→ 로그 파일 확인, Next.js CLI 경로 확인

### "Window shows but content doesn't load"
→ `next dev` 사용, standalone 모드 제거

### Port already in use
→ `netstat -ano | findstr :PORT` 후 프로세스 종료

---

## 성능 최적화

1. **빠른 초기 로딩**: `next dev` 사용
2. **데이터베이스 최적화**: SQLite pragma 설정
   ```typescript
   db.pragma('journal_mode = DELETE');
   db.pragma('synchronous = NORMAL');
   db.pragma('cache_size = 10000');
   ```
3. **React Query 캐싱**: 적절한 staleTime 설정
4. **이미지 최적화**: `unoptimized: true` (Electron 환경)

---

## 참고 자료

- [Electron Documentation](https://www.electronjs.org/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [electron-builder](https://www.electron.build/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

---

## 버전 정보

이 가이드는 다음 버전을 기준으로 작성되었습니다:
- Next.js: 15.4.6
- Electron: 30.0.0
- electron-builder: 25.1.8
- better-sqlite3: 12.0.0

---

**작성일**: 2025-10-26
**마지막 업데이트**: 2025-10-26
