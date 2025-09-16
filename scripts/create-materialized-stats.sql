-- Create materialized statistics tables for performance

-- 월별 센터 통계 테이블
CREATE TABLE IF NOT EXISTS monthly_center_stats (
  month TEXT NOT NULL,
  center_name TEXT NOT NULL,
  total_employees INTEGER,
  weekly_claimed_hours REAL,
  weekly_adjusted_hours REAL,
  efficiency REAL,
  data_reliability REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (month, center_name)
);

-- 월별 등급별 통계 테이블
CREATE TABLE IF NOT EXISTS monthly_grade_stats (
  month TEXT NOT NULL,
  center_name TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  total_employees INTEGER,
  weekly_claimed_hours REAL,
  weekly_adjusted_hours REAL,
  efficiency REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (month, center_name, grade_level)
);

-- 월별 전체 통계 테이블
CREATE TABLE IF NOT EXISTS monthly_overall_stats (
  month TEXT NOT NULL PRIMARY KEY,
  total_employees INTEGER,
  avg_weekly_claimed_hours REAL,
  avg_weekly_adjusted_hours REAL,
  avg_efficiency REAL,
  avg_data_reliability REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_monthly_center_stats_month ON monthly_center_stats(month);
CREATE INDEX IF NOT EXISTS idx_monthly_grade_stats_month ON monthly_grade_stats(month);
CREATE INDEX IF NOT EXISTS idx_monthly_overall_stats_month ON monthly_overall_stats(month);