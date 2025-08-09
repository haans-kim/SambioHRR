-- 직원 상세 데이터 전체 내보내기 쿼리
-- 스크린샷과 동일한 형식으로 전체 기간 데이터 추출

SELECT 
  dar.employee_id as '사번',
  e.employee_name as '이름',
  e.job_grade as '직급',
  e.center_name as '센터',
  e.team_name as '팀',
  e.group_name as '그룹',
  dar.analysis_date as '분석일자',
  ROUND(dar.efficiency_ratio, 1) as '효율성(%)',
  ROUND(dar.actual_work_hours, 1) as '실제작업(H)',
  ROUND(dar.claimed_work_hours, 1) as '근무시간(H)',
  dar.work_minutes as '작업(분)',
  dar.meeting_minutes as '회의(분)',
  dar.meal_minutes as '식사(분)',
  dar.movement_minutes as '이동(분)',
  dar.rest_minutes as '휴식(분)',
  ROUND(dar.confidence_score, 1) as '신뢰도'
FROM daily_analysis_results dar
JOIN employees e ON dar.employee_id = e.employee_id
WHERE e.group_name = '분석개발그룹'
ORDER BY dar.analysis_date DESC, e.employee_name;