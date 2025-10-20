#!/usr/bin/env tsx
/**
 * 완전한 Master Database 마이그레이션 - CLI 인터페이스
 * 실행: npx tsx scripts/migrate-complete-master.ts [start_date] [end_date]
 * 예시: npx tsx scripts/migrate-complete-master.ts 20250701 20250731
 */

import { CompleteMasterMigrator } from '@/lib/migration/CompleteMasterMigrator'

async function main() {
  const [,, startDate, endDate] = process.argv

  if (!startDate) {
    console.error('❌ 시작 날짜를 입력하세요')
    console.log('\n사용법:')
    console.log('  npx tsx scripts/migrate-complete-master.ts YYYYMMDD [YYYYMMDD]')
    console.log('\n예시:')
    console.log('  npx tsx scripts/migrate-complete-master.ts 20250701 20250731  # 7월 전체')
    console.log('  npx tsx scripts/migrate-complete-master.ts 20250801 20250831  # 8월 전체')
    process.exit(1)
  }

  console.log(`\n🚀 Master DB 마이그레이션 시작: ${startDate} ~ ${endDate || startDate}\n`)

  const migrator = new CompleteMasterMigrator(startDate, endDate || startDate)
  const result = await migrator.run()

  if (!result.success) {
    console.error(`\n❌ 마이그레이션 실패: ${result.error}`)
    process.exit(1)
  }

  console.log(`\n✅ 마이그레이션 성공!`)
  console.log(`  • 처리 이벤트: ${result.totalEvents.toLocaleString()}개`)
  console.log(`  • 처리 직원: ${result.uniqueEmployees}명`)
  console.log(`  • 처리 기간: ${result.uniqueDates}일`)
  console.log(`  • 소요 시간: ${(result.duration / 1000).toFixed(1)}초`)

  process.exit(0)
}

main().catch((error) => {
  console.error('\n❌ 오류 발생:', error)
  process.exit(1)
})
