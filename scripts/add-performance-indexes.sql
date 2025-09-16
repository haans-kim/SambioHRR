-- Performance optimization indexes for SambioHRR

-- claim_data 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_claim_data_date_employee
ON claim_data(근무일, 사번);

CREATE INDEX IF NOT EXISTS idx_claim_data_employee_level_date
ON claim_data(employee_level, 근무일);

CREATE INDEX IF NOT EXISTS idx_claim_data_composite
ON claim_data(근무일, 사번, employee_level, 실제근무시간);

-- daily_analysis_results 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_dar_date_employee
ON daily_analysis_results(analysis_date, employee_id);

CREATE INDEX IF NOT EXISTS idx_dar_composite
ON daily_analysis_results(analysis_date, employee_id, actual_work_hours, movement_minutes);

-- employees 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_employees_center
ON employees(center_name);

CREATE INDEX IF NOT EXISTS idx_employees_id_center
ON employees(employee_id, center_name);

-- holidays 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_holidays_date
ON holidays(holiday_date);

-- 복합 인덱스 for JOIN operations
CREATE INDEX IF NOT EXISTS idx_claim_data_for_join
ON claim_data(사번, 근무일, employee_level);

CREATE INDEX IF NOT EXISTS idx_dar_for_join
ON daily_analysis_results(employee_id, analysis_date);

-- ANALYZE to update statistics
ANALYZE;