# 전체 데이터 테이블 매핑 정의

**작성일**: 2025-10-14
**목적**: 모든 데이터 소스의 Excel-DB 매핑 완전 정의

---

## 📊 데이터 현황 요약

### 현재 DB 상태 (sambio_human.db)

| 데이터 유형 | 테이블명 | 행 수 | 기간 | 용도 |
|-----------|---------|-------|------|------|
| **출입 태그** | tag_data | 10,486,360 | 2025-01-01~06-30 | 핵심 분석 데이터 |
| **근태 신고** | claim_data | 154,849 | 2025-01-01~06-30 | 근무시간 검증 |
| **직원 정보** | employees | 5,459 | - | 조직 마스터 |
| **식사 데이터** | meal_data | 710,583 | 2025-04-01~06-30 | M1/M2 태그 생성 |
| **Knox 결재** | knox_approval_data | 339,818 | 2025-06 | O 태그 (업무 활동) |
| **Knox 메일** | knox_mail_data | 95,630 | 2025-06 | O 태그 (업무 활동) |
| **Knox PIMS** | knox_pims_data | 213,237 | 2025-06 | O 태그 (업무 활동) |
| **EAM 설비** | eam_data | 213,700 | 2025-06 | O 태그 (업무 활동) |
| **Equis 장비** | equis_data | 398,428 | 2025-06 | O 태그 (업무 활동) |
| **LAMS 실험** | lams_data | 2,245 | 2025-06 | O 태그 (업무 활동) |
| **MES 제조** | mes_data | 76,040 | 2025-06 | O 태그 (업무 활동) |
| **MDM 마스터** | mdm_data | 290,035 | 2025-06 | O 태그 (업무 활동) |

**총 데이터**: 약 1,299만 건

---

## 1. tag_data (출입 태그) - 최우선

### 1.1 Excel 파일 구조

**파일명 패턴**: `입출문기록(25.X).xlsx` 또는 `입출문기록(25.X)_날짜범위.xlsx`

**헤더 행**: Row 1

**컬럼 구조**:
```
| 일자 | 요일구분 | 요일 | 성명 | 사번 | CENTER | BU | TEAM | GROUP | PART |
  출입시각 | DR_NO | DR_NM | DR_GB | INOUT_GB |
```

### 1.2 DB 스키마

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
  DR_GB TEXT,            -- 문구분 (TagCode)
  INOUT_GB TEXT          -- 입출 구분 (I/O)
);
```

### 1.3 컬럼 매핑

| Excel 컬럼 | DB 컬럼 | 데이터 타입 | 변환 함수 | 필수 | 검증 규칙 |
|-----------|---------|-----------|---------|------|---------|
| 일자 | ENTE_DT | INTEGER | `int(date.replace('-', ''))` | ✅ | 8자리 숫자 |
| 요일구분 | DAY_GB | TEXT | `str` | ❌ | - |
| 요일 | DAY_NM | TEXT | `str` | ❌ | - |
| 성명 | NAME | TEXT | `str` | ✅ | - |
| 사번 | 사번 | INTEGER | `int` | ✅ | 숫자 |
| CENTER | CENTER | TEXT | `str` | ✅ | - |
| BU | BU | TEXT | `str` | ❌ | - |
| TEAM | TEAM | TEXT | `str` | ✅ | - |
| GROUP | GROUP_A | TEXT | `str` | ❌ | - |
| PART | PART | TEXT | `str` | ❌ | - |
| 출입시각 | 출입시각 | INTEGER | `int(time.replace(':', ''))` | ✅ | 6자리 숫자 |
| DR_NO | DR_NO | TEXT | `str` | ✅ | - |
| DR_NM | DR_NM | TEXT | `str` | ✅ | - |
| DR_GB | DR_GB | TEXT | `str` | ✅ | TagCode 검증 |
| INOUT_GB | INOUT_GB | TEXT | `str` | ✅ | 'I' 또는 'O' |

### 1.4 변환 예시

```python
def transform_tag_data(df: pd.DataFrame) -> pd.DataFrame:
    # 날짜 변환: "2025-07-01" -> 20250701
    df['ENTE_DT'] = df['일자'].str.replace('-', '').astype(int)

    # 시간 변환: "09:30:45" -> 93045
    df['출입시각'] = df['출입시각'].str.replace(':', '').astype(int)

    # 사번 변환
    df['사번'] = df['사번'].astype(int)

    # 컬럼명 변경
    df = df.rename(columns={'GROUP': 'GROUP_A'})

    return df
```

---

## 2. meal_data (식사 데이터)

### 2.1 Excel 파일 구조

**파일명 패턴**: `Meal_YYYYMM-YYYYMM.xlsx` 또는 `식사데이터_YYYY.MM.xlsx`

**헤더 행**: Row 1

**컬럼 구조**:
```
| NO | 취식일시 | 정산일 | 식당명 | 배식구 | 식사가격 | 카드번호 |
  사번 | 성명 | 부서 | 식단 | 테이크아웃 | 식사구분명 |
```

### 2.2 DB 스키마

```sql
CREATE TABLE meal_data (
  NO INTEGER,
  취식일시 TEXT,           -- YYYY-MM-DD HH:MM:SS
  정산일 TEXT,
  식당명 TEXT,
  배식구 TEXT,
  식사가격 SMALLINT,
  카드번호 BIGINT,
  사번 TEXT,
  성명 TEXT,
  부서 TEXT,
  식단 TEXT,
  테이크아웃 TEXT,         -- 'Y' 또는 'N'
  식사구분명 TEXT          -- 아침/점심/저녁
);
```

### 2.3 컬럼 매핑

| Excel 컬럼 | DB 컬럼 | 데이터 타입 | 변환 | 필수 | 비고 |
|-----------|---------|-----------|------|------|------|
| NO | NO | INTEGER | `int` | ❌ | 순번 |
| 취식일시 | 취식일시 | TEXT | `datetime` | ✅ | YYYY-MM-DD HH:MM:SS |
| 정산일 | 정산일 | TEXT | `str` | ❌ | |
| 식당명 | 식당명 | TEXT | `str` | ✅ | |
| 배식구 | 배식구 | TEXT | `str` | ✅ | M1/M2 판정에 사용 |
| 식사가격 | 식사가격 | SMALLINT | `int` | ❌ | |
| 카드번호 | 카드번호 | BIGINT | `int` | ❌ | |
| 사번 | 사번 | TEXT | `str` | ✅ | |
| 성명 | 성명 | TEXT | `str` | ✅ | |
| 부서 | 부서 | TEXT | `str` | ❌ | |
| 식단 | 식단 | TEXT | `str` | ❌ | |
| 테이크아웃 | 테이크아웃 | TEXT | `str` | ✅ | 'Y' or 'N' → M1/M2 |
| 식사구분명 | 식사구분명 | TEXT | `str` | ❌ | 아침/점심/저녁 |

### 2.4 M1/M2 태그 판정 로직

```python
def determine_meal_tag(row):
    """M1 (식당 내) vs M2 (테이크아웃) 판정"""
    if row['테이크아웃'] == 'Y':
        return 'M2'
    if row['배식구'] and '테이크아웃' in row['배식구']:
        return 'M2'
    return 'M1'
```

---

## 3. claim_data (근태 신고)

### 3.1 Excel 파일 구조

**파일명 패턴**: `근무기록_YYYY년_MM월.xlsx` 또는 `25년도 1~6월_근무기록_전사.xlsx`

**헤더 행**: Row 1

**컬럼 구조**:
```
| 근무일 | 급여요일 | 성명 | 사번 | 부서 | 직급 | WORKSCHDTYPNM |
  근무시간 | 시작 | 종료 | 제외시간 | 근태명 | 근태코드 |
  시작시간 | 종료시간 | 실제근무시간 |
```

### 3.2 DB 스키마

```sql
CREATE TABLE claim_data (
  근무일 DATETIME,
  급여요일 TEXT,
  성명 TEXT,
  사번 BIGINT,
  부서 TEXT,
  직급 TEXT,
  WORKSCHDTYPNM TEXT,       -- 근무제 유형
  근무시간 TEXT,
  시작 TEXT,
  종료 TEXT,
  제외시간 FLOAT,
  근태명 TEXT,
  근태코드 TEXT,
  시작시간 DATETIME,
  종료시간 DATETIME,
  cross_day_work BOOLEAN,   -- 야간 근무 여부
  실제근무시간 FLOAT,
  employee_level VARCHAR(10), -- 직급 레벨
  휴가_연차 REAL DEFAULT 0,
  실제근무시간_원본 FLOAT
);
```

### 3.3 컬럼 매핑

| Excel 컬럼 | DB 컬럼 | 데이터 타입 | 변환 | 필수 |
|-----------|---------|-----------|------|------|
| 근무일 | 근무일 | DATETIME | `datetime` | ✅ |
| 급여요일 | 급여요일 | TEXT | `str` | ❌ |
| 성명 | 성명 | TEXT | `str` | ✅ |
| 사번 | 사번 | BIGINT | `int` | ✅ |
| 부서 | 부서 | TEXT | `str` | ❌ |
| 직급 | 직급 | TEXT | `str` | ❌ |
| WORKSCHDTYPNM | WORKSCHDTYPNM | TEXT | `str` | ❌ |
| 시작시간 | 시작시간 | DATETIME | `datetime` | ✅ |
| 종료시간 | 종료시간 | DATETIME | `datetime` | ✅ |
| 실제근무시간 | 실제근무시간 | FLOAT | `float` | ✅ |
| 근태명 | 근태명 | TEXT | `str` | ❌ |
| 근태코드 | 근태코드 | TEXT | `str` | ❌ |

---

## 4. Knox 데이터 (3개 테이블)

### 4.1 knox_approval_data (전자결재)

**파일명**: `Knox_approval_YYYYMM-YYYYMM.xlsx`

**스키마**:
```sql
CREATE TABLE knox_approval_data (
  Timestamp TIMESTAMP,      -- 결재 시각
  UserNo INTEGER,          -- 사번
  Task TEXT,               -- 결재 작업
  APID TEXT,               -- 결재 ID
  비고 TEXT
);
```

**매핑**:
| Excel 컬럼 | DB 컬럼 | 변환 | 필수 |
|-----------|---------|------|------|
| Timestamp | Timestamp | `datetime` | ✅ |
| UserNo | UserNo | `int` | ✅ |
| Task | Task | `str` | ❌ |
| APID | APID | `str` | ❌ |
| 비고 | 비고 | `str` | ❌ |

### 4.2 knox_mail_data (메일)

**파일명**: `Knox_mail_YYYYMM-YYYYMM.xlsx`

**스키마**:
```sql
CREATE TABLE knox_mail_data (
  메일key TEXT,
  발신일시_GMT9 TIMESTAMP,    -- 메일 발신 시각
  발신인사번_text INTEGER     -- 사번
);
```

**매핑**:
| Excel 컬럼 | DB 컬럼 | 변환 | 필수 |
|-----------|---------|------|------|
| 메일key | 메일key | `str` | ❌ |
| 발신일시_GMT9 | 발신일시_GMT9 | `datetime` | ✅ |
| 발신인사번_text | 발신인사번_text | `int` | ✅ |

### 4.3 knox_pims_data (프로젝트 관리)

**파일명**: `Knox_PIMS_YYYY.MM.xlsx`

**스키마**:
```sql
CREATE TABLE knox_pims_data (
  id INTEGER PRIMARY KEY,
  employee_id VARCHAR(20),   -- 사번
  meeting_id VARCHAR(100),
  meeting_type VARCHAR(50),
  start_time DATETIME,       -- 시작 시각
  end_time DATETIME          -- 종료 시각
);
```

**매핑**:
| Excel 컬럼 | DB 컬럼 | 변환 | 필수 |
|-----------|---------|------|------|
| employee_id | employee_id | `str` | ✅ |
| meeting_id | meeting_id | `str` | ❌ |
| meeting_type | meeting_type | `str` | ❌ |
| start_time | start_time | `datetime` | ✅ |
| end_time | end_time | `datetime` | ✅ |

---

## 5. 장비 시스템 데이터 (5개 테이블)

### 5.1 eam_data (EAM 설비)

**파일명**: `EAM_YYYYMM-YYYYMM.xlsx`

**스키마**:
```sql
CREATE TABLE eam_data (
  ATTEMPTDATE TEXT,         -- 작업 일시
  USERNO TEXT,             -- 사번
  ATTEMPTRESULT TEXT,      -- 작업 결과
  APP TEXT                 -- 애플리케이션
);
```

**매핑**:
| Excel 컬럼 | DB 컬럼 | 변환 | 필수 |
|-----------|---------|------|------|
| ATTEMPTDATE | ATTEMPTDATE | `str` | ✅ |
| USERNO | USERNO | `str` | ✅ |
| ATTEMPTRESULT | ATTEMPTRESULT | `str` | ❌ |
| APP | APP | `str` | ❌ |

### 5.2 equis_data (Equis 장비)

**파일명**: `EQUIS_YYYYMM-YYYYMM.xlsx`

**스키마**:
```sql
CREATE TABLE equis_data (
  Timestamp TIMESTAMP,           -- 사용 시각
  "USERNO( ID->사번매칭 )" REAL, -- 사번
  Event TEXT                     -- 이벤트
);
```

**매핑**:
| Excel 컬럼 | DB 컬럼 | 변환 | 필수 |
|-----------|---------|------|------|
| Timestamp | Timestamp | `datetime` | ✅ |
| USERNO (또는 ID) | USERNO( ID->사번매칭 ) | `int` | ✅ |
| Event | Event | `str` | ❌ |

### 5.3 lams_data (LAMS 실험실)

**파일명**: `LAMS_YYYY.xlsx`

**스키마**:
```sql
CREATE TABLE lams_data (
  User_No REAL,            -- 사번
  DATE TEXT,               -- 실험 일시
  Task TEXT                -- 작업 내용
);
```

**매핑**:
| Excel 컬럼 | DB 컬럼 | 변환 | 필수 |
|-----------|---------|------|------|
| User_No | User_No | `int` | ✅ |
| DATE | DATE | `str` | ✅ |
| Task | Task | `str` | ❌ |

### 5.4 mes_data (MES 제조)

**파일명**: `MES_2_YYYYMM-YYYYMM.xlsx`

**스키마**:
```sql
CREATE TABLE mes_data (
  session TEXT,            -- 세션 ID
  login_time TIMESTAMP,    -- 로그인 시각
  USERNo INTEGER          -- 사번
);
```

**매핑**:
| Excel 컬럼 | DB 컬럼 | 변환 | 필수 |
|-----------|---------|------|------|
| session | session | `str` | ❌ |
| login_time | login_time | `datetime` | ✅ |
| USERNo | USERNo | `int` | ✅ |

### 5.5 mdm_data (MDM 마스터 데이터)

**파일명**: `MDM_YYYYMM-YYYYMM.xlsx`

**스키마**:
```sql
CREATE TABLE mdm_data (
  UserNo INTEGER,          -- 사번
  Timestap TIMESTAMP,      -- 접속 시각 (오타 주의: Timestap)
  task TEXT                -- 작업 내용
);
```

**매핑**:
| Excel 컬럼 | DB 컬럼 | 변환 | 필수 |
|-----------|---------|------|------|
| UserNo | UserNo | `int` | ✅ |
| Timestamp (또는 Timestap) | Timestap | `datetime` | ✅ |
| task | task | `str` | ❌ |

---

## 6. employees (직원 정보)

### 6.1 Excel 파일 구조

**파일명**: `조직마스터_YYYY.MM.xlsx` 또는 `Organization_YYYY.MM.xlsx`

**컬럼 구조**:
```
| 사번 | 성명 | CENTER | DIVISION | TEAM | GROUP | 직급 | 입사일 | 고용형태 |
```

### 6.2 DB 스키마

```sql
CREATE TABLE employees (
  employee_id TEXT PRIMARY KEY,
  employee_name TEXT,
  center_id TEXT,
  center_name TEXT,
  group_id TEXT,
  group_name TEXT,
  team_id TEXT,
  team_name TEXT,
  position TEXT,
  job_grade TEXT
);
```

### 6.3 컬럼 매핑

| Excel 컬럼 | DB 컬럼 | 변환 | 필수 |
|-----------|---------|------|------|
| 사번 | employee_id | `str` | ✅ |
| 성명 | employee_name | `str` | ✅ |
| CENTER | center_name | `str` | ✅ |
| TEAM | team_name | `str` | ✅ |
| GROUP | group_name | `str` | ❌ |
| 직급 | job_grade | `str` | ❌ |

---

## 7. 데이터 유형별 우선순위

### 7.1 필수 데이터 (매월 업데이트)

1. **tag_data** - 출입 태그 (최우선)
2. **claim_data** - 근태 신고
3. **employees** - 조직 마스터 (변경 시)

### 7.2 분석 고도화 데이터 (선택적)

4. **meal_data** - 식사 데이터 (M1/M2 태그)
5. **knox_approval_data** - Knox 결재 (O 태그)
6. **knox_mail_data** - Knox 메일 (O 태그)
7. **knox_pims_data** - Knox PIMS (O 태그)

### 7.3 상세 분석 데이터 (선택적)

8. **eam_data** - EAM 설비 (O 태그)
9. **equis_data** - Equis 장비 (O 태그)
10. **lams_data** - LAMS 실험실 (O 태그)
11. **mes_data** - MES 제조 (O 태그)
12. **mdm_data** - MDM 마스터 (O 태그)

---

## 8. UI 데이터 유형 선택 목록

```typescript
export const DATA_TYPES = [
  {
    id: 'tag_data',
    label: 'Tagging Data (출입 태그)',
    description: '필수 - RFID 출입 태그 데이터',
    priority: 'critical',
    filePattern: '입출문기록*.xlsx',
    sampleColumns: ['일자', '사번', '출입시각', 'DR_GB']
  },
  {
    id: 'claim_data',
    label: 'Claim Data (근태 신고)',
    description: '필수 - HR 근태 신고 데이터',
    priority: 'critical',
    filePattern: '근무기록*.xlsx',
    sampleColumns: ['근무일', '사번', '시작시간', '실제근무시간']
  },
  {
    id: 'employees',
    label: 'Employee Master (직원 정보)',
    description: '필수 - 조직 및 직원 마스터',
    priority: 'critical',
    filePattern: '조직마스터*.xlsx',
    sampleColumns: ['사번', '성명', 'CENTER', 'TEAM']
  },
  {
    id: 'meal_data',
    label: 'Meal Data (식사 데이터)',
    description: '선택 - 식당 출입 데이터 (M1/M2 태그)',
    priority: 'high',
    filePattern: 'Meal*.xlsx',
    sampleColumns: ['취식일시', '사번', '배식구', '테이크아웃']
  },
  {
    id: 'knox_approval',
    label: 'Knox Approval (전자결재)',
    description: '선택 - Knox 전자결재 데이터 (O 태그)',
    priority: 'medium',
    filePattern: 'Knox_approval*.xlsx',
    sampleColumns: ['Timestamp', 'UserNo', 'Task']
  },
  {
    id: 'knox_mail',
    label: 'Knox Mail (메일)',
    description: '선택 - Knox 메일 데이터 (O 태그)',
    priority: 'medium',
    filePattern: 'Knox_mail*.xlsx',
    sampleColumns: ['발신일시_GMT9', '발신인사번_text']
  },
  {
    id: 'knox_pims',
    label: 'Knox PIMS (프로젝트)',
    description: '선택 - Knox PIMS 데이터 (O 태그)',
    priority: 'medium',
    filePattern: 'Knox_PIMS*.xlsx',
    sampleColumns: ['employee_id', 'start_time', 'end_time']
  },
  {
    id: 'eam_data',
    label: 'EAM Data (설비)',
    description: '선택 - EAM 설비 작업 데이터 (O 태그)',
    priority: 'low',
    filePattern: 'EAM*.xlsx',
    sampleColumns: ['ATTEMPTDATE', 'USERNO', 'APP']
  },
  {
    id: 'equis_data',
    label: 'Equis Data (장비)',
    description: '선택 - Equis 장비 사용 데이터 (O 태그)',
    priority: 'low',
    filePattern: 'EQUIS*.xlsx',
    sampleColumns: ['Timestamp', 'USERNO', 'Event']
  },
  {
    id: 'lams_data',
    label: 'LAMS Data (실험실)',
    description: '선택 - LAMS 실험실 데이터 (O 태그)',
    priority: 'low',
    filePattern: 'LAMS*.xlsx',
    sampleColumns: ['User_No', 'DATE', 'Task']
  },
  {
    id: 'mes_data',
    label: 'MES Data (제조)',
    description: '선택 - MES 제조 시스템 데이터 (O 태그)',
    priority: 'low',
    filePattern: 'MES*.xlsx',
    sampleColumns: ['login_time', 'USERNo']
  },
  {
    id: 'mdm_data',
    label: 'MDM Data (마스터 데이터)',
    description: '선택 - MDM 접속 데이터 (O 태그)',
    priority: 'low',
    filePattern: 'MDM*.xlsx',
    sampleColumns: ['UserNo', 'Timestap', 'task']
  }
];
```

---

## 9. 공통 변환 함수

### 9.1 날짜 변환

```python
def convert_date_to_int(date_str: str) -> int:
    """YYYY-MM-DD -> YYYYMMDD"""
    return int(date_str.replace('-', ''))

def convert_time_to_int(time_str: str) -> int:
    """HH:MM:SS -> HHMMSS"""
    return int(time_str.replace(':', ''))
```

### 9.2 사번 정규화

```python
def normalize_employee_id(emp_id: Any) -> str:
    """다양한 형식의 사번을 문자열로 통일"""
    if pd.isna(emp_id):
        return None
    return str(int(float(emp_id)))
```

### 9.3 날짜/시간 파싱

```python
def parse_datetime(dt_str: str) -> str:
    """다양한 날짜 형식을 YYYY-MM-DD HH:MM:SS로 통일"""
    try:
        dt = pd.to_datetime(dt_str)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return None
```

---

## 10. 검증 규칙

### 10.1 데이터 품질 체크

```python
def validate_data_quality(df: pd.DataFrame, data_type: str) -> dict:
    """데이터 품질 검증"""
    issues = []

    # 필수 컬럼 체크
    required_cols = REQUIRED_COLUMNS[data_type]
    missing_cols = set(required_cols) - set(df.columns)
    if missing_cols:
        issues.append(f"Missing columns: {missing_cols}")

    # NULL 값 체크
    for col in required_cols:
        if col in df.columns:
            null_count = df[col].isna().sum()
            if null_count > 0:
                issues.append(f"{col}: {null_count} null values")

    # 데이터 타입 체크
    # 날짜 범위 체크
    # 중복 체크

    return {
        'valid': len(issues) == 0,
        'issues': issues,
        'row_count': len(df),
        'column_count': len(df.columns)
    }
```

---

## 11. 배치 처리 전략

### 11.1 처리 순서

```
1. tag_data (가장 큰 파일, 150MB+)
   - 청크 크기: 10,000행
   - 배치 삽입: 5,000행
   - 예상 시간: 3-5분

2. Knox/Equipment 데이터 (중간 크기)
   - 청크 크기: 5,000행
   - 배치 삽입: 5,000행
   - 예상 시간: 1-2분

3. 기타 데이터 (작은 크기)
   - 한 번에 처리
   - 예상 시간: < 1분
```

### 11.2 메모리 최적화

```python
# 대용량 파일 처리
for chunk in pd.read_excel(file_path, chunksize=10000):
    # 변환
    transformed = transform_data(chunk, data_type)

    # 삽입
    insert_batch(transformed, table_name)

    # 진행률 업데이트
    progress += len(chunk)
```

---

## 12. 에러 처리

### 12.1 일반적인 오류

| 오류 유형 | 원인 | 해결 방법 |
|---------|------|----------|
| 컬럼 불일치 | Excel 형식 변경 | 매핑 테이블 업데이트 |
| 데이터 타입 오류 | 숫자 필드에 문자 | 데이터 정제 후 재시도 |
| NULL 값 오류 | 필수 필드 누락 | 해당 행 건너뛰기 또는 거부 |
| 중복 키 오류 | Primary Key 중복 | REPLACE 또는 IGNORE 옵션 |
| 메모리 부족 | 파일 너무 큼 | 청크 크기 줄이기 |

### 12.2 에러 로깅

```python
def log_error(error_type: str, row_num: int, details: str):
    """에러 로그 기록"""
    error_log.append({
        'timestamp': datetime.now(),
        'error_type': error_type,
        'row': row_num,
        'details': details
    })
```

---

## 13. 참고 자료

- [EXCEL_UPLOAD_IMPLEMENTATION_PLAN.md](./EXCEL_UPLOAD_IMPLEMENTATION_PLAN.md)
- [PROJECT_HANDOVER_COMPREHENSIVE.md](./PROJECT_HANDOVER_COMPREHENSIVE.md)
- [DATA_UPLOAD_PROCESS.md](./DATA_UPLOAD_PROCESS.md)
