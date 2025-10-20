/**
 * 메모리 기반 데이터 로더
 * Analytics DB에서 모든 필요한 데이터를 한번에 로딩하여 
 * DB 트랜잭션을 최소화하고 병렬 처리를 가능하게 함
 */

import * as Database from 'better-sqlite3'
import * as path from 'path'

export interface EmployeeData {
  employeeId: number
  employeeName: string
  teamName: string
  groupName: string
  jobGroup: string
}

export interface EventData {
  timestamp: Date
  date: string
  employeeId: number
  tagCode: string
  tagName: string
  tagType: string
  tagLocation: string
  duration?: number
  prevTagCode?: string
  nextTagCode?: string
  teamTagRatio: number
  teamWorkIntensity: number
}

export interface ClaimData {
  employeeId: number
  date: string
  claimedHours: number
}

export interface MemoryDataset {
  employees: Map<number, EmployeeData>
  events: Map<number, Map<string, EventData[]>>  // employeeId -> date -> events[]
  teamCharacteristics: Map<string, any>
  claimData: Map<number, Map<string, ClaimData>>  // employeeId -> date -> claimData
}

export class MemoryDataLoader {
  private analyticsDbPath: string

  constructor(analyticsDbPath?: string) {
    this.analyticsDbPath = analyticsDbPath || path.join(process.cwd(), 'sambio_analytics.db')
  }

  /**
   * 지정된 직원들과 날짜 범위의 모든 데이터를 한번에 로딩
   */
  async loadAllData(employeeIds: number[], startDate: string, endDate: string): Promise<MemoryDataset> {
    console.log(`🔥 Loading ALL data for ${employeeIds.length} employees from ${startDate} to ${endDate}`)
    const startTime = Date.now()

    const db = new Database(this.analyticsDbPath, { readonly: true })
    
    try {
      // 1. 직원 정보 로딩
      const employees = this.loadEmployees(db, employeeIds)
      console.log(`✅ Loaded ${employees.size} employees`)

      // 2. 이벤트 데이터 로딩  
      const events = this.loadEvents(db, employeeIds, startDate, endDate)
      console.log(`✅ Loaded events for ${events.size} employees`)

      // 3. 팀 특성 로딩
      const teamCharacteristics = this.loadTeamCharacteristics(db)
      console.log(`✅ Loaded team characteristics for ${teamCharacteristics.size} teams`)

      // 4. 신고 근무시간 로딩 (Human DB에서)
      const claimData = this.loadClaimData(employeeIds, startDate, endDate)
      console.log(`✅ Loaded claim data for ${claimData.size} employees`)

      const duration = Date.now() - startTime
      console.log(`🎉 All data loaded in ${duration}ms - DB connection closed`)

      return {
        employees,
        events,
        teamCharacteristics,
        claimData
      }
    } finally {
      db.close()
    }
  }

  private loadEmployees(db: Database.Database, employeeIds: number[]): Map<number, EmployeeData> {
    const placeholders = employeeIds.map(() => '?').join(',')
    const stmt = db.prepare(`
      SELECT DISTINCT
        employee_id,
        employee_name,
        team_name,
        group_name,
        job_group
      FROM master_events_table
      WHERE employee_id IN (${placeholders})
    `)
    
    const rows = stmt.all(...employeeIds) as any[]
    const employees = new Map<number, EmployeeData>()
    
    for (const row of rows) {
      employees.set(row.employee_id, {
        employeeId: row.employee_id,
        employeeName: row.employee_name || '',
        teamName: row.team_name || '',
        groupName: row.group_name || '',
        jobGroup: row.job_group || ''
      })
    }
    
    return employees
  }

  private loadEvents(db: Database.Database, employeeIds: number[], startDate: string, endDate: string): Map<number, Map<string, EventData[]>> {
    const placeholders = employeeIds.map(() => '?').join(',')
    const stmt = db.prepare(`
      SELECT 
        employee_id,
        timestamp,
        date,
        tag_code,
        tag_name,
        tag_type,
        tag_location,
        prev_tag_code,
        next_tag_code,
        team_tag_ratio,
        team_work_intensity
      FROM master_events_table
      WHERE employee_id IN (${placeholders})
        AND date BETWEEN ? AND ?
      ORDER BY employee_id, timestamp
    `)
    
    const rows = stmt.all(...employeeIds, startDate, endDate) as any[]
    const events = new Map<number, Map<string, EventData[]>>()
    
    for (const row of rows) {
      const employeeId = row.employee_id
      const date = row.date
      
      if (!events.has(employeeId)) {
        events.set(employeeId, new Map())
      }
      
      const employeeEvents = events.get(employeeId)!
      if (!employeeEvents.has(date)) {
        employeeEvents.set(date, [])
      }
      
      employeeEvents.get(date)!.push({
        timestamp: new Date(row.timestamp),
        date: row.date,
        tagCode: row.tag_code,
        tagName: row.tag_name || '',
        tagType: row.tag_type || '',
        tagLocation: row.tag_location || '',
        prevTagCode: row.prev_tag_code,
        nextTagCode: row.next_tag_code,
        teamTagRatio: row.team_tag_ratio || 0,
        teamWorkIntensity: row.team_work_intensity || 0
      })
    }
    
    return events
  }

  private loadTeamCharacteristics(db: Database.Database): Map<string, any> {
    const stmt = db.prepare(`
      SELECT DISTINCT
        team_name,
        team_tag_ratio,
        team_work_intensity,
        COUNT(*) as team_total_count
      FROM master_events_table
      WHERE team_name IS NOT NULL
      GROUP BY team_name, team_tag_ratio, team_work_intensity
    `)
    
    const rows = stmt.all() as any[]
    const characteristics = new Map<string, any>()
    
    for (const row of rows) {
      characteristics.set(row.team_name, {
        teamName: row.team_name,
        tagRatio: row.team_tag_ratio || 0,
        workIntensity: row.team_work_intensity || 0,
        totalCount: row.team_total_count || 0
      })
    }
    
    return characteristics
  }

  private loadClaimData(employeeIds: number[], startDate: string, endDate: string): Map<number, Map<string, ClaimData>> {
    // 신고 근무시간은 Human DB에서 로딩
    const humanDbPath = path.join(process.cwd(), 'sambio_human.db')
    const humanDb = new Database(humanDbPath, { readonly: true })
    
    try {
      // claim_data 테이블 존재 확인
      const tableCheck = humanDb.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='claim_data'
      `).get()
      
      if (!tableCheck) {
        console.log('📊 claim_data table not found - using empty claim data')
        return new Map()
      }

      const placeholders = employeeIds.map(() => '?').join(',')
      const stmt = humanDb.prepare(`
        SELECT
          사번 as employee_id,
          DATE(근무일) as date,
          근무시간 as claimed_hours
        FROM claim_data
        WHERE 사번 IN (${placeholders})
          AND DATE(근무일) BETWEEN ? AND ?
          AND 근무시간 IS NOT NULL
          AND 근무시간 > 0
      `)
      
      const rows = stmt.all(...employeeIds, startDate, endDate) as any[]
      const claimData = new Map<number, Map<string, ClaimData>>()
      
      for (const row of rows) {
        const employeeId = row.employee_id
        const date = row.date
        
        if (!claimData.has(employeeId)) {
          claimData.set(employeeId, new Map())
        }
        
        claimData.get(employeeId)!.set(date, {
          employeeId,
          date,
          claimedHours: row.claimed_hours || 0
        })
      }
      
      return claimData
    } finally {
      humanDb.close()
    }
  }
}