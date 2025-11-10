import Database from 'better-sqlite3'
import * as path from 'path'

const dbPath = path.join(process.cwd(), 'sambio_human.db')
const db = new Database(dbPath)

console.log('='.repeat(80))
console.log('10월 통계 재생성')
console.log('='.repeat(80))

// Delete existing October stats
const deletedCenter = db.prepare("DELETE FROM monthly_center_stats WHERE month = '2025-10'").run()
const deletedGrade = db.prepare("DELETE FROM monthly_grade_stats WHERE month = '2025-10'").run()

console.log(`\n기존 통계 삭제:`)
console.log(`  monthly_center_stats: ${deletedCenter.changes}건`)
console.log(`  monthly_grade_stats: ${deletedGrade.changes}건`)

// Import and run precompute
const { precomputeMonthlyStats, precomputeGroupStats } = require('../lib/db/queries/precompute-stats')

console.log(`\n통계 재생성 중...`)
precomputeMonthlyStats('2025-10')
precomputeGroupStats('2025-10')

// Check results
const centerCount = db.prepare("SELECT COUNT(*) FROM monthly_center_stats WHERE month = '2025-10'").pluck().get()
const gradeCount = db.prepare("SELECT COUNT(*) FROM monthly_grade_stats WHERE month = '2025-10'").pluck().get()

console.log(`\n재생성된 통계:`)
console.log(`  monthly_center_stats: ${centerCount}건`)
console.log(`  monthly_grade_stats: ${gradeCount}건`)

// Show sample data
const sample = db.prepare(`
  SELECT center_name, weekly_claimed_hours, weekly_adjusted_hours
  FROM monthly_center_stats
  WHERE month = '2025-10'
  ORDER BY center_name
  LIMIT 3
`).all()

console.log(`\n샘플 데이터:`)
for (const row of sample as any[]) {
  console.log(`  ${row.center_name}: 근태=${row.weekly_claimed_hours}h, 추정=${row.weekly_adjusted_hours}h`)
}

db.close()
console.log(`\n${'='.repeat(80)}`)
console.log('완료!')
console.log('='.repeat(80))
