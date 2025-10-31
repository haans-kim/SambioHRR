const Database = require('better-sqlite3');
const db = new Database('./sambio_human.db', { readonly: true });

console.log('=== 담당(Division)별 월별 주간 근무시간 분석 ===\n');

// 먼저 DAR 테이블에 division 컬럼이 있는지 확인
const columns = db.prepare(`PRAGMA table_info(daily_analysis_results)`).all();
console.log('Available columns in daily_analysis_results:');
columns.forEach(col => {
  if (col.name.toLowerCase().includes('div') ||
      col.name.toLowerCase().includes('center') ||
      col.name.toLowerCase().includes('group') ||
      col.name.toLowerCase().includes('team')) {
    console.log(`  - ${col.name} (${col.type})`);
  }
});

console.log('\n--- 샘플 데이터 확인 ---');
const sample = db.prepare(`
  SELECT
    analysis_date,
    employee_id,
    center_id,
    center_name,
    group_id,
    group_name,
    team_id,
    team_name,
    actual_work_hours,
    claimed_work_hours
  FROM daily_analysis_results
  LIMIT 5
`).all();
console.table(sample);

// division 컬럼이 없으므로 organization_master를 조인해야 함
console.log('\n--- organization_master 구조 확인 ---');
const orgSample = db.prepare(`
  SELECT * FROM organization_master
  WHERE org_level IN ('center', 'division', 'team')
  LIMIT 10
`).all();
console.table(orgSample);

// 실제 쿼리: center를 담당으로 간주하거나, organization_master와 조인
console.log('\n=== 방법 1: Center를 담당으로 간주한 월별 주간 근무시간 ===\n');
const centerStats = db.prepare(`
  SELECT
    strftime('%Y-%m', analysis_date) as month,
    center_name as division_name,
    COUNT(DISTINCT employee_id) as total_employees,
    COUNT(*) as total_records,

    -- 주간 근무시간 (월 평균)
    ROUND(AVG(actual_work_hours) * 5, 2) as avg_weekly_work_hours,
    ROUND(AVG(claimed_work_hours) * 5, 2) as avg_weekly_claimed_hours,

    -- 효율성
    ROUND(AVG(efficiency_ratio) * 100, 2) as avg_efficiency_percent,

    -- 신뢰도
    ROUND(AVG(confidence_score) * 100, 2) as avg_confidence_percent,

    -- 총 근무시간 (월간)
    ROUND(SUM(actual_work_hours), 2) as total_monthly_work_hours,
    ROUND(SUM(claimed_work_hours), 2) as total_monthly_claimed_hours

  FROM daily_analysis_results
  WHERE analysis_date IS NOT NULL
    AND center_name IS NOT NULL
    AND actual_work_hours IS NOT NULL
  GROUP BY month, center_name
  ORDER BY month DESC, center_name
`).all();

console.log(`Found ${centerStats.length} records\n`);
console.table(centerStats.slice(0, 20));

// 월별 전체 요약
console.log('\n=== 월별 전체 요약 ===\n');
const monthlySummary = db.prepare(`
  SELECT
    strftime('%Y-%m', analysis_date) as month,
    COUNT(DISTINCT center_name) as total_divisions,
    COUNT(DISTINCT employee_id) as total_employees,
    COUNT(*) as total_records,

    -- 평균 주간 근무시간
    ROUND(AVG(actual_work_hours) * 5, 2) as avg_weekly_work_hours,
    ROUND(MIN(actual_work_hours) * 5, 2) as min_weekly_work_hours,
    ROUND(MAX(actual_work_hours) * 5, 2) as max_weekly_work_hours,

    -- 효율성
    ROUND(AVG(efficiency_ratio) * 100, 2) as avg_efficiency_percent,

    -- 신뢰도
    ROUND(AVG(confidence_score) * 100, 2) as avg_confidence_percent

  FROM daily_analysis_results
  WHERE analysis_date IS NOT NULL
    AND actual_work_hours IS NOT NULL
  GROUP BY month
  ORDER BY month DESC
`).all();

console.table(monthlySummary);

// Division 계층 구조가 있는지 확인
console.log('\n=== Organization Master에서 Division 레벨 확인 ===\n');
const divisionCheck = db.prepare(`
  SELECT
    org_level,
    COUNT(*) as count
  FROM organization_master
  WHERE is_active = 1
  GROUP BY org_level
`).all();
console.table(divisionCheck);

// 만약 division이 있다면, 계층 구조로 조인
const hasDivision = divisionCheck.some(d => d.org_level === 'division');

if (hasDivision) {
  console.log('\n=== 방법 2: Organization Master 조인하여 실제 Division 정보 사용 ===\n');

  const divisionStats = db.prepare(`
    SELECT
      strftime('%Y-%m', dar.analysis_date) as month,
      div.org_name as division_name,
      COUNT(DISTINCT dar.employee_id) as total_employees,
      COUNT(*) as total_records,

      -- 주간 근무시간 (일 평균 * 5)
      ROUND(AVG(dar.actual_work_hours) * 5, 2) as avg_weekly_work_hours,
      ROUND(AVG(dar.claimed_work_hours) * 5, 2) as avg_weekly_claimed_hours,

      -- 효율성
      ROUND(AVG(dar.efficiency_ratio) * 100, 2) as avg_efficiency_percent,

      -- 신뢰도
      ROUND(AVG(dar.confidence_score) * 100, 2) as avg_confidence_percent

    FROM daily_analysis_results dar
    JOIN organization_master team ON team.org_code = dar.team_id AND team.org_level = 'team'
    JOIN organization_master div ON div.org_code = team.parent_org_code AND div.org_level = 'division'
    WHERE dar.analysis_date IS NOT NULL
      AND dar.actual_work_hours IS NOT NULL
      AND div.is_active = 1
    GROUP BY month, div.org_name
    ORDER BY month DESC, div.org_name
  `).all();

  console.log(`Found ${divisionStats.length} records\n`);
  console.table(divisionStats.slice(0, 20));
}

// 담당별 상세 분석 (최근 월)
console.log('\n=== 최근 월 담당별 상세 분석 ===\n');
const recentMonth = db.prepare(`
  SELECT strftime('%Y-%m', MAX(analysis_date)) as recent_month
  FROM daily_analysis_results
`).get();

console.log(`Most recent month: ${recentMonth.recent_month}\n`);

const detailedStats = db.prepare(`
  SELECT
    center_name as division_name,
    COUNT(DISTINCT employee_id) as total_employees,
    COUNT(DISTINCT analysis_date) as working_days,

    -- 근무시간 통계
    ROUND(AVG(actual_work_hours), 2) as avg_daily_work_hours,
    ROUND(AVG(actual_work_hours) * 5, 2) as avg_weekly_work_hours,

    -- 신고 시간 vs 실제 시간
    ROUND(AVG(claimed_work_hours), 2) as avg_daily_claimed_hours,
    ROUND(AVG(claimed_work_hours) * 5, 2) as avg_weekly_claimed_hours,

    -- 효율성
    ROUND(AVG(efficiency_ratio) * 100, 2) as avg_efficiency_percent,
    ROUND(MIN(efficiency_ratio) * 100, 2) as min_efficiency_percent,
    ROUND(MAX(efficiency_ratio) * 100, 2) as max_efficiency_percent,

    -- 신뢰도
    ROUND(AVG(confidence_score) * 100, 2) as avg_confidence_percent,

    -- 활동 시간 분포
    ROUND(AVG(work_minutes) / 60.0, 2) as avg_work_hours,
    ROUND(AVG(meeting_minutes) / 60.0, 2) as avg_meeting_hours,
    ROUND(AVG(meal_minutes) / 60.0, 2) as avg_meal_hours,
    ROUND(AVG(movement_minutes) / 60.0, 2) as avg_movement_hours,
    ROUND(AVG(rest_minutes) / 60.0, 2) as avg_rest_hours

  FROM daily_analysis_results
  WHERE strftime('%Y-%m', analysis_date) = ?
    AND center_name IS NOT NULL
    AND actual_work_hours IS NOT NULL
  GROUP BY center_name
  ORDER BY total_employees DESC
`).all(recentMonth.recent_month);

console.table(detailedStats);

// CSV 출력 (Excel용)
console.log('\n=== CSV Export (담당별 월별 주간 근무시간) ===\n');
console.log('month,division_name,total_employees,avg_weekly_work_hours,avg_weekly_claimed_hours,avg_efficiency_percent,avg_confidence_percent');
centerStats.forEach(row => {
  console.log(`${row.month},${row.division_name},${row.total_employees},${row.avg_weekly_work_hours},${row.avg_weekly_claimed_hours},${row.avg_efficiency_percent},${row.avg_confidence_percent}`);
});

db.close();
console.log('\n✓ Analysis complete');
