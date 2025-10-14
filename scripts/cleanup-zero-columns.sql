-- 데이터베이스 정리 SQL 스크립트
-- 생성일: 2025-10-14T00:55:06.593Z
-- 주의: 실행 전 반드시 백업을 만드세요!


-- ============================================
-- sambio_human.db
-- ============================================

-- 테이블: processing_log (1 행)
-- 제거할 컬럼: 2개
-- ALTER TABLE "processing_log" DROP COLUMN "processed_records"; -- INTEGER
-- ALTER TABLE "processing_log" DROP COLUMN "error_count"; -- INTEGER

-- 테이블: daily_analysis_results (526,753 행)
-- 제거할 컬럼: 18개
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "equipment_minutes"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "training_minutes"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "breakfast_minutes"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "lunch_minutes"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "dinner_minutes"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "midnight_meal_minutes"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "fitness_minutes"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "commute_in_minutes"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "commute_out_minutes"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "preparation_minutes"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "work_area_minutes"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "non_work_area_minutes"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "gate_area_minutes"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "activity_count"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "meal_count"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "tag_count"; -- INTEGER
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "anomaly_score"; -- REAL
-- ALTER TABLE "daily_analysis_results" DROP COLUMN "business_trip_hours"; -- REAL

-- 테이블: organization_daily_stats (96 행)
-- 제거할 컬럼: 4개
-- ALTER TABLE "organization_daily_stats" DROP COLUMN "elastic_work_count"; -- INTEGER
-- ALTER TABLE "organization_daily_stats" DROP COLUMN "avg_meal_hours"; -- FLOAT
-- ALTER TABLE "organization_daily_stats" DROP COLUMN "avg_movement_hours"; -- FLOAT
-- ALTER TABLE "organization_daily_stats" DROP COLUMN "min_work_efficiency"; -- FLOAT

-- 테이블: batch_jobs (30 행)
-- 제거할 컬럼: 5개
-- ALTER TABLE "batch_jobs" DROP COLUMN "failure_count"; -- INTEGER
-- ALTER TABLE "batch_jobs" DROP COLUMN "skip_count"; -- INTEGER
-- ALTER TABLE "batch_jobs" DROP COLUMN "avg_processing_time"; -- REAL
-- ALTER TABLE "batch_jobs" DROP COLUMN "total_processing_time"; -- REAL
-- ALTER TABLE "batch_jobs" DROP COLUMN "batch_size"; -- INTEGER

-- 테이블: batch_job_checkpoints (91 행)
-- 제거할 컬럼: 1개
-- ALTER TABLE "batch_job_checkpoints" DROP COLUMN "failure_count"; -- INTEGER

-- 테이블: daily_work_data (1,780 행)
-- 제거할 컬럼: 5개
-- ALTER TABLE "daily_work_data" DROP COLUMN "rest_time"; -- REAL
-- ALTER TABLE "daily_work_data" DROP COLUMN "non_work_time"; -- REAL
-- ALTER TABLE "daily_work_data" DROP COLUMN "meal_time"; -- REAL
-- ALTER TABLE "daily_work_data" DROP COLUMN "dinner_time"; -- REAL
-- ALTER TABLE "daily_work_data" DROP COLUMN "midnight_meal_time"; -- REAL

-- 테이블: team_characteristics (96 행)
-- 제거할 컬럼: 3개
-- ALTER TABLE "team_characteristics" DROP COLUMN "morning_t1_rate"; -- REAL
-- ALTER TABLE "team_characteristics" DROP COLUMN "lunch_t1_rate"; -- REAL
-- ALTER TABLE "team_characteristics" DROP COLUMN "evening_t1_rate"; -- REAL


-- ============================================
-- sambio_analytics.db
-- ============================================

-- 테이블: master_events_table (15,478,409 행)
-- 제거할 컬럼: 5개
-- ALTER TABLE "master_events_table" DROP COLUMN "team_same_tag_count"; -- INTEGER
-- ALTER TABLE "master_events_table" DROP COLUMN "team_total_count"; -- INTEGER
-- ALTER TABLE "master_events_table" DROP COLUMN "team_tag_ratio"; -- REAL
-- ALTER TABLE "master_events_table" DROP COLUMN "team_work_intensity"; -- REAL
-- ALTER TABLE "master_events_table" DROP COLUMN "anomaly_score"; -- REAL


-- 참고: SQLite는 ALTER TABLE DROP COLUMN을 지원하지만,
-- 테이블을 재생성해야 할 수도 있습니다.
-- 각 테이블에 대해 수동으로 확인 후 실행하세요.
