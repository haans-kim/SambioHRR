#!/usr/bin/env npx tsx
import Database from 'better-sqlite3';

const db = new Database('./sambio_human.db', { readonly: true });

console.log('📊 Checking weekly adjusted work hours consistency across levels...\n');

// 날짜 범위 설정
const startDate = '2025-06-01';
const endDate = '2025-06-30';
const days = 30;

// 1. 전체 평균
const totalAvg = db.prepare(`
  SELECT
    ROUND(
      SUM(actual_work_hours) /
      COUNT(DISTINCT CASE WHEN actual_work_hours > 0 THEN employee_id END) /
      ${days} * 7,
      1
    ) as avg_weekly_hours,
    COUNT(DISTINCT employee_id) as total_employees
  FROM daily_analysis_results
  WHERE analysis_date BETWEEN ? AND ?
`).get(startDate, endDate) as any;

console.log(`🌐 전체 평균: ${totalAvg.avg_weekly_hours}h (${totalAvg.total_employees}명)\n`);

// 2. 센터별 평균
console.log('📍 센터별 주간 추정근태시간:');
const centerStats = db.prepare(`
  SELECT
    e.center_name,
    COUNT(DISTINCT dar.employee_id) as employees,
    ROUND(
      SUM(dar.actual_work_hours) /
      COUNT(DISTINCT CASE WHEN dar.actual_work_hours > 0 THEN dar.employee_id END) /
      ${days} * 7,
      1
    ) as weekly_hours
  FROM daily_analysis_results dar
  JOIN employees e ON e.employee_id = dar.employee_id
  WHERE dar.analysis_date BETWEEN ? AND ?
    AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
  GROUP BY e.center_name
  ORDER BY e.center_name
`).all(startDate, endDate) as any[];

let totalWeighted = 0;
let totalEmps = 0;

centerStats.forEach(row => {
  console.log(`  ${row.center_name.padEnd(20)} : ${String(row.weekly_hours).padStart(5)}h (${row.employees}명)`);
  totalWeighted += row.weekly_hours * row.employees;
  totalEmps += row.employees;
});

console.log(`\n  가중평균: ${(totalWeighted / totalEmps).toFixed(1)}h\n`);

// 3. People센터 상세 분석
console.log('🏢 People센터 상세 분석:');

// People센터 전체
const peopleCenter = db.prepare(`
  SELECT
    COUNT(DISTINCT dar.employee_id) as employees,
    ROUND(
      SUM(dar.actual_work_hours) /
      COUNT(DISTINCT CASE WHEN dar.actual_work_hours > 0 THEN dar.employee_id END) /
      ${days} * 7,
      1
    ) as weekly_hours
  FROM daily_analysis_results dar
  JOIN employees e ON e.employee_id = dar.employee_id
  WHERE dar.analysis_date BETWEEN ? AND ?
    AND e.center_name = 'People센터'
`).get(startDate, endDate) as any;

console.log(`\n  People센터 전체: ${peopleCenter.weekly_hours}h (${peopleCenter.employees}명)\n`);

// People센터 팀별
const peopleTeams = db.prepare(`
  SELECT
    e.team_name,
    COUNT(DISTINCT dar.employee_id) as employees,
    ROUND(
      SUM(dar.actual_work_hours) /
      COUNT(DISTINCT CASE WHEN dar.actual_work_hours > 0 THEN dar.employee_id END) /
      ${days} * 7,
      1
    ) as weekly_hours
  FROM daily_analysis_results dar
  JOIN employees e ON e.employee_id = dar.employee_id
  WHERE dar.analysis_date BETWEEN ? AND ?
    AND e.center_name = 'People센터'
    AND e.team_name IS NOT NULL
  GROUP BY e.team_name
  ORDER BY e.team_name
`).all(startDate, endDate) as any[];

console.log('  팀별 상세:');
let peopleWeighted = 0;
let peopleEmps = 0;

peopleTeams.forEach(row => {
  console.log(`    ${(row.team_name || 'Unknown').padEnd(30)} : ${String(row.weekly_hours).padStart(5)}h (${row.employees}명)`);
  peopleWeighted += row.weekly_hours * row.employees;
  peopleEmps += row.employees;
});

console.log(`\n  팀 가중평균: ${(peopleWeighted / peopleEmps).toFixed(1)}h (총 ${peopleEmps}명)`);

// 4. 계산 방식 비교
console.log('\n📐 계산 방식 비교 (People센터):');

// 방식 1: 전체 합계 / 전체 인원
const method1 = db.prepare(`
  SELECT
    ROUND(
      SUM(actual_work_hours) /
      COUNT(DISTINCT CASE WHEN actual_work_hours > 0 THEN employee_id END) /
      ${days} * 7,
      1
    ) as result
  FROM daily_analysis_results dar
  JOIN employees e ON e.employee_id = dar.employee_id
  WHERE dar.analysis_date BETWEEN ? AND ?
    AND e.center_name = 'People센터'
`).get(startDate, endDate) as any;

// 방식 2: 개인별 평균의 평균
const method2 = db.prepare(`
  WITH person_avg AS (
    SELECT
      dar.employee_id,
      SUM(dar.actual_work_hours) / ${days} * 7 as personal_weekly
    FROM daily_analysis_results dar
    JOIN employees e ON e.employee_id = dar.employee_id
    WHERE dar.analysis_date BETWEEN ? AND ?
      AND e.center_name = 'People센터'
    GROUP BY dar.employee_id
    HAVING SUM(dar.actual_work_hours) > 0
  )
  SELECT ROUND(AVG(personal_weekly), 1) as result
  FROM person_avg
`).get(startDate, endDate) as any;

console.log(`  방식1 (전체합/전체인원): ${method1.result}h`);
console.log(`  방식2 (개인평균의 평균): ${method2.result}h`);

db.close();
console.log('\n✅ 분석 완료');