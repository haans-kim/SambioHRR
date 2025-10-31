# SambioHRR Database Schema Reference

> 📅 Last Updated: 2025-10-31
> 📊 Database: sambio_human.db (7.6GB)
> 🎯 Purpose: HR 분석용 통합 데이터베이스

---

## 📑 Table of Contents

1. [핵심 분석 테이블](#핵심-분석-테이블)
2. [원본 데이터 테이블](#원본-데이터-테이블)
3. [조직/직원 마스터](#조직직원-마스터)
4. [통계 집계 테이블](#통계-집계-테이블)
5. [설정/규칙 테이블](#설정규칙-테이블)
6. [자주 사용하는 쿼리 패턴](#자주-사용하는-쿼리-패턴)

---

## 핵심 분석 테이블

### 1. `daily_analysis_results` (613,918 rows) ⭐⭐⭐

**용도**: 일별 개인 근무 분석 결과 (가장 중요한 분석 테이블)

**주요 컬럼**:
```sql
id                      INTEGER PRIMARY KEY
employee_id             TEXT          -- 사번
analysis_date           DATE          -- 분석 일자
center_name             TEXT          -- 센터명 (담당으로 사용)
team_name               TEXT          -- 팀명
group_name              TEXT          -- 그룹명

-- 근무시간 메트릭
total_hours             REAL          -- 총 체류시간
actual_work_hours       REAL          -- 실제 작업시간 (분석 결과)
claimed_work_hours      REAL          -- 신고 근무시간 (HR 시스템)
efficiency_ratio        REAL          -- 효율성 비율 (actual/claimed)

-- 시간 분류 (분 단위)
work_minutes            INTEGER       -- 작업시간
focused_work_minutes    INTEGER       -- 집중 작업시간
equipment_minutes       INTEGER       -- 장비 사용시간
meeting_minutes         INTEGER       -- 회의시간
training_minutes        INTEGER       -- 교육시간
meal_minutes            INTEGER       -- 식사시간
breakfast_minutes       INTEGER       -- 아침
lunch_minutes           INTEGER       -- 점심
dinner_minutes          INTEGER       -- 저녁
midnight_meal_minutes   INTEGER       -- 야식
movement_minutes        INTEGER       -- 이동시간
rest_minutes            INTEGER       -- 휴게시간
fitness_minutes         INTEGER       -- 헬스/운동

-- 공간 분류
work_area_minutes       INTEGER       -- 작업구역 체류시간
non_work_area_minutes   INTEGER       -- 비작업구역 체류시간
gate_area_minutes       INTEGER       -- 출입구 체류시간

-- 신뢰도 및 품질
confidence_score        REAL          -- 데이터 신뢰도 점수
activity_count          INTEGER       -- 활동 건수
tag_count               INTEGER       -- 태그 건수

-- 근무 유형
shift_type              TEXT          -- 'day', 'night', 'special'
work_type               TEXT          -- 근무 형태
job_grade               TEXT          -- 직급

-- 특이사항
leave_hours             REAL          -- 휴가시간
business_trip_hours     REAL          -- 출장시간
leave_type              TEXT          -- 휴가 유형
anomaly_score           REAL          -- 이상치 점수

created_at              TIMESTAMP
updated_at              TIMESTAMP
```

**자주 사용하는 쿼리**:
```sql
-- 월별 담당별 평균 주간 근무시간
SELECT
  strftime('%Y-%m', analysis_date) as month,
  center_name,
  COUNT(DISTINCT employee_id) as employees,
  ROUND(AVG(actual_work_hours) * 5, 2) as avg_weekly_hours
FROM daily_analysis_results
WHERE analysis_date >= '2025-01-01'
GROUP BY month, center_name
ORDER BY month DESC, employees DESC;

-- 효율성이 낮은 케이스 (80% 미만)
SELECT
  employee_id,
  analysis_date,
  center_name,
  team_name,
  actual_work_hours,
  claimed_work_hours,
  ROUND(efficiency_ratio * 100, 2) as efficiency_pct
FROM daily_analysis_results
WHERE efficiency_ratio < 0.8
  AND analysis_date >= date('now', '-30 days')
ORDER BY efficiency_ratio ASC
LIMIT 100;

-- 회의시간이 많은 직원
SELECT
  employee_id,
  COUNT(*) as work_days,
  ROUND(AVG(meeting_minutes) / 60.0, 2) as avg_meeting_hours_per_day,
  ROUND(SUM(meeting_minutes) / 60.0, 2) as total_meeting_hours
FROM daily_analysis_results
WHERE analysis_date >= date('now', '-30 days')
GROUP BY employee_id
HAVING avg_meeting_hours_per_day > 2
ORDER BY total_meeting_hours DESC;
```

---

## 원본 데이터 테이블

### 2. `tag_data` (12,259,328 rows) ⭐⭐⭐

**용도**: RFID 출입 태그 원본 데이터 (가장 큰 테이블)

**주요 컬럼**:
```sql
ENTE_DT        INTEGER    -- 날짜 (YYYYMMDD) 예: 20250101
사번           INTEGER    -- 직원 번호
NAME           TEXT       -- 이름
출입시각       INTEGER    -- 시각 (HHMMSS) 예: 093045
DR_NO          TEXT       -- 문 번호
DR_NM          TEXT       -- 문 이름 (위치)
DR_GB          TEXT       -- 문 구분 (TagCode: G1, G2, T1, O 등)
INOUT_GB       TEXT       -- 입출 구분 ('I' or 'O')
CENTER         TEXT       -- 센터
TEAM           TEXT       -- 팀
GROUP_A        TEXT       -- 그룹
uploaded_at    DATETIME   -- 업로드 일시
```

**인덱스**: 날짜, 사번으로 빠른 조회 가능

**쿼리 예시**:
```sql
-- 특정 직원의 하루 동선
SELECT
  출입시각,
  DR_NM as location,
  DR_GB as tag_code,
  INOUT_GB as direction
FROM tag_data
WHERE 사번 = 20110113
  AND ENTE_DT = 20250102
ORDER BY 출입시각;

-- 야간 시간대 출입 통계
SELECT
  CENTER,
  COUNT(*) as night_entries
FROM tag_data
WHERE ENTE_DT BETWEEN 20250101 AND 20250630
  AND 출입시각 >= 220000  -- 22시 이후
GROUP BY CENTER
ORDER BY night_entries DESC;
```

### 3. `claim_data` (1,398,881 rows) ⭐⭐

**용도**: HR 시스템 근태 신고 데이터

**주요 컬럼**:
```sql
근무일              DATETIME    -- 근무 일자
사번                BIGINT      -- 사번
성명                TEXT        -- 이름
부서                TEXT        -- 부서명
직급                TEXT        -- 직급
WORKSCHDTYPNM       TEXT        -- 근무제 유형
시작시간            DATETIME    -- 출근 시간
종료시간            DATETIME    -- 퇴근 시간
실제근무시간        FLOAT       -- 신고된 근무시간 (시간)
제외시간            FLOAT       -- 제외 시간
근태명              TEXT        -- 근태 유형명
근태코드            TEXT        -- 근태 코드
cross_day_work      BOOLEAN     -- 자정 넘는 근무 여부
employee_level      VARCHAR(10) -- 직급 레벨
휴가_연차           REAL        -- 휴가/연차 시간
uploaded_at         DATETIME
```

**쿼리 예시**:
```sql
-- 신고시간 vs 실제시간 비교 (DAR 조인)
SELECT
  c.사번,
  c.근무일,
  c.실제근무시간 as claimed_hours,
  d.actual_work_hours,
  ROUND((d.actual_work_hours / c.실제근무시간) * 100, 2) as efficiency_pct
FROM claim_data c
JOIN daily_analysis_results d
  ON c.사번 = d.employee_id
  AND DATE(c.근무일) = d.analysis_date
WHERE c.근무일 >= '2025-07-01'
LIMIT 100;
```

### 4. `meal_data` (710,583 rows) ⭐

**용도**: 식사 데이터 (M1/M2 태그 생성용)

**주요 컬럼**:
```sql
취식일시      TEXT      -- 식사 일시 (YYYY-MM-DD HH:MM:SS)
사번          TEXT      -- 사번
성명          TEXT      -- 이름
식당명        TEXT      -- 식당 이름
배식구        TEXT      -- 배식구 (M1/M2 판정에 사용)
테이크아웃    TEXT      -- 'Y' or 'N'
식사구분명    TEXT      -- '아침', '점심', '저녁'
부서          TEXT      -- 부서
```

### 5. Knox 시스템 데이터 (업무 활동, O 태그)

#### `knox_approval_data` (339,818 rows)
```sql
Timestamp    TIMESTAMP    -- 결재 시각
UserNo       INTEGER      -- 사번
Task         TEXT         -- 결재 작업
APID         TEXT         -- 결재 ID
```

#### `knox_mail_data` (95,630 rows)
```sql
발신일시_GMT9      TIMESTAMP    -- 메일 발신 시각
발신인사번_text    INTEGER      -- 사번
메일key           TEXT         -- 메일 고유키
```

#### `knox_pims_data` (213,237 rows)
```sql
employee_id    VARCHAR(20)    -- 사번
meeting_id     VARCHAR(100)   -- 회의 ID
meeting_type   VARCHAR(50)    -- 회의 유형
start_time     DATETIME       -- 시작 시각
end_time       DATETIME       -- 종료 시각
```

### 6. 장비 시스템 데이터 (업무 활동, O 태그)

#### `eam_data` (213,700 rows) - EAM 설비
```sql
ATTEMPTDATE     TEXT      -- 작업 일시
USERNO          TEXT      -- 사번
ATTEMPTRESULT   TEXT      -- 작업 결과
APP             TEXT      -- 애플리케이션
```

#### `equis_data` (398,428 rows) - Equis 장비
```sql
Timestamp                TIMESTAMP    -- 사용 시각
USERNO( ID->사번매칭 )   REAL        -- 사번
Event                    TEXT        -- 이벤트
```

#### `lams_data` (2,245 rows) - LAMS 실험실
```sql
User_No    REAL    -- 사번
DATE       TEXT    -- 실험 일시
Task       TEXT    -- 작업 내용
```

#### `mes_data` (76,040 rows) - MES 제조
```sql
login_time    TIMESTAMP    -- 로그인 시각
USERNo        INTEGER      -- 사번
session       TEXT         -- 세션 ID
```

#### `mdm_data` (290,035 rows) - MDM 마스터 데이터
```sql
Timestap    TIMESTAMP    -- 접속 시각 (오타 주의!)
UserNo      INTEGER      -- 사번
task        TEXT         -- 작업 내용
```

---

## 조직/직원 마스터

### 7. `employees` (5,267 rows) ⭐⭐

**용도**: 직원 기본 정보

```sql
employee_id      TEXT PRIMARY KEY    -- 사번
employee_name    TEXT                -- 이름
center_id        TEXT                -- 센터 ID
center_name      TEXT                -- 센터명
team_id          TEXT                -- 팀 ID
team_name        TEXT                -- 팀명
group_id         TEXT                -- 그룹 ID
group_name       TEXT                -- 그룹명
position         TEXT                -- 직책
job_grade        TEXT                -- 직급
```

### 8. `organization_master` (751 rows) ⭐⭐

**용도**: 조직 계층 구조

```sql
org_code          VARCHAR(50) PRIMARY KEY    -- 조직 코드
org_name          VARCHAR(100)               -- 조직명
org_level         VARCHAR(20)                -- 'center', 'division', 'team', 'group'
parent_org_code   VARCHAR(50)                -- 상위 조직 코드
display_order     INTEGER                    -- 정렬 순서
is_active         BOOLEAN                    -- 활성 여부
```

**조직 레벨 분포**:
- center: 13개
- division: 12개
- team: 88개
- group: 494개

**계층 구조 조회**:
```sql
-- 전체 조직 트리
WITH RECURSIVE org_tree AS (
  SELECT org_code, org_name, org_level, parent_org_code,
         org_name as full_path, 0 as level
  FROM organization_master
  WHERE parent_org_code IS NULL AND is_active = 1

  UNION ALL

  SELECT o.org_code, o.org_name, o.org_level, o.parent_org_code,
         t.full_path || ' > ' || o.org_name as full_path,
         t.level + 1
  FROM organization_master o
  JOIN org_tree t ON o.parent_org_code = t.org_code
  WHERE o.is_active = 1
)
SELECT * FROM org_tree ORDER BY full_path;
```

### 9. `grade_level_mapping` (32 rows) ⭐

**용도**: 직급 → 레벨 매핑

```sql
grade_name       VARCHAR(100) PRIMARY KEY    -- 직급명
level            VARCHAR(10)                 -- 레벨 (L1~L9)
level_numeric    INTEGER                     -- 숫자 레벨
category         VARCHAR(50)                 -- 카테고리
subcategory      VARCHAR(50)                 -- 서브카테고리
```

---

## 통계 집계 테이블

### 10. `monthly_center_stats` (260 rows)

**용도**: 센터별 월간 통계

```sql
month                      TEXT PRIMARY KEY    -- YYYY-MM
center_name                TEXT PRIMARY KEY    -- 센터명
total_employees            INTEGER             -- 직원 수
weekly_claimed_hours       REAL                -- 주간 신고시간
weekly_adjusted_hours      REAL                -- 주간 보정시간
efficiency                 REAL                -- 효율성
data_reliability           REAL                -- 데이터 신뢰도
org_code                   TEXT                -- 조직 코드
```

### 11. `monthly_grade_stats` (561 rows)

**용도**: 센터별 직급별 월간 통계

```sql
month                      TEXT PRIMARY KEY
center_name                TEXT PRIMARY KEY
grade_level                TEXT PRIMARY KEY
total_employees            INTEGER
weekly_claimed_hours       REAL
weekly_adjusted_hours      REAL
efficiency                 REAL
```

### 12. `monthly_group_stats` (247 rows)

**용도**: 그룹별 월간 통계

```sql
month                   TEXT PRIMARY KEY
group_name              TEXT PRIMARY KEY
center_name             TEXT PRIMARY KEY
team_name               TEXT PRIMARY KEY
total_employees         INTEGER
weekly_claimed_hours    REAL
weekly_work_hours       REAL
efficiency              REAL
confidence_score        REAL
work_minutes            REAL
meeting_minutes         REAL
meal_minutes            REAL
movement_minutes        REAL
rest_minutes            REAL
```

---

## 설정/규칙 테이블

### 13. `tag_master` (12 rows) ⭐

**용도**: 태그 코드 정의

```sql
tag_code      VARCHAR(10) PRIMARY KEY    -- G1, G2, G3, G4, N1, N2, T1, O, M1, M2 등
tag_name      VARCHAR(100)               -- 태그 이름
tag_category  VARCHAR(20)                -- 카테고리
description   TEXT                       -- 설명
is_active     BOOLEAN                    -- 활성 여부
```

**주요 태그 코드**:
- **G1**: 정문 출입
- **G2**: 정문 내부
- **G3**: 건물 출입구
- **G4**: 사무실/작업장 출입구
- **N1**: 비업무 공간 (휴게실, 헬스장 등)
- **N2**: 비업무 활동
- **T1**: 업무 공간 (사무실, 실험실, 공장)
- **O**: 업무 활동 (PC, 장비 사용)
- **M1**: 식당 내 식사
- **M2**: 테이크아웃

### 14. `tag_location_master` (3,640 rows)

**용도**: 위치 → 태그 코드 매핑

```sql
DR_NO          TEXT         -- 문 번호
게이트명       TEXT         -- 게이트 이름
위치           TEXT         -- 위치
Tag_Code       TEXT         -- 태그 코드
공간구분_NM    TEXT         -- 공간 구분명
세부유형_NM    TEXT         -- 세부 유형명
라벨링_활동    TEXT         -- 활동 라벨
```

### 15. `state_transition_rules` (36 rows)

**용도**: 태그 간 상태 전이 규칙

```sql
from_tag             VARCHAR(10)    -- 시작 태그
to_tag               VARCHAR(10)    -- 종료 태그
from_state           VARCHAR(50)    -- 시작 상태
to_state             VARCHAR(50)    -- 종료 상태
base_probability     FLOAT          -- 기본 확률
time_condition       JSON           -- 시간 조건
location_condition   JSON           -- 위치 조건
shift_condition      VARCHAR(20)    -- 근무조 조건
priority             INTEGER        -- 우선순위
is_active            BOOLEAN        -- 활성 여부
```

### 16. `holidays` (38 rows)

**용도**: 휴일 정보

```sql
holiday_date       DATE PRIMARY KEY    -- 휴일 날짜
holiday_name       TEXT                -- 휴일명
is_workday         BOOLEAN             -- 근무일 여부
standard_hours     FLOAT               -- 표준 근무시간
```

### 17. `team_characteristics` (96 rows)

**용도**: 팀 특성 분석 (Ground Rules용)

```sql
team_name              TEXT        -- 팀명
work_schedule_type     TEXT        -- 근무제 유형
mobility_level         TEXT        -- 이동성 레벨 ('high', 'medium', 'low')
baseline_confidence    REAL        -- 기준 신뢰도
t1_to_o_ratio          REAL        -- T1/O 태그 비율
morning_t1_rate        REAL        -- 오전 T1 비율
lunch_t1_rate          REAL        -- 점심 T1 비율
evening_t1_rate        REAL        -- 저녁 T1 비율
special_rules          TEXT        -- 특수 규칙
sample_size            INTEGER     -- 샘플 크기
```

---

## 배치 작업 관리

### 18. `batch_jobs` (30 rows)

**용도**: 배치 분석 작업 관리

```sql
job_id                  TEXT PRIMARY KEY
job_name                TEXT
job_type                TEXT
start_time              TIMESTAMP
end_time                TIMESTAMP
status                  TEXT          -- 'pending', 'running', 'completed', 'failed'
target_date_start       DATE
target_date_end         DATE
organization_level      TEXT
organization_name       TEXT
total_employees         INTEGER
processed_employees     INTEGER
success_count           INTEGER
failure_count           INTEGER
avg_processing_time     REAL
created_by              TEXT
```

---

## 자주 사용하는 쿼리 패턴

### 📊 월별 집계

```sql
-- 템플릿
SELECT
  strftime('%Y-%m', analysis_date) as month,
  [집계_기준],
  COUNT(DISTINCT employee_id) as employees,
  [집계_메트릭]
FROM daily_analysis_results
WHERE analysis_date >= '2025-01-01'
GROUP BY month, [집계_기준]
ORDER BY month DESC;
```

### 👥 조직별 집계

```sql
-- 센터별
SELECT center_name, [메트릭] FROM daily_analysis_results
GROUP BY center_name;

-- 팀별
SELECT team_name, [메트릭] FROM daily_analysis_results
GROUP BY team_name;

-- 그룹별
SELECT group_name, [메트릭] FROM daily_analysis_results
GROUP BY group_name;
```

### 📅 날짜 범위 필터

```sql
-- 최근 30일
WHERE analysis_date >= date('now', '-30 days')

-- 특정 월
WHERE strftime('%Y-%m', analysis_date) = '2025-07'

-- 특정 분기
WHERE strftime('%Y-%m', analysis_date) BETWEEN '2025-01' AND '2025-03'
```

### 🎯 효율성 분석

```sql
-- 효율성 구간별 분포
SELECT
  CASE
    WHEN efficiency_ratio >= 0.9 THEN '90% 이상'
    WHEN efficiency_ratio >= 0.8 THEN '80-90%'
    WHEN efficiency_ratio >= 0.7 THEN '70-80%'
    ELSE '70% 미만'
  END as efficiency_range,
  COUNT(*) as count
FROM daily_analysis_results
GROUP BY efficiency_range;
```

### 🔍 이상치 탐지

```sql
-- 신뢰도가 낮은 데이터
WHERE confidence_score < 4000

-- 근무시간 이상
WHERE actual_work_hours > 12 OR actual_work_hours < 2

-- 효율성 이상
WHERE efficiency_ratio < 0.5 OR efficiency_ratio > 1.5
```

### 🔗 테이블 조인 패턴

```sql
-- DAR + employees
SELECT d.*, e.employee_name, e.job_grade
FROM daily_analysis_results d
JOIN employees e ON d.employee_id = e.employee_id;

-- DAR + claim_data
SELECT
  d.employee_id,
  d.analysis_date,
  d.actual_work_hours,
  c.실제근무시간 as claimed_hours
FROM daily_analysis_results d
JOIN claim_data c
  ON d.employee_id = c.사번
  AND d.analysis_date = DATE(c.근무일);

-- employees + organization_master
SELECT e.*, o.org_name, o.org_level
FROM employees e
JOIN organization_master o ON e.center_id = o.org_code;
```

---

## 📝 데이터 품질 체크

```sql
-- NULL 값 체크
SELECT
  COUNT(*) as total_rows,
  COUNT(employee_id) as has_employee_id,
  COUNT(actual_work_hours) as has_work_hours,
  COUNT(confidence_score) as has_confidence
FROM daily_analysis_results;

-- 중복 체크
SELECT employee_id, analysis_date, COUNT(*) as count
FROM daily_analysis_results
GROUP BY employee_id, analysis_date
HAVING count > 1;

-- 날짜 범위 확인
SELECT
  MIN(analysis_date) as first_date,
  MAX(analysis_date) as last_date,
  COUNT(DISTINCT analysis_date) as unique_dates
FROM daily_analysis_results;
```

---

## 🚀 성능 최적화 팁

1. **인덱스 활용**: `employee_id`, `analysis_date` 컬럼은 인덱스가 있음
2. **날짜 필터 필수**: 큰 테이블은 항상 날짜 범위 지정
3. **LIMIT 사용**: 탐색 쿼리는 LIMIT으로 결과 제한
4. **집계 우선**: GROUP BY로 먼저 집계 후 JOIN
5. **strftime 최소화**: 가능하면 DATE 타입 직접 비교

---

## 📌 주의사항

1. **컬럼명 대소문자**: SQLite는 대소문자 구분 없지만, 한글 컬럼명 주의
2. **날짜 형식**:
   - `tag_data`: INTEGER (YYYYMMDD)
   - `daily_analysis_results`: DATE ('YYYY-MM-DD')
   - `claim_data`: DATETIME ('YYYY-MM-DD HH:MM:SS')
3. **사번 타입**: TEXT로 통일 권장 (일부 테이블은 INTEGER)
4. **시간 단위**:
   - `*_hours`: 시간(hour) 단위
   - `*_minutes`: 분(minute) 단위
5. **효율성**: `efficiency_ratio`는 0~1 사이 값 (100% = 1.0)

---

## 📚 관련 문서

- [DATA_TABLES_COMPLETE_MAPPING.md](DATA_TABLES_COMPLETE_MAPPING.md) - Excel-DB 매핑
- [master-db-schema.md](lib/database/master-db-schema.md) - 마스터 DB 설계
- [ANALYSIS_METHODOLOGY_DETAILED.md](ANALYSIS_METHODOLOGY_DETAILED.md) - 분석 방법론
- [CLAUDE.md](CLAUDE.md) - 프로젝트 개요

---

**작성**: Claude Code
**목적**: 효율적인 데이터 분석을 위한 DB 스키마 레퍼런스
