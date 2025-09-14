#!/usr/bin/env tsx
/**
 * 테스트용 재분석 스크립트
 * - 2025년 6월 1일, 특정 센터만 테스트
 * - Ground Rule confidence를 사용한 새로운 분석 방식 검증
 */

import Database from 'better-sqlite3';

const db = new Database('sambio_human.db');
db.pragma('journal_mode = DELETE');

// Sigmoid 함수 기반 업무시간 보정 (90-95% 범위)
function calculateAdjustedWorkHours(workHours: number, groundRuleConfidence: number): number {
  const normalized = groundRuleConfidence / 100;
  const sigmoid = 1 / (1 + Math.exp(-12 * (normalized - 0.65)));
  const adjustmentFactor = 0.90 + sigmoid * 0.05; // 90% ~ 95% 범위
  return workHours * adjustmentFactor;
}

// 테스트 실행
async function runTest() {
  console.log('🧪 재분석 테스트 시작');
  console.log('📅 대상: 2025-06-01, CDO개발센터');
  console.log('='.repeat(50));

  // 1. 현재 데이터 확인
  const currentDataQuery = `
    SELECT
      dar.employee_id,
      e.center_name,
      dar.confidence_score as old_confidence,
      dar.ground_rules_confidence,
      dar.actual_work_hours,
      dar.claimed_work_hours,
      dar.efficiency_ratio
    FROM daily_analysis_results dar
    JOIN employees e ON e.employee_id = dar.employee_id
    WHERE dar.analysis_date = '2025-06-01'
      AND e.center_name = 'CDO개발센터'
    LIMIT 5
  `;

  console.log('\n📊 현재 데이터 (처음 5명):');
  const currentData = db.prepare(currentDataQuery).all();
  console.table(currentData);

  // 2. claim_data 확인
  const claimDataQuery = `
    SELECT
      c.사번,
      e.center_name,
      c.실제근무시간,
      c.휴가_연차,
      c.근태코드,
      c.근태명
    FROM claim_data c
    JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
    WHERE DATE(c.근무일) = '2025-06-01'
      AND e.center_name = 'CDO개발센터'
    LIMIT 5
  `;

  console.log('\n📋 Claim 데이터 (처음 5명):');
  const claimData = db.prepare(claimDataQuery).all();
  console.table(claimData);

  // 3. Ground Rule confidence를 사용한 새로운 계산 테스트
  console.log('\n🔄 새로운 계산 방식 테스트:');

  for (const data of currentData) {
    // Ground Rule confidence 사용 (없으면 기본값 65)
    const groundRuleConfidence = data.ground_rules_confidence || 65;

    // T1 비업무 이동 시간 조회 (예시)
    const t1NonWorkQuery = `
      SELECT non_work_movement_minutes
      FROM daily_analysis_results
      WHERE employee_id = ? AND analysis_date = '2025-06-01'
    `;
    const t1Result = db.prepare(t1NonWorkQuery).get(data.employee_id) as any;
    const t1NonWorkMinutes = t1Result?.non_work_movement_minutes || 0;

    // 실제 작업시간에서 T1 비업무 이동 제외
    const actualWorkHoursAdjusted = data.actual_work_hours - (t1NonWorkMinutes / 60);

    // Sigmoid 함수로 보정
    const adjustedWorkHours = calculateAdjustedWorkHours(actualWorkHoursAdjusted, groundRuleConfidence);

    // 새로운 효율성 계산
    const newEfficiency = data.claimed_work_hours > 0
      ? (adjustedWorkHours / data.claimed_work_hours) * 100
      : 0;

    console.log(`\n직원 ${data.employee_id}:`);
    console.log(`  기존 confidence: ${data.old_confidence?.toFixed(1)}%`);
    console.log(`  Ground Rule confidence: ${groundRuleConfidence.toFixed(1)}%`);
    console.log(`  T1 비업무 이동: ${t1NonWorkMinutes}분`);
    console.log(`  기존 작업시간: ${data.actual_work_hours?.toFixed(2)}시간`);
    console.log(`  조정된 작업시간: ${adjustedWorkHours.toFixed(2)}시간`);
    console.log(`  기존 효율성: ${data.efficiency_ratio?.toFixed(1)}%`);
    console.log(`  새로운 효율성: ${newEfficiency.toFixed(1)}%`);
  }

  // 4. 휴가/연차 데이터 통합 테스트
  console.log('\n🏖️ 휴가/연차 데이터 통합 테스트:');

  const leaveDataQuery = `
    SELECT
      c.사번,
      SUM(c.휴가_연차) as total_leave_hours,
      COUNT(DISTINCT CASE WHEN c.휴가_연차 > 0 THEN c.근무일 END) as leave_days,
      GROUP_CONCAT(DISTINCT c.근태명) as leave_types
    FROM claim_data c
    JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
    WHERE c.근무일 BETWEEN '2025-06-01' AND '2025-06-30'
      AND e.center_name = 'CDO개발센터'
      AND c.휴가_연차 > 0
    GROUP BY c.사번
    LIMIT 5
  `;

  const leaveData = db.prepare(leaveDataQuery).all();
  console.table(leaveData);

  // 5. 주간 추정 근태시간 계산 예시
  console.log('\n📈 주간 추정 근태시간 계산 (휴가 포함):');

  const weeklyQuery = `
    SELECT
      e.center_name,
      COUNT(DISTINCT c.사번) as employees,
      ROUND(SUM(c.실제근무시간) / COUNT(DISTINCT c.사번) / 30 * 7, 1) as avg_weekly_work,
      ROUND(SUM(c.휴가_연차) / COUNT(DISTINCT c.사번) / 30 * 7, 1) as avg_weekly_leave,
      ROUND((SUM(c.실제근무시간) + SUM(c.휴가_연차)) / COUNT(DISTINCT c.사번) / 30 * 7, 1) as avg_weekly_total
    FROM claim_data c
    JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
    WHERE c.근무일 BETWEEN '2025-06-01' AND '2025-06-30'
      AND e.center_name = 'CDO개발센터'
    GROUP BY e.center_name
  `;

  const weeklyData = db.prepare(weeklyQuery).all();
  console.table(weeklyData);

  console.log('\n✅ 테스트 완료');
}

// 실행
runTest().catch(console.error).finally(() => {
  db.close();
  process.exit(0);
});