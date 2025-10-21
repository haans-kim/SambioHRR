#!/usr/bin/env tsx
// @ts-nocheck
/**
 * 운영 DB에서 Master DB로 데이터 마이그레이션
 * 실행: npx tsx scripts/migrate-to-master.ts [start_date] [end_date]
 */

import Database from 'better-sqlite3'
import path from 'path'

const ANALYTICS_DB_PATH = path.join(process.cwd(), 'sambio_analytics.db')
const OPERATIONAL_DB_PATH = path.join(process.cwd(), 'sambio_human.db')

interface TagEvent {
  employee_id: number
  employee_name: string
  center: string
  team: string
  group: string
  timestamp: Date
  date: string
  tag_location: string
  tag_type: string
  inout_type: string
}

class DataMigrator {
  private analyticsDb: Database.Database
  private operationalDb: Database.Database
  private startDate: string
  private endDate: string

  constructor(startDate?: string, endDate?: string) {
    // 기본값: 어제 데이터
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    this.startDate = startDate || yesterday.toISOString().split('T')[0].replace(/-/g, '')
    this.endDate = endDate || this.startDate

    console.log(`🚀 데이터 마이그레이션 시작: ${this.startDate} ~ ${this.endDate}`)

    this.analyticsDb = new Database(ANALYTICS_DB_PATH, { readonly: false })
    this.operationalDb = new Database(OPERATIONAL_DB_PATH, { readonly: true })
  }

  /**
   * 1. 조직 구조 마이그레이션
   */
  async migrateOrganizationStructure() {
    console.log('\n📊 조직 구조 마이그레이션 중...')

    // 운영 DB에서 조직 구조 추출
    const organizations = this.operationalDb.prepare(`
      SELECT DISTINCT
        CENTER,
        CASE WHEN BU = '-' OR BU = '' THEN NULL ELSE BU END as division,
        TEAM as team,
        CASE WHEN GROUP_A = '-' OR GROUP_A = '' THEN NULL ELSE GROUP_A END as group_name,
        COUNT(DISTINCT 사번) as employee_count
      FROM tag_data 
      WHERE ENTE_DT BETWEEN ? AND ?
        AND CENTER IS NOT NULL 
        AND CENTER != ''
        AND TEAM IS NOT NULL
        AND TEAM != ''
      GROUP BY CENTER, BU, TEAM, GROUP_A
      ORDER BY CENTER, BU, TEAM, GROUP_A
    `).all(this.startDate, this.endDate)

    // Master DB에 조직 구조 저장
    const insertOrg = this.analyticsDb.prepare(`
      INSERT OR REPLACE INTO organization_hierarchy (
        center_code, center_name,
        division_code, division_name, 
        team_code, team_name,
        group_code, group_name,
        hierarchy_level, full_path,
        total_employees, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `)

    let orgCount = 0
    for (const org of organizations) {
      const centerCode = this.generateCode(org.CENTER)
      const divisionCode = org.division ? this.generateCode(org.division) : null
      const teamCode = this.generateCode(org.TEAM)
      const groupCode = org.group_name ? this.generateCode(org.group_name) : null
      
      const hierarchyLevel = groupCode ? 4 : (divisionCode ? 3 : 2)
      const fullPath = [org.CENTER, org.division, org.TEAM, org.group_name]
        .filter(Boolean).join('/')

      insertOrg.run(
        centerCode, org.CENTER,
        divisionCode, org.division,
        teamCode, org.TEAM,
        groupCode, org.group_name,
        hierarchyLevel, fullPath,
        org.employee_count
      )
      orgCount++
    }

    console.log(`✅ 조직 구조 ${orgCount}개 마이그레이션 완료`)
  }

  /**
   * 2. 직원 프로필 마이그레이션
   */
  async migrateEmployeeProfiles() {
    console.log('\n👥 직원 프로필 마이그레이션 중...')

    const employees = this.operationalDb.prepare(`
      SELECT DISTINCT
        사번 as employee_id,
        NAME as employee_name,
        CENTER,
        CASE WHEN BU = '-' OR BU = '' THEN NULL ELSE BU END as division,
        TEAM,
        CASE WHEN GROUP_A = '-' OR GROUP_A = '' THEN NULL ELSE GROUP_A END as group_name,
        PART
      FROM tag_data 
      WHERE ENTE_DT BETWEEN ? AND ?
        AND 사번 IS NOT NULL 
        AND NAME IS NOT NULL
        AND NAME != ''
      ORDER BY 사번
    `).all(this.startDate, this.endDate)

    const insertEmployee = this.analyticsDb.prepare(`
      INSERT OR REPLACE INTO employee_profiles (
        employee_id, employee_name,
        center_code, division_code, team_code, group_code,
        job_group, work_type, is_flexible_work,
        last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'regular', 0, CURRENT_TIMESTAMP)
    `)

    for (const emp of employees) {
      const centerCode = this.generateCode(emp.CENTER)
      const divisionCode = emp.division ? this.generateCode(emp.division) : null
      const teamCode = this.generateCode(emp.TEAM)
      const groupCode = emp.group_name ? this.generateCode(emp.group_name) : null

      // 직무 구분 (임시 로직)
      const jobGroup = emp.PART?.includes('생산') ? '생산직' : 
                     emp.PART?.includes('연구') ? '연구직' : '지원직'

      insertEmployee.run(
        emp.employee_id, emp.employee_name,
        centerCode, divisionCode, teamCode, groupCode,
        jobGroup
      )
    }

    console.log(`✅ 직원 프로필 ${employees.length}개 마이그레이션 완료`)
  }

  /**
   * 3. 태그 이벤트 데이터 마이그레이션 (메인)
   */
  async migrateTagEvents() {
    console.log('\n🏷️ 태그 이벤트 마이그레이션 중...')

    // 일자별로 처리 (메모리 효율성)
    const dates = this.getDateRange(this.startDate, this.endDate)
    let totalEvents = 0

    for (const date of dates) {
      console.log(`  📅 ${date} 처리 중...`)
      
      // 해당 날짜의 태그 데이터 조회
      const events = this.operationalDb.prepare(`
        SELECT 
          사번 as employee_id,
          NAME as employee_name,
          CENTER,
          CASE WHEN BU = '-' OR BU = '' THEN NULL ELSE BU END as division,
          TEAM,
          CASE WHEN GROUP_A = '-' OR GROUP_A = '' THEN NULL ELSE GROUP_A END as group_name,
          ENTE_DT as date_int,
          출입시각 as time_int,
          DR_NM as location,
          DR_GB as location_type,
          INOUT_GB as inout_type
        FROM tag_data 
        WHERE ENTE_DT = ?
          AND 사번 IS NOT NULL
          AND 출입시각 IS NOT NULL
          AND NAME IS NOT NULL
          AND NAME != ''
        ORDER BY 사번, 출입시각
      `).all(date)

      if (events.length === 0) continue

      // Master DB 이벤트 형태로 변환 및 저장
      const processedEvents = this.processEvents(events)
      this.insertEvents(processedEvents)
      
      totalEvents += processedEvents.length
      console.log(`    ✓ ${processedEvents.length}개 이벤트 처리`)
    }

    console.log(`✅ 총 ${totalEvents}개 태그 이벤트 마이그레이션 완료`)
  }

  /**
   * 4. 태그 이벤트 처리 (상태 머신 로직 적용)
   */
  private processEvents(rawEvents: any[]): any[] {
    const processed = []

    for (let i = 0; i < rawEvents.length; i++) {
      const event = rawEvents[i]
      const prevEvent = i > 0 ? rawEvents[i-1] : null
      const nextEvent = i < rawEvents.length - 1 ? rawEvents[i+1] : null

      // 타임스탬프 변환
      const timestamp = this.convertTimestamp(event.date_int, event.time_int)
      const date = this.formatDate(event.date_int)

      // 태그 코드 생성 (위치 기반)
      const tagCode = this.generateTagCode(event.location, event.location_type)
      
      // 상태 및 판정 결정
      const state = this.determineState(tagCode, event.inout_type)
      const judgment = this.determineJudgment(state, timestamp)
      
      // 기본 신뢰도 계산
      const baseConfidence = this.calculateBaseConfidence(tagCode, state)
      
      // 지속시간 계산
      const durationMinutes = nextEvent && nextEvent.employee_id === event.employee_id
        ? this.calculateDuration(event.time_int, nextEvent.time_int)
        : null

      processed.push({
        timestamp,
        date,
        year: timestamp.getFullYear(),
        month: timestamp.getMonth() + 1,
        week: this.getWeekNumber(timestamp),
        day_of_week: timestamp.getDay(),
        hour: timestamp.getHours(),
        minute: timestamp.getMinutes(),

        employee_id: event.employee_id,
        employee_name: event.employee_name,
        
        center_code: this.generateCode(event.CENTER),
        center_name: event.CENTER,
        division_code: event.division ? this.generateCode(event.division) : null,
        division_name: event.division,
        team_code: this.generateCode(event.TEAM),
        team_name: event.TEAM,
        group_code: event.group_name ? this.generateCode(event.group_name) : null,
        group_name: event.group_name,

        tag_code: tagCode,
        tag_name: event.location,
        tag_type: event.location_type,
        tag_location: event.location,

        state,
        judgment,
        base_confidence: baseConfidence,
        final_confidence: baseConfidence, // 초기값

        prev_tag_code: prevEvent ? this.generateTagCode(prevEvent.location, prevEvent.location_type) : null,
        next_tag_code: nextEvent ? this.generateTagCode(nextEvent.location, nextEvent.location_type) : null,
        duration_minutes: durationMinutes,

        data_source: 'migration',
        sync_date: new Date().toISOString().split('T')[0]
      })
    }

    return processed
  }

  /**
   * 5. 이벤트 일괄 삽입
   */
  private insertEvents(events: any[]) {
    const insert = this.analyticsDb.prepare(`
      INSERT INTO master_events_table (
        timestamp, date, year, month, week, day_of_week, hour, minute,
        employee_id, employee_name,
        center_code, center_name, division_code, division_name,
        team_code, team_name, group_code, group_name,
        tag_code, tag_name, tag_type, tag_location,
        state, judgment, base_confidence, final_confidence,
        prev_tag_code, next_tag_code, duration_minutes,
        data_source, sync_date
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `)

    const insertMany = this.analyticsDb.transaction(() => {
      for (const event of events) {
        insert.run(
          event.timestamp.toISOString(), event.date, event.year, event.month,
          event.week, event.day_of_week, event.hour, event.minute,
          event.employee_id, event.employee_name,
          event.center_code, event.center_name, event.division_code, event.division_name,
          event.team_code, event.team_name, event.group_code, event.group_name,
          event.tag_code, event.tag_name, event.tag_type, event.tag_location,
          event.state, event.judgment, event.base_confidence, event.final_confidence,
          event.prev_tag_code, event.next_tag_code, event.duration_minutes,
          event.data_source, event.sync_date
        )
      }
    })

    insertMany()
  }

  // 유틸리티 메서드들
  private generateCode(name: string): string {
    if (!name) return ''
    return name.replace(/[^a-zA-Z0-9가-힣]/g, '').toUpperCase()
  }

  private generateTagCode(location: string, type: string): string {
    if (location?.includes('정문') || location?.includes('출입')) return 'T2'
    if (location?.includes('식당') || location?.includes('카페')) return 'M1'
    if (location?.includes('회의실')) return 'G3'
    if (location?.includes('교육')) return 'G4'
    if (type === '장비') return 'O'
    return 'G1' // 기본값
  }

  private determineState(tagCode: string, inoutType: string): string {
    if (tagCode === 'T2' || tagCode === 'T3') return '출입'
    if (tagCode.startsWith('M')) return '식사'
    if (tagCode === 'G3') return '회의'
    if (tagCode === 'G4') return '교육'
    if (tagCode === 'O') return '업무'
    return '업무'
  }

  private determineJudgment(state: string, timestamp: Date): string {
    const hour = timestamp.getHours()
    
    if (state === '식사') return '비업무'
    if (state === '출입') return '이동'
    if (hour >= 9 && hour <= 18) return '업무'
    if (hour >= 19 || hour <= 8) return '연장업무'
    return '업무'
  }

  private calculateBaseConfidence(tagCode: string, state: string): number {
    if (tagCode === 'T2' || tagCode === 'T3') return 1.0
    if (tagCode.startsWith('M')) return 1.0
    if (tagCode === 'O') return 0.98
    if (tagCode === 'G3') return 0.95
    if (tagCode === 'G4') return 0.95
    return 0.85
  }

  private convertTimestamp(dateInt: number, timeInt: number): Date {
    const dateStr = dateInt.toString()
    const timeStr = timeInt.toString().padStart(6, '0')
    
    const year = parseInt(dateStr.substring(0, 4))
    const month = parseInt(dateStr.substring(4, 6)) - 1
    const day = parseInt(dateStr.substring(6, 8))
    const hour = parseInt(timeStr.substring(0, 2))
    const minute = parseInt(timeStr.substring(2, 4))
    const second = parseInt(timeStr.substring(4, 6))
    
    return new Date(year, month, day, hour, minute, second)
  }

  private formatDate(dateInt: number): string {
    const dateStr = dateInt.toString()
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
  }

  private calculateDuration(currentTime: number, nextTime: number): number {
    const current = this.convertTimestamp(20250101, currentTime)
    const next = this.convertTimestamp(20250101, nextTime)
    return Math.round((next.getTime() - current.getTime()) / (1000 * 60))
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

  /**
   * 전체 마이그레이션 실행
   */
  async run() {
    try {
      await this.migrateOrganizationStructure()
      await this.migrateEmployeeProfiles() 
      await this.migrateTagEvents()
      
      // 통계 출력
      this.printStatistics()
      
    } catch (error) {
      console.error('❌ 마이그레이션 오류:', error)
      throw error
    } finally {
      this.close()
    }
  }

  private printStatistics() {
    console.log('\n📈 마이그레이션 통계:')
    
    const stats = this.analyticsDb.prepare(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(DISTINCT employee_id) as unique_employees,
        COUNT(DISTINCT date) as unique_dates,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM master_events_table
    `).get()

    console.log(`  • 총 이벤트: ${stats.total_events?.toLocaleString()}개`)
    console.log(`  • 직원 수: ${stats.unique_employees}명`)
    console.log(`  • 날짜 범위: ${stats.earliest_date} ~ ${stats.latest_date}`)
    console.log(`  • 기간: ${stats.unique_dates}일`)
  }

  private close() {
    this.analyticsDb.close()
    this.operationalDb.close()
    console.log('\n🎉 마이그레이션 완료!')
  }
}

// CLI 실행
if (require.main === module) {
  const [,, startDate, endDate] = process.argv
  const migrator = new DataMigrator(startDate, endDate)
  migrator.run().catch(console.error)
}

export { DataMigrator }