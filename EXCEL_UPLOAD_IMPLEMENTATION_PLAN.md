# Excel 데이터 업로드 시스템 구현 계획

**작성일**: 2025-10-14
**목적**: On-Demand FastAPI 기반 Excel 업로드 시스템 구축
**참고**: SambioHR5/Data_Uploader 분석 기반

---

## 📋 목차

1. [현황 분석](#1-현황-분석)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [데이터베이스 스키마](#3-데이터베이스-스키마)
4. [Excel-DB 매핑](#4-excel-db-매핑)
5. [UI/UX 설계](#5-uiux-설계)
6. [API 설계](#6-api-설계)
7. [구현 로드맵](#7-구현-로드맵)
8. [테스트 계획](#8-테스트-계획)

---

## 1. 현황 분석

### 1.1 기존 시스템 (SambioHR5/Data_Uploader)

**기술 스택**:
- Python 3.10 + Streamlit
- pandas, openpyxl (Excel 처리)
- sqlite3 (DB 연결)

**주요 기능**:
- Excel 다중 시트 자동 병합
- 대용량 파일 청크 처리 (150만+ 행)
- Pickle 캐시 시스템
- 배치 삽입 (5,000행 단위)

**처리 성능**:
- 100MB Excel 파일: ~3-5분
- 메모리 사용: ~2-3GB (피크)

### 1.2 현재 DB 상태

**sambio_human.db** (4.6GB):
- `tag_data`: 10,486,360건 (2025-01-01 ~ 2025-06-30)
- `claim_data`: 154,849건
- `employees`: 5,459명
- `organization_master`: 조직 계층 구조

### 1.3 Raw Data 파일

**위치**: `../SambioHR5/data/raw/`

**파일 목록**:
```
입출문기록(25.1)_1일~15일.xlsx   - 62MB
입출문기록(25.1)_16일~31일.xlsx  - 57MB
입출문기록(25.2).xlsx           - 119MB
입출문기록(25.3).xlsx           - 128MB
입출문기록(25.4).xlsx           - 137MB
입출문기록(25.5).xlsx           - 134MB
25년도 1~6월_근무기록_전사.xlsx  - 55MB
```

---

## 2. 시스템 아키텍처

### 2.1 On-Demand FastAPI 모델

```
[Next.js Frontend - Port 3003]
    ↓ (사용자가 "Excel 업로드" 클릭)
[Next.js API - /api/upload/start-server]
    ↓ (child_process.spawn)
[FastAPI Server - Port 8000]
    ↓ (REST API)
[Excel Processing + SQLite]
    ↓
[sambio_human.db]
    ↓ (5분 idle 후)
[Auto Shutdown]
```

### 2.2 프로세스 라이프사이클

1. **Idle State**: FastAPI 서버 꺼짐
2. **Trigger**: 사용자가 업로드 페이지 접속
3. **Start**: Next.js가 FastAPI 프로세스 기동
4. **Health Check**: 포트 8000 응답 확인 (최대 10초)
5. **Active**: 파일 업로드 처리
6. **Idle Timer**: 마지막 요청 후 5분 카운트
7. **Shutdown**: 자동 종료 또는 수동 종료

### 2.3 폴더 구조

```
SambioHRR/
├── app/
│   ├── upload/
│   │   └── page.tsx                   # 메인 업로드 UI
│   └── api/
│       └── upload/
│           ├── server-control/
│           │   └── route.ts           # 서버 기동/종료/상태
│           ├── database-status/
│           │   └── route.ts           # DB 현황 조회
│           ├── excel-upload/
│           │   └── route.ts           # 파일 업로드 프록시
│           └── mapping-info/
│               └── route.ts           # 컬럼 매핑 정보

SambioHR5/
└── api_server/
    ├── main.py                        # FastAPI 앱
    ├── requirements.txt
    ├── handlers/
    │   ├── tag_data_handler.py        # tag_data 처리
    │   ├── claim_data_handler.py      # claim_data 처리
    │   └── employee_handler.py        # employees 처리
    ├── models/
    │   ├── schemas.py                 # Pydantic 스키마
    │   └── db_models.py               # DB 모델
    └── utils/
        ├── excel_processor.py         # Excel 파싱
        ├── db_manager.py              # SQLite 관리
        └── column_mapper.py           # 컬럼 매핑
```

---

## 3. 데이터베이스 스키마

### 3.1 tag_data (출입 태그 데이터)

**목적**: RFID 출입 태그 원시 데이터

**스키마**:
```sql
CREATE TABLE tag_data (
  ENTE_DT INTEGER,       -- 날짜 (YYYYMMDD)
  DAY_GB TEXT,           -- 요일 구분
  DAY_NM TEXT,           -- 요일명
  NAME TEXT,             -- 이름
  사번 INTEGER,          -- 직원번호
  CENTER TEXT,           -- 센터
  BU TEXT,               -- 사업부
  TEAM TEXT,             -- 팀
  GROUP_A TEXT,          -- 그룹
  PART TEXT,             -- 파트
  출입시각 INTEGER,       -- 시각 (HHMMSS)
  DR_NO TEXT,            -- 문번호
  DR_NM TEXT,            -- 문이름 (장소)
  DR_GB TEXT,            -- 문구분 (TagCode: O, T1, G3 등)
  INOUT_GB TEXT          -- 입출 구분 (I/O)
);
```

**인덱스**:
- `idx_tag_data_employee_date`: (사번, ENTE_DT)
- `idx_tag_data_datetime_employee`: (ENTE_DT, 출입시각, 사번)
- `idx_tag_data_location_employee`: (DR_NM, 사번, ENTE_DT)

**현재 데이터**: 10,486,360건 (2025-01-01 ~ 2025-06-30)

### 3.2 claim_data (근태 신고 데이터)

**목적**: HR 시스템 근태 신고 기록

**스키마**:
```sql
CREATE TABLE claim_data (
  -- 기본 정보
  employee_id INTEGER,
  date TEXT,
  -- 근무 시간
  work_start_time TEXT,
  work_end_time TEXT,
  actual_work_hours REAL,
  -- 근무 유형
  work_type TEXT,
  shift_type TEXT,
  -- 휴가 정보
  leave_type TEXT,
  is_leave INTEGER,
  -- 메타데이터
  created_at DATETIME
);
```

**현재 데이터**: 154,849건

### 3.3 employees (직원 정보)

**목적**: 직원 마스터 데이터

**스키마**:
```sql
CREATE TABLE employees (
  employee_id INTEGER PRIMARY KEY,
  name TEXT,
  center TEXT,
  division TEXT,
  team TEXT,
  group_name TEXT,
  job_grade TEXT,
  -- 추가 정보
  hire_date TEXT,
  employment_type TEXT,
  created_at DATETIME
);
```

**현재 데이터**: 5,459명

### 3.4 organization_master (조직 구조)

**목적**: 4단계 조직 계층

**스키마**:
```sql
CREATE TABLE organization_master (
  org_code TEXT PRIMARY KEY,
  org_name TEXT,
  org_level TEXT,  -- 'center', 'division', 'team', 'group'
  parent_org_code TEXT,
  display_order INTEGER
);
```

---

## 4. Excel-DB 매핑

### 4.1 tag_data 매핑

**Excel 구조** (입출문기록 파일):
```
Row 1: 헤더
  - 일자
  - 요일구분
  - 요일
  - 성명
  - 사번
  - CENTER
  - BU
  - TEAM
  - GROUP
  - PART
  - 출입시각
  - DR_NO
  - DR_NM
  - DR_GB
  - INOUT_GB
```

**매핑 테이블**:
| Excel 컬럼 | DB 컬럼 | 변환 | 비고 |
|-----------|---------|------|------|
| 일자 | ENTE_DT | `int(date.replace('-', ''))` | YYYYMMDD |
| 요일구분 | DAY_GB | `str` | |
| 요일 | DAY_NM | `str` | |
| 성명 | NAME | `str` | |
| 사번 | 사번 | `int` | Primary Key |
| CENTER | CENTER | `str` | |
| BU | BU | `str` | |
| TEAM | TEAM | `str` | |
| GROUP | GROUP_A | `str` | DB는 GROUP_A |
| PART | PART | `str` | |
| 출입시각 | 출입시각 | `int(time.replace(':', ''))` | HHMMSS |
| DR_NO | DR_NO | `str` | |
| DR_NM | DR_NM | `str` | |
| DR_GB | DR_GB | `str` | TagCode |
| INOUT_GB | INOUT_GB | `str` | I/O |

**데이터 검증 규칙**:
- `사번`: 필수, 숫자
- `ENTE_DT`: 필수, 8자리 숫자
- `출입시각`: 필수, 6자리 숫자
- `DR_GB`: 유효한 TagCode (O, T1, T2, T3, G1-G4, N1-N2, M1-M2)

### 4.2 claim_data 매핑

**Excel 구조** (근무기록 파일):
```
Row 1: 헤더
  - 사번
  - 성명
  - 근무일
  - 시작시간
  - 종료시간
  - 실제근무시간
  - 근무유형
  - 교대유형
  - 휴가구분
```

**매핑 테이블**:
| Excel 컬럼 | DB 컬럼 | 변환 | 비고 |
|-----------|---------|------|------|
| 사번 | employee_id | `int` | FK |
| 근무일 | date | `str(YYYY-MM-DD)` | |
| 시작시간 | work_start_time | `str(HH:MM)` | |
| 종료시간 | work_end_time | `str(HH:MM)` | |
| 실제근무시간 | actual_work_hours | `float` | |
| 근무유형 | work_type | `str` | |
| 교대유형 | shift_type | `str` | |
| 휴가구분 | leave_type | `str` | |

### 4.3 employees 매핑

**Excel 구조** (조직 마스터 파일):
```
Row 1: 헤더
  - 사번
  - 성명
  - CENTER
  - DIVISION
  - TEAM
  - GROUP
  - 직급
  - 입사일
  - 고용형태
```

**매핑 테이블**:
| Excel 컬럼 | DB 컬럼 | 변환 | 비고 |
|-----------|---------|------|------|
| 사번 | employee_id | `int` | PK |
| 성명 | name | `str` | |
| CENTER | center | `str` | |
| DIVISION | division | `str` | nullable |
| TEAM | team | `str` | |
| GROUP | group_name | `str` | |
| 직급 | job_grade | `str` | |
| 입사일 | hire_date | `str(YYYY-MM-DD)` | |
| 고용형태 | employment_type | `str` | |

---

## 5. UI/UX 설계

### 5.1 페이지 구조

**URL**: `/upload`

**레이아웃**:
```
┌─────────────────────────────────────────────────────┐
│ Data Upload                                         │
│ 데이터 업로드 및 관리                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [서버 상태 표시]                                      │
│ ● 오프라인  /  ● 온라인  /  ● 처리중                  │
│                                                     │
│ ┌─── 데이터 현황 ───────────────────────────────┐  │
│ │ 테이블    │ 행 수      │ 기간        │ 최종 업데이트│
│ │─────────│──────────│────────────│──────────│  │
│ │ tag_data │ 10,486,360│2025-01~06 │2025-07-21│  │
│ │ claim_data│ 154,849  │2025-01~06 │2025-07-21│  │
│ │ employees│ 5,459     │-          │2025-07-15│  │
│ └─────────────────────────────────────────────┘  │
│                                                     │
│ ┌─── 파일 업로드 ────────────────────────────────┐│
│ │                                                ││
│ │ 데이터 유형:                                    ││
│ │ [▼ Tagging Data                          ]    ││
│ │                                                ││
│ │ ┌──────────────────────────────────────────┐ ││
│ │ │  📁 Drag and drop files here            │ ││
│ │ │     Limit 200MB per file • XLSX, XLS    │ ││
│ │ │                    [Browse files]        │ ││
│ │ └──────────────────────────────────────────┘ ││
│ │                                                ││
│ │ > 신규 데이터 유형 추가                         ││
│ │                                                ││
│ │ ┌─ 모드 옵션 ─────────────────────────────┐ ││
│ │ │ □ 데이터베이스에도 저장                   │ ││
│ │ │   (컬럼 매핑 및 검증 후 DB 삽입)           │ ││
│ │ │                                          │ ││
│ │ │ □ 데이터 전체 삭제                        │ ││
│ │ │   (기존 데이터 삭제 후 새로 삽입)          │ ││
│ │ └────────────────────────────────────────┘ ││
│ │                                                ││
│ │ [데이터 로드]  [캐시 초기화]  [새로고침]  [설정 저장]││
│ └────────────────────────────────────────────────┘│
│                                                     │
│ ┌─── 데이터 조회 ────────────────────────────────┐│
│ │ 조회할 데이터 선택                              ││
│ │ [▼ tag_data                             ▼]  ││
│ │                                                ││
│ │ [데이터 보기]                                   ││
│ └────────────────────────────────────────────────┘│
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.2 컴포넌트 구조

**주요 컴포넌트**:

1. **ServerStatusIndicator**
   - 실시간 서버 상태 표시
   - 오프라인 / 온라인 / 처리중
   - 자동 새로고침 (5초 간격)

2. **DatabaseStatusTable**
   - 테이블별 현황 요약
   - 행 수, 기간, 최종 업데이트
   - 새로고침 버튼

3. **FileUploadZone**
   - Drag & Drop 영역
   - 파일 타입 선택 (Dropdown)
   - 다중 파일 지원
   - 진행률 표시

4. **UploadOptionsPanel**
   - DB 저장 옵션
   - 데이터 교체 옵션
   - Pickle 캐시 옵션

5. **DataPreviewModal**
   - 업로드 전 미리보기
   - 컬럼 매핑 확인
   - 검증 결과 표시

6. **ProgressMonitor**
   - 실시간 진행률
   - 처리 속도 (행/초)
   - 예상 완료 시간

### 5.3 UI 흐름

**시나리오 1: 신규 데이터 업로드**

```
1. 사용자가 /upload 접속
   ↓
2. 서버 상태 확인 (자동)
   - 오프라인이면 "서버 시작" 버튼 표시
   ↓
3. "서버 시작" 클릭
   - API 호출: POST /api/upload/server-control (action: start)
   - 로딩 인디케이터 표시
   - Health check 반복 (최대 10초)
   ↓
4. 서버 온라인 확인
   - 상태 표시: ● 온라인
   - 파일 업로드 UI 활성화
   ↓
5. 데이터 유형 선택: "Tagging Data"
   ↓
6. 파일 Drag & Drop
   - 파일명 표시
   - 크기 검증 (200MB 제한)
   ↓
7. 옵션 선택
   - ✅ 데이터베이스에도 저장
   - ❌ 데이터 전체 삭제
   ↓
8. "데이터 로드" 클릭
   - API 호출: POST /api/upload/excel-upload
   - 진행률 모니터링 (WebSocket 또는 polling)
   ↓
9. 처리 완료
   - 성공 메시지 표시
   - 데이터 현황 테이블 자동 새로고침
   ↓
10. 5분 idle 후 서버 자동 종료
```

**시나리오 2: 데이터 교체**

```
1~5: 동일
   ↓
6. 옵션 선택
   - ✅ 데이터베이스에도 저장
   - ✅ 데이터 전체 삭제 (기존 tag_data 삭제)
   ↓
7. 확인 다이얼로그
   - "기존 10,486,360건의 데이터가 삭제됩니다. 계속하시겠습니까?"
   - [취소] [확인]
   ↓
8. "확인" 클릭
   - DELETE 작업 수행
   - INSERT 작업 수행
   ↓
9. 완료
```

---

## 6. API 설계

### 6.1 서버 제어 API

**Endpoint**: `POST /api/upload/server-control`

**Request**:
```json
{
  "action": "start" | "stop" | "status"
}
```

**Response** (start):
```json
{
  "success": true,
  "status": "starting",
  "port": 8000,
  "pid": 12345,
  "message": "FastAPI server starting..."
}
```

**Response** (status):
```json
{
  "success": true,
  "status": "online" | "offline" | "processing",
  "uptime": 120,  // seconds
  "last_activity": "2025-07-21T10:30:45Z",
  "active_jobs": 0
}
```

### 6.2 데이터베이스 현황 API

**Endpoint**: `GET /api/upload/database-status`

**Response**:
```json
{
  "success": true,
  "tables": [
    {
      "name": "tag_data",
      "row_count": 10486360,
      "date_range": {
        "start": "2025-01-01",
        "end": "2025-06-30"
      },
      "last_updated": "2025-07-21T10:00:00Z",
      "size_mb": 1024.5
    },
    {
      "name": "claim_data",
      "row_count": 154849,
      "date_range": {
        "start": "2025-01-01",
        "end": "2025-06-30"
      },
      "last_updated": "2025-07-21T10:00:00Z",
      "size_mb": 45.2
    },
    {
      "name": "employees",
      "row_count": 5459,
      "date_range": null,
      "last_updated": "2025-07-15T09:00:00Z",
      "size_mb": 2.1
    }
  ],
  "total_size_mb": 1071.8
}
```

### 6.3 컬럼 매핑 정보 API

**Endpoint**: `GET /api/upload/mapping-info?type=tag_data`

**Response**:
```json
{
  "success": true,
  "data_type": "tag_data",
  "excel_columns": [
    "일자", "요일구분", "요일", "성명", "사번",
    "CENTER", "BU", "TEAM", "GROUP", "PART",
    "출입시각", "DR_NO", "DR_NM", "DR_GB", "INOUT_GB"
  ],
  "mappings": [
    {
      "excel_col": "일자",
      "db_col": "ENTE_DT",
      "transform": "date_to_int",
      "required": true,
      "validation": "8-digit integer"
    },
    {
      "excel_col": "사번",
      "db_col": "사번",
      "transform": "to_int",
      "required": true,
      "validation": "integer"
    }
    // ... more mappings
  ],
  "sample_data": [
    {
      "일자": "2025-07-01",
      "사번": "123456",
      "성명": "홍길동",
      // ... sample row
    }
  ]
}
```

### 6.4 파일 업로드 API

**Endpoint**: `POST /api/upload/excel-upload`

**Request** (multipart/form-data):
```
file: <Excel file>
data_type: "tag_data" | "claim_data" | "employees"
save_to_db: true | false
replace_existing: true | false
```

**Response** (Streaming):
```json
// Progress updates (Server-Sent Events or WebSocket)
{
  "event": "progress",
  "stage": "reading",
  "progress": 25,
  "message": "Reading Excel file...",
  "rows_processed": 0
}

{
  "event": "progress",
  "stage": "processing",
  "progress": 50,
  "message": "Processing data...",
  "rows_processed": 500000
}

{
  "event": "progress",
  "stage": "inserting",
  "progress": 75,
  "message": "Inserting to database...",
  "rows_processed": 1000000
}

{
  "event": "complete",
  "stage": "done",
  "progress": 100,
  "message": "Upload complete",
  "rows_processed": 1500000,
  "rows_inserted": 1500000,
  "duration_seconds": 180
}
```

### 6.5 FastAPI 엔드포인트 (포트 8000)

**Health Check**:
```
GET http://localhost:8000/health
Response: {"status": "ok", "uptime": 120}
```

**Upload**:
```
POST http://localhost:8000/upload
Content-Type: multipart/form-data
```

**Status**:
```
GET http://localhost:8000/status
Response: {
  "active_jobs": 0,
  "last_activity": "2025-07-21T10:30:45Z",
  "uptime": 120
}
```

**Shutdown**:
```
POST http://localhost:8000/shutdown
Response: {"message": "Shutting down..."}
```

---

## 7. 구현 로드맵

### Phase 1: 기반 구축 (1-2일)

**목표**: FastAPI 서버 기본 구조

**작업**:
- [ ] FastAPI 프로젝트 생성 (`../SambioHR5/api_server/`)
- [ ] 의존성 설정 (`requirements.txt`)
- [ ] 기본 라우트 구현 (health, status, shutdown)
- [ ] Excel 파싱 유틸리티 작성
- [ ] DB 매니저 작성 (SQLite 연결)
- [ ] 컬럼 매퍼 작성 (Excel → DB)

**결과물**:
- 기동/종료 가능한 FastAPI 서버
- Excel 파일 파싱 기능
- DB 삽입 로직

### Phase 2: Next.js 통합 (1-2일)

**목표**: 서버 제어 및 프록시 API

**작업**:
- [ ] `/api/upload/server-control` 구현
- [ ] `/api/upload/database-status` 구현
- [ ] `/api/upload/mapping-info` 구현
- [ ] `/api/upload/excel-upload` 프록시 구현
- [ ] 프로세스 라이프사이클 관리

**결과물**:
- Next.js에서 FastAPI 제어 가능
- DB 현황 조회 가능

### Phase 3: UI 구현 (2-3일)

**목표**: shadcn/ui 기반 업로드 UI

**작업**:
- [ ] `/app/upload/page.tsx` 생성
- [ ] ServerStatusIndicator 컴포넌트
- [ ] DatabaseStatusTable 컴포넌트
- [ ] FileUploadZone 컴포넌트
- [ ] UploadOptionsPanel 컴포넌트
- [ ] ProgressMonitor 컴포넌트
- [ ] DataPreviewModal 컴포넌트

**결과물**:
- 완전한 업로드 UI
- 실시간 진행률 표시

### Phase 4: 테스트 및 최적화 (1-2일)

**목표**: 안정성 검증

**작업**:
- [ ] 100MB+ 파일 테스트
- [ ] 에러 핸들링 강화
- [ ] 메모리 최적화
- [ ] 속도 최적화 (배치 크기 조정)
- [ ] 사용자 피드백 수집

**결과물**:
- 프로덕션 준비 완료

---

## 8. 테스트 계획

### 8.1 단위 테스트

**FastAPI**:
```python
# tests/test_excel_processor.py
def test_parse_tag_data_excel():
    """tag_data Excel 파싱 테스트"""
    result = parse_excel("test_data.xlsx", "tag_data")
    assert len(result) > 0
    assert "사번" in result.columns

def test_column_mapping():
    """컬럼 매핑 테스트"""
    df = pd.DataFrame({"일자": ["2025-07-01"]})
    result = map_columns(df, "tag_data")
    assert result["ENTE_DT"][0] == 20250701
```

**Next.js**:
```typescript
// __tests__/api/upload/server-control.test.ts
describe('Server Control API', () => {
  it('should start FastAPI server', async () => {
    const res = await POST('/api/upload/server-control', {
      action: 'start'
    });
    expect(res.status).toBe(200);
    expect(res.json.status).toBe('starting');
  });
});
```

### 8.2 통합 테스트

**시나리오 1: 정상 업로드**
```
1. FastAPI 서버 시작
2. 100MB Excel 파일 업로드
3. 진행률 모니터링
4. DB 데이터 검증
5. 서버 종료
```

**시나리오 2: 데이터 교체**
```
1. 기존 데이터 확인
2. replace_existing=true로 업로드
3. 기존 데이터 삭제 확인
4. 새 데이터 삽입 확인
```

**시나리오 3: 에러 처리**
```
1. 잘못된 Excel 형식 업로드
2. 컬럼 불일치 에러 확인
3. 사용자에게 명확한 에러 메시지 표시
```

### 8.3 성능 테스트

**목표**:
- 100MB Excel: < 5분
- 메모리 사용: < 4GB
- CPU 사용: < 80%

**측정 항목**:
- 파일 읽기 속도
- 데이터 변환 속도
- DB 삽입 속도 (행/초)
- 총 처리 시간

---

## 9. 보안 및 제한사항

### 9.1 보안

- **파일 크기 제한**: 200MB
- **파일 타입 검증**: .xlsx, .xls만 허용
- **SQL Injection 방지**: Parameterized queries 사용
- **로컬 전용**: FastAPI는 localhost:8000만 바인딩

### 9.2 제한사항

- **동시 업로드**: 1개만 (순차 처리)
- **브라우저 제한**: Chrome/Edge 권장 (대용량 파일)
- **네트워크**: 로컬 환경만 (프로덕션 배포 시 HTTPS 필요)

---

## 10. 참고 자료

### 기존 코드
- SambioHR5/Data_Uploader/core/data_loader.py
- SambioHR5/Data_Uploader/ui/data_upload_component.py

### 문서
- [PROJECT_HANDOVER_COMPREHENSIVE.md](./PROJECT_HANDOVER_COMPREHENSIVE.md)
- [DATA_UPLOAD_PROCESS.md](./DATA_UPLOAD_PROCESS.md)

### 기술 스택 문서
- FastAPI: https://fastapi.tiangolo.com/
- pandas: https://pandas.pydata.org/
- shadcn/ui: https://ui.shadcn.com/
