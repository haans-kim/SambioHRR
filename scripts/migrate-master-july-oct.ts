#!/usr/bin/env tsx
/**
 * 7-10월 Master Events Table 생성
 *
 * 7월: tag_data + meal_data만
 * 8-10월: tag_data + meal_data + equipment_data (LIMS 제외)
 * 모든 월: Knox 데이터 제외
 */

import { CompleteMasterMigrator } from '@/lib/migration/CompleteMasterMigrator'
import Database from 'better-sqlite3'
import path from 'path'

// 월별로 분리해서 실행
const months = [
  { start: '20250701', end: '20250731', name: '7월', hasEquipment: false },
  { start: '20250801', end: '20250831', name: '8월', hasEquipment: true },
  { start: '20250901', end: '20250930', name: '9월', hasEquipment: true },
  { start: '20251001', end: '20251031', name: '10월', hasEquipment: true },
]

async function main() {
  console.log('=== 7-10월 Master Events Table 생성 시작 ===\n')

  for (const month of months) {
    console.log(`\n📅 ${month.name} 처리 시작 (${month.start} ~ ${month.end})`)
    console.log(`  포함 데이터: tag_data + meal_data${month.hasEquipment ? ' + equipment_data (LIMS 제외)' : ''}`)
    console.log(`  제외 데이터: Knox (PIMS, Mail, Approval)${!month.hasEquipment ? ' + Equipment 전체' : ' + LIMS'}\n`)

    const migrator = new CompleteMasterMigrator(month.start, month.end)
    const result = await migrator.run()

    if (!result.success) {
      console.error(`\n❌ ${month.name} 실패: ${result.error}`)
      process.exit(1)
    }

    console.log(`\n✅ ${month.name} 완료!`)
    console.log(`  • 이벤트: ${result.totalEvents.toLocaleString()}개`)
    console.log(`  • 직원: ${result.uniqueEmployees}명`)
    console.log(`  • 소요시간: ${(result.duration / 1000).toFixed(1)}초`)
  }

  // 전체 통계
  console.log('\n\n=== 전체 완료 통계 ===')
  const ANALYTICS_DB = path.join(process.cwd(), 'sambio_analytics.db')
  const db = new Database(ANALYTICS_DB, { readonly: true })

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_events,
      COUNT(DISTINCT employee_id) as unique_employees,
      MIN(date) as earliest_date,
      MAX(date) as latest_date,
      SUM(CASE WHEN data_source = 'tag' THEN 1 ELSE 0 END) as tag_events,
      SUM(CASE WHEN data_source = 'meal' THEN 1 ELSE 0 END) as meal_events,
      SUM(CASE WHEN data_source = 'equipment' THEN 1 ELSE 0 END) as equipment_events
    FROM master_events_table
    WHERE date >= '2025-07-01' AND date <= '2025-10-31'
  `).get() as any

  console.log(`  • 총 이벤트: ${stats.total_events?.toLocaleString()}개`)
  console.log(`    - Tag: ${stats.tag_events?.toLocaleString()}개`)
  console.log(`    - Meal: ${stats.meal_events?.toLocaleString()}개`)
  console.log(`    - Equipment: ${stats.equipment_events?.toLocaleString()}개`)
  console.log(`  • 직원 수: ${stats.unique_employees}명`)
  console.log(`  • 기간: ${stats.earliest_date} ~ ${stats.latest_date}`)

  db.close()

  console.log('\n=== 모든 작업 완료 ===')
  process.exit(0)
}

main().catch((error) => {
  console.error('\n❌ 오류 발생:', error)
  process.exit(1)
})
