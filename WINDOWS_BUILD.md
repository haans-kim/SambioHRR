# Windows에서 SambioHRR Electron 앱 빌드하기

이 문서는 Windows PC에서 SambioHRR Electron 데스크톱 앱을 빌드하는 방법을 설명합니다.

## 사전 준비

### 1. Node.js 설치

1. https://nodejs.org/ 방문
2. **LTS 버전** (20.x 이상) 다운로드
3. 설치 프로그램 실행
4. 설치 시 "Automatically install necessary tools" 체크

### 2. Git 설치 (옵션 A 사용 시)

1. https://git-scm.com/download/win 방문
2. Git for Windows 다운로드 및 설치

### 3. 설치 확인

PowerShell 또는 명령 프롬프트(CMD)를 열고:

```powershell
# Node.js 버전 확인
node --version
# 출력 예: v20.11.0

# npm 버전 확인
npm --version
# 출력 예: 10.2.4

# Git 버전 확인 (옵션 A 사용 시)
git --version
# 출력 예: git version 2.43.0
```

---

## 소스 코드 가져오기

### 옵션 A: Git Clone (추천)

```powershell
# 원하는 폴더로 이동
cd C:\Users\[사용자이름]\Desktop

# 리포지토리 클론
git clone https://github.com/haans-kim/SambioHRR.git

# 프로젝트 폴더로 이동
cd SambioHRR
```

### 옵션 B: ZIP 파일 사용

1. 전달받은 `SambioHRR-source.zip` 파일을 압축 해제
2. 압축 해제한 폴더로 이동
   ```powershell
   cd C:\Users\[사용자이름]\Desktop\SambioHRR
   ```

---

## 빌드 과정

### 1. 의존성 설치

PowerShell 또는 CMD에서:

```powershell
npm install
```

**예상 시간**: 3-5분

**출력 예시**:
```
added 714 packages in 3m
124 packages are looking for funding
```

**문제 발생 시**:
- 방화벽이 npm을 차단하는 경우 → 일시적으로 방화벽 해제
- 프록시 설정 필요한 경우:
  ```powershell
  npm config set proxy http://proxy.company.com:8080
  npm config set https-proxy http://proxy.company.com:8080
  ```

### 2. Windows용 빌드

```powershell
npm run electron:build:win
```

**예상 시간**: 5-10분 (첫 빌드 시)

**빌드 과정**:
1. Next.js 프로덕션 빌드
2. Electron TypeScript 컴파일
3. Electron 바이너리 다운로드
4. 네이티브 모듈(better-sqlite3) 빌드
5. 앱 패키징
6. NSIS 설치 프로그램 생성

**출력 예시**:
```
> hr-dashboard@0.1.0 electron:build:win
> npm run build && npm run electron:compile && electron-builder --win --x64

✓ Compiled successfully
✓ Generating static pages
✓ Finalizing page optimization

  • electron-builder  version=26.0.12
  • loaded configuration  file=package.json
  • packaging       platform=win32 arch=x64
  • building        target=nsis
  • building block map  blockMapFile=release\SambioHRR Setup 0.1.0.exe.blockmap
```

### 3. 빌드 결과 확인

빌드가 성공하면 `release` 폴더에 다음 파일들이 생성됩니다:

```
release/
├── SambioHRR Setup 0.1.0.exe       (설치 프로그램 - 이 파일 사용!)
├── SambioHRR Setup 0.1.0.exe.blockmap
└── win-unpacked/                    (압축 해제된 앱 파일들)
    ├── SambioHRR.exe
    ├── resources/
    └── ...
```

**설치 파일 크기**: 약 200-300 MB

---

## 설치 및 실행

### 설치 방법

1. `release\SambioHRR Setup 0.1.0.exe` 더블클릭
2. Windows Defender 경고가 나타날 수 있음:
   - "추가 정보" 클릭
   - "실행" 클릭
3. 설치 경로 선택 (기본값: `C:\Program Files\SambioHRR`)
4. 설치 완료

### 실행

- **바탕화면 바로가기**에서 실행
- 또는 시작 메뉴에서 "SambioHRR" 검색

### 데이터베이스 위치

앱 실행 후 데이터베이스는 다음 위치에 생성됩니다:

```
C:\Users\[사용자이름]\AppData\Roaming\SambioHRR\sambio_human.db
```

**백업 방법**:
1. `Win + R` → `%APPDATA%\SambioHRR` 입력 → Enter
2. `sambio_human.db` 파일 복사

---

## 문제 해결 (Troubleshooting)

### 빌드 오류

#### 1. "Python을 찾을 수 없음"

**증상**:
```
gyp ERR! stack Error: Can't find Python executable "python"
```

**해결**:
```powershell
# Python 3.x 설치
# https://www.python.org/downloads/

# 또는 Windows Build Tools 설치
npm install --global windows-build-tools
```

#### 2. "MSBuild를 찾을 수 없음"

**증상**:
```
gyp ERR! stack Error: Could not find any Visual Studio installation to use
```

**해결**:
```powershell
# Visual Studio Build Tools 설치
npm install --global --production windows-build-tools

# 또는 Visual Studio Community 설치
# https://visualstudio.microsoft.com/downloads/
# "Desktop development with C++" 워크로드 선택
```

#### 3. "disk space 부족"

**해결**:
- 최소 5GB 여유 공간 필요
- `node_modules` 삭제 후 재설치:
  ```powershell
  rmdir /s /q node_modules
  npm install
  ```

#### 4. "electron-builder timeout"

**해결**:
- 인터넷 연결 확인
- Electron 바이너리 수동 다운로드:
  ```powershell
  npm cache clean --force
  npm run electron:build:win
  ```

### 실행 오류

#### 1. "데이터베이스를 열 수 없음"

**확인사항**:
- `sambio_human.db` 파일이 앱에 포함되었는지 확인
- 프로젝트 루트에 `sambio_human.db` 파일이 있어야 함

**해결**:
```powershell
# DB 파일 확인
dir sambio_human.db

# 없으면 다른 PC에서 복사 필요
```

#### 2. "앱이 시작되지 않음"

**로그 확인**:
```
C:\Users\[사용자이름]\AppData\Roaming\SambioHRR\logs\
```

**일반적인 원인**:
- .NET Framework 부족 → Windows Update 실행
- 관리자 권한 필요 → 우클릭 → "관리자 권한으로 실행"

#### 3. "포트 3003이 이미 사용 중"

**해결**:
```powershell
# 포트 사용 중인 프로세스 확인
netstat -ano | findstr :3003

# 프로세스 종료 (PID는 위 명령어 결과에서 확인)
taskkill /PID [프로세스ID] /F
```

---

## 고급 옵션

### 빌드 옵션 커스터마이징

#### 설치 파일 이름 변경

`package.json` 수정:
```json
{
  "name": "sambio-hrr-custom",
  "version": "1.0.0",
  "productName": "SambioHRR 2025"
}
```

#### 32비트 Windows 지원

```powershell
npm run electron:build -- --win --ia32
```

#### Portable 버전 (설치 불필요)

`package.json`의 `build.win.target` 수정:
```json
{
  "build": {
    "win": {
      "target": ["portable"]
    }
  }
}
```

빌드:
```powershell
npm run electron:compile
npx electron-builder --win
```

결과: `release\SambioHRR 0.1.0.exe` (단일 실행 파일)

### 디지털 서명 추가

**필요사항**:
- Code Signing 인증서 (.pfx 또는 .p12 파일)
- 인증서 비밀번호

**설정**:
```powershell
# 환경 변수 설정
$env:CSC_LINK = "C:\path\to\certificate.pfx"
$env:CSC_KEY_PASSWORD = "certificate_password"

# 빌드
npm run electron:build:win
```

---

## 배포 체크리스트

### 빌드 전

- [ ] `sambio_human.db` 파일이 프로젝트 루트에 있는지 확인
- [ ] `package.json`의 버전 번호 업데이트
- [ ] 모든 변경사항 커밋 및 푸시
- [ ] 개발 모드에서 테스트 완료

### 빌드 후

- [ ] `release\SambioHRR Setup 0.1.0.exe` 파일 생성 확인
- [ ] 파일 크기 확인 (200-300MB 정상)
- [ ] 바이러스 검사 (Windows Defender 또는 백신 프로그램)

### 테스트

- [ ] 깨끗한 Windows PC에 설치 테스트
- [ ] 앱 실행 및 데이터베이스 로드 확인
- [ ] Excel 업로드 기능 테스트
- [ ] 데이터 조회 및 분석 화면 확인
- [ ] 앱 종료 후 재실행 시 데이터 유지 확인

### 배포

- [ ] 릴리스 노트 작성
- [ ] 설치 가이드 준비
- [ ] 고객사 보안팀 사전 승인
- [ ] 설치 파일 전달 (USB, 공유 폴더, 이메일 등)

---

## 빠른 빌드 명령어 요약

```powershell
# 1. 소스 코드 받기
git clone https://github.com/haans-kim/SambioHRR.git
cd SambioHRR

# 2. 의존성 설치
npm install

# 3. 빌드
npm run electron:build:win

# 4. 결과물 확인
dir release

# 5. 설치 프로그램 실행
.\release\SambioHRR Setup 0.1.0.exe
```

---

## 지원

### 문제 발생 시

1. **로그 확인**:
   - 빌드 로그: PowerShell 출력
   - 앱 로그: `%APPDATA%\SambioHRR\logs\`

2. **GitHub Issues**:
   - https://github.com/haans-kim/SambioHRR/issues

3. **문서 참고**:
   - `ELECTRON.md` - Electron 아키텍처 및 상세 가이드
   - `README.md` - 프로젝트 개요

---

**마지막 업데이트**: 2025-10-22
**버전**: 0.1.0
**대상 OS**: Windows 10/11 (64-bit)
