/**
 * 7~10월 월간 통계를 사전 계산하여 저장
 *
 * 이 스크립트는 monthly_center_stats, monthly_grade_stats, monthly_overall_stats 테이블에
 * 7~10월 데이터를 계산하여 저장합니다.
 */

const { precomputeMonthlyStats, precomputeGroupStats } = require('../lib/db/queries/precompute-stats');

const months = ['2025-07', '2025-08', '2025-09', '2025-10'];

console.log('================================================================================');
console.log('📊 7~10월 월간 통계 사전 계산 시작');
console.log('================================================================================\n');

const startTime = Date.now();

months.forEach((month, index) => {
  console.log(`[${index + 1}/${months.length}] Computing stats for ${month}...`);

  const monthStartTime = Date.now();

  try {
    precomputeMonthlyStats(month);
    precomputeGroupStats(month);

    const elapsed = ((Date.now() - monthStartTime) / 1000).toFixed(1);
    console.log(`✅ ${month} 완료 (${elapsed}초)\n`);
  } catch (error) {
    console.error(`❌ ${month} 실패:`, error.message);
    console.error(error.stack);
  }
});

const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log('================================================================================');
console.log(`✅ 모든 월 계산 완료! (총 소요시간: ${totalElapsed}초)`);
console.log('================================================================================');
console.log('\n다음 명령으로 확인:');
console.log('  sqlite3 sambio_human.db "SELECT * FROM monthly_center_stats WHERE month >= \'2025-07\' ORDER BY month, center_name LIMIT 10;"');
