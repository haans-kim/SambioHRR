import Database from 'better-sqlite3';
import { precomputeMonthlyStats, precomputeGroupStats } from '../lib/db/queries/precompute-stats';

const db = new Database('./sambio_human.db');

console.log('=== 10월 통계 재생성 ===\n');

// 기존 삭제
const deletedCenter = db.prepare("DELETE FROM monthly_center_stats WHERE month = ?").run('2025-10');
const deletedGrade = db.prepare("DELETE FROM monthly_grade_stats WHERE month = ?").run('2025-10');
const deletedGroup = db.prepare("DELETE FROM monthly_group_stats WHERE month = ?").run('2025-10');

console.log('기존 통계 삭제:');
console.log(`  monthly_center_stats: ${deletedCenter.changes}건`);
console.log(`  monthly_grade_stats: ${deletedGrade.changes}건`);
console.log(`  monthly_group_stats: ${deletedGroup.changes}건\n`);

// 재생성
console.log('통계 재생성 중...');
precomputeMonthlyStats('2025-10');
precomputeGroupStats('2025-10');

// 확인
const result = db.prepare(`
  SELECT center_name, weekly_claimed_hours, weekly_adjusted_hours
  FROM monthly_center_stats
  WHERE month = '2025-10'
  ORDER BY center_name
`).all();

console.log('\n재생성 완료:');
result.forEach((r: any) => {
  console.log(`  ${r.center_name}: 근태=${r.weekly_claimed_hours}h, 추정=${r.weekly_adjusted_hours}h`);
});

db.close();

console.log('\n✓ 10월 통계 재생성 완료!');
