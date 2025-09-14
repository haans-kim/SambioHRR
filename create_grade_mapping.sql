-- ============================================
-- 직급 레벨 매핑 테이블 생성 및 데이터 입력
-- ============================================

-- 1. 기존 테이블이 있으면 삭제 (주의: 프로덕션에서는 백업 후 실행)
DROP TABLE IF EXISTS grade_level_mapping;

-- 2. 직급 매핑 테이블 생성
CREATE TABLE grade_level_mapping (
  grade_name VARCHAR(100) PRIMARY KEY,
  level VARCHAR(10) NOT NULL,
  level_numeric INTEGER NOT NULL, -- 숫자로도 관리 (정렬/비교용)
  category VARCHAR(50),
  subcategory VARCHAR(50),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 매핑 데이터 입력
-- Level 4 (Principal/Executive/Expert) - 최고위
INSERT INTO grade_level_mapping (grade_name, level, level_numeric, category, subcategory, notes) VALUES
-- 임원진
('대표사장', 'Lv.4', 4, 'Executive', 'CEO', '최고경영자'),
('부사장', 'Lv.4', 4, 'Executive', 'Vice President', '부사장'),
('상무', 'Lv.4', 4, 'Executive', 'Managing Director', '상무이사'),

-- Principal 레벨 (기술직 최고위)
('S4(Principal Scientist)', 'Lv.4', 4, 'Technical', 'Scientist', 'Principal 레벨 과학자'),
('S4(Principal Specialist)', 'Lv.4', 4, 'Technical', 'Specialist', 'Principal 레벨 전문가'),
('G4(Principal Specialist)', 'Lv.4', 4, 'General', 'Specialist', 'Principal 레벨 일반전문가'),
('E4(Principal Engineer)', 'Lv.4', 4, 'Engineering', 'Engineer', 'Principal 레벨 엔지니어'),

-- 전문직 최고위
('수석변호사', 'Lv.4', 4, 'Legal', 'Lawyer', '수석 변호사');

-- Level 3 (Lead/Senior Management/Senior Expert)
INSERT INTO grade_level_mapping (grade_name, level, level_numeric, category, subcategory, notes) VALUES
-- Lead 레벨 (팀 리드급)
('S3(Lead Scientist)', 'Lv.3', 3, 'Technical', 'Scientist', 'Lead 레벨 과학자'),
('S3(Lead Specialist)', 'Lv.3', 3, 'Technical', 'Specialist', 'Lead 레벨 전문가'),
('G3(Lead Specialist)', 'Lv.3', 3, 'General', 'Specialist', 'Lead 레벨 일반전문가'),
('E3(Lead Engineer)', 'Lv.3', 3, 'Engineering', 'Engineer', 'Lead 레벨 엔지니어'),

-- 전문직 시니어
('선임변호사', 'Lv.3', 3, 'Legal', 'Lawyer', '선임 변호사'),

-- 관리직 (A 등급 중 상위)
('A7', 'Lv.3', 3, 'Administrative', 'Admin', '관리직 7급');

-- Level 2 (Senior/Experienced)
INSERT INTO grade_level_mapping (grade_name, level, level_numeric, category, subcategory, notes) VALUES
-- Senior 레벨 (경력직)
('S2(Senior Scientist)', 'Lv.2', 2, 'Technical', 'Scientist', 'Senior 레벨 과학자'),
('S2(Senior Specialist)', 'Lv.2', 2, 'Technical', 'Specialist', 'Senior 레벨 전문가'),
('G2(Senior Specialist)', 'Lv.2', 2, 'General', 'Specialist', 'Senior 레벨 일반전문가'),
('E2(Senior Engineer)', 'Lv.2', 2, 'Engineering', 'Engineer', 'Senior 레벨 엔지니어'),

-- 관리직 중급
('A6', 'Lv.2', 2, 'Administrative', 'Admin', '관리직 6급');

-- Level 1 (Entry/Junior)
INSERT INTO grade_level_mapping (grade_name, level, level_numeric, category, subcategory, notes) VALUES
-- Entry 레벨 (신입/주니어)
('S1(Scientist)', 'Lv.1', 1, 'Technical', 'Scientist', 'Entry 레벨 과학자'),
('S1(Specialist)', 'Lv.1', 1, 'Technical', 'Specialist', 'Entry 레벨 전문가'),
('G1(Specialist)', 'Lv.1', 1, 'General', 'Specialist', 'Entry 레벨 일반전문가'),
('E1(Engineer)', 'Lv.1', 1, 'Engineering', 'Engineer', 'Entry 레벨 엔지니어'),
('C1(Engineer)', 'Lv.1', 1, 'Contract', 'Engineer', '계약직 엔지니어'),
('C1(Scientist)', 'Lv.1', 1, 'Contract', 'Scientist', '계약직 과학자'),

-- 전문직 주니어
('변호사', 'Lv.1', 1, 'Legal', 'Lawyer', '일반 변호사'),

-- 지원직
('간호사', 'Lv.1', 1, 'Medical', 'Nurse', '간호사'),
('상담사', 'Lv.1', 1, 'Support', 'Counselor', '상담사'),

-- 관리직 초급
('A5', 'Lv.1', 1, 'Administrative', 'Admin', '관리직 5급');

-- Special Category (별도 관리가 필요한 직급)
INSERT INTO grade_level_mapping (grade_name, level, level_numeric, category, subcategory, notes) VALUES
('고문', 'Special', 0, 'Advisory', 'Advisor', '상근 고문 - 별도 관리'),
('비상근고문', 'Special', 0, 'Advisory', 'Advisor', '비상근 고문 - 별도 관리'),
('자문역', 'Special', 0, 'Advisory', 'Consultant', '자문역 - 별도 관리');

-- 4. 인덱스 생성 (조회 성능 최적화)
CREATE INDEX idx_grade_mapping_level ON grade_level_mapping(level);
CREATE INDEX idx_grade_mapping_category ON grade_level_mapping(category);
CREATE INDEX idx_grade_mapping_level_numeric ON grade_level_mapping(level_numeric);

-- 5. 데이터 검증
SELECT
  level,
  COUNT(*) as grade_count,
  GROUP_CONCAT(grade_name) as grades
FROM grade_level_mapping
GROUP BY level
ORDER BY
  CASE level
    WHEN 'Lv.4' THEN 4
    WHEN 'Lv.3' THEN 3
    WHEN 'Lv.2' THEN 2
    WHEN 'Lv.1' THEN 1
    ELSE 0
  END DESC;