-- HR Dashboard Database Migration Script
-- 이 스크립트는 새로운 배치 처리된 DB에 기존 개발 환경의 View와 커스텀 테이블을 복원합니다.
-- 생성일: 2025-08-09

-- ================================================
-- 1. 커스텀 테이블 생성
-- ================================================

-- 1.1 배치 작업 관련 테이블
CREATE TABLE IF NOT EXISTS batch_jobs (
    job_id TEXT PRIMARY KEY,
    job_name TEXT NOT NULL,
    job_type TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    status TEXT NOT NULL,
    organization_id TEXT,
    organization_name TEXT,
    target_date_start DATE,
    target_date_end DATE,
    total_employees INTEGER DEFAULT 0,
    processed_employees INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    total_processing_time REAL DEFAULT 0,
    avg_processing_time REAL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batch_job_checkpoints (
    checkpoint_id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    checkpoint_time TIMESTAMP NOT NULL,
    processed_count INTEGER,
    current_speed REAL,
    estimated_completion TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES batch_jobs(job_id)
);

CREATE TABLE IF NOT EXISTS batch_job_details (
    detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    process_result TEXT,
    error_details TEXT,
    processing_time REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES batch_jobs(job_id)
);

CREATE TABLE IF NOT EXISTS batch_error_logs (
    error_id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT,
    employee_id TEXT,
    error_type TEXT,
    error_message TEXT,
    stack_trace TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.2 일일 분석 결과 테이블 (중요!)
CREATE TABLE IF NOT EXISTS daily_analysis_results (
    dar_id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    employee_name TEXT,
    center_id TEXT,
    center_name TEXT,
    team_id TEXT,
    team_name TEXT,
    group_id TEXT,
    group_name TEXT,
    job_grade TEXT,
    analysis_date DATE NOT NULL,
    shift_type TEXT,
    
    -- 시간 관련 데이터
    total_hours REAL,
    actual_work_hours REAL,
    claimed_work_hours REAL,
    efficiency_ratio REAL,
    
    -- 활동별 시간 (분 단위)
    work_minutes INTEGER DEFAULT 0,
    meeting_minutes INTEGER DEFAULT 0,
    meal_minutes INTEGER DEFAULT 0,
    movement_minutes INTEGER DEFAULT 0,
    rest_minutes INTEGER DEFAULT 0,
    training_minutes INTEGER DEFAULT 0,
    other_minutes INTEGER DEFAULT 0,
    
    -- 식사 관련
    meal_count INTEGER DEFAULT 0,
    breakfast_time TIMESTAMP,
    lunch_time TIMESTAMP,
    dinner_time TIMESTAMP,
    midnight_meal_time TIMESTAMP,
    
    -- 구역별 시간
    work_area_minutes INTEGER DEFAULT 0,
    non_work_area_minutes INTEGER DEFAULT 0,
    gate_area_minutes INTEGER DEFAULT 0,
    
    -- 출퇴근 시간
    first_clock_in TIMESTAMP,
    last_clock_out TIMESTAMP,
    
    -- 데이터 품질
    confidence_score REAL DEFAULT 0,
    
    -- 메타데이터
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(employee_id, analysis_date)
);

-- 1.3 작업 지시서 관련 테이블
CREATE TABLE IF NOT EXISTS work_orders (
    order_id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    order_type TEXT NOT NULL,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'draft',
    requester_id TEXT,
    requester_name TEXT,
    request_date DATE NOT NULL,
    due_date DATE,
    target_type TEXT NOT NULL,
    center_id TEXT,
    center_name TEXT,
    group_id TEXT,
    group_name TEXT,
    team_id TEXT,
    team_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_order_items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    description TEXT NOT NULL,
    target_value REAL,
    current_value REAL,
    unit TEXT,
    status TEXT DEFAULT 'pending',
    progress_rate REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES work_orders(order_id)
);

CREATE TABLE IF NOT EXISTS work_order_assignments (
    assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    assignee_id TEXT NOT NULL,
    assignee_name TEXT,
    role TEXT DEFAULT 'executor',
    status TEXT DEFAULT 'assigned',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES work_orders(order_id)
);

CREATE TABLE IF NOT EXISTS work_order_history (
    history_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT,
    actor_name TEXT,
    old_value TEXT,
    new_value TEXT,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES work_orders(order_id)
);

CREATE TABLE IF NOT EXISTS work_order_attachments (
    attachment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES work_orders(order_id)
);

-- ================================================
-- 2. 인덱스 생성
-- ================================================

-- 배치 작업 인덱스
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_dates ON batch_jobs(target_date_start, target_date_end);

-- 일일 분석 결과 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_dar_employee_date ON daily_analysis_results(employee_id, analysis_date);
CREATE INDEX IF NOT EXISTS idx_dar_date ON daily_analysis_results(analysis_date);
CREATE INDEX IF NOT EXISTS idx_dar_center ON daily_analysis_results(center_id, analysis_date);
CREATE INDEX IF NOT EXISTS idx_dar_team ON daily_analysis_results(team_id, analysis_date);
CREATE INDEX IF NOT EXISTS idx_dar_group ON daily_analysis_results(group_id, analysis_date);
CREATE INDEX IF NOT EXISTS idx_dar_efficiency ON daily_analysis_results(efficiency_ratio);
CREATE INDEX IF NOT EXISTS idx_dar_created ON daily_analysis_results(created_at);
CREATE INDEX IF NOT EXISTS idx_dar_employee ON daily_analysis_results(employee_id);

-- 복합 인덱스 (자주 사용하는 쿼리용)
CREATE INDEX IF NOT EXISTS idx_dar_center_date_efficiency 
ON daily_analysis_results(center_name, analysis_date, efficiency_ratio);

CREATE INDEX IF NOT EXISTS idx_dar_team_date_efficiency 
ON daily_analysis_results(team_name, analysis_date, efficiency_ratio);

CREATE INDEX IF NOT EXISTS idx_dar_date_efficiency_desc 
ON daily_analysis_results(analysis_date, efficiency_ratio DESC);

CREATE INDEX IF NOT EXISTS idx_dar_employee_date_hours 
ON daily_analysis_results(employee_id, analysis_date, actual_work_hours);

-- 작업 지시서 인덱스
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_due_date ON work_orders(due_date);
CREATE INDEX IF NOT EXISTS idx_work_orders_requester ON work_orders(requester_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_target ON work_orders(target_type, center_id, group_id, team_id);

-- ================================================
-- 3. View 생성
-- ================================================

-- 3.1 배치 작업 관련 View
CREATE VIEW IF NOT EXISTS running_batch_jobs AS
SELECT 
    job_id,
    job_name,
    start_time,
    datetime('now') as current_time,
    ROUND((julianday('now') - julianday(start_time)) * 24 * 60) as running_minutes,
    organization_name,
    processed_employees || '/' || total_employees as progress,
    ROUND(100.0 * processed_employees / NULLIF(total_employees, 0), 2) as progress_percent,
    (SELECT current_speed FROM batch_job_checkpoints 
     WHERE batch_job_checkpoints.job_id = batch_jobs.job_id 
     ORDER BY checkpoint_time DESC LIMIT 1) as current_speed,
    (SELECT estimated_completion FROM batch_job_checkpoints 
     WHERE batch_job_checkpoints.job_id = batch_jobs.job_id 
     ORDER BY checkpoint_time DESC LIMIT 1) as estimated_completion
FROM batch_jobs
WHERE status = 'running';

CREATE VIEW IF NOT EXISTS recent_batch_jobs_summary AS
SELECT 
    job_id,
    job_name,
    start_time,
    end_time,
    status,
    organization_name,
    total_employees,
    processed_employees,
    ROUND(100.0 * processed_employees / NULLIF(total_employees, 0), 2) as progress_percent,
    success_count,
    failure_count,
    ROUND(100.0 * success_count / NULLIF(processed_employees, 0), 2) as success_rate,
    ROUND(total_processing_time / 60, 2) as total_minutes,
    ROUND(avg_processing_time, 2) as avg_seconds_per_employee,
    error_message
FROM batch_jobs
WHERE created_at >= datetime('now', '-7 days')
ORDER BY start_time DESC;

-- 3.2 센터별 일일 요약 View
CREATE VIEW IF NOT EXISTS v_center_daily_summary AS
SELECT 
    dar.analysis_date,
    dar.center_id,
    dar.center_name,
    
    -- 인원 통계
    COUNT(DISTINCT dar.employee_id) as analyzed_employees,
    (SELECT COUNT(DISTINCT employee_id) FROM employees WHERE center_id = dar.center_id) as total_employees,
    ROUND(COUNT(DISTINCT dar.employee_id) * 100.0 / 
          NULLIF((SELECT COUNT(DISTINCT employee_id) FROM employees WHERE center_id = dar.center_id), 0), 1) as coverage_rate,
    
    -- 시간 지표 평균
    ROUND(AVG(dar.total_hours), 1) as avg_total_hours,
    ROUND(AVG(dar.actual_work_hours), 1) as avg_actual_work_hours,
    ROUND(AVG(dar.claimed_work_hours), 1) as avg_claimed_hours,
    ROUND(AVG(dar.efficiency_ratio), 1) as avg_efficiency_ratio,
    
    -- 활동별 평균 시간 (시간 단위)
    ROUND(AVG(dar.work_minutes) / 60.0, 1) as avg_work_hours,
    ROUND(AVG(dar.meeting_minutes) / 60.0, 1) as avg_meeting_hours,
    ROUND(AVG(dar.meal_minutes) / 60.0, 1) as avg_meal_hours,
    ROUND(AVG(dar.movement_minutes) / 60.0, 1) as avg_movement_hours,
    ROUND(AVG(dar.rest_minutes) / 60.0, 1) as avg_rest_hours,
    ROUND(AVG(dar.training_minutes) / 60.0, 1) as avg_training_hours,
    
    -- 구역별 비율
    ROUND(AVG(CASE 
        WHEN (dar.work_area_minutes + dar.non_work_area_minutes + dar.gate_area_minutes) > 0 
        THEN dar.work_area_minutes * 100.0 / (dar.work_area_minutes + dar.non_work_area_minutes + dar.gate_area_minutes)
        ELSE 0 
    END), 1) as avg_work_area_ratio,
    
    ROUND(AVG(CASE 
        WHEN (dar.work_area_minutes + dar.non_work_area_minutes + dar.gate_area_minutes) > 0 
        THEN dar.non_work_area_minutes * 100.0 / (dar.work_area_minutes + dar.non_work_area_minutes + dar.gate_area_minutes)
        ELSE 0 
    END), 1) as avg_non_work_area_ratio,
    
    -- 효율성 분포
    SUM(CASE WHEN dar.efficiency_ratio >= 90 THEN 1 ELSE 0 END) as efficiency_90_plus,
    SUM(CASE WHEN dar.efficiency_ratio >= 80 AND dar.efficiency_ratio < 90 THEN 1 ELSE 0 END) as efficiency_80_90,
    SUM(CASE WHEN dar.efficiency_ratio >= 70 AND dar.efficiency_ratio < 80 THEN 1 ELSE 0 END) as efficiency_70_80,
    SUM(CASE WHEN dar.efficiency_ratio < 70 THEN 1 ELSE 0 END) as efficiency_below_70,
    
    -- 데이터 품질
    ROUND(AVG(dar.confidence_score), 1) as avg_confidence_score,
    
    -- 근무 패턴
    SUM(CASE WHEN dar.shift_type = '야간근무' THEN 1 ELSE 0 END) as night_shift_count,
    SUM(CASE WHEN dar.shift_type = '주간근무' THEN 1 ELSE 0 END) as day_shift_count,
    SUM(CASE WHEN dar.shift_type NOT IN ('주간근무', '야간근무') THEN 1 ELSE 0 END) as special_shift_count
    
FROM daily_analysis_results dar
GROUP BY dar.analysis_date, dar.center_id, dar.center_name;

-- 3.3 팀별 일일 요약 View
CREATE VIEW IF NOT EXISTS v_team_daily_summary AS
SELECT 
    dar.analysis_date,
    COALESCE(om_center.org_code, e.center_name) as center_id,
    e.center_name,
    COALESCE(om_team.org_code, e.team_name) as team_id,
    e.team_name,
    '' as group_id,
    '' as group_name,
    
    -- 인원 통계
    COUNT(DISTINCT dar.employee_id) as analyzed_employees,
    (SELECT COUNT(DISTINCT employee_id) FROM employees WHERE team_name = e.team_name) as total_employees,
    ROUND(COUNT(DISTINCT dar.employee_id) * 100.0 / 
          NULLIF((SELECT COUNT(DISTINCT employee_id) FROM employees WHERE team_name = e.team_name), 0), 1) as coverage_rate,
    
    -- 시간 지표 평균
    ROUND(AVG(dar.total_hours), 1) as avg_total_hours,
    ROUND(AVG(dar.actual_work_hours), 1) as avg_actual_work_hours,
    ROUND(AVG(dar.claimed_work_hours), 1) as avg_claimed_hours,
    ROUND(AVG(dar.efficiency_ratio), 1) as avg_efficiency_ratio,
    
    -- 활동별 평균 시간
    ROUND(AVG(dar.work_minutes) / 60.0, 1) as avg_work_hours,
    ROUND(AVG(dar.meeting_minutes) / 60.0, 1) as avg_meeting_hours,
    ROUND(AVG(dar.meal_minutes) / 60.0, 1) as avg_meal_hours,
    
    -- 효율성 분포
    SUM(CASE WHEN dar.efficiency_ratio >= 90 THEN 1 ELSE 0 END) as efficiency_90_plus,
    SUM(CASE WHEN dar.efficiency_ratio >= 80 AND dar.efficiency_ratio < 90 THEN 1 ELSE 0 END) as efficiency_80_90,
    SUM(CASE WHEN dar.efficiency_ratio < 80 THEN 1 ELSE 0 END) as efficiency_below_80,
    
    -- 데이터 품질
    ROUND(AVG(dar.confidence_score), 1) as avg_confidence_score
    
FROM daily_analysis_results dar
JOIN employees e ON dar.employee_id = e.employee_id
LEFT JOIN organization_master om_center ON om_center.org_name = e.center_name AND om_center.org_level = 'center'
LEFT JOIN organization_master om_team ON om_team.org_name = e.team_name AND om_team.org_level = 'team'
WHERE e.team_name IS NOT NULL
GROUP BY dar.analysis_date, e.center_name, e.team_name;

-- 3.4 그룹별 일일 요약 View
CREATE VIEW IF NOT EXISTS v_group_daily_summary AS
SELECT 
    dar.analysis_date,
    COALESCE(om_center.org_code, e.center_name) as center_id,
    e.center_name,
    COALESCE(om_team.org_code, e.team_name) as team_id,
    e.team_name,
    COALESCE(om_group.org_code, e.group_name) as group_id,
    e.group_name,
    
    -- 인원 통계
    COUNT(DISTINCT dar.employee_id) as analyzed_employees,
    (SELECT COUNT(DISTINCT employee_id) FROM employees WHERE group_name = e.group_name) as total_employees,
    ROUND(COUNT(DISTINCT dar.employee_id) * 100.0 / 
          NULLIF((SELECT COUNT(DISTINCT employee_id) FROM employees WHERE group_name = e.group_name), 0), 1) as coverage_rate,
    
    -- 시간 지표 평균
    ROUND(AVG(dar.total_hours), 1) as avg_total_hours,
    ROUND(AVG(dar.actual_work_hours), 1) as avg_actual_work_hours,
    ROUND(AVG(dar.claimed_work_hours), 1) as avg_claimed_hours,
    ROUND(AVG(dar.efficiency_ratio), 1) as avg_efficiency_ratio,
    
    -- 활동별 평균 시간 (시간 단위)
    ROUND(AVG(dar.work_minutes) / 60.0, 1) as avg_work_hours,
    ROUND(AVG(dar.meeting_minutes) / 60.0, 1) as avg_meeting_hours,
    ROUND(AVG(dar.meal_minutes) / 60.0, 1) as avg_meal_hours,
    ROUND(AVG(dar.movement_minutes) / 60.0, 1) as avg_movement_hours,
    ROUND(AVG(dar.rest_minutes) / 60.0, 1) as avg_rest_hours,
    
    -- 효율성 분포
    SUM(CASE WHEN dar.efficiency_ratio >= 90 THEN 1 ELSE 0 END) as efficiency_90_plus,
    SUM(CASE WHEN dar.efficiency_ratio >= 80 AND dar.efficiency_ratio < 90 THEN 1 ELSE 0 END) as efficiency_80_90,
    SUM(CASE WHEN dar.efficiency_ratio >= 70 AND dar.efficiency_ratio < 80 THEN 1 ELSE 0 END) as efficiency_70_80,
    SUM(CASE WHEN dar.efficiency_ratio < 70 THEN 1 ELSE 0 END) as efficiency_below_70,
    
    -- 데이터 품질
    ROUND(AVG(dar.confidence_score), 1) as avg_confidence_score
    
FROM daily_analysis_results dar
JOIN employees e ON dar.employee_id = e.employee_id
LEFT JOIN organization_master om_center ON om_center.org_name = e.center_name AND om_center.org_level = 'center'
LEFT JOIN organization_master om_team ON om_team.org_name = e.team_name AND om_team.org_level = 'team'
LEFT JOIN organization_master om_group ON om_group.org_name = e.group_name AND om_group.org_level = 'group'
WHERE e.group_name IS NOT NULL
GROUP BY dar.analysis_date, e.center_name, e.team_name, e.group_name;

-- 3.5 직원별 일일 분석 View
CREATE VIEW IF NOT EXISTS v_employee_daily_analysis AS
SELECT 
    dar.*,
    
    -- 추가 계산 필드
    CASE 
        WHEN dar.efficiency_ratio >= 90 THEN '우수'
        WHEN dar.efficiency_ratio >= 80 THEN '양호'
        WHEN dar.efficiency_ratio >= 70 THEN '주의'
        ELSE '개선필요'
    END as efficiency_grade,
    
    CASE
        WHEN dar.meal_count >= 4 THEN '야간근무'
        WHEN dar.meal_count >= 2 THEN '주간근무'
        WHEN dar.meal_count = 1 THEN '반일근무'
        ELSE '특수근무'
    END as estimated_shift_type,
    
    -- 활동 시간 비율
    ROUND(dar.work_minutes * 100.0 / NULLIF(dar.total_hours * 60, 0), 1) as work_ratio,
    ROUND(dar.meeting_minutes * 100.0 / NULLIF(dar.total_hours * 60, 0), 1) as meeting_ratio,
    ROUND(dar.meal_minutes * 100.0 / NULLIF(dar.total_hours * 60, 0), 1) as meal_ratio,
    ROUND(dar.rest_minutes * 100.0 / NULLIF(dar.total_hours * 60, 0), 1) as rest_ratio
    
FROM daily_analysis_results dar;

-- 3.6 주간 트렌드 View
CREATE VIEW IF NOT EXISTS v_organization_weekly_trend AS
SELECT 
    strftime('%Y-W%W', dar.analysis_date) as week,
    dar.center_id,
    dar.center_name,
    'center' as org_type,
    
    -- 주간 평균
    ROUND(AVG(dar.efficiency_ratio), 1) as weekly_avg_efficiency,
    ROUND(AVG(dar.actual_work_hours), 1) as weekly_avg_work_hours,
    ROUND(AVG(dar.total_hours), 1) as weekly_avg_total_hours,
    
    -- 주간 통계
    COUNT(DISTINCT dar.employee_id) as unique_employees,
    COUNT(*) as total_records,
    
    -- 주간 근무 패턴
    SUM(CASE WHEN dar.shift_type = '야간근무' THEN 1 ELSE 0 END) as night_shift_days,
    SUM(CASE WHEN dar.shift_type = '주간근무' THEN 1 ELSE 0 END) as day_shift_days
    
FROM daily_analysis_results dar
GROUP BY strftime('%Y-W%W', dar.analysis_date), dar.center_id, dar.center_name

UNION ALL

SELECT 
    strftime('%Y-W%W', dar.analysis_date) as week,
    dar.group_id as organization_id,
    dar.group_name as organization_name,
    'group' as org_type,
    
    ROUND(AVG(dar.efficiency_ratio), 1) as weekly_avg_efficiency,
    ROUND(AVG(dar.actual_work_hours), 1) as weekly_avg_work_hours,
    ROUND(AVG(dar.total_hours), 1) as weekly_avg_total_hours,
    
    COUNT(DISTINCT dar.employee_id) as unique_employees,
    COUNT(*) as total_records,
    
    SUM(CASE WHEN dar.shift_type = '야간근무' THEN 1 ELSE 0 END) as night_shift_days,
    SUM(CASE WHEN dar.shift_type = '주간근무' THEN 1 ELSE 0 END) as day_shift_days
    
FROM daily_analysis_results dar
GROUP BY strftime('%Y-W%W', dar.analysis_date), dar.group_id, dar.group_name;

-- 3.7 효율성 랭킹 View
CREATE VIEW IF NOT EXISTS v_efficiency_ranking AS
WITH latest_date AS (
    SELECT MAX(analysis_date) as max_date FROM daily_analysis_results
)
SELECT 
    'center' as org_type,
    center_id as org_id,
    center_name as org_name,
    analysis_date,
    avg_efficiency_ratio,
    analyzed_employees,
    total_employees,
    coverage_rate,
    RANK() OVER (PARTITION BY analysis_date ORDER BY avg_efficiency_ratio DESC) as efficiency_rank
FROM v_center_daily_summary
WHERE analysis_date = (SELECT max_date FROM latest_date)

UNION ALL

SELECT 
    'group' as org_type,
    group_id as org_id,
    group_name as org_name,
    analysis_date,
    avg_efficiency_ratio,
    analyzed_employees,
    total_employees,
    coverage_rate,
    RANK() OVER (PARTITION BY analysis_date ORDER BY avg_efficiency_ratio DESC) as efficiency_rank
FROM v_group_daily_summary
WHERE analysis_date = (SELECT max_date FROM latest_date)

UNION ALL

SELECT 
    'team' as org_type,
    team_id as org_id,
    team_name as org_name,
    analysis_date,
    avg_efficiency_ratio,
    analyzed_employees,
    total_employees,
    coverage_rate,
    RANK() OVER (PARTITION BY analysis_date ORDER BY avg_efficiency_ratio DESC) as efficiency_rank
FROM v_team_daily_summary
WHERE analysis_date = (SELECT max_date FROM latest_date);

-- 3.8 작업 지시서 관련 View
CREATE VIEW IF NOT EXISTS v_work_order_summary AS
SELECT 
    wo.order_id,
    wo.order_number,
    wo.title,
    wo.order_type,
    wo.priority,
    wo.status,
    wo.requester_name,
    wo.request_date,
    wo.due_date,
    wo.target_type,
    wo.center_name,
    wo.group_name,
    wo.team_name,
    COUNT(DISTINCT woa.assignee_id) as assignee_count,
    COUNT(DISTINCT woi.item_id) as item_count,
    AVG(woi.progress_rate) as avg_progress_rate,
    CASE 
        WHEN wo.status = 'completed' THEN 100
        WHEN COUNT(woi.item_id) = 0 THEN 0
        ELSE CAST(COUNT(CASE WHEN woi.status = 'completed' THEN 1 END) AS FLOAT) / COUNT(woi.item_id) * 100
    END as completion_rate
FROM work_orders wo
LEFT JOIN work_order_assignments woa ON wo.order_id = woa.order_id
LEFT JOIN work_order_items woi ON wo.order_id = woi.order_id
GROUP BY wo.order_id;

CREATE VIEW IF NOT EXISTS v_organization_work_orders AS
SELECT 
    target_type,
    center_name,
    group_name,
    team_name,
    COUNT(DISTINCT order_id) as total_orders,
    COUNT(DISTINCT CASE WHEN status = 'draft' THEN order_id END) as draft_orders,
    COUNT(DISTINCT CASE WHEN status = 'assigned' THEN order_id END) as assigned_orders,
    COUNT(DISTINCT CASE WHEN status = 'in_progress' THEN order_id END) as in_progress_orders,
    COUNT(DISTINCT CASE WHEN status = 'completed' THEN order_id END) as completed_orders
FROM work_orders
GROUP BY target_type, center_name, group_name, team_name;

CREATE VIEW IF NOT EXISTS v_assignee_work_orders AS
SELECT 
    woa.assignee_id,
    woa.assignee_name,
    wo.order_id,
    wo.order_number,
    wo.title,
    wo.priority,
    wo.due_date,
    woa.role,
    woa.status as assignment_status,
    wo.status as order_status,
    COUNT(woi.item_id) as total_items,
    COUNT(CASE WHEN woi.status = 'completed' THEN 1 END) as completed_items
FROM work_order_assignments woa
JOIN work_orders wo ON woa.order_id = wo.order_id
LEFT JOIN work_order_items woi ON wo.order_id = woi.order_id
GROUP BY woa.assignment_id;

-- 3.9 센터별 직급별 요약 View
CREATE VIEW IF NOT EXISTS v_center_grade_daily_summary AS
SELECT 
    dar.analysis_date,
    dar.center_id,
    dar.center_name,
    dar.job_grade,
    
    -- 인원 통계
    COUNT(DISTINCT dar.employee_id) as employee_count,
    
    -- 효율성 평균
    ROUND(AVG(dar.efficiency_ratio), 1) as avg_efficiency_ratio,
    
    -- 효율성 분포
    CASE 
        WHEN AVG(dar.efficiency_ratio) >= 90 THEN 'green'
        WHEN AVG(dar.efficiency_ratio) >= 80 THEN 'blue'
        ELSE 'red'
    END as efficiency_color,
    
    -- 이전 날짜 대비 변화 (임시로 0으로 설정)
    0 as efficiency_change
    
FROM daily_analysis_results dar
WHERE dar.job_grade IS NOT NULL
GROUP BY dar.analysis_date, dar.center_id, dar.center_name, dar.job_grade;

-- 3.10 그룹별 직급별 요약 View
CREATE VIEW IF NOT EXISTS v_group_grade_daily_summary AS
SELECT 
    dar.analysis_date,
    dar.center_id,
    dar.center_name,
    dar.group_id,
    dar.group_name,
    dar.job_grade,
    
    -- 인원 통계
    COUNT(DISTINCT dar.employee_id) as employee_count,
    
    -- 효율성 평균
    ROUND(AVG(dar.efficiency_ratio), 1) as avg_efficiency_ratio,
    
    -- 효율성 분포
    CASE 
        WHEN AVG(dar.efficiency_ratio) >= 90 THEN 'green'
        WHEN AVG(dar.efficiency_ratio) >= 80 THEN 'blue'
        ELSE 'red'
    END as efficiency_color,
    
    -- 이전 날짜 대비 변화
    0 as efficiency_change
    
FROM daily_analysis_results dar
WHERE dar.job_grade IS NOT NULL
GROUP BY dar.analysis_date, dar.center_id, dar.center_name, 
         dar.group_id, dar.group_name, dar.job_grade;

-- 3.11 성능 인덱스 View
CREATE VIEW IF NOT EXISTS v_performance_indexes AS
SELECT 
    name as index_name,
    tbl_name as table_name,
    sql as index_definition
FROM sqlite_master 
WHERE type = 'index' 
    AND name LIKE 'idx_tag_data_%' 
    OR name LIKE 'idx_tag_logs_%'
    OR name LIKE 'idx_equipment_logs_%' 
    OR name LIKE 'idx_attendance_%'
    OR name LIKE 'idx_dar_%'
ORDER BY tbl_name, name;

-- ================================================
-- 4. 데이터 마이그레이션 완료 메시지
-- ================================================
-- 이 스크립트를 실행한 후 다음을 확인하세요:
-- 1. 기존 데이터가 있는 경우, daily_work_data를 daily_analysis_results로 변환하는 작업이 필요합니다.
-- 2. 새로운 배치 처리 시 daily_analysis_results 테이블을 직접 채우도록 설정하세요.
-- 3. 대시보드 API가 새로운 View들을 참조하도록 업데이트하세요.