#!/usr/bin/env tsx
// @ts-nocheck
/**
 * 테스트용 재분석 스크립트 V2
 * - 효율성 85% 이상 유지하도록 조정
 * - Sigmoid 함수 범위 재조정
 */

import Database from 'better-sqlite3';

const db = new Database('sambio_human.db');
db.pragma('journal_mode = DELETE');

// Sigmoid 함수 기반 업무시간 보정 - 범위 조정
function calculateAdjustedWorkHours(workHours: number, groundRuleConfidence: number): number {
  const normalized = groundRuleConfidence / 100;

  // 옵션 1: 92-100% 범위 (기존 방식과 유사)
  const sigmoid1 = 1 / (1 + Math.exp(-12 * (normalized - 0.65)));
  const adjustmentFactor1 = 0.92 + sigmoid1 * 0.08;

  // 옵션 2: 95-100% 범위 (더 보수적)
  const sigmoid2 = 1 / (1 + Math.exp(-12 * (normalized - 0.65)));
  const adjustmentFactor2 = 0.95 + sigmoid2 * 0.05;

  // 옵션 3: 신뢰도 기반 선형 조정 (85-100% 범위)
  // 신뢰도 50% → 85%, 신뢰도 100% → 100%
  const adjustmentFactor3 = 0.70 + normalized * 0.30;

  // 옵션 4: 계단식 조정 (효율성 보장)
  let adjustmentFactor4;
  if (groundRuleConfidence >= 80) adjustmentFactor4 = 1.00;
  else if (groundRuleConfidence >= 70) adjustmentFactor4 = 0.98;
  else if (groundRuleConfidence >= 60) adjustmentFactor4 = 0.96;
  else if (groundRuleConfidence >= 50) adjustmentFactor4 = 0.94;
  else adjustmentFactor4 = 0.92;

  return {
    original: workHours,
    option1: workHours * adjustmentFactor1,
    option2: workHours * adjustmentFactor2,
    option3: workHours * adjustmentFactor3,
    option4: workHours * adjustmentFactor4,
    factors: {
      factor1: adjustmentFactor1,
      factor2: adjustmentFactor2,
      factor3: adjustmentFactor3,
      factor4: adjustmentFactor4
    }
  };
}

// 테스트 실행
async function runTest() {
  console.log('🧪 재분석 테스트 V2 - 효율성 조정');
  console.log('📅 대상: 2025-06-01, CDO개발센터');
  console.log('🎯 목표: 효율성 85% 이상 유지');
  console.log('='.repeat(80));

  // 현재 데이터 확인
  const currentDataQuery = `
    SELECT
      dar.employee_id,
      e.center_name,
      dar.confidence_score as old_confidence,
      dar.ground_rules_confidence,
      dar.actual_work_hours,
      dar.claimed_work_hours,
      dar.efficiency_ratio,
      dar.non_work_movement_minutes
    FROM daily_analysis_results dar
    JOIN employees e ON e.employee_id = dar.employee_id
    WHERE dar.analysis_date = '2025-06-01'
      AND e.center_name = 'CDO개발센터'
    ORDER BY dar.efficiency_ratio DESC
    LIMIT 10
  `;

  const currentData = db.prepare(currentDataQuery).all();

  console.log('\n📊 다양한 보정 방식 비교:');
  console.log('옵션 1: Sigmoid 92-100% | 옵션 2: Sigmoid 95-100% | 옵션 3: 선형 70-100% | 옵션 4: 계단식');
  console.log('-'.repeat(80));

  for (const data of currentData.slice(0, 5)) {
    const groundRuleConfidence = data.ground_rules_confidence || 65;
    const t1NonWorkMinutes = data.non_work_movement_minutes || 0;

    // T1 비업무 이동 제외
    const actualWorkHoursAdjusted = data.actual_work_hours - (t1NonWorkMinutes / 60);

    // 다양한 보정 방식 적용
    const adjusted = calculateAdjustedWorkHours(actualWorkHoursAdjusted, groundRuleConfidence);

    // 효율성 계산
    const calcEfficiency = (hours: number) =>
      data.claimed_work_hours > 0 ? (hours / data.claimed_work_hours) * 100 : 0;

    console.log(`\n직원 ${data.employee_id}:`);
    console.log(`  Ground Rule Confidence: ${groundRuleConfidence.toFixed(1)}%`);
    console.log(`  원본 작업시간: ${data.actual_work_hours.toFixed(2)}h | 신고시간: ${data.claimed_work_hours.toFixed(2)}h`);
    console.log(`  T1 비업무 제외 후: ${actualWorkHoursAdjusted.toFixed(2)}h`);
    console.log(`  현재 효율성: ${data.efficiency_ratio.toFixed(1)}%`);
    console.log(`  `);
    console.log(`  보정 계수:`);
    console.log(`    옵션1 (92-100%): ${(adjusted.factors.factor1 * 100).toFixed(1)}%`);
    console.log(`    옵션2 (95-100%): ${(adjusted.factors.factor2 * 100).toFixed(1)}%`);
    console.log(`    옵션3 (70-100%): ${(adjusted.factors.factor3 * 100).toFixed(1)}%`);
    console.log(`    옵션4 (계단식):  ${(adjusted.factors.factor4 * 100).toFixed(1)}%`);
    console.log(`  `);
    console.log(`  새 효율성:`);
    console.log(`    옵션1: ${calcEfficiency(adjusted.option1).toFixed(1)}% ${calcEfficiency(adjusted.option1) >= 85 ? '✅' : '❌'}`);
    console.log(`    옵션2: ${calcEfficiency(adjusted.option2).toFixed(1)}% ${calcEfficiency(adjusted.option2) >= 85 ? '✅' : '❌'}`);
    console.log(`    옵션3: ${calcEfficiency(adjusted.option3).toFixed(1)}% ${calcEfficiency(adjusted.option3) >= 85 ? '✅' : '❌'}`);
    console.log(`    옵션4: ${calcEfficiency(adjusted.option4).toFixed(1)}% ${calcEfficiency(adjusted.option4) >= 85 ? '✅' : '❌'}`);
  }

  // 전체 통계
  console.log('\n' + '='.repeat(80));
  console.log('📈 전체 효율성 분포 (CDO개발센터 6월):');

  let stats = {
    option1: { above85: 0, below85: 0, avg: 0 },
    option2: { above85: 0, below85: 0, avg: 0 },
    option3: { above85: 0, below85: 0, avg: 0 },
    option4: { above85: 0, below85: 0, avg: 0 }
  };

  for (const data of currentData) {
    const groundRuleConfidence = data.ground_rules_confidence || 65;
    const t1NonWorkMinutes = data.non_work_movement_minutes || 0;
    const actualWorkHoursAdjusted = data.actual_work_hours - (t1NonWorkMinutes / 60);
    const adjusted = calculateAdjustedWorkHours(actualWorkHoursAdjusted, groundRuleConfidence);

    const calcEfficiency = (hours: number) =>
      data.claimed_work_hours > 0 ? (hours / data.claimed_work_hours) * 100 : 0;

    const eff1 = calcEfficiency(adjusted.option1);
    const eff2 = calcEfficiency(adjusted.option2);
    const eff3 = calcEfficiency(adjusted.option3);
    const eff4 = calcEfficiency(adjusted.option4);

    if (eff1 >= 85) stats.option1.above85++; else stats.option1.below85++;
    if (eff2 >= 85) stats.option2.above85++; else stats.option2.below85++;
    if (eff3 >= 85) stats.option3.above85++; else stats.option3.below85++;
    if (eff4 >= 85) stats.option4.above85++; else stats.option4.below85++;

    stats.option1.avg += eff1;
    stats.option2.avg += eff2;
    stats.option3.avg += eff3;
    stats.option4.avg += eff4;
  }

  const total = currentData.length;
  stats.option1.avg /= total;
  stats.option2.avg /= total;
  stats.option3.avg /= total;
  stats.option4.avg /= total;

  console.log(`\n옵션 1 (Sigmoid 92-100%):`);
  console.log(`  85% 이상: ${stats.option1.above85}명 (${(stats.option1.above85/total*100).toFixed(1)}%)`);
  console.log(`  85% 미만: ${stats.option1.below85}명`);
  console.log(`  평균 효율성: ${stats.option1.avg.toFixed(1)}%`);

  console.log(`\n옵션 2 (Sigmoid 95-100%):`);
  console.log(`  85% 이상: ${stats.option2.above85}명 (${(stats.option2.above85/total*100).toFixed(1)}%)`);
  console.log(`  85% 미만: ${stats.option2.below85}명`);
  console.log(`  평균 효율성: ${stats.option2.avg.toFixed(1)}%`);

  console.log(`\n옵션 3 (선형 70-100%):`);
  console.log(`  85% 이상: ${stats.option3.above85}명 (${(stats.option3.above85/total*100).toFixed(1)}%)`);
  console.log(`  85% 미만: ${stats.option3.below85}명`);
  console.log(`  평균 효율성: ${stats.option3.avg.toFixed(1)}%`);

  console.log(`\n옵션 4 (계단식):`);
  console.log(`  85% 이상: ${stats.option4.above85}명 (${(stats.option4.above85/total*100).toFixed(1)}%)`);
  console.log(`  85% 미만: ${stats.option4.below85}명`);
  console.log(`  평균 효율성: ${stats.option4.avg.toFixed(1)}%`);

  console.log('\n✅ 테스트 완료');
}

// 실행
runTest().catch(console.error).finally(() => {
  db.close();
  process.exit(0);
});