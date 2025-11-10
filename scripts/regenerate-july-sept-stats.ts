import Database from 'better-sqlite3'
import * as path from 'path'

const dbPath = path.join(process.cwd(), 'sambio_human.db')
const db = new Database(dbPath)

console.log('='.repeat(80))
console.log('7-9월 통계 재생성')
console.log('='.repeat(80))

const months = [
  { month: '2025-07', name: '7월' },
  { month: '2025-08', name: '8월' },
  { month: '2025-09', name: '9월' }
]

// Import precompute functions
const { precomputeMonthlyStats, precomputeGroupStats } = require('../lib/db/queries/precompute-stats')

for (const { month, name } of months) {
  console.log(`\n[${ name}] 통계 재생성 중...`)

  // Delete existing stats
  const deletedCenter = db.prepare("DELETE FROM monthly_center_stats WHERE month = ?").run(month)
  const deletedGrade = db.prepare("DELETE FROM monthly_grade_stats WHERE month = ?").run(month)
  const deletedGroup = db.prepare("DELETE FROM monthly_group_stats WHERE month = ?").run(month)

  console.log(`  기존 통계 삭제:`)
  console.log(`    monthly_center_stats: ${deletedCenter.changes}건`)
  console.log(`    monthly_grade_stats: ${deletedGrade.changes}건`)
  console.log(`    monthly_group_stats: ${deletedGroup.changes}건`)

  // Regenerate stats
  precomputeMonthlyStats(month)
  precomputeGroupStats(month)

  // Check results
  const centerCount = db.prepare("SELECT COUNT(*) FROM monthly_center_stats WHERE month = ?").pluck().get(month)
  const gradeCount = db.prepare("SELECT COUNT(*) FROM monthly_grade_stats WHERE month = ?").pluck().get(month)
  const groupCount = db.prepare("SELECT COUNT(*) FROM monthly_group_stats WHERE month = ?").pluck().get(month)

  console.log(`  재생성된 통계:`)
  console.log(`    monthly_center_stats: ${centerCount}건`)
  console.log(`    monthly_grade_stats: ${gradeCount}건`)
  console.log(`    monthly_group_stats: ${groupCount}건`)

  // Show sample data
  const sample = db.prepare(`
    SELECT center_name, weekly_claimed_hours, weekly_adjusted_hours
    FROM monthly_center_stats
    WHERE month = ?
    ORDER BY center_name
    LIMIT 3
  `).all(month)

  if (sample.length > 0) {
    console.log(`  샘플 데이터:`)
    for (const row of sample as any[]) {
      console.log(`    ${row.center_name}: 근태=${row.weekly_claimed_hours}h, 추정=${row.weekly_adjusted_hours}h`)
    }
  }
}

db.close()
console.log(`\n${'='.repeat(80)}`)
console.log('완료!')
console.log('='.repeat(80))
