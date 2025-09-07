#!/usr/bin/env tsx
/**
 * 완전한 Master Database 마이그레이션 - TagEnricher 로직 완전 구현
 * 모든 태그 소스 통합: tag_data + meal_data + knox_pims + knox_mail + knox_approval + equipment
 * 실행: npx tsx scripts/migrate-complete-master.ts [start_date] [end_date]
 */

import Database from 'better-sqlite3'
import path from 'path'

const ANALYTICS_DB_PATH = path.join(process.cwd(), 'sambio_analytics.db')
const OPERATIONAL_DB_PATH = path.join(process.cwd(), 'sambio_human.db')

interface TagEvent {
  timestamp: Date
  employee_id: number
  employee_name: string
  tag_code: string
  location: string
  source: string
  duration?: number
  center: string
  division?: string
  team: string
  group?: string
}

class CompleteMasterMigrator {
  private analyticsDb: Database.Database
  private operationalDb: Database.Database
  private startDate: string
  private endDate: string

  constructor(startDate?: string, endDate?: string) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    this.startDate = startDate || yesterday.toISOString().split('T')[0].replace(/-/g, '')
    this.endDate = endDate || this.startDate

    console.log(`🚀 완전한 Master DB 마이그레이션 시작: ${this.startDate} ~ ${this.endDate}`)

    this.analyticsDb = new Database(ANALYTICS_DB_PATH, { readonly: false })
    this.operationalDb = new Database(OPERATIONAL_DB_PATH, { readonly: true })

    // 기존 데이터 초기화 (완전히 새로 구성)
    this.clearMasterTable()
  }

  private clearMasterTable() {
    console.log('🧹 기존 Master Table 데이터 초기화 중...')
    this.analyticsDb.exec('DELETE FROM master_events_table')
    console.log('✅ 초기화 완료')
  }

  /**
   * 1. 위치명 → 태그코드 매핑 (TagEnricher 로직 구현)
   */
  private locationToTagCode(location: string): string {
    if (!location) return 'G1'
    
    const lowerLocation = location.toLowerCase()
    
    // G codes (work areas)
    if (lowerLocation.includes('회의') || lowerLocation.includes('meeting')) {
      return 'G3'
    }
    if (lowerLocation.includes('교육') || lowerLocation.includes('강의') || lowerLocation.includes('univ')) {
      return 'G4'
    }
    if (lowerLocation.includes('locker') || lowerLocation.includes('락커') || 
        lowerLocation.includes('가우닝') || lowerLocation.includes('gowning') ||
        lowerLocation.includes('탈의') || lowerLocation.includes('경의') || 
        lowerLocation.includes('파우더')) {
      return 'G2'
    }
    
    // N codes (non-work areas)
    if (lowerLocation.includes('휴게') || lowerLocation.includes('모성') || 
        lowerLocation.includes('대기') || lowerLocation.includes('수면') || 
        lowerLocation.includes('탐배')) {
      return 'N1'
    }
    if (lowerLocation.includes('메디컬') || lowerLocation.includes('약국') || 
        lowerLocation.includes('휘트니스') || lowerLocation.includes('마용실') || 
        lowerLocation.includes('세탁소') || lowerLocation.includes('나눔')) {
      return 'N2'
    }
    
    // T codes (transit)
    if (lowerLocation.includes('복도') || lowerLocation.includes('브릿지') || 
        lowerLocation.includes('계단') || lowerLocation.includes('연결통로')) {
      return 'T1'
    }
    if (lowerLocation.includes('입문') || lowerLocation.includes('정문입') || 
        lowerLocation.includes('스피드게이트입')) {
      return 'T2'
    }
    if (lowerLocation.includes('출문') || lowerLocation.includes('정문출') || 
        lowerLocation.includes('스피드게이트출')) {
      return 'T3'
    }
    
    // Default to G1 (main work area)
    return 'G1'
  }

  /**
   * 2. 태그 데이터 수집 (Tag + Meal + Knox + Equipment 통합)
   */
  async enrichTagsForEmployee(employeeId: number, date: string): Promise<TagEvent[]> {
    const events: TagEvent[] = []
    const dateFormatted = this.formatDateForDB(date) // YYYY-MM-DD
    const dateInt = parseInt(date) // YYYYMMDD

    console.log(`  👤 직원 ${employeeId} 태그 수집 중...`)

    // 1. Tag Data 수집
    await this.collectTagData(events, employeeId, dateInt)

    // 2. Meal Data 수집  
    await this.collectMealData(events, employeeId, dateFormatted)

    // 3. Knox PIMS Data 수집
    await this.collectKnoxPimsData(events, employeeId, dateFormatted)

    // 4. Knox Mail Data 수집
    await this.collectKnoxMailData(events, employeeId, dateFormatted)

    // 5. Knox Approval Data 수집
    await this.collectKnoxApprovalData(events, employeeId, dateFormatted)

    // 6. Equipment Data 수집
    await this.collectEquipmentData(events, employeeId, dateFormatted)

    // 시간순 정렬
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    // 1분 이내 중복 제거 (TagEnricher 로직)
    const deduplicatedEvents = this.removeDuplicates(events)

    return deduplicatedEvents
  }

  private async collectTagData(events: TagEvent[], employeeId: number, dateInt: number) {
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
        td.BU as division,
        td.TEAM,
        td.GROUP_A as group_name,
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
      WHERE td.사번 = ? AND td.ENTE_DT = ?
      ORDER BY td.출입시각
    `).all(employeeId, dateInt)

    for (const tag of tagData) {
      const tagCode = tag.tag_code || this.locationToTagCode(tag.location)
      
      events.push({
        timestamp: new Date(tag.timestamp),
        employee_id: tag.employee_id,
        employee_name: tag.employee_name,
        tag_code: tagCode,
        location: tag.location,
        source: 'tag',
        center: tag.CENTER || '',
        division: tag.division === '-' ? undefined : tag.division,
        team: tag.TEAM || '',
        group: tag.group_name === '-' ? undefined : tag.group_name
      })
    }
  }

  private async collectMealData(events: TagEvent[], employeeId: number, date: string) {
    const mealData = this.operationalDb.prepare(`
      SELECT 
        취식일시 as timestamp,
        사번 as employee_id,
        성명 as employee_name,
        식당명 as cafeteria,
        식사구분명 as meal_type,
        테이크아웃 as takeout,
        배식구 as serving_point
      FROM meal_data
      WHERE 사번 = ? AND DATE(취식일시) = ?
      ORDER BY 취식일시
    `).all(String(employeeId), date)

    for (const meal of mealData) {
      // M1(구내식당 30분) vs M2(테이크아웃 10분) 판정
      const isTakeout = meal.takeout === 'Y' || 
                       (meal.serving_point && meal.serving_point.includes('테이크아웃'))
      
      const tagCode = isTakeout ? 'M2' : 'M1'
      const duration = isTakeout ? 10 : 30

      events.push({
        timestamp: new Date(meal.timestamp),
        employee_id: parseInt(meal.employee_id),
        employee_name: meal.employee_name,
        tag_code: tagCode,
        location: meal.cafeteria,
        source: 'meal',
        duration: duration,
        center: '', // 조직 정보는 tag_data에서 가져옴
        team: ''
      })
    }
  }

  private async collectKnoxPimsData(events: TagEvent[], employeeId: number, date: string) {
    const knoxData = this.operationalDb.prepare(`
      SELECT 
        employee_id,
        meeting_id,
        meeting_type,
        start_time,
        end_time
      FROM knox_pims_data
      WHERE employee_id = ? AND DATE(start_time) = ?
      ORDER BY start_time
    `).all(String(employeeId), date)

    for (const knox of knoxData) {
      // G3(회의) vs G4(교육) 판정
      const tagCode = (knox.meeting_type.includes('회의') || knox.meeting_type.includes('보고')) 
        ? 'G3' 
        : knox.meeting_type.includes('교육') 
        ? 'G4' 
        : 'G1'

      const duration = knox.end_time 
        ? Math.floor((new Date(knox.end_time).getTime() - new Date(knox.start_time).getTime()) / 60000)
        : undefined

      events.push({
        timestamp: new Date(knox.start_time),
        employee_id: parseInt(knox.employee_id),
        employee_name: '',
        tag_code: tagCode,
        location: `Knox PIMS: ${knox.meeting_type}`,
        source: 'knox',
        duration: duration,
        center: '',
        team: ''
      })
    }
  }

  private async collectKnoxMailData(events: TagEvent[], employeeId: number, date: string) {
    const mailData = this.operationalDb.prepare(`
      SELECT 
        발신일시_GMT9 as timestamp,
        CAST(발신인사번_text AS INTEGER) as employee_id,
        메일key as mail_id
      FROM knox_mail_data
      WHERE CAST(발신인사번_text AS INTEGER) = ? AND DATE(발신일시_GMT9) = ?
      ORDER BY 발신일시_GMT9
    `).all(employeeId, date)

    for (const mail of mailData) {
      events.push({
        timestamp: new Date(mail.timestamp),
        employee_id: mail.employee_id,
        employee_name: '',
        tag_code: 'O', // Knox Mail = 업무 확정
        location: 'Knox: Mail',
        source: 'equipment', // O태그로 분류
        center: '',
        team: ''
      })
    }
  }

  private async collectKnoxApprovalData(events: TagEvent[], employeeId: number, date: string) {
    const approvalData = this.operationalDb.prepare(`
      SELECT 
        Timestamp as timestamp,
        UserNo as employee_id,
        APID as approval_id,
        Task as task
      FROM knox_approval_data
      WHERE UserNo = ? AND DATE(Timestamp) = ?
      ORDER BY Timestamp
    `).all(employeeId, date)

    for (const approval of approvalData) {
      events.push({
        timestamp: new Date(approval.timestamp),
        employee_id: approval.employee_id,
        employee_name: '',
        tag_code: 'O', // Knox Approval = 업무 확정
        location: 'Knox: Approval',
        source: 'equipment',
        center: '',
        team: ''
      })
    }
  }

  private async collectEquipmentData(events: TagEvent[], employeeId: number, date: string) {
    // Equipment 데이터는 현재 비어있음 - 향후 확장용 틀만 구성
    try {
      const equipmentData = this.operationalDb.prepare(`
        SELECT 
          timestamp,
          employee_id,
          action_type,
          application
        FROM equipment_data
        WHERE employee_id = ? AND DATE(timestamp) = ?
        ORDER BY timestamp
      `).all(String(employeeId), date)

      for (const equipment of equipmentData) {
        events.push({
          timestamp: new Date(equipment.timestamp),
          employee_id: parseInt(equipment.employee_id),
          employee_name: '',
          tag_code: 'O', // Equipment = 업무 확정
          location: `Equipment: ${equipment.application}`,
          source: 'equipment',
          center: '',
          team: ''
        })
      }
    } catch (error) {
      // Equipment 테이블이 비어있는 경우 무시
    }
  }

  /**
   * 3. 중복 제거 (1분 이내 동일 태그)
   */
  private removeDuplicates(events: TagEvent[]): TagEvent[] {
    if (events.length === 0) return []
    
    const result: TagEvent[] = [events[0]]
    
    for (let i = 1; i < events.length; i++) {
      const prev = result[result.length - 1]
      const curr = events[i]
      
      // 1분 이내 동일 태그는 스킵
      const timeDiff = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000
      if (timeDiff < 60 && prev.tag_code === curr.tag_code) {
        continue
      }
      
      result.push(curr)
    }
    
    return result
  }

  /**
   * 4. 직원별 조직 정보 보완
   */
  private async enrichEmployeeOrgInfo(events: TagEvent[]) {
    const employeeOrgMap = new Map()

    // 조직 정보가 있는 이벤트에서 직원 조직 매핑 구성
    for (const event of events) {
      if (event.center && event.team && !employeeOrgMap.has(event.employee_id)) {
        employeeOrgMap.set(event.employee_id, {
          center: event.center,
          division: event.division,
          team: event.team,
          group: event.group
        })
      }
    }

    // 조직 정보가 없는 이벤트에 보완
    for (const event of events) {
      if (!event.center && employeeOrgMap.has(event.employee_id)) {
        const orgInfo = employeeOrgMap.get(event.employee_id)
        event.center = orgInfo.center
        event.division = orgInfo.division
        event.team = orgInfo.team
        event.group = orgInfo.group
      }
    }
  }

  /**
   * 5. 상태 및 확신도 계산
   */
  private calculateStateAndConfidence(events: TagEvent[]) {
    for (let i = 0; i < events.length; i++) {
      const event = events[i]
      const nextEvent = i < events.length - 1 ? events[i + 1] : null

      // 지속시간 계산
      if (nextEvent && nextEvent.employee_id === event.employee_id) {
        const duration = Math.round((nextEvent.timestamp.getTime() - event.timestamp.getTime()) / (1000 * 60))
        if (!event.duration) {
          event.duration = duration
        }
      }

      // 상태 결정 (STATE_CLASSIFICATION.md 기반)
      const state = this.determineState(event.tag_code, event.timestamp)
      const judgment = this.determineJudgment(event.tag_code, state, event.timestamp)
      const baseConfidence = this.calculateBaseConfidence(event.tag_code, event.duration)

      // 추가 속성 설정
      ;(event as any).state = state
      ;(event as any).judgment = judgment
      ;(event as any).base_confidence = baseConfidence
      ;(event as any).final_confidence = baseConfidence
    }
  }

  private determineState(tagCode: string, timestamp: Date): string {
    switch (tagCode) {
      case 'T2':
      case 'T3': return '출입'
      case 'M1':
      case 'M2': return '식사'
      case 'G3': return '회의'
      case 'G4': return '교육'
      case 'N1': return '휴식'
      case 'N2': return '휴식'
      case 'O': return '업무'
      case 'G1':
      case 'G2':
      default: return '업무'
    }
  }

  private determineJudgment(tagCode: string, state: string, timestamp: Date): string {
    const hour = timestamp.getHours()
    
    if (state === '식사') return '비업무'
    if (state === '출입') return '이동'
    if (state === '휴식') return '비업무'
    if (hour >= 9 && hour <= 18) return '업무'
    if (hour >= 19 || hour <= 8) return '연장업무'
    return '업무'
  }

  private calculateBaseConfidence(tagCode: string, duration?: number): number {
    // STATE_CLASSIFICATION.md의 확신도 체계
    switch (tagCode) {
      case 'O':
      case 'M1':
      case 'M2':
      case 'T2':
      case 'T3':
        return 1.0
      case 'G3':
      case 'G4':
        return 0.95
      case 'G2':
        return 0.90
      case 'G1':
        if (!duration) return 0.85
        if (duration < 5) return 0.75
        if (duration < 15) return 0.85
        return 0.95
      case 'N1':
      case 'N2':
        return 0.90
      case 'T1':
        return 0.85
      default:
        return 0.85
    }
  }

  /**
   * 6. Master Table에 삽입
   */
  private async insertToMasterTable(events: TagEvent[]) {
    const insert = this.analyticsDb.prepare(`
      INSERT INTO master_events_table (
        timestamp, date, year, month, week, day_of_week, hour, minute,
        employee_id, employee_name,
        center_code, center_name, division_code, division_name,
        team_code, team_name, group_code, group_name,
        tag_code, tag_name, tag_type, tag_location,
        state, judgment, base_confidence, final_confidence,
        duration_minutes, data_source, sync_date
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `)

    const insertBatch = this.analyticsDb.transaction(() => {
      for (const event of events) {
        const timestamp = event.timestamp
        const eventAny = event as any

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

          this.generateCode(event.center),
          event.center,
          event.division ? this.generateCode(event.division) : null,
          event.division,
          this.generateCode(event.team),
          event.team,
          event.group ? this.generateCode(event.group) : null,
          event.group,

          event.tag_code,
          event.location,
          event.source,
          event.location,

          eventAny.state,
          eventAny.judgment,
          eventAny.base_confidence,
          eventAny.final_confidence,

          event.duration,
          event.source,
          new Date().toISOString().split('T')[0]
        )
      }
    })

    insertBatch()
  }

  /**
   * 7. 전체 마이그레이션 실행
   */
  async run() {
    try {
      const dates = this.getDateRange(this.startDate, this.endDate)
      let totalEvents = 0
      let processedEmployees = 0

      for (const date of dates) {
        console.log(`\n📅 ${date} 처리 중...`)

        // 해당 날짜에 데이터가 있는 직원들 조회
        const employees = this.getEmployeesForDate(date)
        
        for (const employeeId of employees) {
          // 직원별 태그 이벤트 수집
          const events = await this.enrichTagsForEmployee(employeeId, date)
          
          if (events.length === 0) continue

          // 조직 정보 보완
          await this.enrichEmployeeOrgInfo(events)

          // 상태 및 확신도 계산
          this.calculateStateAndConfidence(events)

          // Master Table에 삽입
          await this.insertToMasterTable(events)

          totalEvents += events.length
          processedEmployees++

          if (processedEmployees % 100 === 0) {
            console.log(`    ✓ ${processedEmployees}명 처리 완료 (총 ${totalEvents}개 이벤트)`)
          }
        }

        console.log(`  ✅ ${date}: ${employees.length}명, ${totalEvents}개 이벤트 처리`)
      }

      this.printStatistics()

    } catch (error) {
      console.error('❌ 마이그레이션 오류:', error)
      throw error
    } finally {
      this.close()
    }
  }

  // 유틸리티 메서드들
  private getEmployeesForDate(date: string): number[] {
    const dateInt = parseInt(date)
    const dateFormatted = this.formatDateForDB(date)

    const employees = new Set<number>()

    // Tag 데이터 직원들
    const tagEmployees = this.operationalDb.prepare(`
      SELECT DISTINCT 사번 FROM tag_data WHERE ENTE_DT = ?
    `).all(dateInt)
    tagEmployees.forEach((row: any) => employees.add(row.사번))

    // Meal 데이터 직원들
    const mealEmployees = this.operationalDb.prepare(`
      SELECT DISTINCT CAST(사번 AS INTEGER) as emp_id FROM meal_data WHERE DATE(취식일시) = ?
    `).all(dateFormatted)
    mealEmployees.forEach((row: any) => employees.add(row.emp_id))

    // Knox 데이터 직원들
    const knoxEmployees = this.operationalDb.prepare(`
      SELECT DISTINCT CAST(employee_id AS INTEGER) as emp_id FROM knox_pims_data WHERE DATE(start_time) = ?
    `).all(dateFormatted)
    knoxEmployees.forEach((row: any) => employees.add(row.emp_id))

    return Array.from(employees)
  }

  private formatDateForDB(dateStr: string): string {
    // YYYYMMDD -> YYYY-MM-DD
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
        SUM(CASE WHEN source = 'tag' THEN 1 ELSE 0 END) as tag_events,
        SUM(CASE WHEN source = 'meal' THEN 1 ELSE 0 END) as meal_events,
        SUM(CASE WHEN source = 'knox' THEN 1 ELSE 0 END) as knox_events,
        SUM(CASE WHEN source = 'equipment' THEN 1 ELSE 0 END) as equipment_events,
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
    console.log('\n🎉 완전한 Master Table 마이그레이션 완료!')
  }
}

// CLI 실행
if (require.main === module) {
  const [,, startDate, endDate] = process.argv
  const migrator = new CompleteMasterMigrator(startDate, endDate)
  migrator.run().catch(console.error)
}

export { CompleteMasterMigrator }