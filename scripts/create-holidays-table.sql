-- 휴일 관리 테이블 생성 및 2025년 법정공휴일 데이터 입력
-- 실행: sqlite3 sambio_human.db < scripts/create-holidays-table.sql

-- 기존 테이블 있으면 삭제 (개발 중에만 사용)
-- DROP TABLE IF EXISTS holidays;

-- 휴일 테이블 생성
CREATE TABLE IF NOT EXISTS holidays (
  holiday_date DATE PRIMARY KEY,
  holiday_name TEXT NOT NULL,
  is_workday BOOLEAN DEFAULT FALSE,  -- 대체공휴일이 평일인 경우 TRUE
  standard_hours FLOAT DEFAULT 8.0,   -- 표준 근무 인정 시간
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2025년 1-6월 법정공휴일 입력
-- ON CONFLICT DO NOTHING으로 중복 삽입 방지
INSERT INTO holidays (holiday_date, holiday_name, standard_hours) VALUES
  ('2025-01-01', '신정', 8.0),
  ('2025-01-27', '설날연휴', 8.0),
  ('2025-01-28', '설날', 8.0),
  ('2025-01-29', '설날연휴', 8.0),
  ('2025-01-30', '설날대체휴일', 8.0),
  ('2025-03-01', '삼일절', 8.0),
  ('2025-05-05', '어린이날', 8.0),
  ('2025-05-06', '어린이날대체휴일', 8.0),
  ('2025-06-06', '현충일', 8.0)
ON CONFLICT DO NOTHING;

-- 확인 쿼리
SELECT
  holiday_date,
  holiday_name,
  standard_hours,
  CASE WHEN strftime('%w', holiday_date) = '0' THEN '일'
       WHEN strftime('%w', holiday_date) = '1' THEN '월'
       WHEN strftime('%w', holiday_date) = '2' THEN '화'
       WHEN strftime('%w', holiday_date) = '3' THEN '수'
       WHEN strftime('%w', holiday_date) = '4' THEN '목'
       WHEN strftime('%w', holiday_date) = '5' THEN '금'
       WHEN strftime('%w', holiday_date) = '6' THEN '토'
  END as weekday
FROM holidays
ORDER BY holiday_date;

-- 통계 확인
SELECT
  COUNT(*) as total_holidays,
  SUM(standard_hours) as total_hours
FROM holidays
WHERE holiday_date BETWEEN '2025-01-01' AND '2025-06-30';