-- 빈 테이블 제거 SQL 스크립트
-- 생성일: 2025-10-14
-- 주의: 백업을 확인한 후 실행하세요!

-- ============================================
-- sambio_human.db
-- ============================================

DROP TABLE IF EXISTS "shift_work_data";
DROP TABLE IF EXISTS "organization_summary";
DROP TABLE IF EXISTS "tag_logs";
DROP TABLE IF EXISTS "abc_activity_data";
DROP TABLE IF EXISTS "non_work_time_data";
DROP TABLE IF EXISTS "employee_info";
DROP TABLE IF EXISTS "organization_mapping";
DROP TABLE IF EXISTS "hmm_model_config";
DROP TABLE IF EXISTS "tag_sequence_patterns";
DROP TABLE IF EXISTS "tag_processing_log";
DROP TABLE IF EXISTS "equipment_data";
DROP TABLE IF EXISTS "equipment_logs";
DROP TABLE IF EXISTS "organization_daily_summary";
DROP TABLE IF EXISTS "work_orders";
DROP TABLE IF EXISTS "work_order_assignments";
DROP TABLE IF EXISTS "work_order_items";
DROP TABLE IF EXISTS "work_order_history";
DROP TABLE IF EXISTS "work_order_attachments";
DROP TABLE IF EXISTS "organization_monthly_stats";
DROP TABLE IF EXISTS "employee_organization_mapping";
DROP TABLE IF EXISTS "organization_master_backup";
DROP TABLE IF EXISTS "batch_job_details";
DROP TABLE IF EXISTS "batch_error_logs";
DROP TABLE IF EXISTS "ground_rules_analysis_log";

-- ============================================
-- sambio_analytics.db
-- ============================================

DROP TABLE IF EXISTS "processing_logs";
