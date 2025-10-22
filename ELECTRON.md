# SambioHRR Electron 데스크톱 앱

Next.js 웹 애플리케이션을 Electron 데스크톱 앱으로 변환한 문서입니다.

## 개요

보안 정책으로 인해 서버-클라이언트 구조 사용이 어려운 환경을 위해, SambioHRR을 Windows/Mac 데스크톱 애플리케이션으로 변환했습니다.

### 주요 특징

- ✅ **네트워크 포트 없음**: HTTP 서버 대신 프로세스 간 통신(IPC) 사용
- ✅ **독립 실행형**: 인터넷 연결 없이 완전 오프라인 동작
- ✅ **크로스 플랫폼**: Mac, Windows, Linux 지원
- ✅ **Python 번들**: Excel 처리를 위한 Python 내장 (예정)
- ✅ **데이터 보존**: 앱 업데이트 시에도 데이터 유지

---

## 프로젝트 구조

```
SambioHRR/
├── electron/                    # Electron 관련 파일
│   ├── main.ts                 # 메인 프로세스 (앱 생명주기 관리)
│   ├── preload.ts              # Preload 스크립트 (안전한 API 노출)
│   └── tsconfig.json           # Electron TypeScript 설정
├── dist-electron/              # 컴파일된 Electron 파일
├── app/                        # Next.js 앱 (기존 코드)
├── lib/                        # 라이브러리 및 유틸리티
│   └── db.ts                   # SQLite 데이터베이스 (Electron 경로 지원)
├── public/                     # 정적 파일
├── release/                    # 빌드된 설치 파일
└── package.json                # Electron 스크립트 및 빌드 설정
```

---

## 아키텍처

### Electron 프로세스 구조

```
┌─────────────────────────────────────┐
│   Electron App (SambioHRR.exe)     │
├─────────────────────────────────────┤
│  Main Process (Node.js)             │
│  ├─ Window 관리                     │
│  ├─ Next.js 서버 (내부)            │
│  ├─ Python 프로세스 관리 (예정)    │
│  └─ SQLite 데이터베이스             │
├─────────────────────────────────────┤
│  Renderer Process (Chromium)        │
│  └─ Next.js React UI                │
└─────────────────────────────────────┘
```

### 통신 방식

- **Main ↔ Renderer**: IPC (Inter-Process Communication)
- **Python ↔ Main**: Child Process (stdin/stdout)
- **네트워크 없음**: 모든 통신은 프로세스 내부

---

## 데이터베이스 위치

### 개발 환경

```
프로젝트루트/sambio_human.db
```

### 프로덕션 환경

#### Mac
```
~/Library/Application Support/SambioHRR/sambio_human.db
```

#### Windows
```
C:\Users\[사용자]\AppData\Roaming\SambioHRR\sambio_human.db
```

#### Linux
```
~/.config/SambioHRR/sambio_human.db
```

### 데이터베이스 초기화 로직

1. **앱 첫 실행**:
   - 번들된 `sambio_human.db`를 사용자 데이터 폴더로 복사
   - 이후 해당 경로의 DB 사용

2. **앱 업데이트**:
   - 기존 DB 유지 (덮어쓰지 않음)
   - 데이터 보존

3. **DB 백업**:
   - 사용자가 해당 폴더에서 직접 복사 가능

---

## 개발 가이드

### 필수 요구사항

- Node.js 20+
- npm 또는 yarn
- Mac: Xcode Command Line Tools
- Windows: Windows SDK (선택)

### 설치

```bash
# 의존성 설치
npm install

# Electron 개발 도구 설치 (이미 포함됨)
# electron, electron-builder, concurrently, wait-on
```

### 개발 모드 실행

```bash
# Next.js 개발 서버 + Electron 동시 실행
npm run electron:dev
```

이 명령어는:
1. Next.js 개발 서버 시작 (localhost:3003)
2. Next.js 준비 대기
3. Electron 앱 실행 (개발자 도구 자동 열림)

### Electron 코드 컴파일

```bash
# TypeScript → JavaScript 컴파일
npm run electron:compile
```

결과: `dist-electron/` 폴더에 `.js` 파일 생성

---

## 빌드 가이드

### Mac용 빌드

```bash
# .dmg 파일 생성
npm run electron:build:mac
```

**출력**:
- `release/SambioHRR-0.1.0.dmg` - 설치 파일
- `release/mac/SambioHRR.app` - 실행 파일

**설치 방법**:
1. .dmg 파일 더블클릭
2. SambioHRR을 Applications 폴더로 드래그

### Windows용 빌드 (Mac에서 크로스 컴파일)

```bash
# .exe 설치 파일 생성
npm run electron:build:win
```

**출력**:
- `release/SambioHRR Setup 0.1.0.exe` - NSIS 설치 프로그램

**설치 방법**:
1. Setup.exe 실행
2. 설치 경로 선택
3. 바탕화면 바로가기 생성

**주의사항**:
- Mac에서 빌드한 Windows 앱은 디지털 서명이 없음
- Windows Defender가 "알 수 없는 게시자" 경고 표시 가능
- 고객사 보안팀 사전 승인 필요할 수 있음

### Linux용 빌드

```bash
# AppImage 파일 생성
npm run electron:build:linux
```

**출력**:
- `release/SambioHRR-0.1.0.AppImage`

---

## Electron 설정 상세

### package.json - build 섹션

```json
{
  "build": {
    "appId": "com.sambio.hrr",
    "productName": "SambioHRR",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist-electron/**/*",
      ".next/**/*",
      "public/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "extraResources": [
      {
        "from": "sambio_human.db",
        "to": "sambio_human.db"
      }
    ],
    "win": {
      "target": "nsis",
      "icon": "public/icon.ico"
    },
    "mac": {
      "target": "dmg",
      "icon": "public/icon.icns",
      "category": "public.app-category.business"
    }
  }
}
```

### 주요 설정 설명

- **files**: 앱에 포함될 파일들
- **extraResources**: 앱 외부에 복사될 리소스 (DB 파일)
- **win.target**: Windows 설치 프로그램 형식 (NSIS)
- **mac.target**: Mac 배포 형식 (DMG)

---

## Python 통합 (예정)

### 배경

Excel 파일 처리 시 170만 행, 100MB 크기의 데이터를 다룹니다.
- Node.js `xlsx` 라이브러리: 느리고 메모리 부족 ❌
- Python `pandas`: 빠르고 안정적 ✅

### 계획된 구조

```
[Electron App]
├─ UI (React/Next.js)
├─ Main Process (Node.js)
│   └─ Python 프로세스 실행
└─ Python (번들)
    ├─ python.exe (embedded)
    ├─ pandas, openpyxl
    └─ data_transformers.py
```

### 통신 방식

```typescript
// electron/main.ts
import { spawn } from 'child_process';

ipcMain.handle('process-excel', async (event, filePath) => {
  const pythonPath = path.join(process.resourcesPath, 'python', 'python.exe');
  const scriptPath = path.join(process.resourcesPath, 'scripts', 'process_excel.py');

  const pythonProcess = spawn(pythonPath, [scriptPath, filePath]);

  return new Promise((resolve, reject) => {
    pythonProcess.on('close', (code) => {
      if (code === 0) resolve({ success: true });
      else reject(new Error('Python process failed'));
    });
  });
});
```

### Python 번들 방법

1. **Python Embeddable Package 다운로드**
   ```bash
   wget https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip
   ```

2. **필요한 라이브러리 설치**
   ```bash
   pip install pandas openpyxl -t python/Lib/site-packages
   ```

3. **electron-builder 설정**
   ```json
   {
     "extraResources": [
       {
         "from": "python-embed",
         "to": "python"
       },
       {
         "from": "excel-upload-server",
         "to": "scripts"
       }
     ]
   }
   ```

---

## 보안 고려사항

### Context Isolation

`webPreferences.contextIsolation: true`로 설정하여 렌더러 프로세스와 Node.js 환경 분리.

### Preload 스크립트

안전한 API만 노출:

```typescript
// electron/preload.ts
contextBridge.exposeInMainWorld('electron', {
  processExcel: (filePath: string) => ipcRenderer.invoke('process-excel', filePath),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
});
```

### Node Integration 비활성화

`nodeIntegration: false`로 설정하여 렌더러에서 직접 Node.js API 접근 차단.

---

## 트러블슈팅

### 빌드 오류: "Cannot find module 'electron'"

```bash
npm install --save-dev electron electron-builder
```

### Mac 빌드 시 서명 오류

개발용으로는 서명 없이 빌드 가능:
```bash
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run electron:build:mac
```

### Windows에서 "앱을 열 수 없음" 경고

Mac에서 빌드한 Windows 앱은 서명이 없습니다.
- "추가 정보" → "실행" 클릭
- 또는 보안팀에 사전 승인 요청

### DB 경로 오류

로그 확인:
```bash
# Mac
~/Library/Logs/SambioHRR/main.log

# Windows
%APPDATA%\SambioHRR\logs\main.log
```

DB 경로가 올바른지 확인:
```typescript
console.log('Database path:', dbPath);
```

### 개발 모드에서 앱이 시작되지 않음

1. Next.js 개발 서버가 먼저 실행되었는지 확인
2. 포트 3003이 이미 사용 중인지 확인
   ```bash
   lsof -i :3003
   ```

---

## 성능 최적화

### 앱 크기 줄이기

1. **불필요한 node_modules 제외**
   ```json
   {
     "build": {
       "files": [
         "!node_modules/!(@radix-ui|@tanstack)/**/*"
       ]
     }
   }
   ```

2. **asar 압축**
   ```json
   {
     "build": {
       "asar": true
     }
   }
   ```

### 시작 속도 개선

1. **V8 스냅샷 사용**
2. **지연 로딩**: 필요한 모듈만 import
3. **프리로딩**: 자주 사용하는 데이터 미리 로드

---

## 배포 체크리스트

### 빌드 전

- [ ] 버전 번호 업데이트 (package.json)
- [ ] 아이콘 파일 준비 (.ico, .icns, .png)
- [ ] 데이터베이스 스키마 최신 상태 확인
- [ ] 의존성 보안 취약점 검사 (`npm audit`)

### 빌드

- [ ] 개발 모드에서 테스트 완료
- [ ] TypeScript 컴파일 오류 없음
- [ ] Electron 빌드 성공

### 테스트

- [ ] 설치 프로그램 실행 확인
- [ ] 앱 첫 실행 시 DB 정상 생성
- [ ] Excel 업로드 기능 테스트
- [ ] 데이터 조회/분석 기능 확인

### 배포

- [ ] 릴리스 노트 작성
- [ ] 설치 가이드 준비
- [ ] 고객사 보안팀 사전 승인
- [ ] 백업 및 복원 가이드 제공

---

## 향후 계획

### Phase 1: 기본 기능 (완료)
- [x] Electron 기본 설정
- [x] Next.js 통합
- [x] SQLite 데이터베이스 경로 설정
- [x] 크로스 플랫폼 빌드

### Phase 2: Python 통합 (진행 중)
- [ ] Python Embedded 번들
- [ ] Excel 처리 IPC 구현
- [ ] Streamlit UI를 Electron UI로 재작성

### Phase 3: 고급 기능
- [ ] 자동 업데이트 (electron-updater)
- [ ] 로그 수집 및 분석
- [ ] 에러 리포팅
- [ ] 사용자 설정 저장

### Phase 4: 최적화
- [ ] 앱 크기 최소화 (50MB 목표)
- [ ] 시작 속도 개선 (3초 이하)
- [ ] 메모리 사용량 최적화

---

## 참고 자료

### 공식 문서
- [Electron 공식 문서](https://www.electronjs.org/docs)
- [electron-builder 문서](https://www.electron.build/)
- [Next.js 문서](https://nextjs.org/docs)

### 유용한 도구
- [Electron Forge](https://www.electronforge.io/) - 대안 빌드 도구
- [electron-log](https://github.com/megahertz/electron-log) - 로깅
- [electron-updater](https://github.com/electron-userland/electron-builder/tree/master/packages/electron-updater) - 자동 업데이트

### 디버깅
- Chrome DevTools (Renderer Process)
- VS Code Debugger (Main Process)

---

## 라이선스

SambioHRR는 독점 소프트웨어입니다.

---

**마지막 업데이트**: 2025-10-22
**작성자**: Claude Code
**버전**: 0.1.0
