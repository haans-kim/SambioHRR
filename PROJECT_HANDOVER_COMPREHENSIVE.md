# SambioHRR 프로젝트 종합 이관 문서

**작성일**: 2025-10-14
**버전**: 1.0
**목적**: 프로젝트 전체 데이터 구조, 처리 프로세스, 분석 로직의 완전한 이해와 이관

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [데이터베이스 구조](#2-데이터베이스-구조)
3. [데이터 로딩 및 처리 파이프라인](#3-데이터-로딩-및-처리-파이프라인)
4. [분석 엔진](#4-분석-엔진)
5. [페이지별 데이터 흐름](#5-페이지별-데이터-흐름)
6. [기술 스택과 Obsolete 기술](#6-기술-스택과-obsolete-기술)
7. [운영 가이드](#7-운영-가이드)

---

## 1. 프로젝트 개요

### 1.1 프로젝트 목적
SambioHRR은 HR 분석 대시보드로, 조직 구성원의 **근무 패턴**, **업무 효율성**, **시간 활용**을 분석하여 조직 리밸런싱과 의사결정을 지원하는 시스템입니다.

### 1.2 핵심 기능
- **개인 분석**: 개별 직원의 일별 근무 패턴 상세 분석
- **조직 분석**: 센터/팀/그룹 단위의 집계 분석 및 벤치마킹
- **근무 불균형 모니터링**: 팀별 근무시간 편차 실시간 모니터링
- **근무 패턴 클러스터링**: 팀별 근무 특성 분류 및 인사이트 제공
- **트렌드 분석**: 직급별, 센터별 월별 근무 추이 분석

### 1.3 시스템 아키텍처
```
데이터 소스 (Tag, Knox, Claim 등)
    ↓
데이터베이스 (sambio_human.db)
    ↓
분석 엔진 (WorkHourCalculator, Master Table Builder)
    ↓
API 레이어 (Next.js API Routes)
    ↓
UI 레이어 (React 컴포넌트)
```

---

## 2. 데이터베이스 구조

### 2.1 데이터베이스 개요
- **주 데이터베이스**: `sambio_human.db` (SQLite, 4.6GB)
  - 운영 데이터 저장소
  - 원시 데이터 및 일별 분석 결과
  - 총 테이블 수: 57개 (테이블 + 뷰)

- **분석 데이터베이스**: `sambio_analytics.db` (SQLite, 6.5GB)
  - Master Events Table 기반 집단 분석용 DB
  - 동일 시간대 타 팀원 패턴 참조 및 이상치 탐지
  - 1,547만+ 이벤트 데이터 저장
  - 집단 지성(Collective Intelligence) 분석 지원

### 2.2 핵심 테이블 분류

#### 2.2.1 원시 데이터 테이블 (Raw Data)
조직의 다양한 시스템에서 수집된 원본 데이터를 저장합니다.

| 테이블명 | 설명 | 주요 컬럼 | 데이터 소스 |
|---------|------|----------|-----------|
| `tag_data` | RFID 출입 태그 데이터 | 사번, 출입시각, DR_NO (문번호), INOUT_GB | 출입통제 시스템 |
| `claim_data` | 근태 신고 데이터 | 사번, 근무일, 시작시간, 종료시간, 실제근무시간 | HR 시스템 |
| `knox_approval_data` | Knox 전자결재 데이터 | 사번, 결재시각, 문서유형 | Knox 시스템 |
| `knox_mail_data` | Knox 메일 데이터 | 사번, 메일시각 | Knox 메일 |
| `knox_pims_data` | PIMS 프로젝트 관리 데이터 | 사번, 작업시각 | PIMS 시스템 |
| `meal_data` | 식당 출입 데이터 | 사번, 식사시각, 식사구분 | 구내식당 시스템 |
| `eam_data` | EAM 설비 데이터 | 사번, 작업시각, 설비번호 | EAM 시스템 |
| `equis_data` | Equis 장비 데이터 | 사번, 사용시각, 장비코드 | Equis 시스템 |
| `lams_data` | LAMS 실험실 데이터 | 사번, 실험시각 | LAMS 시스템 |
| `mdm_data` | MDM 마스터 데이터 | 사번, 접속시각 | MDM 시스템 |
| `mes_data` | MES 제조 데이터 | 사번, 작업시각, 공정코드 | MES 시스템 |

**데이터 특성**:
- 모든 테이블에 `사번` (employee_id) 컬럼 포함
- 타임스탬프 기반 이벤트 데이터
- 원본 데이터는 변경하지 않음 (Immutable)

#### 2.2.2 조직 및 마스터 데이터

| 테이블명 | 설명 | 주요 컬럼 | 용도 |
|---------|------|----------|-----|
| `organization_master` | 조직 계층 구조 | org_code, org_name, org_level, parent_org_code | 조직도 관리 |
| `employees` | 직원 기본 정보 | employee_id, name, job_grade, center, team | 직원 마스터 |
| `tag_master` | 태그 코드 마스터 | tag_code, tag_name, tag_type | 태그 분류 |
| `tag_location_master` | 장소 코드 마스터 | location_code, location_name, building | 출입 장소 정보 |
| `holidays` | 공휴일 데이터 | holiday_date, holiday_name, holiday_type | 휴일 판정 |
| `grade_level_mapping` | 직급 레벨 매핑 | job_grade, grade_level (Lv.1-4) | 직급 표준화 |

**조직 계층 구조**:
```
center (센터)
  └── division (담당) - optional
      └── team (팀)
          └── group (그룹)
```

**중요**: `organization_master`는 4단계 계층을 지원하지만, division 레벨은 선택적으로 사용됩니다.

#### 2.2.3 분석 결과 테이블

| 테이블명 | 설명 | 주요 컬럼 | 생성 방식 |
|---------|------|----------|---------|
| `daily_analysis_results` | 개인별 일일 분석 결과 | employee_id, analysis_date, actual_work_hours, efficiency_ratio | WorkHourCalculator |
| `organization_daily_stats` | 조직별 일일 통계 | org_code, work_date, avg_actual_work_hours, avg_efficiency_ratio | 집계 스크립트 |
| `dept_pattern_analysis_new` | 팀별 근무 패턴 분석 | team, cluster_type, o_tag_count, t1_count | 클러스터링 분석 |
| `team_t1_statistics` | 팀별 T1 태그 통계 | team, avg_t1_per_person, movement_index | T1 분석 스크립트 |

**daily_analysis_results 주요 지표**:
- `total_hours`: 총 체류시간 (출근~퇴근)
- `actual_work_hours`: 실제 근무시간 (업무 활동 시간)
- `claimed_work_hours`: 신고 근무시간 (HR 시스템 신고)
- `efficiency_ratio`: 효율성 비율 (actual / total * 100)
- `work_minutes`, `meeting_minutes`, `meal_minutes`, `rest_minutes`: 활동별 시간
- `confidence_score`: 데이터 신뢰도 (0-100)
- `ground_rules_work_hours`: Ground Rules 기반 추정 근무시간
- `leave_hours`: 휴가 시간 (연차, 반차 등)

#### 2.2.4 집계 뷰 (Materialized Views)

| 뷰명 | 설명 | 기반 테이블 | 용도 |
|-----|------|-----------|-----|
| `v_center_daily_summary` | 센터별 일일 요약 | daily_analysis_results | 센터 대시보드 |
| `v_team_daily_summary` | 팀별 일일 요약 | daily_analysis_results | 팀별 분석 |
| `v_group_daily_summary` | 그룹별 일일 요약 | daily_analysis_results | 그룹별 분석 |
| `v_grade_level_summary` | 직급별 요약 | daily_analysis_results | 직급별 벤치마킹 |
| `v_efficiency_ranking` | 효율성 순위 | daily_analysis_results | 랭킹 표시 |

**뷰의 장점**:
- 복잡한 집계 쿼리를 단순화
- 코드 중복 제거
- 일관된 집계 로직 보장

#### 2.2.5 배치 작업 관리 테이블

| 테이블명 | 설명 | 주요 컬럼 |
|---------|------|----------|
| `batch_jobs` | 배치 작업 이력 | job_id, job_type, status, start_time, end_time |
| `batch_job_checkpoints` | 체크포인트 (중단/재개) | job_id, checkpoint_data, created_at |
| `organization_analysis_job` | 조직 분석 작업 | job_id, target_org, progress, status |
| `processing_log` | 처리 로그 | log_id, operation, message, timestamp |

**배치 작업 특징**:
- 중단 후 재개 가능한 체크포인트 시스템
- 진행률 추적
- 오류 복구 메커니즘

### 2.3 테이블 간 관계도

```
원시 데이터 (tag_data, claim_data, knox_*, meal_data 등)
    ↓ [분석 엔진 처리]
daily_analysis_results (개인별 일일 분석)
    ↓ [집계 쿼리]
organization_daily_stats (조직별 일일 통계)
    ↓ [뷰 활용]
v_center_daily_summary, v_team_daily_summary, v_group_daily_summary
    ↓ [API 제공]
UI 페이지 (Dashboard, Teams, Groups 등)
```

### 2.4 인덱스 전략

**성능 최적화를 위한 주요 인덱스**:
```sql
-- daily_analysis_results
CREATE INDEX idx_dar_date_efficiency_desc ON daily_analysis_results(analysis_date DESC, efficiency_ratio DESC);
CREATE INDEX idx_dar_center_date_efficiency ON daily_analysis_results(center_id, analysis_date, efficiency_ratio);
CREATE INDEX idx_dar_team_date_efficiency ON daily_analysis_results(team_id, analysis_date, efficiency_ratio);
CREATE INDEX idx_dar_employee_date ON daily_analysis_results(employee_id, analysis_date);

-- tag_data
CREATE INDEX idx_tag_employee_date ON tag_data(사번, ENTE_DT);
CREATE INDEX idx_tag_date_center ON tag_data(ENTE_DT, CENTER);

-- claim_data
CREATE INDEX idx_claim_employee_date ON claim_data(사번, 근무일);
```

---

## 3. 데이터 로딩 및 처리 파이프라인

### 3.1 데이터 수집 프로세스

#### 3.1.1 초기 데이터 로드
신규 데이터를 시스템에 최초로 로드하는 과정입니다.

**데이터 소스별 로딩 방법**:

1. **Tag Data (출입 태그)**
   - 파일 형식: CSV, Excel
   - 로딩 스크립트: 수동 SQL INSERT 또는 CSV IMPORT
   - 주기: 일일 배치 (매일 새벽)
   - 테이블: `tag_data`

2. **Claim Data (근태 신고)**
   - 파일 형식: Excel
   - 로딩 스크립트: Excel → CSV 변환 → SQL INSERT
   - 주기: 주간 배치 (매주 월요일)
   - 테이블: `claim_data`

3. **Knox 데이터 (전자결재/메일/PIMS)**
   - 파일 형식: CSV
   - 로딩 스크립트: 각 시스템별 개별 스크립트
   - 주기: 일일 배치
   - 테이블: `knox_approval_data`, `knox_mail_data`, `knox_pims_data`

4. **장비 사용 데이터 (EAM, Equis, LAMS, MES 등)**
   - 파일 형식: CSV
   - 로딩 스크립트: 시스템별 개별 로더
   - 주기: 일일/주간 배치
   - 테이블: `eam_data`, `equis_data`, `lams_data`, `mes_data` 등

**데이터 로딩 체크리스트**:
- [ ] 데이터 파일 형식 검증 (컬럼명, 데이터 타입)
- [ ] 중복 데이터 제거 (UNIQUE 제약조건 활용)
- [ ] 날짜 형식 표준화 (YYYY-MM-DD)
- [ ] 사번 유효성 검증 (employees 테이블 참조)
- [ ] 조직 코드 유효성 검증 (organization_master 참조)

### 3.2 데이터 전처리 및 정제

#### 3.2.1 Tag Data 정제
출입 태그 데이터는 가장 중요한 원시 데이터이지만, 노이즈가 많아 정제가 필요합니다.

**정제 프로세스**:
1. **중복 태그 제거**: 동일 시간대(±30초) 중복 태그 제거
2. **태그 순서 정렬**: 시간순 정렬 및 연속성 검증
3. **장소 매핑**: DR_NO (문번호) → 실제 장소명 (tag_location_master 참조)

**중요**: 24시간 교대근무 체계이므로, 야간 시간대 태그나 짧은 체류 시간 등에 대한 필터링은 적용하지 않습니다. 모든 시간대의 태그 데이터를 유효한 근무 데이터로 처리합니다.

**정제 코드 예시** (개념):
```typescript
function cleanTagData(rawTags: RawTag[]): CleanTag[] {
  // 1. 시간순 정렬
  const sorted = rawTags.sort((a, b) => a.timestamp - b.timestamp);

  // 2. 중복 제거 (30초 이내)
  const deduped = removeDuplicates(sorted, 30);

  // 3. 유효성 검증
  const valid = deduped.filter(tag =>
    isValidWorkTime(tag) &&
    hasValidLocation(tag) &&
    hasValidEmployee(tag)
  );

  return valid;
}
```

#### 3.2.2 Claim Data 정제
근태 신고 데이터는 직원이 수동으로 입력하므로 오류가 있을 수 있습니다.

**정제 프로세스**:
1. **날짜 교차 근무 처리**: 야간 근무 시 다음날 날짜로 교차 (cross_day_work 플래그)
2. **제외시간 계산**: 휴게시간 자동 계산 및 검증
3. **휴가 시간 처리**: 연차, 반차 등 휴가 코드 별도 처리 (`leave_hours` 컬럼)
4. **직급 매핑**: 원본 직급 → 표준 직급 레벨 (Lv.1-4) 변환

**휴가 처리 로직**:
```typescript
function processLeaveHours(claimData: ClaimData): number {
  const leaveTypes = ['연차', '반차', '오전반차', '오후반차', '병가', '경조사'];
  if (leaveTypes.includes(claimData.근태명)) {
    switch (claimData.근태명) {
      case '연차': return 8.0;
      case '반차': case '오전반차': case '오후반차': return 4.0;
      case '병가': case '경조사': return 8.0;
      default: return 0;
    }
  }
  return 0;
}
```

#### 3.2.3 조직 데이터 동기화
조직 구조는 변경될 수 있으므로, 정기적으로 동기화가 필요합니다.

**동기화 스크립트**: `scripts/migration_4level_hierarchy.sql`
- 조직 계층 재구성
- 직원-조직 매핑 업데이트
- 비활성 조직 처리 (is_active = 0)

### 3.3 Master Table 구축 (통합 이벤트 테이블)

**Master Table**은 모든 원시 데이터를 시간순으로 통합한 이벤트 테이블입니다. (현재 개발 중)

#### 3.3.1 Master Table 개념
```
개별 데이터 소스          Master Table (통합)
─────────────────        ─────────────────────
tag_data                 2025-01-15 08:30 사번123 TAG 출근
claim_data        →      2025-01-15 09:00 사번123 WORK_START 근무시작
knox_approval_data       2025-01-15 10:15 사번123 APPROVAL 결재
meal_data                2025-01-15 12:00 사번123 MEAL 점심
eam_data                 2025-01-15 14:20 사번123 EQUIPMENT 장비사용
tag_data                 2025-01-15 18:00 사번123 TAG 퇴근
```

#### 3.3.2 Master Table 스키마
```sql
CREATE TABLE master_events_table (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- 시간 정보
  timestamp DATETIME NOT NULL,
  date DATE NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  hour INTEGER NOT NULL,

  -- 직원 및 조직 정보
  employee_id TEXT NOT NULL,
  center_code TEXT,
  division_code TEXT,
  team_code TEXT,
  group_code TEXT,
  job_grade TEXT,

  -- 이벤트 정보
  event_type TEXT NOT NULL,  -- TAG, KNOX, MEAL, EQUIPMENT 등
  event_subtype TEXT,         -- ENTRY, EXIT, APPROVAL, LUNCH 등
  event_source TEXT NOT NULL, -- tag_data, knox_approval_data 등

  -- 위치 정보
  location_code TEXT,
  location_name TEXT,
  building TEXT,
  floor TEXT,

  -- 추가 속성 (JSON)
  event_metadata TEXT,  -- 이벤트별 추가 정보 (JSON 형식)

  -- 인덱스
  INDEX idx_timestamp (timestamp),
  INDEX idx_employee_date (employee_id, date),
  INDEX idx_event_type (event_type, timestamp)
);
```

#### 3.3.3 Master Table 구축 스크립트
**스크립트**: `scripts/master-table-builder.ts`

**실행 방법**:
```bash
# 전체 모듈 실행 (기본)
npx tsx scripts/master-table-builder.ts 2025-01-01 2025-01-31

# 특정 모듈만 실행
npx tsx scripts/master-table-builder.ts 2025-01-01 2025-01-31 --modules=tag,knox,meal

# 강제 재구축
npx tsx scripts/master-table-builder.ts 2025-01-01 2025-01-31 --force-rebuild
```

**모듈 구성**:
1. `schema`: Master Table 스키마 초기화
2. `tag`: Tag 데이터 통합
3. `knox`: Knox 데이터 통합 (approval, mail, pims)
4. `equipment`: 장비 데이터 통합 (eam, equis, lams, mes)
5. `meal`: 식사 데이터 통합
6. `claim`: Claim 데이터 통합
7. `organization`: 조직 정보 동기화
8. `analysis`: 통합 데이터 기반 분석 수행

**모듈 실행 순서**:
```
schema → tag → knox → equipment → meal → claim → organization → analysis
```

**중요**: 각 모듈은 독립적으로 실행 가능하므로, 오류 발생 시 해당 모듈만 재실행할 수 있습니다.

### 3.4 일일 배치 프로세스

#### 3.4.1 개인 분석 배치
**스크립트**: `scripts/reanalyze_all_data.ts`

**실행 순서**:
1. 대상 날짜 범위 설정
2. 직원 목록 조회 (employees 테이블)
3. 각 직원별 일일 데이터 조회:
   - Tag data
   - Claim data
   - Knox data
   - Meal data
   - Equipment data
4. **WorkHourCalculator** 호출하여 분석
5. 결과를 `daily_analysis_results`에 저장 (UPSERT)
6. 진행률 출력 및 체크포인트 저장

**실행 예시**:
```bash
# 특정 날짜 범위 분석
npx tsx scripts/reanalyze_all_data.ts 2025-01-01 2025-01-31

# 특정 센터만 분석
npx tsx scripts/reanalyze_all_data.ts 2025-01-01 2025-01-31 --center=영업센터
```

#### 3.4.2 조직 통계 집계 배치
**스크립트**: 내장 SQL 뷰 활용 (자동 집계)

**집계 순서**:
```
daily_analysis_results
  → v_group_daily_summary (그룹별)
  → v_team_daily_summary (팀별)
  → v_center_daily_summary (센터별)
  → monthly_stats 테이블들 (월별 집계)
```

**월별 집계 테이블**:
- `monthly_center_stats`: 센터별 월별 통계
- `monthly_grade_stats`: 직급별 월별 통계
- `monthly_group_stats`: 그룹별 월별 통계
- `monthly_overall_stats`: 전사 월별 통계

**집계 실행**:
```bash
# 조직 통계 업데이트 (Ground Rules 포함)
npx tsx scripts/update-organization-stats-with-ground-rules.ts
```

#### 3.4.3 Ground Rules 기반 분석
**Ground Rules**는 T1 태그 (이동 태그) 패턴을 기반으로 근무 시간을 추정하는 고급 분석 기법입니다.

**Ground Rules 개념**:
- T1 태그 (통로, 복도 이동) = 업무 이동 패턴
- T1 태그 빈도가 높으면 → 실제 근무 중일 가능성 높음
- T1 태그 빈도가 낮으면 → 자리 이탈 또는 비업무 시간

**Ground Rules 처리 스크립트**:
- `scripts/update-organization-stats-with-ground-rules.ts`
- `scripts/validate-ground-rules.ts`

**결과 컬럼**:
- `ground_rules_work_hours`: Ground Rules 기반 추정 근무시간
- `ground_rules_confidence`: 추정 신뢰도 (0-100)
- `work_movement_minutes`: 업무 이동 시간
- `non_work_movement_minutes`: 비업무 이동 시간

---

## 4. 분석 엔진

### 4.1 WorkHourCalculator (개인 분석 엔진)

#### 4.1.1 개요
**WorkHourCalculator**는 개인별 일일 근무 데이터를 분석하여 실제 근무시간, 활동 패턴, 효율성을 계산하는 핵심 분석 엔진입니다.

**파일 위치**: `/lib/analytics/WorkHourCalculator.ts`

#### 4.1.2 분석 모드

WorkHourCalculator는 두 가지 모드를 지원합니다:

1. **Enhanced Mode (기본)**: 모든 데이터 소스를 활용한 정밀 분석
   - Tag + Claim + Knox + Meal + Equipment 데이터 통합
   - 상태 머신 기반 활동 분류
   - Ground Rules 기반 근무 추정

2. **Legacy Mode**: Tag와 Claim 데이터만 사용한 기본 분석
   - 최소한의 데이터로 분석 가능
   - 신뢰도는 낮지만 빠른 처리
   - 초기 데이터 부족 시 사용

**모드 선택**:
```typescript
const calculator = new WorkHourCalculator('enhanced'); // 또는 'legacy'
const metrics = calculator.calculateMetrics(timeline);
```

#### 4.1.3 데이터 입력 형식

**TimelineEntry 인터페이스**:
```typescript
interface TimelineEntry {
  timestamp: Date;           // 이벤트 발생 시각
  eventType: string;         // TAG, KNOX, MEAL 등
  eventSubtype?: string;     // ENTRY, EXIT, LUNCH 등
  location?: string;         // 장소 정보
  tagCode?: TagCode;         // 태그 코드 (O, T1, G3 등)
  state: ActivityState;      // 활동 상태
  duration: number;          // 해당 상태 지속 시간 (분)
  confidence?: number;       // 추정 신뢰도 (0-1)
  assumption?: string;       // 추정 근거 (예: T1_WORK_RETURN)
}
```

**ActivityState 열거형**:
```typescript
enum ActivityState {
  WORK = 'WORK',                    // 일반 업무
  FOCUSED_WORK = 'FOCUSED_WORK',    // 집중 업무 (O 태그 밀집)
  MEETING = 'MEETING',              // 회의 (G3 태그)
  EDUCATION = 'EDUCATION',          // 교육/훈련
  MEAL = 'MEAL',                    // 식사
  REST = 'REST',                    // 휴식
  NON_WORK = 'NON_WORK',           // 비업무
  TRANSIT = 'TRANSIT',              // 이동 (T1 태그)
  ENTRY = 'ENTRY',                  // 출근
  EXIT = 'EXIT',                    // 퇴근
  PREPARATION = 'PREPARATION'       // 업무 준비
}
```

**TagCode 분류**:
```typescript
enum TagCode {
  G1 = 'G1',   // 주업무 공간
  G2 = 'G2',   // 준비 공간
  G3 = 'G3',   // 회의 공간
  G4 = 'G4',   // 교육 공간
  N1 = 'N1',   // 휴게 공간
  N2 = 'N2',   // 복지시설
  T1 = 'T1',   // 통로/계단
  T2 = 'T2',   // 출입구(입)
  T3 = 'T3',   // 출입구(출)
  M1 = 'M1',   // 식당 내 식사
  M2 = 'M2',   // 테이크아웃
  O = 'O'      // 실제 업무 로그 (장비/설비 태그 + Knox 시스템 이벤트)
}
```

**중요**: Knox 시스템 이벤트(전자결재, 메일, PIMS 등)는 모두 `O` 태그로 분류되어 실제 업무 활동으로 처리됩니다.

#### 4.1.4 분석 알고리즘

**단계별 분석 프로세스**:

```
1. Timeline 생성
   ├─ Tag 이벤트 수집
   ├─ Knox 이벤트 수집
   ├─ Meal 이벤트 수집
   ├─ Equipment 이벤트 수집
   └─ 시간순 정렬

2. 상태 분류
   ├─ 각 이벤트에 ActivityState 할당
   ├─ 연속 이벤트 그룹화
   └─ 상태 지속 시간 계산

3. 시간 집계
   ├─ 활동별 시간 합산
   ├─ 총 체류시간 계산
   └─ 실제 근무시간 계산

4. 고급 분석
   ├─ 집중 업무 시간 계산 (O 태그 밀도)
   ├─ Ground Rules 적용 (T1 패턴 분석)
   └─ 신뢰도 점수 계산

5. 지표 계산
   ├─ 효율성 비율 = (실제 근무 / 체류) * 100
   ├─ 작업추정률 = (추정 근무 / 신고 근무) * 100
   └─ 데이터 신뢰도 점수
```

**핵심 계산 로직**:

```typescript
calculateMetrics(timeline: TimelineEntry[]): WorkMetrics {
  const metrics: WorkMetrics = {
    totalTime: 0,        // 총 체류시간
    workTime: 0,         // 실제 근무시간
    estimatedWorkTime: 0,// 추정 근무시간
    focusTime: 0,        // 집중 업무시간
    meetingTime: 0,      // 회의시간
    mealTime: 0,         // 식사시간
    transitTime: 0,      // 이동시간
    restTime: 0,         // 휴식시간
    reliabilityScore: 0  // 신뢰도 점수
  };

  // 1. 총 체류시간 계산
  if (timeline.length > 0) {
    const firstTime = timeline[0].timestamp.getTime();
    const lastTime = timeline[timeline.length - 1].timestamp.getTime();
    metrics.totalTime = (lastTime - firstTime) / 60000; // 분 단위
  }

  // 2. 활동별 시간 집계
  for (const entry of timeline) {
    const duration = entry.duration || 0;

    switch (entry.state) {
      case ActivityState.WORK:
      case ActivityState.PREPARATION:
        metrics.workTime += duration;
        break;
      case ActivityState.MEETING:
        metrics.meetingTime += duration;
        metrics.workTime += duration; // 회의도 근무에 포함
        break;
      case ActivityState.MEAL:
        metrics.mealTime += duration;
        break;
      case ActivityState.TRANSIT:
        metrics.transitTime += duration;
        break;
      case ActivityState.REST:
      case ActivityState.NON_WORK:
        metrics.restTime += duration;
        break;
    }

    // T1 근무 복귀 가정
    if (entry.assumption === 'T1_WORK_RETURN') {
      metrics.estimatedWorkTime += duration * (entry.confidence || 0.5);
    }
  }

  // 3. 집중 업무 시간 계산
  metrics.focusTime = this.calculateFocusTime(timeline);

  // 4. 효율성 계산
  if (metrics.totalTime > 0) {
    metrics.workRatio = (metrics.workTime / metrics.totalTime) * 100;
  }

  // 5. 신뢰도 계산
  metrics.reliabilityScore = this.calculateReliability(timeline);

  return metrics;
}
```

**집중 업무 시간 계산**:
```typescript
private calculateFocusTime(timeline: TimelineEntry[]): number {
  let focusTime = 0;
  const O_TAG_THRESHOLD = 3; // 30분당 O 태그 3개 이상 → 집중 업무

  // 30분 단위로 윈도우 슬라이딩
  for (let i = 0; i < timeline.length; i++) {
    const windowStart = timeline[i].timestamp.getTime();
    const windowEnd = windowStart + (30 * 60 * 1000); // 30분

    // 윈도우 내 O 태그 개수 카운트
    let oTagCount = 0;
    for (let j = i; j < timeline.length; j++) {
      const entryTime = timeline[j].timestamp.getTime();
      if (entryTime > windowEnd) break;
      if (timeline[j].tagCode === TagCode.O) {
        oTagCount++;
      }
    }

    // 임계값 이상이면 집중 업무로 판정
    if (oTagCount >= O_TAG_THRESHOLD) {
      focusTime += 30; // 30분 추가
    }
  }

  return focusTime;
}
```

**신뢰도 점수 계산**:
```typescript
private calculateReliability(timeline: TimelineEntry[]): number {
  let score = 100; // 최대 점수에서 감점 방식

  // 1. 데이터 밀도 체크
  const density = timeline.length / (metrics.totalTime / 60); // 시간당 이벤트 수
  if (density < 2) score -= 20; // 시간당 2개 미만 → -20점

  // 2. 출퇴근 태그 존재 여부
  const hasEntry = timeline.some(e => e.state === ActivityState.ENTRY);
  const hasExit = timeline.some(e => e.state === ActivityState.EXIT);
  if (!hasEntry) score -= 15;
  if (!hasExit) score -= 15;

  // 3. 데이터 간격 체크 (1시간 이상 공백)
  for (let i = 1; i < timeline.length; i++) {
    const gap = (timeline[i].timestamp.getTime() - timeline[i-1].timestamp.getTime()) / 60000;
    if (gap > 60) {
      score -= 10; // 큰 공백마다 -10점
    }
  }

  return Math.max(0, Math.min(100, score)); // 0-100 범위로 제한
}
```

#### 4.1.5 WorkMetrics 출력 형식

```typescript
interface WorkMetrics {
  employeeId: number;              // 사번
  date: string;                    // 날짜 (YYYY-MM-DD)
  totalTime: number;               // 총 체류시간 (분)
  workTime: number;                // 실제 근무시간 (분)
  estimatedWorkTime: number;       // 추정 근무시간 (분)
  workRatio: number;               // 효율성 비율 (%)
  focusTime: number;               // 집중 업무시간 (분)
  meetingTime: number;             // 회의시간 (분)
  mealTime: number;                // 식사시간 (분)
  transitTime: number;             // 이동시간 (분)
  restTime: number;                // 휴식시간 (분)
  reliabilityScore: number;        // 신뢰도 점수 (0-100)

  // 추가 정보 (optional)
  oTagCount?: number;              // O 태그 개수
  t1TagCount?: number;             // T1 태그 개수
  g3TagCount?: number;             // G3 태그 개수
  knoxEventCount?: number;         // Knox 이벤트 개수
  mealCount?: number;              // 식사 횟수
}
```

### 4.2 조직 분석 (Worker 기반 분석)

#### 4.2.1 Worker 프로세스 개요
조직 분석은 여러 직원의 데이터를 병렬로 처리하기 위해 Worker 패턴을 사용합니다.

**관련 파일**:
- `/app/organization/page.tsx`: 조직 분석 UI
- `/app/api/organization/ground-rules-worker-analysis/route.ts`: Worker API

#### 4.2.2 Worker 기반 배치 분석

**분석 플로우**:
```
1. 사용자가 조직 선택 (센터/팀)
   ↓
2. API 호출: /api/organization/ground-rules-worker-analysis
   ↓
3. 대상 직원 목록 조회
   ↓
4. Worker Pool 생성 (병렬 처리)
   ↓
5. 각 Worker가 직원별 분석 수행
   ├─ Raw 데이터 조회
   ├─ WorkHourCalculator 호출
   ├─ Ground Rules 적용
   └─ 결과 저장
   ↓
6. 진행률 업데이트 (SSE 또는 Polling)
   ↓
7. 완료 후 결과 집계
```

**Worker 코드 개념**:
```typescript
class OrganizationAnalysisWorker {
  async analyzeEmployee(employeeId: string, date: string): Promise<AnalysisResult> {
    // 1. 데이터 조회
    const rawData = await this.fetchRawData(employeeId, date);

    // 2. Timeline 생성
    const timeline = this.buildTimeline(rawData);

    // 3. 분석 수행
    const calculator = new WorkHourCalculator('enhanced');
    const metrics = calculator.calculateMetrics(timeline);

    // 4. Ground Rules 적용
    const groundRulesMetrics = this.applyGroundRules(timeline, metrics);

    // 5. 결과 반환
    return {
      employeeId,
      date,
      metrics,
      groundRulesMetrics,
      reliabilityScore: metrics.reliabilityScore
    };
  }

  async analyzeBatch(employees: string[], date: string): Promise<void> {
    const batchSize = 10; // 동시 처리 개수
    const batches = this.chunkArray(employees, batchSize);

    for (const batch of batches) {
      const promises = batch.map(empId => this.analyzeEmployee(empId, date));
      const results = await Promise.all(promises);

      // 결과 저장
      await this.saveResults(results);

      // 진행률 업데이트
      this.updateProgress(results.length);
    }
  }
}
```

#### 4.2.3 체크포인트 및 재개 기능

배치 작업은 시간이 오래 걸리므로, 중단 시 재개 가능해야 합니다.

**체크포인트 저장**:
```typescript
async saveCheckpoint(jobId: string, progress: CheckpointData): Promise<void> {
  const checkpoint = {
    jobId,
    processedEmployees: progress.processedEmployees,
    totalEmployees: progress.totalEmployees,
    lastProcessedIndex: progress.lastProcessedIndex,
    errors: progress.errors,
    timestamp: new Date().toISOString()
  };

  await db.run(`
    INSERT INTO batch_job_checkpoints (job_id, checkpoint_data, created_at)
    VALUES (?, ?, ?)
  `, [jobId, JSON.stringify(checkpoint), new Date()]);
}
```

**재개 로직**:
```typescript
async resumeJob(jobId: string): Promise<void> {
  // 1. 체크포인트 로드
  const checkpoint = await this.loadCheckpoint(jobId);

  // 2. 남은 직원 목록 조회
  const remainingEmployees = this.getEmployeeList().slice(checkpoint.lastProcessedIndex);

  // 3. 재개
  await this.analyzeBatch(remainingEmployees, checkpoint.date);
}
```

### 4.3 Ground Rules 분석 엔진

#### 4.3.1 Ground Rules 개념
Ground Rules는 T1 태그 (이동 태그) 패턴을 기반으로 근무 중/비근무 중을 추정하는 규칙 기반 시스템입니다.

**기본 가정**:
- **T1 태그 빈도 높음** → 업무 중 (사무실 내 이동)
- **T1 태그 빈도 낮음** → 비업무 (자리 비움, 외출)
- **T1 태그 패턴** → 업무 복귀 시점 추정

#### 4.3.2 Ground Rules 알고리즘

**단계별 분석**:
```
1. T1 태그 집계
   ├─ 30분 단위 윈도우
   ├─ 윈도우별 T1 태그 개수 카운트
   └─ 임계값 비교 (예: 3개 이상)

2. 근무 구간 판정
   ├─ T1 빈도 ≥ 임계값 → 근무 중
   ├─ T1 빈도 < 임계값 → 비근무 (의심)
   └─ 연속 비근무 30분 이상 → 자리 비움 확정

3. 근무 복귀 시점 추정
   ├─ 비근무 구간 종료 시점 탐지
   ├─ T1 태그 재출현 → 근무 복귀로 판정
   └─ 신뢰도 계산 (T1 밀도 기반)

4. 근무시간 재계산
   ├─ 기존 workTime에서 비근무 구간 제외
   ├─ ground_rules_work_hours 계산
   └─ ground_rules_confidence 계산
```

**코드 예시**:
```typescript
function applyGroundRules(timeline: TimelineEntry[], baseMetrics: WorkMetrics): GroundRulesMetrics {
  const WINDOW_SIZE = 30; // 30분 윈도우
  const T1_THRESHOLD = 3;  // 임계값: 30분당 3개

  let groundRulesWorkTime = baseMetrics.workTime;
  let totalConfidence = 0;
  let windowCount = 0;

  // 30분 단위로 분석
  for (let i = 0; i < timeline.length; i++) {
    const windowStart = timeline[i].timestamp.getTime();
    const windowEnd = windowStart + (WINDOW_SIZE * 60 * 1000);

    // 윈도우 내 T1 태그 개수
    const t1Count = timeline
      .filter(e =>
        e.timestamp.getTime() >= windowStart &&
        e.timestamp.getTime() < windowEnd &&
        e.tagCode === TagCode.T1
      )
      .length;

    // 근무 판정
    if (t1Count >= T1_THRESHOLD) {
      // 근무 중: 신뢰도 높음
      totalConfidence += 90;
      windowCount++;
    } else if (t1Count === 0) {
      // 비근무 의심: 해당 시간 제외
      groundRulesWorkTime -= WINDOW_SIZE;
      totalConfidence += 30; // 낮은 신뢰도
      windowCount++;
    } else {
      // 애매한 경우: 부분 인정
      totalConfidence += 60;
      windowCount++;
    }
  }

  return {
    groundRulesWorkHours: Math.max(0, groundRulesWorkTime / 60), // 시간 단위
    groundRulesConfidence: windowCount > 0 ? totalConfidence / windowCount : 0,
    t1TotalCount: timeline.filter(e => e.tagCode === TagCode.T1).length,
    t1Density: t1Count / (baseMetrics.totalTime / WINDOW_SIZE) // 밀도
  };
}
```

#### 4.3.3 Ground Rules 검증

**검증 스크립트**: `scripts/validate-ground-rules.ts`

**검증 항목**:
1. **정확도 검증**: Ground Rules 추정 vs Claim 신고 비교
2. **신뢰도 검증**: Confidence Score 분포 확인
3. **이상치 탐지**: 비정상적으로 높거나 낮은 값 탐지
4. **T1 패턴 검증**: T1 밀도와 근무시간 상관관계 확인

---

## 5. 페이지별 데이터 흐름

### 5.1 전체 개요 (Dashboard)

**페이지**: `/` (app/page.tsx)
**API**: `/api/dashboard-fast`

**데이터 흐름**:
```
1. 사용자 페이지 접속
   ↓
2. API 호출: /api/dashboard-fast?month=2025-06
   ↓
3. 쿼리 실행:
   - SELECT FROM v_center_daily_summary WHERE DATE(work_date) BETWEEN ? AND ?
   ↓
4. 센터별 집계 데이터 반환:
   - center_name, avg_efficiency_ratio, total_employees
   - 직급별 분포 (Lv.1-4)
   ↓
5. UI 렌더링:
   - 센터별 카드 (CenterCard 컴포넌트)
   - 효율성 색상 코딩 (빨강/노랑/초록)
   - 직급별 바 차트
```

**주요 쿼리**:
```sql
SELECT
  center_name,
  COUNT(DISTINCT employee_id) as total_employees,
  AVG(efficiency_ratio) as avg_efficiency,
  AVG(actual_work_hours) as avg_work_hours,
  SUM(CASE WHEN job_grade = 'Lv.1' THEN 1 ELSE 0 END) as lv1_count,
  SUM(CASE WHEN job_grade = 'Lv.2' THEN 1 ELSE 0 END) as lv2_count,
  SUM(CASE WHEN job_grade = 'Lv.3' THEN 1 ELSE 0 END) as lv3_count,
  SUM(CASE WHEN job_grade = 'Lv.4' THEN 1 ELSE 0 END) as lv4_count
FROM daily_analysis_results
WHERE analysis_date BETWEEN ? AND ?
GROUP BY center_name
ORDER BY center_name;
```

### 5.2 팀별 분석 (Teams)

**페이지**: `/teams` (app/teams/page.tsx)
**API**: `/api/teams?month=2025-06`

**데이터 흐름**:
```
1. 월 선택 (MonthSelector)
   ↓
2. API 호출: /api/teams?month=2025-06
   ↓
3. 쿼리 실행:
   - SELECT FROM v_team_daily_summary
   - LEFT JOIN organization_master ON team_code
   ↓
4. 팀별 데이터 반환:
   - team_name, center_name
   - avg_efficiency_ratio, avg_work_hours
   - total_employees, work_days
   ↓
5. Miller Column 네비게이션:
   - Center → Team 계층적 탐색
   ↓
6. 팀별 테이블 렌더링:
   - 효율성, 인원, 근무일수
   - 직급별 분포 차트
```

**주요 쿼리**:
```sql
SELECT
  t.team_name,
  o.center_name,
  t.team_code,
  COUNT(DISTINCT d.employee_id) as total_employees,
  COUNT(DISTINCT d.analysis_date) as work_days,
  AVG(d.efficiency_ratio) as avg_efficiency,
  AVG(d.actual_work_hours) as avg_work_hours,
  AVG(d.meeting_minutes) / 60.0 as avg_meeting_hours,
  -- 직급별 인원
  SUM(CASE WHEN d.job_grade = 'Lv.1' THEN 1 ELSE 0 END) as lv1_count,
  SUM(CASE WHEN d.job_grade = 'Lv.2' THEN 1 ELSE 0 END) as lv2_count,
  SUM(CASE WHEN d.job_grade = 'Lv.3' THEN 1 ELSE 0 END) as lv3_count,
  SUM(CASE WHEN d.job_grade = 'Lv.4' THEN 1 ELSE 0 END) as lv4_count
FROM daily_analysis_results d
LEFT JOIN organization_master o ON d.team_id = o.org_code
WHERE d.analysis_date BETWEEN ? AND ?
GROUP BY d.team_id, t.team_name, o.center_name
ORDER BY o.center_name, t.team_name;
```

### 5.3 그룹별 분석 (Groups)

**페이지**: `/groups` (app/groups/page.tsx)
**API**: `/api/groups?month=2025-06`

**데이터 흐름**:
```
1. 월 선택 + 센터/팀 필터
   ↓
2. API 호출: /api/groups?month=2025-06&center=CENTER_001
   ↓
3. 쿼리 실행:
   - SELECT FROM v_group_daily_summary
   - WHERE center_id = ? AND month = ?
   ↓
4. 그룹별 데이터 반환:
   - group_name, team_name, center_name
   - avg_efficiency_ratio, employee_count
   - work_pattern (주요 활동 패턴)
   ↓
5. 그룹별 카드 렌더링:
   - 효율성 게이지
   - 인원 수
   - 활동 패턴 아이콘
```

**주요 쿼리**:
```sql
SELECT
  g.group_name,
  t.team_name,
  c.center_name,
  g.group_code,
  COUNT(DISTINCT d.employee_id) as employee_count,
  COUNT(DISTINCT d.analysis_date) as work_days,
  AVG(d.efficiency_ratio) as avg_efficiency,
  AVG(d.actual_work_hours) as avg_work_hours,
  -- 활동 패턴 분석
  AVG(d.focused_work_minutes) / 60.0 as avg_focus_hours,
  AVG(d.meeting_minutes) / 60.0 as avg_meeting_hours,
  AVG(d.work_minutes) / 60.0 as avg_work_hours,
  -- 근무 패턴 판정
  CASE
    WHEN AVG(d.focused_work_minutes) > 240 THEN 'HIGH_FOCUS'
    WHEN AVG(d.meeting_minutes) > 180 THEN 'MEETING_INTENSIVE'
    WHEN AVG(d.movement_minutes) > 120 THEN 'HIGH_MOBILITY'
    ELSE 'BALANCED'
  END as work_pattern
FROM daily_analysis_results d
LEFT JOIN organization_master g ON d.group_id = g.org_code
LEFT JOIN organization_master t ON g.parent_org_code = t.org_code
LEFT JOIN organization_master c ON t.parent_org_code = c.org_code
WHERE d.analysis_date BETWEEN ? AND ?
  AND c.org_code = ?
GROUP BY g.group_code, g.group_name, t.team_name, c.center_name
ORDER BY c.center_name, t.team_name, g.group_name;
```

### 5.4 근무 불균형 (Enterprise)

**페이지**: `/enterprise` (app/enterprise/page.tsx)
**API**: `/api/insights`, `/api/teams/distribution`, `/api/metrics/realtime`

**데이터 흐름**:
```
1. 실시간 대시보드 접속
   ↓
2. 병렬 API 호출:
   - /api/insights (전체 인사이트)
   - /api/teams/distribution (팀별 분포)
   - /api/metrics/realtime (실시간 지표)
   ↓
3. 쿼리 실행:
   - 팀별 근무시간 편차 계산
   - 이상치 팀 탐지 (표준편차 ±2σ)
   - 효율성 하위 10% 팀
   ↓
4. 데이터 반환:
   - High variance teams (편차 큰 팀)
   - Low efficiency teams (효율성 낮은 팀)
   - Real-time alerts (실시간 경고)
   ↓
5. 시각화:
   - 편차 히트맵
   - 경고 배지
   - 트렌드 그래프
```

**주요 쿼리 (편차 계산)**:
```sql
WITH team_stats AS (
  SELECT
    team_id,
    team_name,
    AVG(actual_work_hours) as avg_work_hours,
    STDDEV(actual_work_hours) as stddev_work_hours,
    COUNT(DISTINCT employee_id) as employee_count
  FROM daily_analysis_results
  WHERE analysis_date >= date('now', '-30 days')
  GROUP BY team_id, team_name
),
overall_stats AS (
  SELECT
    AVG(avg_work_hours) as overall_avg,
    STDDEV(avg_work_hours) as overall_stddev
  FROM team_stats
)
SELECT
  t.team_name,
  t.avg_work_hours,
  t.stddev_work_hours,
  t.employee_count,
  -- 편차 계산 (Z-score)
  (t.avg_work_hours - o.overall_avg) / o.overall_stddev as z_score,
  -- 경고 레벨
  CASE
    WHEN ABS((t.avg_work_hours - o.overall_avg) / o.overall_stddev) > 2 THEN 'HIGH'
    WHEN ABS((t.avg_work_hours - o.overall_avg) / o.overall_stddev) > 1 THEN 'MEDIUM'
    ELSE 'LOW'
  END as alert_level
FROM team_stats t, overall_stats o
WHERE t.employee_count >= 5  -- 최소 5명 이상 팀만
ORDER BY ABS(z_score) DESC
LIMIT 20;
```

### 5.5 근무 패턴 분석 (Insight2)

**페이지**: `/insight2` (app/insight2/page.tsx)
**API**: `/api/insights/pattern-analysis`

**데이터 흐름**:
```
1. 패턴 분석 페이지 접속
   ↓
2. API 호출: /api/insights/pattern-analysis
   ↓
3. 쿼리 실행:
   - SELECT FROM dept_pattern_analysis_new
   - 클러스터별 통계 집계
   ↓
4. 데이터 반환:
   - patterns: 팀별 패턴 데이터 (x=장비사용, y=이동성)
   - clusterStats: 클러스터별 통계
   - centerDistribution: 센터별 클러스터 분포
   ↓
5. 시각화:
   - 산점도 (Scatter Plot)
   - 클러스터 색상 구분
   - 통계 테이블
```

**클러스터 타입**:
- **High Equipment / Low Mobility**: 장비 집중형 (제조, 연구)
- **High Equipment / High Mobility**: 다기능형 (품질, 기술지원)
- **Low Equipment / High Mobility**: 이동 집중형 (영업, 관리)
- **Low Equipment / Low Mobility**: 사무 집중형 (기획, 경영지원)

**주요 쿼리**:
```sql
-- 팀별 패턴 데이터
SELECT
  center,
  team,
  employee_count,
  -- X축: 장비 사용 (건/인)
  ROUND(o_tag_count * 1.0 / NULLIF(employee_count, 0), 1) as equipment_per_person,
  -- Y축: 이동성 지수
  ROUND(t1_count * 1.0 / NULLIF(employee_count, 0), 1) as movement_per_person,
  -- 색상: 클러스터 타입
  cluster_type,
  -- 추가 정보 (툴팁용)
  ROUND(knox_total_count * 1.0 / NULLIF(employee_count, 0), 1) as knox_per_person,
  ROUND(g3_count * 1.0 / NULLIF(employee_count, 0), 1) as meeting_per_person,
  reliability_score
FROM dept_pattern_analysis_new
WHERE is_analysis_target = 1  -- 분석 대상 팀만 (직원 5명 이상)
ORDER BY cluster_type, team;

-- 클러스터별 통계
SELECT
  cluster_type as cluster_name,
  COUNT(DISTINCT team) as team_count,
  SUM(employee_count) as total_employees,
  AVG(equipment_per_person) as avg_equipment,
  AVG(movement_per_person) as avg_movement,
  AVG(knox_per_person) as avg_knox,
  AVG(meeting_per_person) as avg_meeting
FROM dept_pattern_analysis_new
WHERE is_analysis_target = 1
GROUP BY cluster_type;
```

### 5.6 트렌드 분석 (Trends)

**페이지**: `/trends` (app/trends/page.tsx)
**API**: `/api/trends?year=2025&startMonth=1&endMonth=12&center=CENTER_001`

**데이터 흐름**:
```
1. 연도, 월 범위, 센터 선택
   ↓
2. API 호출: /api/trends?year=2025&startMonth=1&endMonth=12&center=CENTER_001
   ↓
3. 쿼리 실행:
   - Claim 데이터 기반 월별 집계
   - 직급별 주간 평균 근무시간 계산
   ↓
4. 데이터 반환:
   - months: [1, 2, 3, ..., 12]
   - levels: ['Lv.1', 'Lv.2', 'Lv.3', 'Lv.4']
   - data: { 'Lv.1': [45, 47, 46, ...], 'Lv.2': [...], ... }
   ↓
5. 시각화:
   - 라인 차트 (월별 추이)
   - 직급별 색상 구분
   - 평균선 표시
```

**주요 쿼리** (최적화된 버전):
```sql
WITH monthly_totals AS (
  SELECT
    c.사번,
    c.employee_level,
    e.center_name,
    strftime('%m', c.근무일) as month,
    SUM(
      CASE
        WHEN c.근태코드 IN ('연차', '반차', '오전반차', '오후반차') THEN c.휴가_연차
        ELSE c.실제근무시간
      END
    ) as month_total_hours,
    COUNT(DISTINCT DATE(c.근무일)) as work_days
  FROM claim_data c
  LEFT JOIN (
    SELECT DISTINCT 사번, CENTER as center_name
    FROM tag_data
    WHERE ENTE_DT BETWEEN ? AND ?
  ) e ON c.사번 = e.사번
  WHERE c.근무일 BETWEEN ? AND ?
    AND c.employee_level IS NOT NULL
    AND e.center_name = ?
  GROUP BY c.사번, c.employee_level, e.center_name, month
)
SELECT
  employee_level as grade_level,
  center_name,
  CAST(month AS INTEGER) as month,
  ROUND(SUM(month_total_hours) / COUNT(DISTINCT 사번) / AVG(work_days) * 7, 1) as avg_weekly_hours
FROM monthly_totals
GROUP BY employee_level, center_name, month
ORDER BY center_name, month, employee_level;
```

**성능 최적화**:
- 기존 12개 쿼리 → 1개 쿼리로 통합
- `strftime('%m', ...)` 활용한 월별 그룹화
- 응답 시간: 59초 → 1.6초 (97% 개선)

### 5.7 개인 분석 (Individual) - Dev Mode

**페이지**: `/individual` (app/individual/page.tsx)
**API**: `/api/employees/{id}/analytics`

**데이터 흐름**:
```
1. 직원 검색 (사번 또는 이름)
   ↓
2. 직원 선택 + 날짜 선택
   ↓
3. API 호출: /api/employees/123456/analytics?date=2025-06-15
   ↓
4. 쿼리 실행:
   - SELECT FROM daily_analysis_results WHERE employee_id = ? AND date = ?
   - SELECT FROM tag_data WHERE 사번 = ? AND ENTE_DT = ?
   - SELECT FROM claim_data WHERE 사번 = ? AND 근무일 = ?
   ↓
5. WorkHourCalculator 호출 (실시간 분석)
   ↓
6. 데이터 반환:
   - 개인 기본 정보
   - 일일 분석 결과
   - Timeline 상세 데이터
   ↓
7. 시각화:
   - 타임라인 차트 (활동별 시간대)
   - 지표 카드 (총 시간, 효율성 등)
   - 신뢰도 점수
```

**주요 쿼리**:
```sql
-- 개인 분석 결과
SELECT
  d.*,
  e.name as employee_name,
  o.center_name,
  o.team_name,
  o.group_name
FROM daily_analysis_results d
LEFT JOIN employees e ON d.employee_id = e.employee_id
LEFT JOIN organization_master o ON d.team_id = o.org_code
WHERE d.employee_id = ?
  AND d.analysis_date = ?;

-- Timeline 데이터 (Tag + Knox + Meal)
SELECT
  timestamp,
  event_type,
  event_subtype,
  location_code,
  tag_code,
  duration
FROM (
  SELECT
    datetime(출입시각) as timestamp,
    'TAG' as event_type,
    INOUT_GB as event_subtype,
    DR_NO as location_code,
    DR_GB as tag_code,
    NULL as duration
  FROM tag_data
  WHERE 사번 = ? AND ENTE_DT = ?

  UNION ALL

  SELECT
    approval_timestamp as timestamp,
    'KNOX' as event_type,
    'APPROVAL' as event_subtype,
    NULL as location_code,
    NULL as tag_code,
    NULL as duration
  FROM knox_approval_data
  WHERE employee_id = ? AND DATE(approval_timestamp) = ?

  UNION ALL

  SELECT
    meal_timestamp as timestamp,
    'MEAL' as event_type,
    meal_type as event_subtype,
    NULL as location_code,
    NULL as tag_code,
    duration_minutes as duration
  FROM meal_data
  WHERE employee_id = ? AND DATE(meal_timestamp) = ?
)
ORDER BY timestamp;
```

### 5.8 조직 분석 (Organization) - Dev Mode

**페이지**: `/organization` (app/organization/page.tsx)
**API**: `/api/organization/ground-rules-worker-analysis`

**데이터 흐름**:
```
1. 조직 선택 (센터/팀/그룹)
   ↓
2. 날짜 범위 선택
   ↓
3. 배치 분석 시작
   ↓
4. API 호출 (POST): /api/organization/ground-rules-worker-analysis
   Body: { orgCode, startDate, endDate }
   ↓
5. Worker Pool 생성 및 병렬 처리
   ├─ 직원 목록 조회
   ├─ 각 직원별 데이터 수집
   ├─ WorkHourCalculator 호출
   ├─ Ground Rules 적용
   └─ 결과 저장
   ↓
6. 진행률 실시간 업데이트 (SSE)
   ↓
7. 완료 후 Excel 다운로드
   - 직원별 상세 분석 결과
   - Ground Rules 지표
   - 신뢰도 점수
```

**배치 처리 로직**:
```typescript
async function batchAnalyzeOrganization(orgCode: string, startDate: string, endDate: string) {
  // 1. 직원 목록 조회
  const employees = await db.all(`
    SELECT DISTINCT employee_id, name, job_grade
    FROM employees
    WHERE team_code = ?
    ORDER BY name
  `, [orgCode]);

  // 2. 날짜 범위 생성
  const dates = generateDateRange(startDate, endDate);

  // 3. 전체 작업 개수
  const totalTasks = employees.length * dates.length;
  let completedTasks = 0;

  // 4. 배치 처리 (10명씩)
  const batchSize = 10;
  for (let i = 0; i < employees.length; i += batchSize) {
    const batch = employees.slice(i, i + batchSize);

    // 병렬 처리
    const promises = batch.flatMap(emp =>
      dates.map(date => analyzeEmployeeDate(emp.employee_id, date))
    );

    const results = await Promise.allSettled(promises);

    // 결과 저장
    for (const result of results) {
      if (result.status === 'fulfilled') {
        await saveAnalysisResult(result.value);
      } else {
        console.error('Analysis failed:', result.reason);
      }
    }

    // 진행률 업데이트
    completedTasks += batch.length * dates.length;
    const progress = (completedTasks / totalTasks) * 100;
    await updateProgress(progress);
  }

  // 5. Excel 생성
  const excelData = await generateExcelReport(orgCode, startDate, endDate);
  return excelData;
}
```

---

## 6. 기술 스택과 Obsolete 기술

### 6.1 현재 기술 스택

#### 6.1.1 프론트엔드
| 기술 | 버전 | 용도 |
|-----|------|-----|
| **Next.js** | 15.4.6 | React 프레임워크, App Router |
| **React** | 19.x | UI 라이브러리 |
| **TypeScript** | 5.x | 타입 안정성 |
| **Tailwind CSS** | v4 | 스타일링 |
| **shadcn/ui** | - | UI 컴포넌트 라이브러리 |
| **Magic UI** | - | 고급 UI 컴포넌트 (bento-grid, magic-card 등) |
| **React Query** | TanStack Query | 데이터 페칭 및 캐싱 |
| **Zustand** | - | 전역 상태 관리 |
| **Recharts** | - | 차트 라이브러리 |

#### 6.1.2 백엔드
| 기술 | 버전 | 용도 |
|-----|------|-----|
| **Next.js API Routes** | 15.4.6 | REST API 엔드포인트 |
| **SQLite** | 3.x | 데이터베이스 |
| **better-sqlite3** | - | Node.js SQLite 드라이버 |

#### 6.1.3 개발 도구
| 도구 | 용도 |
|-----|------|
| **tsx** | TypeScript 스크립트 실행 |
| **ESLint** | 코드 린팅 |
| **Prettier** | 코드 포매팅 |
| **Turbopack** | Next.js 빌드 도구 (Webpack 대체) |

### 6.2 향후 기술 로드맵

#### 6.2.1 단기 계획 (1-3개월)
- [ ] Master Table 전환 완료
- [ ] Ground Rules 정확도 개선 (90% 이상)
- [ ] API 응답 속도 최적화 (<500ms)
- [ ] 실시간 대시보드 개선

#### 6.2.2 중기 계획 (3-6개월)
- [ ] 예측 분석 기능 추가 (ML 기반)
- [ ] 자동 이상치 탐지 및 알림
- [ ] 모바일 앱 개발
- [ ] 다국어 지원 (영어, 일본어)

#### 6.2.3 장기 계획 (6-12개월)
- [ ] AI 기반 근무 패턴 최적화 제안
- [ ] 실시간 데이터 스트리밍 (WebSocket)
- [ ] 대규모 조직 지원 (10,000명 이상)
- [ ] 클라우드 배포 (AWS/Azure)

---

## 7. 운영 가이드

### 7.1 일일 운영 체크리스트

#### 7.1.1 데이터 수집
- [ ] Tag 데이터 로드 확인 (매일 새벽 자동)
- [ ] Claim 데이터 동기화 (주간 수동)
- [ ] Knox 데이터 수집 확인
- [ ] 데이터 품질 검증 (누락, 중복 체크)

#### 7.1.2 배치 작업
- [ ] 일일 개인 분석 배치 실행
  ```bash
  npx tsx scripts/reanalyze_all_data.ts $(date -d yesterday +%Y-%m-%d) $(date -d yesterday +%Y-%m-%d)
  ```
- [ ] 조직 통계 업데이트
  ```bash
  npx tsx scripts/update-organization-stats-with-ground-rules.ts
  ```
- [ ] 배치 작업 로그 확인
  ```bash
  sqlite3 sambio_human.db "SELECT * FROM processing_log WHERE timestamp >= date('now', '-1 day') ORDER BY timestamp DESC LIMIT 50;"
  ```

#### 7.1.3 시스템 모니터링
- [ ] 데이터베이스 크기 확인
  ```bash
  ls -lh sambio_human.db
  ```
- [ ] 디스크 용량 확인 (최소 10GB 여유 필요)
- [ ] 애플리케이션 로그 확인
- [ ] API 응답 시간 모니터링

### 7.2 주간 운영 작업

#### 7.2.1 데이터 정합성 검증
```bash
# 주간 근무시간 일관성 체크
npx tsx scripts/check_weekly_hours_consistency.ts

# Ground Rules 검증
npx tsx scripts/validate-ground-rules.ts
```

#### 7.2.2 데이터베이스 최적화
```bash
# VACUUM (월 1회)
sqlite3 sambio_human.db "VACUUM;"

# ANALYZE (주 1회)
sqlite3 sambio_human.db "ANALYZE;"
```

#### 7.2.3 백업
```bash
# 데이터베이스 백업 (주 1회 + 중요 작업 전)
cp sambio_human.db "backups/sambio_human_$(date +%Y%m%d).db"

# 백업 파일 압축
gzip "backups/sambio_human_$(date +%Y%m%d).db"

# 오래된 백업 정리 (30일 이상)
find backups/ -name "*.db.gz" -mtime +30 -delete
```

### 7.3 월간 운영 작업

#### 7.3.1 월별 집계 갱신
```bash
# 월별 통계 재계산
sqlite3 sambio_human.db <<EOF
DELETE FROM monthly_center_stats WHERE year_month = '2025-06';
DELETE FROM monthly_grade_stats WHERE year_month = '2025-06';
DELETE FROM monthly_group_stats WHERE year_month = '2025-06';

INSERT INTO monthly_center_stats
SELECT
  strftime('%Y-%m', analysis_date) as year_month,
  center_id,
  center_name,
  COUNT(DISTINCT employee_id) as total_employees,
  AVG(efficiency_ratio) as avg_efficiency,
  AVG(actual_work_hours) as avg_work_hours
FROM daily_analysis_results
WHERE strftime('%Y-%m', analysis_date) = '2025-06'
GROUP BY year_month, center_id, center_name;

-- (monthly_grade_stats, monthly_group_stats도 동일한 패턴)
EOF
```

#### 7.3.2 성능 리포트 생성
```bash
# 월간 성능 리포트
sqlite3 sambio_human.db -header -csv <<EOF > reports/monthly_performance_$(date +%Y%m).csv
SELECT
  center_name,
  AVG(efficiency_ratio) as avg_efficiency,
  AVG(actual_work_hours) as avg_work_hours,
  AVG(confidence_score) as avg_confidence
FROM daily_analysis_results
WHERE strftime('%Y-%m', analysis_date) = '$(date +%Y-%m)'
GROUP BY center_name
ORDER BY avg_efficiency DESC;
EOF
```

### 7.4 트러블슈팅 가이드

#### 7.4.1 "no such column" 에러
**원인**: 데이터베이스 스키마와 코드 불일치
**해결**:
```bash
# 1. 스키마 확인
sqlite3 sambio_human.db ".schema daily_analysis_results"

# 2. 누락된 컬럼 추가 (예시)
sqlite3 sambio_human.db "ALTER TABLE daily_analysis_results ADD COLUMN new_column REAL DEFAULT 0;"

# 3. 애플리케이션 재시작
npm run dev
```

#### 7.4.2 배치 작업 중단
**원인**: 메모리 부족, 데이터 오류 등
**해결**:
```bash
# 1. 체크포인트 확인
sqlite3 sambio_human.db "SELECT * FROM batch_job_checkpoints ORDER BY created_at DESC LIMIT 1;"

# 2. 재개
npx tsx scripts/reanalyze_all_data.ts --resume --job-id=<job_id>

# 3. 실패 시 처음부터 재실행
npx tsx scripts/reanalyze_all_data.ts 2025-06-01 2025-06-30 --force
```

#### 7.4.3 API 응답 느림
**원인**: 인덱스 부족, 대량 데이터 조회
**해결**:
```bash
# 1. 쿼리 플랜 확인
sqlite3 sambio_human.db "EXPLAIN QUERY PLAN SELECT ... ;"

# 2. 인덱스 추가
sqlite3 sambio_human.db < scripts/add-performance-indexes.sql

# 3. ANALYZE 실행
sqlite3 sambio_human.db "ANALYZE;"
```

#### 7.4.4 Ground Rules 이상 수치
**원인**: T1 태그 데이터 품질 문제
**해결**:
```bash
# 1. 검증 스크립트 실행
npx tsx scripts/validate-ground-rules.ts

# 2. T1 통계 확인
sqlite3 sambio_human.db "SELECT team, AVG(t1_count) FROM team_t1_statistics GROUP BY team;"

# 3. 이상치 팀 재분석
npx tsx scripts/reanalyze_all_data.ts 2025-06-01 2025-06-30 --team=<team_code>
```

### 7.5 보안 및 권한 관리

#### 7.5.1 데이터베이스 접근 제어
- 운영 서버: 읽기 전용 계정만 허용
- 분석 작업: 별도 분석 계정 사용
- 백업 파일: 암호화 저장

#### 7.5.2 개인정보 보호
- 직원 이름, 사번 등 개인정보는 최소한으로 노출
- 개인 분석 페이지는 Dev Mode로 제한
- 로그 파일에 개인정보 기록 금지

#### 7.5.3 API 보안
- API 키 기반 인증 (환경 변수 관리)
- Rate Limiting 설정 (DDoS 방지)
- CORS 정책 설정

### 7.6 데이터 마이그레이션 가이드

#### 7.6.1 새로운 환경으로 이전
```bash
# 1. 데이터베이스 백업
cp sambio_human.db migration_backup.db

# 2. 새 환경에 복사
scp sambio_human.db user@new-server:/path/to/project/

# 3. 의존성 설치
cd /path/to/project
npm install

# 4. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일 편집

# 5. 데이터베이스 검증
npx tsx scripts/verify-database.ts

# 6. 애플리케이션 시작
npm run build
npm start
```

#### 7.6.2 스키마 마이그레이션
```bash
# 1. 현재 스키마 덤프
sqlite3 sambio_human.db .schema > current_schema.sql

# 2. 마이그레이션 스크립트 실행
sqlite3 sambio_human.db < scripts/migration_*.sql

# 3. 데이터 검증
npx tsx scripts/verify-migration.ts

# 4. 롤백 준비 (문제 발생 시)
cp migration_backup.db sambio_human.db
```

---

## 부록

### A. 주요 스크립트 레퍼런스

| 스크립트 | 설명 | 사용법 |
|---------|------|--------|
| `reanalyze_all_data.ts` | 개인 분석 배치 | `npx tsx scripts/reanalyze_all_data.ts <start_date> <end_date>` |
| `master-table-builder.ts` | Master Table 구축 | `npx tsx scripts/master-table-builder.ts <start_date> <end_date>` |
| `update-organization-stats-with-ground-rules.ts` | 조직 통계 업데이트 | `npx tsx scripts/update-organization-stats-with-ground-rules.ts` |
| `validate-ground-rules.ts` | Ground Rules 검증 | `npx tsx scripts/validate-ground-rules.ts` |
| `check_weekly_hours_consistency.ts` | 주간 근무시간 일관성 체크 | `npx tsx scripts/check_weekly_hours_consistency.ts` |
| `cleanup-databases.ts` | DB 정리 (사용하지 않는 컬럼 제거) | `npx tsx scripts/cleanup-databases.ts` |

### B. 데이터베이스 ERD

```
organization_master (조직 마스터)
  ├─ org_code (PK)
  ├─ org_name
  ├─ org_level (center, division, team, group)
  └─ parent_org_code (FK → organization_master)

employees (직원 마스터)
  ├─ employee_id (PK)
  ├─ name
  ├─ job_grade
  ├─ center_code (FK → organization_master)
  └─ team_code (FK → organization_master)

tag_data (출입 태그)
  ├─ 사번 (FK → employees)
  ├─ ENTE_DT (날짜)
  ├─ 출입시각
  ├─ DR_NO (장소 코드)
  └─ DR_GB (태그 타입: O, T1, G3)

claim_data (근태 신고)
  ├─ 사번 (FK → employees)
  ├─ 근무일 (날짜)
  ├─ 시작시간, 종료시간
  ├─ 실제근무시간
  └─ employee_level (Lv.1-4)

daily_analysis_results (일일 분석)
  ├─ id (PK)
  ├─ employee_id (FK → employees)
  ├─ analysis_date
  ├─ center_id, team_id, group_id (FK → organization_master)
  ├─ actual_work_hours
  ├─ efficiency_ratio
  ├─ work_minutes, meeting_minutes, meal_minutes
  ├─ ground_rules_work_hours
  └─ confidence_score

organization_daily_stats (조직 통계)
  ├─ org_code (FK → organization_master)
  ├─ work_date
  ├─ avg_actual_work_hours
  ├─ avg_efficiency_ratio
  └─ total_employees

dept_pattern_analysis_new (패턴 분석)
  ├─ team (PK)
  ├─ center
  ├─ cluster_type
  ├─ o_tag_count, t1_count, g3_count
  └─ employee_count
```

### C. API 엔드포인트 전체 목록

| 엔드포인트 | 메소드 | 설명 |
|-----------|--------|------|
| `/api/dashboard-fast` | GET | 전체 대시보드 데이터 |
| `/api/teams` | GET | 팀별 분석 데이터 |
| `/api/groups` | GET | 그룹별 분석 데이터 |
| `/api/trends` | GET | 트렌드 분석 데이터 |
| `/api/insights` | GET | 전체 인사이트 |
| `/api/insights/pattern-analysis` | GET | 근무 패턴 분석 |
| `/api/teams/distribution` | GET | 팀별 분포 |
| `/api/metrics/realtime` | GET | 실시간 지표 |
| `/api/employees/{id}/analytics` | GET | 개인 상세 분석 |
| `/api/organization/ground-rules-worker-analysis` | POST | 조직 배치 분석 |

### D. 용어 사전

| 용어 | 영문 | 설명 |
|-----|------|------|
| 체류시간 | Total Time | 출근부터 퇴근까지 총 시간 |
| 실제 근무시간 | Actual Work Hours | 실제 업무 활동 시간 |
| 신고 근무시간 | Claimed Work Hours | HR 시스템에 신고한 근무시간 |
| 효율성 비율 | Efficiency Ratio | (실제 근무 / 체류) * 100 |
| 작업추정률 | Work Estimation Rate | (추정 근무 / 신고 근무) * 100 |
| 집중 업무시간 | Focused Work Time | O 태그 밀도 기반 집중 업무 시간 |
| 이동시간 | Transit Time | T1 태그 기반 이동 시간 |
| Ground Rules | - | T1 패턴 기반 근무 추정 규칙 |
| 신뢰도 점수 | Reliability Score | 분석 데이터 품질 점수 (0-100) |
| O 태그 | Equipment Tag | 장비/설비 사용 태그 |
| T1 태그 | Movement Tag | 이동 태그 (통로, 복도) |
| G3 태그 | Meeting Tag | 회의실 태그 |

---

**문서 종료**

이 문서는 SambioHRR 프로젝트의 완전한 이해와 이관을 위해 작성되었습니다.
추가 질문이나 불명확한 부분이 있으면 언제든지 문의하시기 바랍니다.
