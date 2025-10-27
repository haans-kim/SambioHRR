# SambioHRR 빌드 가이드

## 전체 빌드 프로세스

SambioHRR은 두 개의 독립적인 애플리케이션으로 구성됩니다:
1. **메인 Electron 앱** - Next.js 기반 HR 대시보드
2. **Excel Uploader** - Python/Streamlit 기반 데이터 업로드 도구

---

## 사전 준비

### 필요한 소프트웨어:
- Node.js 18+
- Python 3.11+
- Git (선택사항)

### 체크리스트:
- [ ] Node.js가 설치되어 있는지 확인: `node --version`
- [ ] npm이 설치되어 있는지 확인: `npm --version`
- [ ] Python이 설치되어 있는지 확인: `python --version`
- [ ] Python venv가 설치되어 있는지 확인

---

## Phase 1: Excel Uploader 빌드

Excel Uploader를 먼저 빌드해야 Electron 앱에 포함시킬 수 있습니다.

### 1.1 가상환경 설정 (최초 1회만)

```batch
cd excel-upload-server

# 가상환경 생성
python -m venv venv

# 가상환경 활성화
venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 가상환경 비활성화
deactivate
```

### 1.2 Excel Uploader 빌드

```batch
cd excel-upload-server

# 빌드 스크립트 실행
build-excel-uploader.bat
```

빌드가 완료되면:
- 결과물 위치: `excel-upload-server\dist\ExcelUploader\`
- 실행 파일: `ExcelUploader.exe`
- 크기: 약 150-300MB (모든 의존성 포함)

### 1.3 Excel Uploader 테스트 (선택사항)

```batch
cd excel-upload-server\dist\ExcelUploader

# 실행
ExcelUploader.exe
```

브라우저에서 `http://localhost:8501` 접속하여 정상 작동 확인

---

## Phase 2: Electron 앱 빌드

### 2.1 의존성 설치 (최초 1회 또는 package.json 변경 시)

```batch
# 프로젝트 루트로 이동
cd C:\Project\SambioHRR

# Node.js 의존성 설치
npm install
```

### 2.2 Electron TypeScript 컴파일

```batch
# Electron 메인 프로세스 컴파일
npm run electron:compile
```

### 2.3 Electron 앱 빌드

```batch
# Windows 포터블 버전 빌드
npm run electron:build:win
```

빌드가 완료되면:
- 결과물 위치: `release\win-unpacked\`
- 실행 파일: `SambioHRR.exe`
- Excel Uploader 포함 위치: `release\win-unpacked\resources\tools\excel-uploader\`

---

## 빠른 빌드 (전체)

모든 단계를 한 번에 실행하려면:

```batch
# 1. Excel Uploader 빌드
cd excel-upload-server
build-excel-uploader.bat
cd ..

# 2. Electron 앱 빌드
npm run electron:compile
npm run electron:build:win
```

---

## 빌드 결과물 구조

```
release\win-unpacked\
├── SambioHRR.exe               # 메인 실행 파일
├── resources\
│   ├── app\                    # Next.js 앱
│   │   ├── .next\
│   │   ├── app\
│   │   ├── components\
│   │   └── ...
│   └── tools\
│       └── excel-uploader\     # Excel Uploader
│           ├── ExcelUploader.exe
│           └── _internal\      # Python 의존성
├── node_modules\
└── ... (기타 Electron 파일들)
```

---

## 배포

### 프로덕션 모드 빌드 (권장)

프로덕션 모드로 빌드하면 dev 의존성 없이 독립 실행 가능한 앱을 만들 수 있습니다.

**중요**: Electron 앱은 `next start` (프로덕션 모드)로 설정되어 있습니다. 빌드 전에 Next.js 프로덕션 빌드가 필요합니다.

```batch
# 1. Next.js 프로덕션 빌드
npm run build

# 2. Electron TypeScript 컴파일
npm run electron:compile

# 3. Electron 앱 빌드
npm run electron:build:win
```

### 배포 패키지 생성

#### 방법 1: 전체 폴더 배포 (가장 간단)

`release\win-unpacked\` 폴더와 데이터베이스를 함께 배포:

```batch
# 배포 폴더 생성
mkdir D:\Sambio

# 빌드 파일 복사
powershell -Command "Copy-Item -Path 'release\win-unpacked\*' -Destination 'D:\Sambio\' -Recurse -Force"

# 데이터베이스 복사
powershell -Command "Copy-Item -Path 'sambio_human.db' -Destination 'D:\Sambio\' -Force"
```

#### 방법 2: 압축 배포

```batch
# 폴더 이름 변경 (선택사항)
cd release
move win-unpacked SambioHRR-v1.0.0

# 데이터베이스 복사
copy ..\sambio_human.db SambioHRR-v1.0.0\

# 압축 (7-Zip 등 사용)
7z a SambioHRR-v1.0.0.zip SambioHRR-v1.0.0\
```

### 설치 방법 (사용자)

#### 포터블 방식 (권장)

1. 폴더를 원하는 위치에 복사 (예: `D:\Sambio`, `E:\SambioHRR` 등)
2. 데이터베이스 파일(`sambio_human.db`)이 실행 파일과 같은 폴더에 있는지 확인
3. `SambioHRR.exe` 실행
4. 앱이 실행 폴더 내에서 자동으로 데이터베이스와 로그 파일 생성/참조

**장점**:
- 어떤 경로에서도 실행 가능
- 폴더만 이동하면 전체 환경이 함께 이동
- USB 등 이동식 저장소에서도 실행 가능

#### 고정 경로 방식 (레거시)

1. `C:\SambioHRData` 폴더 생성
2. 빌드 파일과 데이터베이스를 `C:\SambioHRData`에 복사
3. `SambioHRR.exe` 실행

---

## 개발 모드 실행

빌드 없이 개발 모드로 실행:

### Next.js 개발 서버
```batch
npm run dev
```
브라우저에서 http://localhost:3003 접속

### Excel Uploader 개발 모드
```batch
cd excel-upload-server
venv\Scripts\activate
streamlit run streamlit_app.py --server.port 8501
```
브라우저에서 http://localhost:8501 접속

### Electron 개발 모드
```batch
npm run electron:dev
```

---

## 트러블슈팅

### Excel Uploader 빌드 실패

**증상**: PyInstaller 에러
**해결**:
```batch
cd excel-upload-server
venv\Scripts\activate
pip install --upgrade pyinstaller
pip install --upgrade streamlit streamlit-aggrid
```

### Electron 빌드 시 Excel Uploader 미포함

**증상**: "Excel Uploader not found" 에러
**원인**: Excel Uploader가 빌드되지 않음
**해결**:
1. `excel-upload-server\dist\ExcelUploader\ExcelUploader.exe` 존재 확인
2. 없으면 Phase 1 다시 실행

### 빌드된 앱 실행 시 "Module not found" 에러

**증상**: Electron 앱 실행 시 `Module not found: Can't resolve 'tailwindcss'` 같은 모듈 에러
**원인**:
1. Next.js가 dev 모드로 실행되어 dev 의존성을 찾으려고 시도
2. `.next` 캐시가 손상됨

**해결**:
```batch
# .next 캐시 삭제
rmdir /s /q .next

# Next.js 프로덕션 빌드
npm run build

# Electron 재빌드
npm run electron:compile
npm run electron:build:win
```

### 다른 경로로 복사 후 실행 안됨

**증상**: `C:\Project\SambioHRR\release\win-unpacked`에서는 실행되지만 `D:\Sambio`로 복사하면 안됨
**원인**: Next.js 프로덕션 빌드가 안되어 있거나 dev 모드로 설정됨
**해결**:
1. `electron/main.ts`에서 `next start` 모드 확인 (line 203)
2. Next.js 프로덕션 빌드 실행: `npm run build`
3. Electron 재빌드
4. 전체 폴더와 DB 파일을 함께 복사

### Excel Uploader 실행 시 포트 충돌

**증상**: "Port 8501 already in use"
**해결**:
```batch
# 포트 사용 프로세스 찾기
netstat -ano | findstr :8501

# 프로세스 종료 (PID 확인 후)
taskkill /F /PID <PID>
```

---

## 개발자 참고사항

### 빌드 스크립트 위치
- Excel Uploader: `excel-upload-server/build-excel-uploader.bat`
- Excel Uploader Spec: `excel-upload-server/excel-uploader.spec`
- Electron 빌드 설정: `package.json` → `build` 섹션

### 로그 파일 위치
- Electron 메인: `<실행폴더>\electron-main.log`
- Next.js 서버: `<실행폴더>\nextjs-server.log`
- Excel Uploader: 콘솔 출력 또는 Streamlit 로그

### 데이터베이스 위치
- 프로덕션: `<실행폴더>\sambio_human.db` (포터블 모드)
- 레거시: `C:\SambioHRData\sambio_human.db`
- 개발: 프로젝트 루트의 `sambio_human.db` (symlink)

### 경로 동작 방식
앱은 실행 파일(`SambioHRR.exe`)이 위치한 폴더를 기준으로 모든 파일을 찾습니다:
- 데이터베이스: `실행폴더\sambio_human.db`
- 로그 파일: `실행폴더\electron-main.log`, `실행폴더\nextjs-server.log`
- Next.js 앱: `실행폴더\resources\app\`
- Excel Uploader: `실행폴더\resources\tools\excel-uploader\`

---

## 버전 관리

### 버전 업데이트 방법

1. `package.json`에서 버전 변경:
```json
{
  "version": "1.0.1"
}
```

2. Git 태그 생성 (선택사항):
```batch
git tag v1.0.1
git push origin v1.0.1
```

3. 빌드 및 배포

---

## 추가 문서

- Electron Build Guide: `Electron Build Guide.md`
- 프로젝트 개요: `CLAUDE.md`
- Python 서버 README: `excel-upload-server/README.md`

---

**마지막 업데이트**: 2025-10-26
**빌드 환경**: Windows 10/11, Node.js 18+, Python 3.11+
