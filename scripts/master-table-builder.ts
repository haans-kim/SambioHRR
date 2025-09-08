#!/usr/bin/env tsx
/**
 * 모듈형 Master Table 통합 빌더
 * 각 데이터 소스별로 독립적 처리, 오류 발생시 해당 모듈만 재실행 가능
 * 
 * 실행: npx tsx scripts/master-table-builder.ts [start_date] [end_date] [--modules=tag,equipment,knox,org]
 */

import Database from 'better-sqlite3'
import path from 'path'

const ANALYTICS_DB_PATH = path.join(process.cwd(), 'sambio_analytics.db')
const OPERATIONAL_DB_PATH = path.join(process.cwd(), 'sambio_human.db')

interface BuilderConfig {
  startDate: string
  endDate: string
  modules: string[]
  forceRebuild: boolean
  batchSize: number
}

interface ProcessingStats {
  module: string
  startTime: Date
  endTime?: Date
  processedRecords: number
  errors: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  errorDetails?: string[]
}

class MasterTableBuilder {
  private analyticsDb: Database.Database
  private operationalDb: Database.Database
  private config: BuilderConfig
  private stats: Map<string, ProcessingStats> = new Map()

  constructor(config: BuilderConfig) {
    this.config = config
    console.log(`🚀 Master Table Builder 시작`)
    console.log(`📅 기간: ${config.startDate} ~ ${config.endDate}`)
    console.log(`🔧 모듈: ${config.modules.join(', ')}`)
    
    this.analyticsDb = new Database(ANALYTICS_DB_PATH, { readonly: false })
    this.operationalDb = new Database(OPERATIONAL_DB_PATH, { readonly: true })
    
    // Attach operational DB
    this.analyticsDb.exec(`ATTACH DATABASE '${OPERATIONAL_DB_PATH}' AS operational;`)
  }

  async build(): Promise<void> {
    try {
      // 1. 테이블 초기화 (필요시)
      if (this.config.forceRebuild) {
        await this.initializeSchema()
      }

      // 2. 각 모듈 순차 실행
      for (const module of this.config.modules) {
        await this.processModule(module)
      }

      // 3. 최종 통계 출력
      this.printFinalStats()

    } catch (error) {
      console.error('❌ Master Table 구축 실패:', error)
      throw error
    } finally {
      this.analyticsDb.close()
      this.operationalDb.close()
    }
  }

  private async processModule(moduleName: string): Promise<void> {
    const stat: ProcessingStats = {
      module: moduleName,
      startTime: new Date(),
      processedRecords: 0,
      errors: 0,
      status: 'running'
    }
    
    this.stats.set(moduleName, stat)
    console.log(`\n🔄 [${moduleName}] 모듈 처리 시작...`)

    try {
      switch (moduleName) {
        case 'schema':
          await this.initializeSchema()
          break
        case 'tag':
          await this.processTagData()
          break
        case 'equipment':
          await this.processEquipmentData()
          break
        case 'knox':
          await this.processKnoxData()
          break
        case 'meal':
          await this.processMealData()
          break
        case 'organization':
          await this.processOrganizationData()
          break
        case 'claim':
          await this.processClaimData()
          break
        case 'analysis':
          await this.performAnalysis()
          break
        default:
          throw new Error(`Unknown module: ${moduleName}`)
      }

      stat.status = 'completed'
      stat.endTime = new Date()
      console.log(`✅ [${moduleName}] 완료 - ${stat.processedRecords}건 처리`)

    } catch (error) {
      stat.status = 'failed'
      stat.endTime = new Date()
      stat.errorDetails = [error instanceof Error ? error.message : String(error)]
      console.error(`❌ [${moduleName}] 실패:`, error)
    }
  }

  private async initializeSchema(): Promise<void> {
    console.log('📋 스키마 초기화...')
    
    const schema = `
      -- Master Table 재생성
      DROP TABLE IF EXISTS master_events_table;
      
      CREATE TABLE master_events_table (
        -- Primary Key
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- 시간 정보
        timestamp DATETIME NOT NULL,
        date DATE NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        week INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        hour INTEGER NOT NULL,
        minute INTEGER NOT NULL,
        
        -- 직원 정보
        employee_id INTEGER NOT NULL,
        employee_name TEXT,
        job_group TEXT,
        
        -- 조직 정보 (정확한 매핑)
        center_code TEXT,
        center_name TEXT,
        division_code TEXT,
        division_name TEXT,
        team_code TEXT,
        team_name TEXT,
        group_code TEXT,
        group_name TEXT,
        
        -- 근무 정보 (claim_data 연동)
        work_schedule_type TEXT,  -- 탄력근무제, 선택근무제, 고정근무제
        shift_type TEXT,
        claimed_hours REAL,       -- 신청 근무시간
        
        -- 태그 정보
        tag_code TEXT NOT NULL,
        tag_name TEXT,
        tag_type TEXT,
        tag_location TEXT,
        
        -- 상태 분류
        state TEXT,
        judgment TEXT,
        
        -- 신뢰도 (기존 + 개선)
        base_confidence REAL,
        final_confidence REAL,
        confidence_reason TEXT,
        
        -- 시퀀스 정보
        prev_tag_code TEXT,
        prev_state TEXT,
        next_tag_code TEXT,
        next_state TEXT,
        duration_minutes INTEGER,
        
        -- 집단 지성 메트릭 (팀 기반)
        team_same_tag_count INTEGER,
        team_total_count INTEGER,
        team_tag_ratio REAL,
        team_work_intensity REAL,  -- O태그 비율 기반
        
        -- 이상치 탐지
        is_anomaly BOOLEAN DEFAULT 0,
        anomaly_score REAL,
        anomaly_type TEXT,
        
        -- 메타데이터
        data_source TEXT,
        original_id TEXT,          -- 원본 데이터 ID
        processing_batch TEXT,     -- 처리 배치 식별
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      -- 최적화된 인덱스
      CREATE INDEX idx_met_timestamp ON master_events_table(timestamp);
      CREATE INDEX idx_met_emp_date ON master_events_table(employee_id, date);
      CREATE INDEX idx_met_team_hour ON master_events_table(team_code, hour);
      CREATE INDEX idx_met_tag_date ON master_events_table(tag_code, date);
      CREATE INDEX idx_met_anomaly ON master_events_table(is_anomaly, anomaly_type);
      CREATE INDEX idx_met_confidence ON master_events_table(final_confidence);
      
      -- 처리 로그 테이블
      CREATE TABLE IF NOT EXISTS processing_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_name TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        processed_records INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'running',
        error_details TEXT,
        config_snapshot TEXT
      );
    `
    
    this.analyticsDb.exec(schema)
    this.updateStats('schema', 1, 0)
  }

  private async processTagData(): Promise<void> {
    console.log('🏷️ 태그 데이터 처리...')
    console.log(`📅 날짜 범위: ${this.config.startDate} ~ ${this.config.endDate}`)
    
    const query = `
      INSERT INTO master_events_table (
        timestamp, date, year, month, week, day_of_week, hour, minute,
        employee_id, employee_name, tag_code, tag_name, tag_type, tag_location,
        state, judgment, base_confidence, final_confidence,
        data_source, original_id, processing_batch
      )
      SELECT 
        datetime(substr(t.ENTE_DT, 1, 4) || '-' || substr(t.ENTE_DT, 5, 2) || '-' || substr(t.ENTE_DT, 7, 2) || ' ' || printf('%02d:%02d:%02d', 
          CAST(t.출입시각 / 10000 AS INTEGER), 
          CAST((t.출입시각 % 10000) / 100 AS INTEGER),
          CAST(t.출입시각 % 100 AS INTEGER)
        )) as timestamp,
        date(substr(t.ENTE_DT, 1, 4) || '-' || substr(t.ENTE_DT, 5, 2) || '-' || substr(t.ENTE_DT, 7, 2)) as date,
        cast(substr(t.ENTE_DT, 1, 4) as integer) as year,
        cast(substr(t.ENTE_DT, 5, 2) as integer) as month,
        cast(strftime('%W', date(substr(t.ENTE_DT, 1, 4) || '-' || substr(t.ENTE_DT, 5, 2) || '-' || substr(t.ENTE_DT, 7, 2))) as integer) as week,
        cast(strftime('%w', date(substr(t.ENTE_DT, 1, 4) || '-' || substr(t.ENTE_DT, 5, 2) || '-' || substr(t.ENTE_DT, 7, 2))) as integer) as day_of_week,
        CAST(t.출입시각 / 10000 AS INTEGER) as hour,
        CAST((t.출입시각 % 10000) / 100 AS INTEGER) as minute,
        
        t.사번 as employee_id,
        t.NAME as employee_name,
        COALESCE(tlm.Tag_Code, 'UNKNOWN') as tag_code,
        t.DR_NM as tag_name,
        'TagLog' as tag_type,
        t.DR_NM as tag_location,
        
        -- 기본 상태 분류
        CASE 
          WHEN t.DR_NM LIKE '%T2%' OR t.DR_NM LIKE '%GATE%' THEN '출입'
          WHEN t.DR_NM LIKE '%복도%' OR t.DR_NM LIKE '%계단%' THEN '이동'
          WHEN t.DR_NM LIKE '%휴게%' THEN '휴게'
          WHEN t.DR_NM LIKE '%회의%' THEN '회의'
          ELSE '업무'
        END as state,
        '태그기반' as judgment,
        
        -- 기본 신뢰도
        CASE 
          WHEN t.DR_NM LIKE '%T2%' OR t.DR_NM LIKE '%GATE%' THEN 1.0
          WHEN t.DR_NM LIKE '%회의%' OR t.DR_NM LIKE '%교육%' THEN 0.95
          WHEN t.DR_NM LIKE '%휴게%' THEN 0.90
          ELSE 0.85
        END as base_confidence,
        0.85 as final_confidence,  -- 임시값, 나중에 재계산
        
        'tag_data' as data_source,
        t.rowid as original_id,
        '${new Date().toISOString()}' as processing_batch
        
      FROM operational.tag_data t
      LEFT JOIN operational.tag_location_master tlm ON t.DR_NM = tlm.게이트명
      WHERE t.ENTE_DT >= ? AND t.ENTE_DT <= ?
        AND t.사번 IS NOT NULL
        AND t.출입시각 IS NOT NULL
        AND t.출입시각 >= 0
      ORDER BY t.사번, t.ENTE_DT, t.출입시각
    `
    
    const stmt = this.analyticsDb.prepare(query)
    // tag_data의 ENTE_DT는 integer 형식 (YYYYMMDD)이므로 변환
    const startDateInt = parseInt(this.config.startDate.replace(/-/g, ''))
    const endDateInt = parseInt(this.config.endDate.replace(/-/g, ''))
    console.log(`🔢 변환된 날짜: ${startDateInt} ~ ${endDateInt}`)
    const result = stmt.run(startDateInt, endDateInt)
    console.log(`📊 처리된 레코드: ${result.changes}건`)
    
    this.updateStats('tag', result.changes, 0)
  }

  private async processEquipmentData(): Promise<void> {
    console.log('⚙️ 장비 데이터 처리 (O태그 생성)...')
    
    // EAM 데이터
    await this.processEquipmentSource('EAM', `
      INSERT INTO master_events_table (
        timestamp, date, year, month, week, day_of_week, hour, minute,
        employee_id, tag_code, tag_name, tag_type,
        state, judgment, base_confidence, final_confidence,
        data_source, original_id, processing_batch
      )
      SELECT 
        e.ATTEMPTDATE as timestamp,
        date(e.ATTEMPTDATE) as date,
        cast(strftime('%Y', e.ATTEMPTDATE) as integer) as year,
        cast(strftime('%m', e.ATTEMPTDATE) as integer) as month,
        cast(strftime('%W', e.ATTEMPTDATE) as integer) as week,
        cast(strftime('%w', e.ATTEMPTDATE) as integer) as day_of_week,
        cast(strftime('%H', e.ATTEMPTDATE) as integer) as hour,
        cast(strftime('%M', e.ATTEMPTDATE) as integer) as minute,
        
        cast(e.USERNO as integer) as employee_id,
        'O' as tag_code,
        'EAM: ' || e.APP as tag_name,
        'Equipment' as tag_type,
        
        '업무' as state,
        'EAM장비사용' as judgment,
        0.98 as base_confidence,
        0.98 as final_confidence,
        
        'eam_data' as data_source,
        e.rowid as original_id,
        ? as processing_batch
        
      FROM operational.eam_data e
      WHERE e.ATTEMPTDATE >= ? AND e.ATTEMPTDATE <= ?
        AND e.USERNO IS NOT NULL
        AND e.ATTEMPTRESULT = 'SUCCESS'
    `)

    // EQUIS 데이터  
    await this.processEquipmentSource('EQUIS', `
      INSERT INTO master_events_table (
        timestamp, date, year, month, week, day_of_week, hour, minute,
        employee_id, tag_code, tag_name, tag_type,
        state, judgment, base_confidence, final_confidence,
        data_source, original_id, processing_batch
      )
      SELECT 
        e.Timestamp as timestamp,
        date(e.Timestamp) as date,
        cast(strftime('%Y', e.Timestamp) as integer) as year,
        cast(strftime('%m', e.Timestamp) as integer) as month,
        cast(strftime('%W', e.Timestamp) as integer) as week,
        cast(strftime('%w', e.Timestamp) as integer) as day_of_week,
        cast(strftime('%H', e.Timestamp) as integer) as hour,
        cast(strftime('%M', e.Timestamp) as integer) as minute,
        
        cast(e."USERNO( ID->사번매칭 )" as integer) as employee_id,
        'O' as tag_code,
        'EQUIS: ' || e.Event as tag_name,
        'Equipment' as tag_type,
        
        '업무' as state,
        'EQUIS장비사용' as judgment,
        0.98 as base_confidence,
        0.98 as final_confidence,
        
        'equis_data' as data_source,
        e.rowid as original_id,
        ? as processing_batch
        
      FROM operational.equis_data e
      WHERE e.Timestamp >= ? AND e.Timestamp <= ?
        AND e."USERNO( ID->사번매칭 )" IS NOT NULL
    `)

    // MES, LAMS, MDM도 동일하게 처리...
    await this.processEquipmentSource('MES', `
      INSERT INTO master_events_table (
        timestamp, date, year, month, week, day_of_week, hour, minute,
        employee_id, tag_code, tag_name, tag_type,
        state, judgment, base_confidence, final_confidence,
        data_source, original_id, processing_batch
      )
      SELECT 
        m.login_time as timestamp,
        date(m.login_time) as date,
        cast(strftime('%Y', m.login_time) as integer) as year,
        cast(strftime('%m', m.login_time) as integer) as month,
        cast(strftime('%W', m.login_time) as integer) as week,
        cast(strftime('%w', m.login_time) as integer) as day_of_week,
        cast(strftime('%H', m.login_time) as integer) as hour,
        cast(strftime('%M', m.login_time) as integer) as minute,
        
        m.USERNo as employee_id,
        'O' as tag_code,
        'MES: ' || m.session as tag_name,
        'Equipment' as tag_type,
        
        '업무' as state,
        'MES시스템사용' as judgment,
        0.98 as base_confidence,
        0.98 as final_confidence,
        
        'mes_data' as data_source,
        m.rowid as original_id,
        ? as processing_batch
        
      FROM operational.mes_data m
      WHERE m.login_time >= ? AND m.login_time <= ?
        AND m.USERNo IS NOT NULL
    `)

    // MDM 데이터
    await this.processEquipmentSource('MDM', `
      INSERT INTO master_events_table (
        timestamp, date, year, month, week, day_of_week, hour, minute,
        employee_id, tag_code, tag_name, tag_type,
        state, judgment, base_confidence, final_confidence,
        data_source, original_id, processing_batch
      )
      SELECT 
        m.Timestap as timestamp,
        date(m.Timestap) as date,
        cast(strftime('%Y', m.Timestap) as integer) as year,
        cast(strftime('%m', m.Timestap) as integer) as month,
        cast(strftime('%W', m.Timestap) as integer) as week,
        cast(strftime('%w', m.Timestap) as integer) as day_of_week,
        cast(strftime('%H', m.Timestap) as integer) as hour,
        cast(strftime('%M', m.Timestap) as integer) as minute,
        
        m.UserNo as employee_id,
        'O' as tag_code,
        'MDM: ' || m.task as tag_name,
        'Equipment' as tag_type,
        
        '업무' as state,
        'MDM시스템사용' as judgment,
        0.98 as base_confidence,
        0.98 as final_confidence,
        
        'mdm_data' as data_source,
        m.rowid as original_id,
        ? as processing_batch
        
      FROM operational.mdm_data m
      WHERE m.Timestap >= ? AND m.Timestap <= ?
        AND m.UserNo IS NOT NULL
    `)

    // LAMS 데이터
    await this.processEquipmentSource('LAMS', `
      INSERT INTO master_events_table (
        timestamp, date, year, month, week, day_of_week, hour, minute,
        employee_id, tag_code, tag_name, tag_type,
        state, judgment, base_confidence, final_confidence,
        data_source, original_id, processing_batch
      )
      SELECT 
        datetime(l.DATE) as timestamp,
        date(l.DATE) as date,
        cast(strftime('%Y', l.DATE) as integer) as year,
        cast(strftime('%m', l.DATE) as integer) as month,
        cast(strftime('%W', l.DATE) as integer) as week,
        cast(strftime('%w', l.DATE) as integer) as day_of_week,
        cast(strftime('%H', l.DATE) as integer) as hour,
        cast(strftime('%M', l.DATE) as integer) as minute,
        
        cast(l.User_No as integer) as employee_id,
        'O' as tag_code,
        'LAMS: ' || l.Task as tag_name,
        'Equipment' as tag_type,
        
        '업무' as state,
        'LAMS시스템사용' as judgment,
        0.98 as base_confidence,
        0.98 as final_confidence,
        
        'lams_data' as data_source,
        l.rowid as original_id,
        ? as processing_batch
        
      FROM operational.lams_data l
      WHERE l.DATE >= ? AND l.DATE <= ?
        AND l.User_No IS NOT NULL
    `)
  }

  private async processEquipmentSource(systemName: string, query: string): Promise<void> {
    console.log(`  📊 ${systemName} 데이터 처리...`)
    const batch = new Date().toISOString()
    const stmt = this.analyticsDb.prepare(query)
    const result = stmt.run(batch, this.config.startDate + ' 00:00:00', this.config.endDate + ' 23:59:59')
    console.log(`    ✓ ${systemName}: ${result.changes}건 처리`)
  }

  private async processKnoxData(): Promise<void> {
    console.log('📧 Knox 데이터 처리 (회의, 결재, 메일)...')
    
    const batch = new Date().toISOString()
    let totalRecords = 0
    
    // 1. Knox PIMS (회의) 데이터 - G3 태그
    const pimsQuery = `
      INSERT INTO master_events_table (
        timestamp, date, year, month, week, day_of_week, hour, minute,
        employee_id, tag_code, tag_name, tag_type,
        state, judgment, base_confidence, final_confidence,
        duration_minutes,
        data_source, original_id, processing_batch
      )
      SELECT 
        k.start_time as timestamp,
        date(k.start_time) as date,
        cast(strftime('%Y', k.start_time) as integer) as year,
        cast(strftime('%m', k.start_time) as integer) as month,
        cast(strftime('%W', k.start_time) as integer) as week,
        cast(strftime('%w', k.start_time) as integer) as day_of_week,
        cast(strftime('%H', k.start_time) as integer) as hour,
        cast(strftime('%M', k.start_time) as integer) as minute,
        
        cast(k.employee_id as integer) as employee_id,
        'G3' as tag_code,
        'Knox 회의: ' || k.meeting_type as tag_name,
        'Meeting' as tag_type,
        
        '회의' as state,
        'Knox회의참석' as judgment,
        0.95 as base_confidence,
        0.95 as final_confidence,
        cast((julianday(k.end_time) - julianday(k.start_time)) * 24 * 60 as integer) as duration_minutes,
        
        'knox_pims_data' as data_source,
        k.id as original_id,
        ? as processing_batch
        
      FROM operational.knox_pims_data k
      WHERE k.start_time >= ? AND k.start_time <= ?
        AND k.employee_id IS NOT NULL
    `
    
    const pimsStmt = this.analyticsDb.prepare(pimsQuery)
    const pimsResult = pimsStmt.run(batch, this.config.startDate + ' 00:00:00', this.config.endDate + ' 23:59:59')
    totalRecords += pimsResult.changes
    
    // 2. Knox Approval (결재) 데이터 - O 태그
    const approvalQuery = `
      INSERT INTO master_events_table (
        timestamp, date, year, month, week, day_of_week, hour, minute,
        employee_id, tag_code, tag_name, tag_type,
        state, judgment, base_confidence, final_confidence,
        duration_minutes,
        data_source, original_id, processing_batch
      )
      SELECT 
        a.Timestamp as timestamp,
        date(a.Timestamp) as date,
        cast(strftime('%Y', a.Timestamp) as integer) as year,
        cast(strftime('%m', a.Timestamp) as integer) as month,
        cast(strftime('%W', a.Timestamp) as integer) as week,
        cast(strftime('%w', a.Timestamp) as integer) as day_of_week,
        cast(strftime('%H', a.Timestamp) as integer) as hour,
        cast(strftime('%M', a.Timestamp) as integer) as minute,
        
        cast(a.UserNo as integer) as employee_id,
        'O' as tag_code,
        'Knox 결재: ' || COALESCE(a.Task, '문서결재') as tag_name,
        'Approval' as tag_type,
        
        '결재' as state,
        'Knox결재처리' as judgment,
        0.90 as base_confidence,
        0.90 as final_confidence,
        5 as duration_minutes,  -- 결재는 평균 5분 소요로 가정
        
        'knox_approval_data' as data_source,
        a.APID as original_id,
        ? as processing_batch
        
      FROM operational.knox_approval_data a
      WHERE a.Timestamp >= ? AND a.Timestamp <= ?
        AND a.UserNo IS NOT NULL
    `
    
    const approvalStmt = this.analyticsDb.prepare(approvalQuery)
    const approvalResult = approvalStmt.run(batch, this.config.startDate + ' 00:00:00', this.config.endDate + ' 23:59:59')
    totalRecords += approvalResult.changes
    
    // 3. Knox Mail (메일) 데이터 - O 태그  
    const mailQuery = `
      INSERT INTO master_events_table (
        timestamp, date, year, month, week, day_of_week, hour, minute,
        employee_id, tag_code, tag_name, tag_type,
        state, judgment, base_confidence, final_confidence,
        duration_minutes,
        data_source, original_id, processing_batch
      )
      SELECT 
        m.발신일시_GMT9 as timestamp,
        date(m.발신일시_GMT9) as date,
        cast(strftime('%Y', m.발신일시_GMT9) as integer) as year,
        cast(strftime('%m', m.발신일시_GMT9) as integer) as month,
        cast(strftime('%W', m.발신일시_GMT9) as integer) as week,
        cast(strftime('%w', m.발신일시_GMT9) as integer) as day_of_week,
        cast(strftime('%H', m.발신일시_GMT9) as integer) as hour,
        cast(strftime('%M', m.발신일시_GMT9) as integer) as minute,
        
        cast(m.발신인사번_text as integer) as employee_id,
        'O' as tag_code,
        'Knox 메일발송' as tag_name,
        'Mail' as tag_type,
        
        '메일' as state,
        'Knox메일발송' as judgment,
        0.85 as base_confidence,
        0.85 as final_confidence,
        3 as duration_minutes,  -- 메일 발송은 평균 3분 소요로 가정
        
        'knox_mail_data' as data_source,
        m.메일key as original_id,
        ? as processing_batch
        
      FROM operational.knox_mail_data m
      WHERE m.발신일시_GMT9 >= ? AND m.발신일시_GMT9 <= ?
        AND m.발신인사번_text IS NOT NULL
    `
    
    const mailStmt = this.analyticsDb.prepare(mailQuery)
    const mailResult = mailStmt.run(batch, this.config.startDate + ' 00:00:00', this.config.endDate + ' 23:59:59')
    totalRecords += mailResult.changes
    
    this.updateStats('knox', totalRecords, 0)
  }

  private async processMealData(): Promise<void> {
    console.log('🍽️ 식사 데이터 처리...')
    
    const mealQuery = `
      INSERT INTO master_events_table (
        timestamp, date, year, month, week, day_of_week, hour, minute,
        employee_id, tag_code, tag_name, tag_type,
        state, judgment, base_confidence, final_confidence,
        duration_minutes,
        data_source, original_id, processing_batch
      )
      SELECT 
        datetime(m.취식일시) as timestamp,
        date(m.취식일시) as date,
        cast(strftime('%Y', m.취식일시) as integer) as year,
        cast(strftime('%m', m.취식일시) as integer) as month,
        cast(strftime('%W', m.취식일시) as integer) as week,
        cast(strftime('%w', m.취식일시) as integer) as day_of_week,
        cast(strftime('%H', m.취식일시) as integer) as hour,
        cast(strftime('%M', m.취식일시) as integer) as minute,
        
        CAST(m.사번 AS INTEGER) as employee_id,
        CASE 
          WHEN m.테이크아웃 = 'Y' THEN 'M2'  -- 테이크아웃 = M2
          WHEN m.테이크아웃 = 'N' THEN 'M1'  -- 매장식사 = M1
          ELSE 'M1'
        END as tag_code,
        m.식사구분명 || ' (' || m.식당명 || ', ' || 
        CASE WHEN m.테이크아웃 = 'Y' THEN '테이크아웃' ELSE '매장식사' END || ')' as tag_name,
        'Meal' as tag_type,
        
        '식사' as state,
        '식사확정' as judgment,
        1.0 as base_confidence,
        1.0 as final_confidence,
        CASE WHEN m.식당명 = '바이오플라자' THEN 30 ELSE 10 END as duration_minutes,
        
        'meal_data' as data_source,
        m.NO as original_id,
        ? as processing_batch
        
      FROM operational.meal_data m
      WHERE date(m.취식일시) >= ? AND date(m.취식일시) <= ?
        AND m.사번 IS NOT NULL
    `
    
    const batch = new Date().toISOString()
    const stmt = this.analyticsDb.prepare(mealQuery)
    const result = stmt.run(batch, this.config.startDate, this.config.endDate)
    
    this.updateStats('meal', result.changes, 0)
  }

  private async processOrganizationData(): Promise<void> {
    console.log('🏢 조직 정보 매핑...')
    
    // employees 테이블에서 정확한 조직 정보 매핑
    const orgQuery = `
      UPDATE master_events_table 
      SET 
        center_name = COALESCE(e.center_name, '미매핑'),
        team_name = COALESCE(e.team_name, '미매핑'),
        group_name = COALESCE(e.group_name, '미매핑'),
        work_schedule_type = COALESCE(
          (SELECT DISTINCT c.WORKSCHDTYPNM FROM operational.claim_data c 
           WHERE c.사번 = master_events_table.employee_id LIMIT 1),
          '고정근무제'
        )
      FROM operational.employees e
      WHERE master_events_table.employee_id = CAST(e.employee_id AS INTEGER)
    `
    
    const result = this.analyticsDb.prepare(orgQuery).run()
    this.updateStats('organization', result.changes, 0)
  }

  private async processClaimData(): Promise<void> {
    console.log('📋 근무제 정보 매핑...')
    
    // 일별 근무시간 매핑
    const claimQuery = `
      UPDATE master_events_table 
      SET 
        claimed_hours = COALESCE(
          (SELECT c.실제근무시간 FROM operational.claim_data c 
           WHERE c.사번 = master_events_table.employee_id 
             AND date(c.근무일) = master_events_table.date LIMIT 1),
          8.0
        )
      WHERE EXISTS (
        SELECT 1 FROM operational.claim_data c 
        WHERE c.사번 = master_events_table.employee_id 
          AND date(c.근무일) = master_events_table.date
      )
    `
    
    const result = this.analyticsDb.prepare(claimQuery).run()
    this.updateStats('claim', result.changes, 0)
  }

  private async performAnalysis(): Promise<void> {
    console.log('🔍 집단 패턴 분석...')
    
    // 팀별 시간대별 패턴 계산
    const teamPatternQuery = `
      UPDATE master_events_table 
      SET 
        team_same_tag_count = (
          SELECT COUNT(*) 
          FROM master_events_table m2 
          WHERE m2.team_code = master_events_table.team_code
            AND m2.hour = master_events_table.hour
            AND m2.tag_code = master_events_table.tag_code
            AND m2.date = master_events_table.date
        ),
        team_total_count = (
          SELECT COUNT(*) 
          FROM master_events_table m2 
          WHERE m2.team_code = master_events_table.team_code
            AND m2.hour = master_events_table.hour
            AND m2.date = master_events_table.date
        )
      WHERE team_code IS NOT NULL
    `
    
    this.analyticsDb.prepare(teamPatternQuery).run()
    
    // 팀 업무 강도 계산
    const workIntensityQuery = `
      UPDATE master_events_table 
      SET 
        team_work_intensity = COALESCE((
          SELECT COUNT(CASE WHEN tag_code = 'O' THEN 1 END) * 1.0 / COUNT(*)
          FROM master_events_table m2 
          WHERE m2.team_code = master_events_table.team_code
            AND m2.hour = master_events_table.hour
            AND m2.date = master_events_table.date
        ), 0.0)
      WHERE team_code IS NOT NULL
    `
    
    this.analyticsDb.prepare(workIntensityQuery).run()
    
    this.updateStats('analysis', 1, 0)
  }

  private updateStats(module: string, processed: number, errors: number): void {
    const stat = this.stats.get(module)
    if (stat) {
      stat.processedRecords += processed
      stat.errors += errors
    }
  }

  private printFinalStats(): void {
    console.log('\n📊 === 최종 처리 결과 ===')
    
    for (const [module, stat] of this.stats.entries()) {
      const duration = stat.endTime && stat.startTime 
        ? Math.round((stat.endTime.getTime() - stat.startTime.getTime()) / 1000)
        : 0
      
      const status = stat.status === 'completed' ? '✅' : 
                    stat.status === 'failed' ? '❌' : '⏳'
      
      console.log(`${status} [${module}] ${stat.processedRecords}건 (${duration}초)`)
      
      if (stat.errors > 0) {
        console.log(`  ⚠️  오류: ${stat.errors}건`)
      }
    }
    
    // 전체 통계
    const totalQuery = `
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN tag_code = 'O' THEN 1 END) as o_events,
        COUNT(DISTINCT employee_id) as unique_employees,
        COUNT(DISTINCT team_code) as unique_teams
      FROM master_events_table
      WHERE date >= ? AND date <= ?
    `
    
    const total = this.analyticsDb.prepare(totalQuery).get(this.config.startDate, this.config.endDate) as any
    
    console.log('\n🎯 === Master Table 현황 ===')
    console.log(`총 이벤트: ${total.total_events.toLocaleString()}건`)
    console.log(`O태그: ${total.o_events.toLocaleString()}건 (${((total.o_events/total.total_events)*100).toFixed(1)}%)`)
    console.log(`직원 수: ${total.unique_employees}명`)
    console.log(`팀 수: ${total.unique_teams}개`)
  }

  close(): void {
    if (this.analyticsDb) this.analyticsDb.close()
    if (this.operationalDb) this.operationalDb.close()
  }
}

// CLI 실행부
async function main() {
  const args = process.argv.slice(2)
  
  const config: BuilderConfig = {
    startDate: args[0] || (() => {
      const date = new Date()
      date.setDate(date.getDate() - 1)
      return date.toISOString().split('T')[0]
    })(),
    endDate: args[1] || args[0] || (() => {
      const date = new Date()
      date.setDate(date.getDate() - 1)
      return date.toISOString().split('T')[0]
    })(),
    modules: args.find(arg => arg.startsWith('--modules='))?.split('=')[1]?.split(',') || 
             ['schema', 'tag', 'equipment', 'knox', 'meal', 'organization', 'claim', 'analysis'],
    forceRebuild: args.includes('--force'),
    batchSize: 10000
  }
  
  const builder = new MasterTableBuilder(config)
  
  try {
    await builder.build()
    console.log('\n🎉 Master Table 구축 완료!')
  } catch (error) {
    console.error('\n💥 구축 실패:', error)
    process.exit(1)
  } finally {
    builder.close()
  }
}

// 직접 실행시 main 함수 실행
if (require.main === module) {
  main().catch(console.error)
}

export { MasterTableBuilder }