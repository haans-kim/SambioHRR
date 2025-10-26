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

### 배포 패키지 생성

전체 `release\win-unpacked\` 폴더를 압축하거나 그대로 배포:

```batch
# 폴더 이름 변경 (선택사항)
cd release
move win-unpacked SambioHRR-v1.0.0

# 압축 (7-Zip 등 사용)
7z a SambioHRR-v1.0.0.zip SambioHRR-v1.0.0\
```

### 설치 방법 (사용자)

1. 압축 해제
2. `SambioHRR.exe` 실행
3. 데이터베이스는 자동으로 `C:\SambioHRData\` 경로 사용

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

**증상**: Electron 앱 실행 시 모듈 에러
**해결**:
```batch
# .next 캐시 삭제
rmdir /s /q .next

# 재빌드
npm run electron:build:win
```

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
- Electron 메인: `C:\SambioHRData\electron-main.log`
- Next.js 서버: `C:\SambioHRData\nextjs-server.log`
- Excel Uploader: 콘솔 출력 또는 Streamlit 로그

### 데이터베이스 위치
- 프로덕션: `C:\SambioHRData\sambio_human.db`
- 개발: 프로젝트 루트의 `sambio_human.db` (symlink)

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
