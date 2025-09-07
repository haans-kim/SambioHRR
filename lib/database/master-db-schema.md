# Master Database Schema Design
## 분석 전용 통합 데이터베이스 설계서

### 1. 데이터베이스 구조 개요

```
sambio_analytics.db (분석 전용 DB)
├── master_events_table     # 모든 이벤트 데이터 통합
├── organization_hierarchy   # 조직 계층 구조 (비정규화)
├── employee_profiles       # 직원 프로필 (탄력근무 포함)
├── work_patterns          # 업무 패턴 집계
├── confidence_weights     # 신뢰도 가중치
└── analysis_cache         # 분석 결과 캐시
```

### 2. 핵심 테이블 스키마

#### 2.1 master_events_table (메인 이벤트 테이블)
```sql
CREATE TABLE master_events_table (
    -- Primary Key
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 시간 정보 (인덱싱 최적화)
    timestamp DATETIME NOT NULL,
    date DATE NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    week INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,  -- 1=월, 7=일
    hour INTEGER NOT NULL,
    minute INTEGER NOT NULL,
    
    -- 직원 정보
    employee_id INTEGER NOT NULL,
    employee_name TEXT,
    job_group TEXT,  -- 생산직/지원직/연구직 등
    
    -- 조직 정보 (비정규화 for 성능)
    center_code TEXT,
    center_name TEXT,
    division_code TEXT,  -- NULL 가능 (3단계 조직)
    division_name TEXT,
    team_code TEXT,
    team_name TEXT,
    group_code TEXT,
    group_name TEXT,
    
    -- 근무 정보
    shift_type TEXT,  -- 'day', 'night', 'flexible'
    is_flexible_work BOOLEAN DEFAULT 0,  -- 탄력근무 여부
    flexible_work_type TEXT,  -- '시차출퇴근', '재택근무', '집중근무' 등
    standard_work_start TIME,  -- 표준 출근 시간
    standard_work_end TIME,    -- 표준 퇴근 시간
    
    -- 태그 정보
    tag_code TEXT NOT NULL,
    tag_name TEXT,
    tag_type TEXT,  -- 'Equipment', 'Knox', 'Meal' 등
    tag_location TEXT,
    
    -- 상태 분류
    state TEXT,  -- '업무', '휴게', '식사', '회의', '교육', '이동', '출입'
    judgment TEXT,  -- '집중업무', '일반업무', '비업무' 등
    
    -- 신뢰도 및 보정값
    base_confidence REAL,  -- 기본 신뢰도 (0.0 ~ 1.0)
    context_confidence REAL,  -- 맥락 기반 신뢰도
    group_confidence REAL,  -- 집단 패턴 신뢰도
    final_confidence REAL,  -- 최종 신뢰도
    
    -- 집단 지성 메트릭
    dept_same_tag_count INTEGER,  -- 같은 부서 동일 태그 수
    dept_total_count INTEGER,      -- 같은 부서 전체 인원
    dept_tag_ratio REAL,          -- 부서 내 동일 태그 비율
    team_same_tag_count INTEGER,
    team_total_count INTEGER,
    team_tag_ratio REAL,
    
    -- 시퀀스 정보
    prev_tag_code TEXT,
    prev_state TEXT,
    next_tag_code TEXT,
    next_state TEXT,
    duration_minutes INTEGER,  -- 다음 이벤트까지 시간(분)
    
    -- 이상치 탐지
    is_anomaly BOOLEAN DEFAULT 0,
    anomaly_score REAL,
    anomaly_reason TEXT,
    
    -- 메타데이터
    data_source TEXT,  -- 'tag_enricher', 'manual', 'system'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_date DATE  -- 운영 DB와 동기화 날짜
);

-- 최적화 인덱스
CREATE INDEX idx_met_timestamp ON master_events_table(timestamp);
CREATE INDEX idx_met_emp_date ON master_events_table(employee_id, date);
CREATE INDEX idx_met_date_hour ON master_events_table(date, hour);
CREATE INDEX idx_met_center_date ON master_events_table(center_code, date);
CREATE INDEX idx_met_team_date ON master_events_table(team_code, date);
CREATE INDEX idx_met_tag_date ON master_events_table(tag_code, date);
CREATE INDEX idx_met_state_judgment ON master_events_table(state, judgment);
CREATE INDEX idx_met_flexible ON master_events_table(is_flexible_work, flexible_work_type);

-- 파티셔닝을 위한 트리거 (월별)
CREATE TRIGGER update_met_timestamp 
AFTER UPDATE ON master_events_table
BEGIN
    UPDATE master_events_table 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE event_id = NEW.event_id;
END;
```

#### 2.2 organization_hierarchy (조직 계층 구조)
```sql
CREATE TABLE organization_hierarchy (
    org_id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 조직 코드 (4단계)
    center_code TEXT NOT NULL,
    center_name TEXT NOT NULL,
    division_code TEXT,  -- NULL 가능 (3단계 조직)
    division_name TEXT,
    team_code TEXT NOT NULL,
    team_name TEXT NOT NULL,
    group_code TEXT,
    group_name TEXT,
    
    -- 계층 정보
    hierarchy_level INTEGER,  -- 3 또는 4
    full_path TEXT,  -- 'CENTER1/DIV1/TEAM1/GROUP1'
    
    -- 조직 메트릭
    total_employees INTEGER,
    avg_work_hours REAL,
    avg_efficiency REAL,
    
    -- 활성 상태
    is_active BOOLEAN DEFAULT 1,
    effective_date DATE,
    expiry_date DATE,
    
    UNIQUE(center_code, division_code, team_code, group_code)
);

CREATE INDEX idx_oh_center ON organization_hierarchy(center_code);
CREATE INDEX idx_oh_team ON organization_hierarchy(team_code);
CREATE INDEX idx_oh_path ON organization_hierarchy(full_path);
```

#### 2.3 employee_profiles (직원 프로필)
```sql
CREATE TABLE employee_profiles (
    employee_id INTEGER PRIMARY KEY,
    employee_name TEXT NOT NULL,
    
    -- 조직 정보
    center_code TEXT,
    division_code TEXT,
    team_code TEXT,
    group_code TEXT,
    
    -- 직무 정보
    job_group TEXT,  -- '생산직', '지원직', '연구직'
    job_title TEXT,
    job_level TEXT,
    
    -- 근무 형태
    work_type TEXT DEFAULT 'regular',  -- 'regular', 'flexible', 'shift'
    is_flexible_work BOOLEAN DEFAULT 0,
    flexible_work_type TEXT,
    flexible_work_start_date DATE,
    flexible_work_end_date DATE,
    
    -- 탄력근무 상세
    flexible_core_start TIME,  -- 코어타임 시작
    flexible_core_end TIME,    -- 코어타임 종료
    flexible_min_hours REAL,   -- 최소 근무시간
    flexible_max_hours REAL,   -- 최대 근무시간
    
    -- 표준 근무 시간
    standard_clock_in TIME DEFAULT '09:00',
    standard_clock_out TIME DEFAULT '18:00',
    standard_work_hours REAL DEFAULT 8.0,
    
    -- 개인 패턴 (학습된 값)
    avg_actual_clock_in TIME,
    avg_actual_clock_out TIME,
    avg_actual_work_hours REAL,
    work_pattern_consistency REAL,  -- 패턴 일관성 (0~1)
    
    -- 메타데이터
    hire_date DATE,
    is_active BOOLEAN DEFAULT 1,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ep_flexible ON employee_profiles(is_flexible_work);
CREATE INDEX idx_ep_team ON employee_profiles(team_code);
CREATE INDEX idx_ep_work_type ON employee_profiles(work_type);
```

#### 2.4 work_patterns (업무 패턴 집계)
```sql
CREATE TABLE work_patterns (
    pattern_id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 집계 기준
    aggregation_level TEXT,  -- 'employee', 'team', 'division', 'center'
    aggregation_code TEXT,   -- 해당 레벨의 코드
    date DATE NOT NULL,
    hour INTEGER,
    day_of_week INTEGER,
    
    -- 태그 패턴
    dominant_tag_code TEXT,
    dominant_tag_ratio REAL,
    tag_diversity REAL,  -- 태그 다양성 (엔트로피)
    
    -- 상태 분포
    work_state_ratio REAL,
    rest_state_ratio REAL,
    meal_state_ratio REAL,
    meeting_state_ratio REAL,
    
    -- 통계
    event_count INTEGER,
    unique_employees INTEGER,
    avg_confidence REAL,
    std_confidence REAL,
    
    -- 이상치 정보
    anomaly_count INTEGER,
    anomaly_ratio REAL,
    
    PRIMARY KEY (aggregation_level, aggregation_code, date, hour)
);

CREATE INDEX idx_wp_level_date ON work_patterns(aggregation_level, date);
CREATE INDEX idx_wp_code_date ON work_patterns(aggregation_code, date);
```

#### 2.5 confidence_weights (신뢰도 가중치 학습)
```sql
CREATE TABLE confidence_weights (
    weight_id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 적용 범위
    scope_type TEXT,  -- 'global', 'center', 'team', 'job_group'
    scope_code TEXT,  -- 해당 범위의 코드
    
    -- 조건
    tag_code TEXT,
    hour_range_start INTEGER,
    hour_range_end INTEGER,
    day_of_week INTEGER,
    is_flexible_work BOOLEAN,
    
    -- 가중치
    base_weight REAL DEFAULT 1.0,
    context_weight REAL DEFAULT 1.0,
    group_weight REAL DEFAULT 1.0,
    sequence_weight REAL DEFAULT 1.0,
    
    -- 학습 정보
    sample_size INTEGER,
    accuracy REAL,
    last_trained DATETIME,
    
    -- 활성화
    is_active BOOLEAN DEFAULT 1,
    
    UNIQUE(scope_type, scope_code, tag_code, hour_range_start, day_of_week)
);

CREATE INDEX idx_cw_scope ON confidence_weights(scope_type, scope_code);
CREATE INDEX idx_cw_tag ON confidence_weights(tag_code);
```

#### 2.6 analysis_cache (분석 결과 캐시)
```sql
CREATE TABLE analysis_cache (
    cache_id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 캐시 키
    cache_key TEXT UNIQUE NOT NULL,  -- MD5(query_params)
    query_type TEXT,  -- 'timeline', 'summary', 'pattern'
    
    -- 파라미터
    employee_id INTEGER,
    date_from DATE,
    date_to DATE,
    organization_code TEXT,
    organization_level TEXT,
    
    -- 결과
    result_json TEXT,  -- JSON 형태의 결과
    row_count INTEGER,
    execution_time_ms INTEGER,
    
    -- 캐시 관리
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    hit_count INTEGER DEFAULT 0,
    last_accessed DATETIME
);

CREATE INDEX idx_ac_key ON analysis_cache(cache_key);
CREATE INDEX idx_ac_expires ON analysis_cache(expires_at);
```

### 3. 뷰 (Views) 설계

#### 3.1 실시간 근무 현황 뷰
```sql
CREATE VIEW v_realtime_work_status AS
SELECT 
    e.employee_id,
    e.employee_name,
    e.team_name,
    e.is_flexible_work,
    m.state as current_state,
    m.judgment as current_judgment,
    m.final_confidence,
    m.timestamp as last_event_time,
    m.duration_minutes as minutes_in_state
FROM employee_profiles e
LEFT JOIN master_events_table m ON e.employee_id = m.employee_id
WHERE m.timestamp = (
    SELECT MAX(timestamp) 
    FROM master_events_table 
    WHERE employee_id = e.employee_id 
    AND date = DATE('now')
);
```

#### 3.2 탄력근무자 분석 뷰
```sql
CREATE VIEW v_flexible_work_analysis AS
SELECT 
    e.employee_id,
    e.employee_name,
    e.flexible_work_type,
    DATE(m.timestamp) as work_date,
    MIN(TIME(m.timestamp)) as first_event,
    MAX(TIME(m.timestamp)) as last_event,
    SUM(CASE WHEN m.judgment IN ('집중업무', '일반업무') THEN m.duration_minutes ELSE 0 END) as total_work_minutes,
    AVG(m.final_confidence) as avg_confidence
FROM employee_profiles e
JOIN master_events_table m ON e.employee_id = m.employee_id
WHERE e.is_flexible_work = 1
GROUP BY e.employee_id, DATE(m.timestamp);
```

### 4. 성능 최적화 전략

#### 4.1 인덱스 전략
- **시간 기반 조회**: timestamp, date, hour 복합 인덱스
- **조직 계층 조회**: center → team → group 순차 인덱스
- **탄력근무 분석**: is_flexible_work 필터 인덱스
- **신뢰도 분석**: final_confidence 범위 인덱스

#### 4.2 파티셔닝
- 월별 파티션으로 과거 데이터 아카이빙
- 최근 3개월은 활성 파티션 유지
- 3개월 이상은 읽기 전용 파티션

#### 4.3 캐싱
- 자주 조회되는 패턴은 analysis_cache 활용
- 조직별 일일 집계는 미리 계산
- 개인별 주간/월간 통계는 증분 업데이트

### 5. 용량 예측

```
초기 데이터 (1개월):
- 직원 1,000명 × 일 50 이벤트 × 30일 = 1,500,000 rows
- Row당 약 500 bytes = 750MB

연간 예측:
- 1,500,000 × 12 = 18,000,000 rows
- 약 9GB (인덱스 포함 시 15GB)

최적화 후:
- 압축 및 아카이빙으로 실제 사용량 약 60%
- 연간 약 10GB 예상
```

