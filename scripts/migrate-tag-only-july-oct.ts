#!/usr/bin/env tsx
/**
 * 7-10월 Master Events Table 생성 (tag_data만)
 *
 * 포함: tag_data만
 * 제외: meal_data, knox, equipment 모두 제외
 */

import Database from 'better-sqlite3'
import path from 'path'

const ANALYTICS_DB_PATH = path.join(process.cwd(), 'sambio_analytics.db')
const OPERATIONAL_DB_PATH = path.join(process.cwd(), 'sambio_human.db')

class TagOnlyMigrator {
  private analyticsDb: Database.Database
  private operationalDb: Database.Database
  private startDate: string
  private endDate: string

  constructor(startDate: string, endDate: string) {
    this.startDate = startDate
    this.endDate = endDate

    this.analyticsDb = new Database(ANALYTICS_DB_PATH, { readonly: false, timeout: 30000 })
    this.operationalDb = new Database(OPERATIONAL_DB_PATH, { readonly: true, timeout: 30000 })
  }

  private clearDateRange() {
    console.log(`\n🧹 기존 7-10월 데이터 삭제 중...`)
    const deleteStmt = this.analyticsDb.prepare(`
      DELETE FROM master_events_table
      WHERE date >= '2025-07-01' AND date <= '2025-10-31'
    `)
    const result = deleteStmt.run()
    console.log(`   ✅ ${result.changes}개 레코드 삭제 완료\n`)
  }

  private determineState(tagCode: string): string {
    switch (tagCode) {
      case 'T2': case 'T3': return '출입'
      case 'M1': case 'M2': return '식사'
      case 'G3': return '회의'
      case 'G4': return '교육'
      case 'N1': case 'N2': return '휴식'
      case 'O': return '업무'
      default: return '업무'
    }
  }

  private determineJudgment(tagCode: string, hour: number): string {
    const state = this.determineState(tagCode)
    if (state === '식사' || state === '휴식') return '비업무'
    if (state === '출입') return '이동'
    if (hour >= 9 && hour <= 18) return '업무'
    return '연장업무'
  }

  private calculateBaseConfidence(tagCode: string): number {
    switch (tagCode) {
      case 'O': case 'M1': case 'M2': case 'T2': case 'T3': return 1.0
      case 'G3': case 'G4': return 0.95
      case 'G2': return 0.90
      case 'G1': return 0.85
      case 'N1': case 'N2': return 0.90
      case 'T1': return 0.85
      default: return 0.85
    }
  }

  private generateCode(name: string): string {
    if (!name) return ''
    return name.replace(/[^a-zA-Z0-9가-힣]/g, '').toUpperCase()
  }

  private getWeekNumber(date: Date): number {
    const onejan = new Date(date.getFullYear(), 0, 1)
    return Math.ceil((((date.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7)
  }

  async run() {
    const startTime = Date.now()

    try {
      // 1. 기존 데이터 삭제
      this.clearDateRange()

      console.log(`🚀 7-10월 Tag Data 마이그레이션 시작\n`)
      console.log(`   포함: tag_data만`)
      console.log(`   제외: meal, knox, equipment 모두\n`)

      // 2. 날짜 범위 생성
      const dates = this.getDateRange(this.startDate, this.endDate)
      let totalEvents = 0
      let processedEmployees = 0
      const uniqueEmployees = new Set<number>()

      // 3. INSERT 준비
      const insert = this.analyticsDb.prepare(`
        INSERT INTO master_events_table (
          timestamp, date, year, month, week, day_of_week, hour, minute,
          employee_id, employee_name,
          center_code, center_name, division_code, division_name,
          team_code, team_name, group_code, group_name,
          tag_code, tag_name, tag_location,
          state, judgment, base_confidence, final_confidence,
          data_source
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?
        )
      `)

      // 4. 날짜별 처리
      for (let dateIndex = 0; dateIndex < dates.length; dateIndex++) {
        const date = dates[dateIndex]
        const dateInt = parseInt(date)
        const formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`

        // Tag data 조회
        const tagData = this.operationalDb.prepare(`
          SELECT
            SUBSTR(td.ENTE_DT, 1, 4) || '-' ||
            SUBSTR(td.ENTE_DT, 5, 2) || '-' ||
            SUBSTR(td.ENTE_DT, 7, 2) || ' ' ||
            SUBSTR('000000' || td.출입시각, -6, 2) || ':' ||
            SUBSTR('000000' || td.출입시각, -4, 2) || ':' ||
            SUBSTR('000000' || td.출입시각, -2, 2) as timestamp,
            td.사번 as employee_id,
            td.NAME as employee_name,
            td.DR_NM as location,
            td.CENTER,
            CASE WHEN td.BU = '-' THEN NULL ELSE td.BU END as division,
            td.TEAM,
            CASE WHEN td.GROUP_A = '-' THEN NULL ELSE td.GROUP_A END as group_name,
            COALESCE(tlm.Tag_Code,
              CASE
                WHEN td.DR_NM LIKE '%식당%' THEN 'M1'
                WHEN td.DR_NM LIKE '%정문%' AND td.INOUT_GB = '입문' THEN 'T2'
                WHEN td.DR_NM LIKE '%정문%' AND td.INOUT_GB = '출문' THEN 'T3'
                WHEN td.DR_NM LIKE '%휴게%' THEN 'N1'
                WHEN td.DR_NM LIKE '%회의%' THEN 'G3'
                ELSE 'G1'
              END
            ) as tag_code
          FROM tag_data td
          LEFT JOIN tag_location_master tlm ON td.DR_NM = tlm.게이트명
          WHERE td.ENTE_DT = ?
          ORDER BY td.사번, td.출입시각
        `).all(dateInt) as any[]

        // Batch insert
        const insertBatch = this.analyticsDb.transaction(() => {
          for (const event of tagData) {
            const timestamp = new Date(event.timestamp)
            const tagCode = event.tag_code || 'G1'
            const state = this.determineState(tagCode)
            const judgment = this.determineJudgment(tagCode, timestamp.getHours())
            const baseConfidence = this.calculateBaseConfidence(tagCode)

            insert.run(
              timestamp.toISOString(),
              timestamp.toISOString().split('T')[0],
              timestamp.getFullYear(),
              timestamp.getMonth() + 1,
              this.getWeekNumber(timestamp),
              timestamp.getDay(),
              timestamp.getHours(),
              timestamp.getMinutes(),

              event.employee_id,
              event.employee_name,

              this.generateCode(event.CENTER || ''),
              event.CENTER || '',
              event.division ? this.generateCode(event.division) : null,
              event.division || null,
              this.generateCode(event.TEAM || ''),
              event.TEAM || '',
              event.group_name ? this.generateCode(event.group_name) : null,
              event.group_name || null,

              tagCode,
              event.location,
              event.location,

              state,
              judgment,
              baseConfidence,
              baseConfidence,

              'tag'
            )
          }
        })

        insertBatch()

        totalEvents += tagData.length
        const employeesInDate = new Set(tagData.map((e: any) => e.employee_id))
        processedEmployees += employeesInDate.size
        employeesInDate.forEach(id => uniqueEmployees.add(id))

        // 진행 상황 출력
        console.log(`📅 ${formattedDate} (${dateIndex + 1}/${dates.length}일) - ${employeesInDate.size}명, ${tagData.length.toLocaleString()}개 이벤트`)

        // 10일마다 중간 통계
        if ((dateIndex + 1) % 10 === 0) {
          console.log(`   ⏱️  중간 집계: ${totalEvents.toLocaleString()}개 이벤트, ${uniqueEmployees.size}명\n`)
        }
      }

      const duration = Date.now() - startTime

      // 최종 통계
      console.log(`\n✅ 마이그레이션 완료!`)
      console.log(`  • 총 이벤트: ${totalEvents.toLocaleString()}개`)
      console.log(`  • 직원 수: ${uniqueEmployees.size}명`)
      console.log(`  • 기간: ${dates.length}일`)
      console.log(`  • 소요 시간: ${(duration / 1000).toFixed(1)}초\n`)

      return {
        success: true,
        totalEvents,
        uniqueEmployees: uniqueEmployees.size,
        duration
      }

    } catch (error) {
      console.error('❌ 마이그레이션 오류:', error)
      throw error
    } finally {
      this.close()
    }
  }

  private getDateRange(start: string, end: string): string[] {
    const dates = []
    const startDate = new Date(
      parseInt(start.substring(0, 4)),
      parseInt(start.substring(4, 6)) - 1,
      parseInt(start.substring(6, 8))
    )
    const endDate = new Date(
      parseInt(end.substring(0, 4)),
      parseInt(end.substring(4, 6)) - 1,
      parseInt(end.substring(6, 8))
    )

    const current = new Date(startDate)
    while (current <= endDate) {
      const dateStr = current.getFullYear().toString() +
                     (current.getMonth() + 1).toString().padStart(2, '0') +
                     current.getDate().toString().padStart(2, '0')
      dates.push(dateStr)
      current.setDate(current.getDate() + 1)
    }

    return dates
  }

  private close() {
    this.analyticsDb.close()
    this.operationalDb.close()
  }
}

// 실행
async function main() {
  const migrator = new TagOnlyMigrator('20250701', '20251031')
  await migrator.run()
  process.exit(0)
}

main().catch((error) => {
  console.error('오류:', error)
  process.exit(1)
})
