#!/usr/bin/env tsx
// @ts-nocheck
/**
 * 최적화된 완전한 Master Database 마이그레이션
 * 배치 처리 및 병렬 처리로 성능 향상
 */

import Database from 'better-sqlite3'
import path from 'path'

const ANALYTICS_DB_PATH = path.join(process.cwd(), 'sambio_analytics.db')
const OPERATIONAL_DB_PATH = path.join(process.cwd(), 'sambio_human.db')

class FastCompleteMigrator {
  private analyticsDb: Database.Database
  private operationalDb: Database.Database
  private startDate: string
  private endDate: string

  constructor(startDate?: string, endDate?: string) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    this.startDate = startDate || yesterday.toISOString().split('T')[0].replace(/-/g, '')
    this.endDate = endDate || this.startDate

    console.log(`🚀 최적화된 Master DB 마이그레이션 시작: ${this.startDate} ~ ${this.endDate}`)

    this.analyticsDb = new Database(ANALYTICS_DB_PATH, { readonly: false })
    this.operationalDb = new Database(OPERATIONAL_DB_PATH, { readonly: true })

    // 기존 데이터 초기화
    this.clearMasterTable()
  }

  private clearMasterTable() {
    console.log('🧹 기존 Master Table 데이터 초기화 중...')
    this.analyticsDb.exec('DELETE FROM master_events_table')
    console.log('✅ 초기화 완료')
  }

  /**
   * 태그코드 매핑 함수
   */
  private locationToTagCode(location: string): string {
    if (!location) return 'G1'
    
    const lowerLocation = location.toLowerCase()
    
    if (lowerLocation.includes('회의') || lowerLocation.includes('meeting')) return 'G3'
    if (lowerLocation.includes('교육') || lowerLocation.includes('강의')) return 'G4'
    if (lowerLocation.includes('locker') || lowerLocation.includes('락커') || 
        lowerLocation.includes('가우닝') || lowerLocation.includes('탈의')) return 'G2'
    if (lowerLocation.includes('휴게') || lowerLocation.includes('모성') || 
        lowerLocation.includes('대기')) return 'N1'
    if (lowerLocation.includes('메디컬') || lowerLocation.includes('약국')) return 'N2'
    if (lowerLocation.includes('복도') || lowerLocation.includes('계단')) return 'T1'
    if (lowerLocation.includes('입문') || lowerLocation.includes('정문입')) return 'T2'
    if (lowerLocation.includes('출문') || lowerLocation.includes('정문출')) return 'T3'
    
    return 'G1'
  }

  /**
   * 1. Tag Data 일괄 마이그레이션
   */
  async migrateTagData() {
    console.log('\n🏷️ Tag Data 마이그레이션 중...')

    const dates = this.getDateRange(this.startDate, this.endDate)
    
    for (const date of dates) {
      console.log(`  📅 ${date} Tag Data 처리 중...`)
      const dateInt = parseInt(date)
      const dateFormatted = this.formatDateForDB(date)

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
      `).all(dateInt)

      await this.insertTagEvents(tagData, 'tag')
      console.log(`    ✓ ${tagData.length}개 Tag 이벤트 처리`)
    }
  }

  /**
   * 2. Meal Data 일괄 마이그레이션
   */
  async migrateMealData() {
    console.log('\n🍽️ Meal Data 마이그레이션 중...')

    const dates = this.getDateRange(this.startDate, this.endDate)
    
    for (const date of dates) {
      console.log(`  📅 ${date} Meal Data 처리 중...`)
      const dateFormatted = this.formatDateForDB(date)

      const mealData = this.operationalDb.prepare(`
        SELECT 
          취식일시 as timestamp,
          CAST(사번 AS INTEGER) as employee_id,
          성명 as employee_name,
          식당명 as location,
          테이크아웃,
          배식구,
          '' as CENTER,
          NULL as division,
          '' as TEAM,
          NULL as group_name,
          CASE 
            WHEN 테이크아웃 = 'Y' OR 배식구 LIKE '%테이크아웃%' THEN 'M2'
            ELSE 'M1'
          END as tag_code
        FROM meal_data
        WHERE DATE(취식일시) = ?
          AND 사번 IS NOT NULL 
          AND 사번 != ''
          AND LENGTH(TRIM(사번)) > 0
        ORDER BY 사번, 취식일시
      `).all(dateFormatted)

      await this.insertTagEvents(mealData, 'meal')
      console.log(`    ✓ ${mealData.length}개 Meal 이벤트 처리`)
    }
  }

  /**
   * 3. Knox PIMS Data 일괄 마이그레이션
   */
  async migrateKnoxPimsData() {
    console.log('\n📅 Knox PIMS Data 마이그레이션 중...')

    const dates = this.getDateRange(this.startDate, this.endDate)
    
    for (const date of dates) {
      console.log(`  📅 ${date} Knox PIMS Data 처리 중...`)
      const dateFormatted = this.formatDateForDB(date)

      const knoxData = this.operationalDb.prepare(`
        SELECT 
          start_time as timestamp,
          CAST(employee_id AS INTEGER) as employee_id,
          '' as employee_name,
          'Knox PIMS: ' || meeting_type as location,
          '' as CENTER,
          NULL as division,
          '' as TEAM,
          NULL as group_name,
          CASE 
            WHEN meeting_type LIKE '%회의%' OR meeting_type LIKE '%보고%' THEN 'G3'
            WHEN meeting_type LIKE '%교육%' THEN 'G4'
            ELSE 'G1'
          END as tag_code
        FROM knox_pims_data
        WHERE DATE(start_time) = ?
          AND employee_id IS NOT NULL
          AND employee_id != ''
        ORDER BY employee_id, start_time
      `).all(dateFormatted)

      await this.insertTagEvents(knoxData, 'knox')
      console.log(`    ✓ ${knoxData.length}개 Knox PIMS 이벤트 처리`)
    }
  }

  /**
   * 4. Knox Mail Data 일괄 마이그레이션
   */
  async migrateKnoxMailData() {
    console.log('\n📧 Knox Mail Data 마이그레이션 중...')

    const dates = this.getDateRange(this.startDate, this.endDate)
    
    for (const date of dates) {
      console.log(`  📅 ${date} Knox Mail Data 처리 중...`)
      const dateFormatted = this.formatDateForDB(date)

      try {
        const mailData = this.operationalDb.prepare(`
          SELECT 
            발신일시_GMT9 as timestamp,
            CAST(발신인사번_text AS INTEGER) as employee_id,
            '' as employee_name,
            'Knox: Mail' as location,
            '' as CENTER,
            NULL as division,
            '' as TEAM,
            NULL as group_name,
            'O' as tag_code
          FROM knox_mail_data
          WHERE DATE(발신일시_GMT9) = ?
          ORDER BY CAST(발신인사번_text AS INTEGER), 발신일시_GMT9
        `).all(dateFormatted)

        await this.insertTagEvents(mailData, 'equipment')
        console.log(`    ✓ ${mailData.length}개 Knox Mail 이벤트 처리`)
      } catch (error) {
        console.log(`    ⚠️ Knox Mail 데이터 없음`)
      }
    }
  }

  /**
   * 5. Equipment Data 일괄 마이그레이션 (EQUIS, MES, MDS, EAM, LAMS)
   */
  async migrateEquipmentData() {
    console.log('\n⚙️ Equipment Data 마이그레이션 중...')

    const dates = this.getDateRange(this.startDate, this.endDate)
    
    for (const date of dates) {
      console.log(`  📅 ${date} Equipment Data 처리 중...`)
      const dateFormatted = this.formatDateForDB(date)

      // EQUIS Data
      const equisData = await this.getEquipmentSystemData('equis_data', 'Timestamp', '"USERNO( ID->사번매칭 )"', 'EQUIS', dateFormatted)
      
      // MES Data  
      const mesData = await this.getEquipmentSystemData('mes_data', 'login_time', 'USERNo', 'MES', dateFormatted)
      
      // MDM Data
      const mdmData = await this.getEquipmentSystemData('mdm_data', 'Timestap', 'UserNo', 'MDM', dateFormatted)
      
      // EAM Data
      const eamData = await this.getEquipmentSystemData('eam_data', 'ATTEMPTDATE', 'USERNO', 'EAM', dateFormatted)
      
      // LAMS Data  
      const lamsData = await this.getEquipmentSystemData('lams_data', 'DATE', 'User_No', 'LAMS', dateFormatted, true)

      const allEquipmentData = [...equisData, ...mesData, ...mdmData, ...eamData, ...lamsData]
      
      await this.insertTagEvents(allEquipmentData, 'equipment')
      console.log(`    ✓ ${allEquipmentData.length}개 Equipment 이벤트 처리 (EQUIS:${equisData.length}, MES:${mesData.length}, MDM:${mdmData.length}, EAM:${eamData.length}, LAMS:${lamsData.length})`)
    }
  }

  private async getEquipmentSystemData(tableName: string, timestampCol: string, userCol: string, systemName: string, date: string, isLamsDate: boolean = false): Promise<any[]> {
    try {
      let query = ''
      if (isLamsDate) {
        // LAMS는 DATE 컬럼이 문자열 형태
        query = `
          SELECT 
            ${timestampCol} as timestamp,
            CAST(${userCol} AS INTEGER) as employee_id,
            '' as employee_name,
            'Equipment: ${systemName}' as location,
            '' as CENTER,
            NULL as division,
            '' as TEAM,
            NULL as group_name,
            'O' as tag_code
          FROM ${tableName}
          WHERE ${timestampCol} LIKE ?
            AND ${userCol} IS NOT NULL
            AND ${userCol} != ''
          ORDER BY ${userCol}, ${timestampCol}
        `
        return this.operationalDb.prepare(query).all(`${date}%`)
      } else {
        query = `
          SELECT 
            ${timestampCol} as timestamp,
            CAST(${userCol} AS INTEGER) as employee_id,
            '' as employee_name,
            'Equipment: ${systemName}' as location,
            '' as CENTER,
            NULL as division,
            '' as TEAM,
            NULL as group_name,
            'O' as tag_code
          FROM ${tableName}
          WHERE DATE(${timestampCol}) = ?
            AND ${userCol} IS NOT NULL
            AND ${userCol} != ''
          ORDER BY ${userCol}, ${timestampCol}
        `
        return this.operationalDb.prepare(query).all(date)
      }
    } catch (error) {
      console.log(`    ⚠️ ${systemName} 데이터 처리 오류:`, error)
      return []
    }
  }

  /**
   * 6. Knox Approval Data 일괄 마이그레이션
   */
  async migrateKnoxApprovalData() {
    console.log('\n✅ Knox Approval Data 마이그레이션 중...')

    const dates = this.getDateRange(this.startDate, this.endDate)
    
    for (const date of dates) {
      console.log(`  📅 ${date} Knox Approval Data 처리 중...`)
      const dateFormatted = this.formatDateForDB(date)

      try {
        const approvalData = this.operationalDb.prepare(`
          SELECT 
            Timestamp as timestamp,
            UserNo as employee_id,
            '' as employee_name,
            'Knox: Approval' as location,
            '' as CENTER,
            NULL as division,
            '' as TEAM,
            NULL as group_name,
            'O' as tag_code
          FROM knox_approval_data
          WHERE DATE(Timestamp) = ?
          ORDER BY UserNo, Timestamp
        `).all(dateFormatted)

        await this.insertTagEvents(approvalData, 'equipment')
        console.log(`    ✓ ${approvalData.length}개 Knox Approval 이벤트 처리`)
      } catch (error) {
        console.log(`    ⚠️ Knox Approval 데이터 없음`)
      }
    }
  }

  /**
   * 이벤트 일괄 삽입
   */
  private async insertTagEvents(events: any[], source: string) {
    if (events.length === 0) return

    const insert = this.analyticsDb.prepare(`
      INSERT INTO master_events_table (
        timestamp, date, year, month, week, day_of_week, hour, minute,
        employee_id, employee_name,
        center_code, center_name, division_code, division_name,
        team_code, team_name, group_code, group_name,
        tag_code, tag_name, tag_type, tag_location,
        state, judgment, base_confidence, final_confidence,
        data_source, sync_date
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `)

    const insertBatch = this.analyticsDb.transaction(() => {
      for (const event of events) {
        const timestamp = new Date(event.timestamp)
        const tagCode = event.tag_code || this.locationToTagCode(event.location)
        
        // 상태 및 확신도 계산
        const state = this.determineState(tagCode)
        const judgment = this.determineJudgment(tagCode, timestamp)
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
          event.employee_name || '',

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
          source,
          event.location,

          state,
          judgment,
          baseConfidence,
          baseConfidence,

          source,
          new Date().toISOString().split('T')[0]
        )
      }
    })

    insertBatch()
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

  private determineJudgment(tagCode: string, timestamp: Date): string {
    const hour = timestamp.getHours()
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

  /**
   * 전체 마이그레이션 실행
   */
  async run() {
    try {
      // 순차적으로 각 데이터 소스 마이그레이션
      await this.migrateTagData()
      await this.migrateMealData()
      await this.migrateKnoxPimsData()
      await this.migrateKnoxMailData()
      await this.migrateEquipmentData()
      await this.migrateKnoxApprovalData()

      this.printStatistics()

    } catch (error) {
      console.error('❌ 마이그레이션 오류:', error)
      throw error
    } finally {
      this.close()
    }
  }

  // 유틸리티 메서드들
  private formatDateForDB(dateStr: string): string {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
  }

  private generateCode(name: string): string {
    if (!name) return ''
    return name.replace(/[^a-zA-Z0-9가-힣]/g, '').toUpperCase()
  }

  private getWeekNumber(date: Date): number {
    const onejan = new Date(date.getFullYear(), 0, 1)
    return Math.ceil((((date.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7)
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

  private printStatistics() {
    console.log('\n📈 완전한 Master Table 통계:')
    
    const stats = this.analyticsDb.prepare(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(DISTINCT employee_id) as unique_employees,
        COUNT(DISTINCT date) as unique_dates,
        SUM(CASE WHEN data_source = 'tag' THEN 1 ELSE 0 END) as tag_events,
        SUM(CASE WHEN data_source = 'meal' THEN 1 ELSE 0 END) as meal_events,
        SUM(CASE WHEN data_source = 'knox' THEN 1 ELSE 0 END) as knox_events,
        SUM(CASE WHEN data_source = 'equipment' THEN 1 ELSE 0 END) as equipment_events,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM master_events_table
    `).get()

    console.log(`  • 총 이벤트: ${stats.total_events?.toLocaleString()}개`)
    console.log(`    - Tag 이벤트: ${stats.tag_events?.toLocaleString()}개`)
    console.log(`    - Meal 이벤트: ${stats.meal_events?.toLocaleString()}개`)
    console.log(`    - Knox 이벤트: ${stats.knox_events?.toLocaleString()}개`)
    console.log(`    - Equipment 이벤트: ${stats.equipment_events?.toLocaleString()}개`)
    console.log(`  • 직원 수: ${stats.unique_employees}명`)
    console.log(`  • 날짜 범위: ${stats.earliest_date} ~ ${stats.latest_date}`)
    console.log(`  • 기간: ${stats.unique_dates}일`)
  }

  private close() {
    this.analyticsDb.close()
    this.operationalDb.close()
    console.log('\n🎉 최적화된 Master Table 마이그레이션 완료!')
  }
}

// CLI 실행
if (require.main === module) {
  const [,, startDate, endDate] = process.argv
  const migrator = new FastCompleteMigrator(startDate, endDate)
  migrator.run().catch(console.error)
}

export { FastCompleteMigrator }