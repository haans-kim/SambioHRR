# Excel 업로드 시스템 구현 요약

## 📋 개요

12가지 데이터 타입을 지원하는 SambioHRR 프로젝트용 Excel 데이터 업로드 시스템 (On-Demand FastAPI 서버 아키텍처)

**구현 날짜**: 2025-10-14
**상태**: ✅ 구현 완료 및 테스트 준비 완료

---

## 🎯 구현된 기능

### 1. FastAPI 업로드 서버 (`excel-upload-server/`)

Excel 파일 처리 및 데이터베이스 삽입을 담당하는 On-Demand Python FastAPI 서버

**핵심 컴포넌트**:
- **[main.py](excel-upload-server/main.py)** - REST 엔드포인트를 제공하는 FastAPI 애플리케이션
- **[core/excel_loader.py](excel-upload-server/core/excel_loader.py)** - 다중 시트 지원 Excel 파일 로더
- **[core/db_manager.py](excel-upload-server/core/db_manager.py)** - SQLite 데이터베이스 작업
- **[handlers/data_transformers.py](excel-upload-server/handlers/data_transformers.py)** - 12가지 데이터 타입별 변환 함수
- **[models/data_types.py](excel-upload-server/models/data_types.py)** - 데이터 타입 정의 및 스키마

**지원 데이터 타입** (총 12개):
1. ✅ **tag_data** - RFID 출입 태그
2. ✅ **claim_data** - 근태 신고
3. ✅ **employees** - 조직/직원 정보
4. ✅ **meal_data** - 식사 데이터
5. ✅ **knox_approval** - Knox 전자결재
6. ✅ **knox_mail** - Knox 메일
7. ✅ **knox_pims** - Knox PIMS
8. ✅ **eam_data** - EAM 설비
9. ✅ **equis_data** - Equis 장비
10. ✅ **lams_data** - LAMS 실험실
11. ✅ **mes_data** - MES 생산
12. ✅ **mdm_data** - MDM 마스터

### 2. Next.js API 통합

**서버 제어 라우트** - [app/api/upload-server/control/route.ts](app/api/upload-server/control/route.ts)
- Python FastAPI 서버 실행/중지 (On-Demand)
- 헬스 체크 및 상태 모니터링
- 5분 유휴 시간 후 자동 종료

**프록시 라우트** - [app/api/upload/[...proxy]/route.ts](app/api/upload/[...proxy]/route.ts)
- 모든 `/api/upload/*` 요청을 FastAPI 서버로 프록시
- 연결 오류 처리

### 3. 사용자 인터페이스

**업로드 페이지** - [app/data-upload/page.tsx](app/data-upload/page.tsx)
- 서버 시작/중지 컨트롤
- 12가지 데이터 타입 선택 드롭다운
- 드래그 앤 드롭 파일 업로드
- 실시간 업로드 진행률
- 데이터베이스 통계 대시보드
- shadcn/ui 컴포넌트 스타일

---

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────┐
│          Next.js (Port 3003)                    │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  /data-upload 페이지 (React UI)         │  │
│  │  - 서버 컨트롤                           │  │
│  │  - 파일 업로드 인터페이스                │  │
│  │  - 진행률 추적                           │  │
│  │  - DB 통계 대시보드                      │  │
│  └──────────────────────────────────────────┘  │
│                    ↓                            │
│  ┌──────────────────────────────────────────┐  │
│  │  API 라우트                              │  │
│  │  /api/upload-server/control (POST/GET)  │  │
│  │  /api/upload/[...proxy] (Proxy)         │  │
│  └──────────────────────────────────────────┘  │
│                    ↓                            │
│          자식 프로세스 생성                      │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│    FastAPI 서버 (Port 8000)                     │
│    excel-upload-server/                         │
│                                                 │
│  엔드포인트:                                    │
│  - GET  /api/data-types                        │
│  - GET  /api/stats                             │
│  - POST /api/upload/{data_type}                │
│  - POST /api/validate-file                     │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Excel 로더                              │  │
│  │  - 다중 시트 병합                        │  │
│  │  - 데이터 타입 최적화                    │  │
│  └──────────────────────────────────────────┘  │
│                    ↓                            │
│  ┌──────────────────────────────────────────┐  │
│  │  데이터 변환기 (12가지 타입)            │  │
│  │  - 컬럼 매핑                             │  │
│  │  - 타입 변환                             │  │
│  │  - 유효성 검사                           │  │
│  └──────────────────────────────────────────┘  │
│                    ↓                            │
│  ┌──────────────────────────────────────────┐  │
│  │  데이터베이스 매니저                     │  │
│  │  - 청크 단위 삽입 (5000행)              │  │
│  │  - 트랜잭션 관리                         │  │
│  │  - 통계 수집                             │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                     ↓
        sambio_human.db (SQLite)
```

---

## 🚀 사용 방법

### 1. 업로드 인터페이스 접속

**http://localhost:3003/data-upload** 로 이동

### 2. 업로드 서버 시작

**"Start Server"** 버튼 클릭. 시스템이 자동으로:
- 8000번 포트에 FastAPI 서버 실행
- 데이터 타입 설정 로드
- 현재 데이터베이스 통계 조회

### 3. Excel 파일 업로드

1. 드롭다운에서 **데이터 타입** 선택 (12가지 옵션)
2. Excel 파일 **클릭 또는 드래그** (.xlsx, .xls)
3. **"Upload File"** 버튼 클릭
4. 실시간 진행률 모니터링
5. 행 개수와 함께 성공 확인 메시지 확인

### 4. 데이터베이스 통계 확인

- **선택된 타입**: 현재 행 개수 및 날짜 범위 표시
- **전체 타입 요약**: 모든 데이터 타입의 간단한 개요

### 5. 자동 종료

5분간 활동이 없으면 서버가 자동으로 중지됩니다.

---

## 📊 데이터 변환 로직

각 데이터 타입은 [DATA_TABLES_COMPLETE_MAPPING.md](DATA_TABLES_COMPLETE_MAPPING.md)에 정의된 특정 변환 규칙을 따릅니다.

**예시: tag_data 변환**
```python
# Excel 컬럼 → DB 컬럼
'일자' → 'ENTE_DT' (Integer, YYYYMMDD)
'사번' → '사번' (Integer)
'출입시각' → '출입시각' (Integer, YYYYMMDDHHmmss)
'DR구분' → 'DR_GB' (Text, O/T1/T2/T3/G1-G4/N1-N2/M1-M2)
```

**예시: meal_data 변환**
```python
# 식사 타입 판정
'테이크아웃' == 'Y' → M2 태그 (10분)
'테이크아웃' == 'N' → M1 태그 (30분)
'취식일시' → timestamp → Integer (YYYYMMDDHHmmss)
```

---

## 🔧 기술 세부사항

### 의존성

Python 패키지 (`venv`에 설치됨):
- `fastapi` - REST API 프레임워크
- `uvicorn` - ASGI 서버
- `pandas` - Excel 처리
- `openpyxl` - Excel 파일 형식 지원
- `python-multipart` - 파일 업로드 처리
- `pydantic` - 데이터 유효성 검사

Node.js 추가 의존성 불필요 (기존 shadcn/ui 사용)

### 데이터베이스 설정

- **대상 DB**: `sambio_human.db`
- **삽입 모드**: Append (기존 데이터 유지)
- **청크 크기**: 배치당 5,000행
- **트랜잭션**: 청크별 자동 커밋

### 에러 처리

- 잘못된 파일 형식 → 400 Bad Request
- 서버 미실행 → 503 Service Unavailable
- 업로드 실패 → 트랜잭션 롤백
- 모든 에러는 스택 트레이스와 함께 로깅

---

## 📝 API 엔드포인트

### FastAPI 서버 (Port 8000)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 헬스 체크 |
| GET | `/api/data-types` | 12가지 데이터 타입 목록 조회 |
| GET | `/api/stats` | 모든 데이터베이스 통계 조회 |
| GET | `/api/stats/{data_type}` | 특정 타입 통계 조회 |
| POST | `/api/upload/{data_type}` | Excel 파일 업로드 |
| POST | `/api/validate-file` | 업로드 전 파일 유효성 검사 |
| GET | `/api/upload-progress/{id}` | 업로드 진행률 조회 |

### Next.js 프록시 (Port 3003)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/upload-server/control` | 서버 시작/중지 |
| GET | `/api/upload-server/control` | 서버 상태 조회 |
| ALL | `/api/upload/*` | FastAPI로 프록시 |

---

## 📖 문서 파일

1. **[EXCEL_UPLOAD_IMPLEMENTATION_PLAN.md](EXCEL_UPLOAD_IMPLEMENTATION_PLAN.md)** - 최초 구현 계획서
2. **[DATA_TABLES_COMPLETE_MAPPING.md](DATA_TABLES_COMPLETE_MAPPING.md)** - 12가지 타입의 전체 컬럼 매핑
3. **[DATA_UPLOAD_PROCESS.md](DATA_UPLOAD_PROCESS.md)** - 데이터 업로드 워크플로우 문서
4. **[excel-upload-server/README.md](excel-upload-server/README.md)** - FastAPI 서버 문서

---

## ✅ 테스트 체크리스트

### 테스트 전 준비사항
- [ ] `sambio_human.db` 존재 확인
- [ ] venv 설정 확인 (`excel-upload-server/venv/`)
- [ ] Next.js 개발 서버 실행 (`npm run dev`)

### 기본 플로우 테스트
- [ ] `/data-upload`로 이동
- [ ] "Start Server" 클릭 - "Running" 상태 확인
- [ ] 드롭다운에서 데이터 타입 선택
- [ ] 샘플 Excel 파일 업로드
- [ ] 진행률 바 100% 도달 확인
- [ ] 행 개수와 함께 성공 메시지 확인
- [ ] 데이터베이스 통계 업데이트 확인

### 전체 데이터 타입 테스트
- [ ] 12가지 데이터 타입 각각 개별 테스트
- [ ] 컬럼 매핑이 올바르게 동작하는지 확인
- [ ] 시간 기반 데이터의 날짜 범위 표시 확인
- [ ] 업로드 후 행 개수 증가 확인

### 에러 처리 테스트
- [ ] Excel이 아닌 파일 업로드 시도 → 거부되어야 함
- [ ] 타입 선택 없이 업로드 → 경고 표시되어야 함
- [ ] 업로드 중 서버 중지 → 에러 표시되어야 함
- [ ] 잘못된 Excel 구조 업로드 → 유효성 검사 에러 표시

### 자동 종료 테스트
- [ ] 서버 시작
- [ ] 5분 이상 활동 없이 대기
- [ ] 서버 자동 중지 확인
- [ ] UI에 "Stopped" 상태 표시 확인

---

## 🔍 문제 해결

### 서버가 시작되지 않음

**문제**: "Failed to start server" 에러

**해결 방법**:
1. venv 존재 확인: `ls excel-upload-server/venv/`
2. 의존성 재설치:
   ```bash
   cd excel-upload-server
   rm -rf venv
   python3 -m venv venv
   venv/bin/pip install -r requirements.txt
   ```
3. 8000번 포트 사용 가능 여부 확인: `lsof -i :8000`

### 업로드 실패

**문제**: 업로드 시 500 에러 발생

**해결 방법**:
1. 터미널에서 FastAPI 서버 로그 확인
2. Excel 파일 형식이 예상 컬럼과 일치하는지 확인
3. 데이터베이스 파일 권한 확인
4. 특정 데이터 타입의 변환 로직 검토

### 데이터베이스 잠김

**문제**: "Database is locked" 에러

**해결 방법**:
1. SQLite 브라우저 연결 종료
2. DB에 접근하는 다른 프로세스 없는지 확인
3. FastAPI 서버 재시작

---

## 🚦 다음 단계

### 즉시 실행 (현재 준비 완료)
1. 샘플 Excel 파일로 테스트
2. 12가지 데이터 타입 모두 정상 동작 확인
3. 대용량 파일 업로드 성능 확인

### Phase 2 개선 사항 (향후)
1. 업로드 전 데이터 유효성 검사 추가
2. 처리 전 컬럼 미리보기 표시
3. 증분 업데이트 지원 (기존 데이터 교체)
4. 업로드 시 날짜 범위 필터링
5. 업로드 이력 로그 내보내기
6. 여러 파일 일괄 업로드
7. 예약 자동 업로드

### Phase 3 통합 (향후)
1. `sambio_analytics.db`로 자동 마이그레이션 트리거
2. 직원 데이터 업로드 후 조직 계층 구조 업데이트
3. 데이터 업로드 후 대시보드 통계 새로고침
4. 업로드 완료 알림 전송

---

## 📦 생성된 파일

### Python 서버 (9개 파일)
```
excel-upload-server/
├── main.py                           # FastAPI 애플리케이션
├── requirements.txt                  # Python 의존성
├── README.md                         # 서버 문서
├── models/
│   ├── __init__.py
│   └── data_types.py                # 데이터 타입 정의
├── core/
│   ├── __init__.py
│   ├── excel_loader.py              # Excel 파일 로더
│   └── db_manager.py                # 데이터베이스 매니저
├── handlers/
│   ├── __init__.py
│   └── data_transformers.py         # 12가지 변환 함수
└── utils/
    └── __init__.py
```

### Next.js 통합 (3개 파일)
```
app/
├── data-upload/
│   └── page.tsx                      # 업로드 UI 페이지
└── api/
    ├── upload-server/
    │   └── control/
    │       └── route.ts              # 서버 제어 API
    └── upload/
        └── [...proxy]/
            └── route.ts              # FastAPI 프록시
```

### 문서 (4개 파일)
```
EXCEL_UPLOAD_IMPLEMENTATION_PLAN.md   # 구현 계획서
DATA_TABLES_COMPLETE_MAPPING.md       # 컬럼 매핑
DATA_UPLOAD_PROCESS.md                # 업로드 워크플로우
EXCEL_UPLOAD_IMPLEMENTATION_SUMMARY.md # 이 문서
```

**총**: 16개의 새 파일

---

## 🎉 구현 완료

Excel 업로드 시스템이 **완전히 구현되어 테스트 준비가 완료**되었습니다. 12가지 데이터 타입 모두 완전한 변환 로직, 데이터베이스 통합, 사용자 친화적인 인터페이스를 갖추고 있습니다.

**시스템 접속**: http://localhost:3003/data-upload

질문이나 문제가 있는 경우 위에 나열된 문서 파일을 참조하거나 코드 내 주석을 확인하세요.
