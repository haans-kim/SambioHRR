import { precomputeMonthlyStats } from '../lib/db/queries/precompute-stats'
import Database from 'better-sqlite3'

console.log('='.repeat(80))
console.log('7월 Monthly Stats 재생성')
console.log('='.repeat(80))

const dbPath = 'C:\\Project\\SambioHRR\\sambio_human.db'

// 1. 기존 7월 stats 삭제
console.log('\n[1단계] 기존 7월 monthly stats 삭제...')
const db = new Database(dbPath)

const deletedCenter = db.prepare("DELETE FROM monthly_center_stats WHERE month = '2025-07'").run()
console.log(`  monthly_center_stats 삭제: ${deletedCenter.changes}개`)

const deletedGrade = db.prepare("DELETE FROM monthly_grade_stats WHERE month = '2025-07'").run()
console.log(`  monthly_grade_stats 삭제: ${deletedGrade.changes}개`)

db.close()

// 2. 7월 stats 재생성
console.log('\n[2단계] 7월 monthly stats 재생성...')
try {
  precomputeMonthlyStats('2025-07')
  console.log('  [OK] 재생성 성공')
} catch (error) {
  console.error('  [오류]', error)
}

// 3. 검증
console.log('\n[3단계] 검증...')
const db2 = new Database(dbPath, { readonly: true })

const centerCount = db2.prepare("SELECT COUNT(*) as count FROM monthly_center_stats WHERE month = '2025-07'").get() as { count: number }
console.log(`  monthly_center_stats (2025-07): ${centerCount.count}개`)

const gradeCount = db2.prepare("SELECT COUNT(*) as count FROM monthly_grade_stats WHERE month = '2025-07'").get() as { count: number }
console.log(`  monthly_grade_stats (2025-07): ${gradeCount.count}개`)

// 센터별 확인
const centers = db2.prepare("SELECT center_name, COUNT(*) as count FROM monthly_center_stats WHERE month = '2025-07' GROUP BY center_name ORDER BY center_name").all() as Array<{ center_name: string, count: number }>
console.log('\n  센터별 stats:')
for (const { center_name, count } of centers) {
  console.log(`    - ${center_name}: ${count}개`)
}

// 담당이 있는지 확인
const wrongCount = db2.prepare("SELECT COUNT(*) as count FROM monthly_center_stats WHERE month = '2025-07' AND center_name LIKE '%담당%'").get() as { count: number }
if (wrongCount.count > 0) {
  console.log(`\n  [경고] center_name에 담당이 있음: ${wrongCount.count}개`)
} else {
  console.log('\n  [OK] center_name에 담당 없음')
}

db2.close()

console.log('\n' + '='.repeat(80))
console.log('완료!')
console.log('='.repeat(80))
