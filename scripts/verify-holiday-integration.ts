#!/usr/bin/env npx tsx

/**
 * 휴일 반영 전후 데이터 비교 검증 스크립트
 * 실행: npx tsx scripts/verify-holiday-integration.ts
 */

import db from '../lib/db/client';
import * as originalClaim from '../lib/db/queries/claim-analytics';
import * as holidaysClaim from '../lib/db/queries/claim-analytics-with-holidays';

interface ComparisonResult {
  metric: string;
  before: number;
  after: number;
  difference: number;
  percentChange: number;
}

function formatComparison(results: ComparisonResult[]) {
  console.log('\n=== 휴일 반영 전후 비교 분석 ===\n');
  console.table(results.map(r => ({
    '지표': r.metric,
    '수정 전': r.before.toFixed(1),
    '수정 후': r.after.toFixed(1),
    '차이': r.difference > 0 ? `+${r.difference.toFixed(1)}` : r.difference.toFixed(1),
    '변화율': r.percentChange > 0 ? `+${r.percentChange.toFixed(1)}%` : `${r.percentChange.toFixed(1)}%`
  })));
}

async function main() {
  const startDate = '2025-01-01';
  const endDate = '2025-06-30';

  console.log(`\n분석 기간: ${startDate} ~ ${endDate}\n`);

  // 1. holidays 테이블 확인
  const holidaysCheck = db.prepare('SELECT COUNT(*) as cnt FROM holidays WHERE holiday_date BETWEEN ? AND ?').get(startDate, endDate) as { cnt: number };

  if (!holidaysCheck || holidaysCheck.cnt === 0) {
    console.error('❌ holidays 테이블이 없거나 데이터가 없습니다.');
    console.log('먼저 다음 명령을 실행하세요:');
    console.log('sqlite3 sambio_human.db < scripts/create-holidays-table.sql');
    process.exit(1);
  }

  console.log(`✅ holidays 테이블 확인: ${holidaysCheck.cnt}개 휴일 데이터 존재\n`);

  // 2. 전체 평균 비교
  console.log('📊 전체 직원 주간 근태시간 비교...');
  const beforeTotal = originalClaim.getWeeklyClaimedHoursFromClaim(startDate, endDate);
  const afterTotal = holidaysClaim.getWeeklyClaimedHoursFromClaim(startDate, endDate);

  const totalComparison: ComparisonResult[] = [{
    metric: '전체 평균 주간 근태시간',
    before: beforeTotal.avgWeeklyClaimedHours,
    after: afterTotal.avgWeeklyClaimedHours,
    difference: afterTotal.avgWeeklyClaimedHours - beforeTotal.avgWeeklyClaimedHours,
    percentChange: ((afterTotal.avgWeeklyClaimedHours - beforeTotal.avgWeeklyClaimedHours) / beforeTotal.avgWeeklyClaimedHours) * 100
  }, {
    metric: '분석 대상 직원수',
    before: beforeTotal.totalEmployees,
    after: afterTotal.totalEmployees,
    difference: afterTotal.totalEmployees - beforeTotal.totalEmployees,
    percentChange: ((afterTotal.totalEmployees - beforeTotal.totalEmployees) / beforeTotal.totalEmployees) * 100
  }];

  formatComparison(totalComparison);

  // 3. 센터별 비교 (상위 5개 센터)
  console.log('\n📊 주요 센터별 주간 근태시간 비교...');
  const centers = ['People센터', '상생협력센터', 'AM센터', 'Digital센터', '경영지원센터'];
  const centerComparisons: ComparisonResult[] = [];

  for (const center of centers) {
    const beforeCenter = originalClaim.getCenterWeeklyClaimedHoursFromClaim(center, startDate, endDate);
    const afterCenter = holidaysClaim.getCenterWeeklyClaimedHoursFromClaim(center, startDate, endDate);

    if (beforeCenter && afterCenter) {
      centerComparisons.push({
        metric: center,
        before: beforeCenter.avgWeeklyClaimedHours,
        after: afterCenter.avgWeeklyClaimedHours,
        difference: afterCenter.avgWeeklyClaimedHours - beforeCenter.avgWeeklyClaimedHours,
        percentChange: ((afterCenter.avgWeeklyClaimedHours - beforeCenter.avgWeeklyClaimedHours) / beforeCenter.avgWeeklyClaimedHours) * 100
      });
    }
  }

  formatComparison(centerComparisons);

  // 4. 레벨별 전체 평균 비교
  console.log('\n📊 레벨별 전체 평균 비교...');
  const beforeMatrix = originalClaim.getGradeWeeklyClaimedHoursMatrixFromClaim(startDate, endDate);
  const afterMatrix = holidaysClaim.getGradeWeeklyClaimedHoursMatrixFromClaim(startDate, endDate);

  const levelComparisons: ComparisonResult[] = [];

  for (const grade of beforeMatrix.grades) {
    let beforeSum = 0, afterSum = 0, count = 0;

    for (const center of beforeMatrix.centers) {
      if (beforeMatrix.matrix[grade][center] > 0) {
        beforeSum += beforeMatrix.matrix[grade][center];
        afterSum += afterMatrix.matrix[grade][center] || 0;
        count++;
      }
    }

    if (count > 0) {
      levelComparisons.push({
        metric: grade,
        before: beforeSum / count,
        after: afterSum / count,
        difference: (afterSum - beforeSum) / count,
        percentChange: ((afterSum - beforeSum) / beforeSum) * 100
      });
    }
  }

  formatComparison(levelComparisons);

  // 5. 휴일 반영 상세 확인
  console.log('\n📅 휴일 반영 상세 확인...');
  const holidayDetails = db.prepare(`
    SELECT
      h.holiday_date,
      h.holiday_name,
      COUNT(DISTINCT c.사번) as affected_employees,
      SUM(CASE WHEN c.실제근무시간 = 0 THEN 1 ELSE 0 END) as zero_hour_employees
    FROM holidays h
    LEFT JOIN claim_data c ON DATE(c.근무일) = h.holiday_date
    WHERE h.holiday_date BETWEEN ? AND ?
    GROUP BY h.holiday_date, h.holiday_name
    ORDER BY h.holiday_date
  `).all(startDate, endDate) as Array<{
    holiday_date: string;
    holiday_name: string;
    affected_employees: number;
    zero_hour_employees: number;
  }>;

  console.table(holidayDetails.map(h => ({
    '날짜': h.holiday_date,
    '휴일명': h.holiday_name,
    '해당 직원수': h.affected_employees,
    '0시간 기록 직원수': h.zero_hour_employees,
    '반영 대상': h.zero_hour_employees
  })));

  // 6. 결과 요약
  console.log('\n=== 검증 결과 요약 ===\n');
  console.log(`✅ 전체 주간 근태시간: ${beforeTotal.avgWeeklyClaimedHours.toFixed(1)}h → ${afterTotal.avgWeeklyClaimedHours.toFixed(1)}h (+${(afterTotal.avgWeeklyClaimedHours - beforeTotal.avgWeeklyClaimedHours).toFixed(1)}h)`);
  console.log(`✅ 예상 효과: 주 40시간 기준에 더 근접`);
  console.log(`✅ 영향 받은 휴일: ${holidayDetails.length}일`);
  console.log(`✅ 최대 영향 받은 직원수: ${Math.max(...holidayDetails.map(h => h.zero_hour_employees))}명/일`);

  if (afterTotal.avgWeeklyClaimedHours >= 40) {
    console.log('\n🎉 목표 달성: 주간 평균 근태시간이 40시간 이상입니다!');
  } else {
    console.log(`\n⚠️  추가 조정 필요: 현재 ${afterTotal.avgWeeklyClaimedHours.toFixed(1)}h (목표: 40h)`);
  }
}

main().catch(console.error);