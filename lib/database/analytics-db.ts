/**
 * Analytics Database 연결 및 쿼리 클래스
 */

import Database from 'better-sqlite3'
import path from 'path'

export class AnalyticsDB {
  private db: Database.Database
  private operationalDb: Database.Database | null = null

  constructor() {
    // 분석 전용 DB 연결
    this.db = new Database(path.join(process.cwd(), 'sambio_analytics.db'), {
      readonly: false,
      fileMustExist: true
    })

    // 성능 최적화 설정
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('cache_size = -64000')
    this.db.pragma('temp_store = MEMORY')
  }

  /**
   * 운영 DB 연결 (필요시)
   */
  attachOperationalDB() {
    if (!this.operationalDb) {
      this.operationalDb = new Database(path.join(process.cwd(), 'sambio_human.db'), {
        readonly: true,
        fileMustExist: true
      })
    }
    return this.operationalDb
  }

  /**
   * 이벤트 데이터 삽입
   */
  insertEvents(events: any[]) {
    const insert = this.db.prepare(`
      INSERT INTO master_events_table (
        timestamp, date, year, month, week, day_of_week, hour, minute,
        employee_id, employee_name, job_group,
        center_code, center_name, team_code, team_name,
        tag_code, tag_name, tag_type,
        state, judgment, base_confidence,
        duration_minutes, sync_date
      ) VALUES (
        @timestamp, @date, @year, @month, @week, @day_of_week, @hour, @minute,
        @employee_id, @employee_name, @job_group,
        @center_code, @center_name, @team_code, @team_name,
        @tag_code, @tag_name, @tag_type,
        @state, @judgment, @base_confidence,
        @duration_minutes, @sync_date
      )
    `)

    const insertMany = this.db.transaction((events) => {
      for (const event of events) {
        insert.run(event)
      }
    })

    insertMany(events)
  }

  /**
   * 집단 패턴 계산
   */
  calculateGroupPatterns(date: string, teamCode: string) {
    return this.db.prepare(`
      SELECT 
        tag_code,
        hour,
        COUNT(*) as event_count,
        COUNT(DISTINCT employee_id) as unique_employees,
        AVG(base_confidence) as avg_confidence,
        COUNT(*) * 1.0 / (
          SELECT COUNT(DISTINCT employee_id) 
          FROM master_events_table 
          WHERE date = ? AND team_code = ?
        ) as participation_ratio
      FROM master_events_table
      WHERE date = ? AND team_code = ?
      GROUP BY tag_code, hour
      ORDER BY hour, event_count DESC
    `).all(date, teamCode, date, teamCode)
  }

  /**
   * 신뢰도 업데이트
   */
  updateConfidence(eventId: number, contextConfidence: number, groupConfidence: number) {
    const stmt = this.db.prepare(`
      UPDATE master_events_table
      SET 
        context_confidence = ?,
        group_confidence = ?,
        final_confidence = (base_confidence + ? + ?) / 3,
        updated_at = CURRENT_TIMESTAMP
      WHERE event_id = ?
    `)

    return stmt.run(contextConfidence, groupConfidence, contextConfidence, groupConfidence, eventId)
  }

  /**
   * 이상치 탐지
   */
  detectAnomalies(employeeId: number, date: string) {
    // 개인의 평균 패턴 가져오기
    const avgPattern = this.db.prepare(`
      SELECT 
        hour,
        tag_code,
        COUNT(*) as frequency
      FROM master_events_table
      WHERE employee_id = ?
        AND date BETWEEN date(?, '-30 days') AND date(?, '-1 day')
      GROUP BY hour, tag_code
    `).all(employeeId, date, date)

    // 오늘 패턴과 비교
    const todayPattern = this.db.prepare(`
      SELECT 
        hour,
        tag_code,
        COUNT(*) as frequency
      FROM master_events_table
      WHERE employee_id = ? AND date = ?
      GROUP BY hour, tag_code
    `).all(employeeId, date)

    // 이상치 판단 로직
    const anomalies = []
    for (const today of todayPattern) {
      const avg = avgPattern.find(a => 
        a.hour === today.hour && a.tag_code === today.tag_code
      )
      
      if (!avg || Math.abs(today.frequency - avg.frequency) > avg.frequency * 0.5) {
        anomalies.push({
          hour: today.hour,
          tag_code: today.tag_code,
          expected: avg?.frequency || 0,
          actual: today.frequency
        })
      }
    }

    return anomalies
  }

  /**
   * 탄력근무자 분석
   */
  analyzeFlexibleWorkers(date: string) {
    return this.db.prepare(`
      SELECT 
        e.employee_id,
        e.employee_name,
        e.flexible_work_type,
        MIN(TIME(m.timestamp)) as first_event,
        MAX(TIME(m.timestamp)) as last_event,
        SUM(
          CASE 
            WHEN m.judgment IN ('집중업무', '일반업무') 
            THEN m.duration_minutes 
            ELSE 0 
          END
        ) as work_minutes,
        AVG(m.final_confidence) as avg_confidence
      FROM employee_profiles e
      JOIN master_events_table m ON e.employee_id = m.employee_id
      WHERE e.is_flexible_work = 1 
        AND m.date = ?
      GROUP BY e.employee_id
    `).all(date)
  }

  /**
   * 캐시 조회
   */
  getCachedResult(cacheKey: string) {
    const result = this.db.prepare(`
      SELECT result_json 
      FROM analysis_cache 
      WHERE cache_key = ? 
        AND expires_at > CURRENT_TIMESTAMP
    `).get(cacheKey)

    if (result) {
      // 히트 카운트 증가
      this.db.prepare(`
        UPDATE analysis_cache 
        SET hit_count = hit_count + 1, 
            last_accessed = CURRENT_TIMESTAMP 
        WHERE cache_key = ?
      `).run(cacheKey)

      return JSON.parse(result.result_json)
    }

    return null
  }

  /**
   * 캐시 저장
   */
  setCachedResult(cacheKey: string, data: any, expiryMinutes: number = 60) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO analysis_cache (
        cache_key, result_json, expires_at, created_at
      ) VALUES (?, ?, datetime('now', '+' || ? || ' minutes'), CURRENT_TIMESTAMP)
    `)

    stmt.run(cacheKey, JSON.stringify(data), expiryMinutes)
  }

  /**
   * 연결 종료
   */
  close() {
    this.db.close()
    if (this.operationalDb) {
      this.operationalDb.close()
    }
  }
}

// 싱글톤 인스턴스
let analyticsDbInstance: AnalyticsDB | null = null

export function getAnalyticsDB(): AnalyticsDB {
  if (!analyticsDbInstance) {
    analyticsDbInstance = new AnalyticsDB()
  }
  return analyticsDbInstance
}