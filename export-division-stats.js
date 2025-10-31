const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('./sambio_human.db', { readonly: true });

console.log('📊 담당별 월별 주간 근무시간 집계 시작...\n');

// 1. Center(담당)별 월별 통계
const divisionMonthlyStats = db.prepare(`
  SELECT
    strftime('%Y-%m', analysis_date) as month,
    center_name as division_name,
    COUNT(DISTINCT employee_id) as total_employees,
    COUNT(*) as total_records,

    -- 주간 근무시간 (일평균 * 5일)
    ROUND(AVG(actual_work_hours) * 5, 2) as avg_weekly_work_hours,
    ROUND(AVG(claimed_work_hours) * 5, 2) as avg_weekly_claimed_hours,

    -- 효율성
    ROUND(AVG(efficiency_ratio) * 100, 2) as avg_efficiency_percent,

    -- 신뢰도
    ROUND(AVG(confidence_score) * 100, 2) as avg_confidence_percent,

    -- 월간 총 근무시간
    ROUND(SUM(actual_work_hours), 2) as total_monthly_work_hours,
    ROUND(SUM(claimed_work_hours), 2) as total_monthly_claimed_hours

  FROM daily_analysis_results
  WHERE analysis_date IS NOT NULL
    AND center_name IS NOT NULL
    AND actual_work_hours IS NOT NULL
  GROUP BY month, center_name
  ORDER BY month DESC, total_employees DESC, center_name
`).all();

console.log(`✓ 총 ${divisionMonthlyStats.length}개 담당-월 조합 데이터 조회 완료\n`);

// 2. CSV 파일로 저장
const csvHeader = 'month,division_name,total_employees,total_records,avg_weekly_work_hours,avg_weekly_claimed_hours,avg_efficiency_percent,avg_confidence_percent,total_monthly_work_hours,total_monthly_claimed_hours\n';

const csvRows = divisionMonthlyStats.map(row => {
  return `${row.month},"${row.division_name}",${row.total_employees},${row.total_records},${row.avg_weekly_work_hours},${row.avg_weekly_claimed_hours},${row.avg_efficiency_percent},${row.avg_confidence_percent},${row.total_monthly_work_hours},${row.total_monthly_claimed_hours}`;
}).join('\n');

const csvContent = csvHeader + csvRows;
fs.writeFileSync('담당별_월별_주간근무시간.csv', '\ufeff' + csvContent, 'utf8'); // BOM for Excel

console.log('✓ CSV 파일 저장: 담당별_월별_주간근무시간.csv\n');

// 3. 월별 요약
const monthlySummary = db.prepare(`
  SELECT
    strftime('%Y-%m', analysis_date) as month,
    COUNT(DISTINCT center_name) as total_divisions,
    COUNT(DISTINCT employee_id) as total_employees,
    COUNT(*) as total_records,

    -- 평균 주간 근무시간
    ROUND(AVG(actual_work_hours) * 5, 2) as avg_weekly_work_hours,
    ROUND(AVG(claimed_work_hours) * 5, 2) as avg_weekly_claimed_hours,

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

console.log('=== 월별 전체 요약 ===');
console.table(monthlySummary);

// 4. 최근 월 Top 20 담당
const recentMonth = monthlySummary[0].month;
console.log(`\n=== ${recentMonth} Top 20 담당 (인원수 기준) ===`);

const top20 = divisionMonthlyStats
  .filter(row => row.month === recentMonth)
  .slice(0, 20);

console.table(top20);

// 5. 통계 요약
console.log('\n=== 분석 요약 ===');
console.log(`• 분석 기간: ${monthlySummary[monthlySummary.length - 1].month} ~ ${monthlySummary[0].month}`);
console.log(`• 총 담당 수: ${new Set(divisionMonthlyStats.map(r => r.division_name)).size}개`);
console.log(`• 총 직원 수: ${monthlySummary[0].total_employees}명`);
console.log(`• 평균 주간 근무시간: ${monthlySummary[0].avg_weekly_work_hours}시간`);
console.log(`• 평균 효율성: ${monthlySummary[0].avg_efficiency_percent}%`);
console.log(`• 평균 신뢰도: ${monthlySummary[0].avg_confidence_percent}%`);

// 6. 담당별 평균 (전체 기간)
const divisionAverage = db.prepare(`
  SELECT
    center_name as division_name,
    COUNT(DISTINCT strftime('%Y-%m', analysis_date)) as months_count,
    COUNT(DISTINCT employee_id) as avg_employees,

    -- 평균 주간 근무시간
    ROUND(AVG(actual_work_hours) * 5, 2) as avg_weekly_work_hours,
    ROUND(AVG(claimed_work_hours) * 5, 2) as avg_weekly_claimed_hours,

    -- 효율성
    ROUND(AVG(efficiency_ratio) * 100, 2) as avg_efficiency_percent,

    -- 신뢰도
    ROUND(AVG(confidence_score) * 100, 2) as avg_confidence_percent

  FROM daily_analysis_results
  WHERE analysis_date IS NOT NULL
    AND center_name IS NOT NULL
    AND actual_work_hours IS NOT NULL
  GROUP BY center_name
  HAVING avg_employees >= 10  -- 10명 이상인 담당만
  ORDER BY avg_employees DESC
  LIMIT 30
`).all();

console.log('\n=== 담당별 평균 (전체 기간, 10명 이상, Top 30) ===');
console.table(divisionAverage);

// 7. 담당별 평균 CSV
const avgCsvHeader = 'division_name,months_count,avg_employees,avg_weekly_work_hours,avg_weekly_claimed_hours,avg_efficiency_percent,avg_confidence_percent\n';
const avgCsvRows = divisionAverage.map(row => {
  return `"${row.division_name}",${row.months_count},${row.avg_employees},${row.avg_weekly_work_hours},${row.avg_weekly_claimed_hours},${row.avg_efficiency_percent},${row.avg_confidence_percent}`;
}).join('\n');

fs.writeFileSync('담당별_평균_주간근무시간.csv', '\ufeff' + avgCsvHeader + avgCsvRows, 'utf8');
console.log('\n✓ CSV 파일 저장: 담당별_평균_주간근무시간.csv');

db.close();
console.log('\n✅ 집계 완료!\n');
