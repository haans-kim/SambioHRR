#!/usr/bin/env tsx
/**
 * Master Database 생성 및 초기화 스크립트
 * 실행: npx tsx scripts/create-master-db.ts
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const ANALYTICS_DB_PATH = path.join(process.cwd(), 'sambio_analytics.db')
const OPERATIONAL_DB_PATH = path.join(process.cwd(), 'sambio_human.db')

class MasterDatabaseCreator {
  private analyticsDb: Database.Database
  private operationalDb: Database.Database

  constructor() {
    console.log('🚀 Master Database 생성 시작...')
    
    // 기존 분석 DB가 있으면 백업
    if (fs.existsSync(ANALYTICS_DB_PATH)) {
      const backupPath = `${ANALYTICS_DB_PATH}.backup.${Date.now()}`
      fs.copyFileSync(ANALYTICS_DB_PATH, backupPath)
      console.log(`📦 기존 DB 백업 완료: ${backupPath}`)
    }

    // 분석 DB 생성/연결
    this.analyticsDb = new Database(ANALYTICS_DB_PATH, {
      verbose: console.log
    })

    // 운영 DB 읽기 전용 연결
    this.operationalDb = new Database(OPERATIONAL_DB_PATH, {
      readonly: true,
      fileMustExist: true
    })

    console.log('✅ 데이터베이스 연결 완료')
  }

  /**
   * 1. 테이블 생성
   */
  createTables() {
    console.log('\n📋 테이블 생성 중...')

    // master_events_table
    this.analyticsDb.exec(`
      DROP TABLE IF EXISTS master_events_table;
      
      CREATE TABLE master_events_table (
        -- Primary Key
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- 시간 정보 (인덱싱 최적화)
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
        
        -- 조직 정보 (비정규화)
        center_code TEXT,
        center_name TEXT,
        division_code TEXT,
        division_name TEXT,
        team_code TEXT,
        team_name TEXT,
        group_code TEXT,
        group_name TEXT,
        
        -- 근무 정보
        shift_type TEXT,
        is_flexible_work BOOLEAN DEFAULT 0,
        flexible_work_type TEXT,
        standard_work_start TIME,
        standard_work_end TIME,
        
        -- 태그 정보
        tag_code TEXT NOT NULL,
        tag_name TEXT,
        tag_type TEXT,
        tag_location TEXT,
        
        -- 상태 분류
        state TEXT,
        judgment TEXT,
        
        -- 신뢰도
        base_confidence REAL,
        context_confidence REAL,
        group_confidence REAL,
        final_confidence REAL,
        
        -- 집단 지성 메트릭
        dept_same_tag_count INTEGER,
        dept_total_count INTEGER,
        dept_tag_ratio REAL,
        team_same_tag_count INTEGER,
        team_total_count INTEGER,
        team_tag_ratio REAL,
        
        -- 시퀀스 정보
        prev_tag_code TEXT,
        prev_state TEXT,
        next_tag_code TEXT,
        next_state TEXT,
        duration_minutes INTEGER,
        
        -- 이상치 탐지
        is_anomaly BOOLEAN DEFAULT 0,
        anomaly_score REAL,
        anomaly_reason TEXT,
        
        -- 메타데이터
        data_source TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sync_date DATE
      );
    `)

    // organization_hierarchy
    this.analyticsDb.exec(`
      DROP TABLE IF EXISTS organization_hierarchy;
      
      CREATE TABLE organization_hierarchy (
        org_id INTEGER PRIMARY KEY AUTOINCREMENT,
        center_code TEXT NOT NULL,
        center_name TEXT NOT NULL,
        division_code TEXT,
        division_name TEXT,
        team_code TEXT NOT NULL,
        team_name TEXT NOT NULL,
        group_code TEXT,
        group_name TEXT,
        hierarchy_level INTEGER,
        full_path TEXT,
        total_employees INTEGER,
        avg_work_hours REAL,
        avg_efficiency REAL,
        is_active BOOLEAN DEFAULT 1,
        effective_date DATE,
        expiry_date DATE,
        UNIQUE(center_code, division_code, team_code, group_code)
      );
    `)

    // employee_profiles
    this.analyticsDb.exec(`
      DROP TABLE IF EXISTS employee_profiles;
      
      CREATE TABLE employee_profiles (
        employee_id INTEGER PRIMARY KEY,
        employee_name TEXT NOT NULL,
        center_code TEXT,
        division_code TEXT,
        team_code TEXT,
        group_code TEXT,
        job_group TEXT,
        job_title TEXT,
        job_level TEXT,
        work_type TEXT DEFAULT 'regular',
        is_flexible_work BOOLEAN DEFAULT 0,
        flexible_work_type TEXT,
        flexible_work_start_date DATE,
        flexible_work_end_date DATE,
        flexible_core_start TIME,
        flexible_core_end TIME,
        flexible_min_hours REAL,
        flexible_max_hours REAL,
        standard_clock_in TIME DEFAULT '09:00',
        standard_clock_out TIME DEFAULT '18:00',
        standard_work_hours REAL DEFAULT 8.0,
        avg_actual_clock_in TIME,
        avg_actual_clock_out TIME,
        avg_actual_work_hours REAL,
        work_pattern_consistency REAL,
        hire_date DATE,
        is_active BOOLEAN DEFAULT 1,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // work_patterns
    this.analyticsDb.exec(`
      DROP TABLE IF EXISTS work_patterns;
      
      CREATE TABLE work_patterns (
        pattern_id INTEGER PRIMARY KEY AUTOINCREMENT,
        aggregation_level TEXT,
        aggregation_code TEXT,
        date DATE NOT NULL,
        hour INTEGER,
        day_of_week INTEGER,
        dominant_tag_code TEXT,
        dominant_tag_ratio REAL,
        tag_diversity REAL,
        work_state_ratio REAL,
        rest_state_ratio REAL,
        meal_state_ratio REAL,
        meeting_state_ratio REAL,
        event_count INTEGER,
        unique_employees INTEGER,
        avg_confidence REAL,
        std_confidence REAL,
        anomaly_count INTEGER,
        anomaly_ratio REAL
      );
    `)

    // confidence_weights
    this.analyticsDb.exec(`
      DROP TABLE IF EXISTS confidence_weights;
      
      CREATE TABLE confidence_weights (
        weight_id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope_type TEXT,
        scope_code TEXT,
        tag_code TEXT,
        hour_range_start INTEGER,
        hour_range_end INTEGER,
        day_of_week INTEGER,
        is_flexible_work BOOLEAN,
        base_weight REAL DEFAULT 1.0,
        context_weight REAL DEFAULT 1.0,
        group_weight REAL DEFAULT 1.0,
        sequence_weight REAL DEFAULT 1.0,
        sample_size INTEGER,
        accuracy REAL,
        last_trained DATETIME,
        is_active BOOLEAN DEFAULT 1,
        UNIQUE(scope_type, scope_code, tag_code, hour_range_start, day_of_week)
      );
    `)

    // analysis_cache
    this.analyticsDb.exec(`
      DROP TABLE IF EXISTS analysis_cache;
      
      CREATE TABLE analysis_cache (
        cache_id INTEGER PRIMARY KEY AUTOINCREMENT,
        cache_key TEXT UNIQUE NOT NULL,
        query_type TEXT,
        employee_id INTEGER,
        date_from DATE,
        date_to DATE,
        organization_code TEXT,
        organization_level TEXT,
        result_json TEXT,
        row_count INTEGER,
        execution_time_ms INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        hit_count INTEGER DEFAULT 0,
        last_accessed DATETIME
      );
    `)

    console.log('✅ 테이블 생성 완료')
  }

  /**
   * 2. 인덱스 생성
   */
  createIndexes() {
    console.log('\n🔍 인덱스 생성 중...')

    const indexes = [
      // master_events_table 인덱스
      'CREATE INDEX idx_met_timestamp ON master_events_table(timestamp)',
      'CREATE INDEX idx_met_emp_date ON master_events_table(employee_id, date)',
      'CREATE INDEX idx_met_date_hour ON master_events_table(date, hour)',
      'CREATE INDEX idx_met_center_date ON master_events_table(center_code, date)',
      'CREATE INDEX idx_met_team_date ON master_events_table(team_code, date)',
      'CREATE INDEX idx_met_tag_date ON master_events_table(tag_code, date)',
      'CREATE INDEX idx_met_state_judgment ON master_events_table(state, judgment)',
      'CREATE INDEX idx_met_flexible ON master_events_table(is_flexible_work, flexible_work_type)',
      
      // organization_hierarchy 인덱스
      'CREATE INDEX idx_oh_center ON organization_hierarchy(center_code)',
      'CREATE INDEX idx_oh_team ON organization_hierarchy(team_code)',
      'CREATE INDEX idx_oh_path ON organization_hierarchy(full_path)',
      
      // employee_profiles 인덱스
      'CREATE INDEX idx_ep_flexible ON employee_profiles(is_flexible_work)',
      'CREATE INDEX idx_ep_team ON employee_profiles(team_code)',
      'CREATE INDEX idx_ep_work_type ON employee_profiles(work_type)',
      
      // work_patterns 인덱스
      'CREATE INDEX idx_wp_level_date ON work_patterns(aggregation_level, date)',
      'CREATE INDEX idx_wp_code_date ON work_patterns(aggregation_code, date)',
      
      // confidence_weights 인덱스
      'CREATE INDEX idx_cw_scope ON confidence_weights(scope_type, scope_code)',
      'CREATE INDEX idx_cw_tag ON confidence_weights(tag_code)',
      
      // analysis_cache 인덱스
      'CREATE INDEX idx_ac_key ON analysis_cache(cache_key)',
      'CREATE INDEX idx_ac_expires ON analysis_cache(expires_at)'
    ]

    for (const index of indexes) {
      try {
        this.analyticsDb.exec(index)
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          throw error
        }
      }
    }

    console.log('✅ 인덱스 생성 완료')
  }

  /**
   * 3. 뷰 생성
   */
  createViews() {
    console.log('\n👁️ 뷰 생성 중...')

    // 실시간 근무 현황 뷰
    this.analyticsDb.exec(`
      DROP VIEW IF EXISTS v_realtime_work_status;
      
      CREATE VIEW v_realtime_work_status AS
      SELECT 
        e.employee_id,
        e.employee_name,
        e.team_name,
        e.is_flexible_work,
        m.state as current_state,
        m.judgment as current_judgment,
        m.final_confidence,
        m.timestamp as last_event_time,
        m.duration_minutes as minutes_in_state
      FROM employee_profiles e
      LEFT JOIN master_events_table m ON e.employee_id = m.employee_id
      WHERE m.event_id = (
        SELECT MAX(event_id) 
        FROM master_events_table 
        WHERE employee_id = e.employee_id 
        AND date = DATE('now')
      );
    `)

    // 탄력근무자 분석 뷰
    this.analyticsDb.exec(`
      DROP VIEW IF EXISTS v_flexible_work_analysis;
      
      CREATE VIEW v_flexible_work_analysis AS
      SELECT 
        e.employee_id,
        e.employee_name,
        e.flexible_work_type,
        DATE(m.timestamp) as work_date,
        MIN(TIME(m.timestamp)) as first_event,
        MAX(TIME(m.timestamp)) as last_event,
        SUM(CASE WHEN m.judgment IN ('집중업무', '일반업무') THEN m.duration_minutes ELSE 0 END) as total_work_minutes,
        AVG(m.final_confidence) as avg_confidence
      FROM employee_profiles e
      JOIN master_events_table m ON e.employee_id = m.employee_id
      WHERE e.is_flexible_work = 1
      GROUP BY e.employee_id, DATE(m.timestamp);
    `)

    console.log('✅ 뷰 생성 완료')
  }

  /**
   * 4. 초기 데이터 로드 (조직 구조)
   */
  loadOrganizationData() {
    console.log('\n📊 조직 데이터 로드 중...')

    // 운영 DB에서 조직 데이터 가져오기
    const organizations = this.operationalDb.prepare(`
      SELECT DISTINCT
        CASE 
          WHEN org_level = 'center' THEN org_code 
          ELSE NULL 
        END as center_code,
        CASE 
          WHEN org_level = 'center' THEN org_name 
          ELSE NULL 
        END as center_name,
        CASE 
          WHEN org_level = 'team' THEN parent_org_code 
          ELSE NULL 
        END as team_parent,
        CASE 
          WHEN org_level = 'team' THEN org_code 
          ELSE NULL 
        END as team_code,
        CASE 
          WHEN org_level = 'team' THEN org_name 
          ELSE NULL 
        END as team_name,
        CASE 
          WHEN org_level = 'group' THEN parent_org_code 
          ELSE NULL 
        END as group_parent,
        CASE 
          WHEN org_level = 'group' THEN org_code 
          ELSE NULL 
        END as group_code,
        CASE 
          WHEN org_level = 'group' THEN org_name 
          ELSE NULL 
        END as group_name
      FROM organization_master
      WHERE is_active = 1
    `).all()

    // 조직 계층 구조 재구성 및 삽입
    const insertOrg = this.analyticsDb.prepare(`
      INSERT OR IGNORE INTO organization_hierarchy (
        center_code, center_name, division_code, division_name,
        team_code, team_name, group_code, group_name,
        hierarchy_level, full_path, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `)

    // 실제 구현시 조직 계층 재구성 로직 필요
    console.log('⚠️  조직 데이터는 별도 마이그레이션 필요')
  }

  /**
   * 5. 샘플 데이터 생성 (테스트용)
   */
  createSampleData() {
    console.log('\n🧪 샘플 데이터 생성 중...')

    const insertEmployee = this.analyticsDb.prepare(`
      INSERT INTO employee_profiles (
        employee_id, employee_name, center_code, team_code,
        job_group, is_flexible_work, flexible_work_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    // 샘플 직원 추가
    insertEmployee.run(1001, '홍길동', 'CENTER1', 'TEAM1', '생산직', 0, null)
    insertEmployee.run(1002, '김철수', 'CENTER1', 'TEAM1', '지원직', 1, '시차출퇴근')
    insertEmployee.run(1003, '이영희', 'CENTER2', 'TEAM2', '연구직', 1, '재택근무')

    console.log('✅ 샘플 데이터 생성 완료')
  }

  /**
   * 6. 데이터베이스 최적화 설정
   */
  optimizeDatabase() {
    console.log('\n⚡ 데이터베이스 최적화 중...')

    this.analyticsDb.exec(`
      -- WAL 모드 활성화 (동시성 향상)
      PRAGMA journal_mode = WAL;
      
      -- 캐시 크기 설정 (64MB)
      PRAGMA cache_size = -64000;
      
      -- 임시 저장소를 메모리에
      PRAGMA temp_store = MEMORY;
      
      -- 동기화 모드 (성능 우선)
      PRAGMA synchronous = NORMAL;
      
      -- 자동 분석 실행
      ANALYZE;
    `)

    console.log('✅ 최적화 완료')
  }

  /**
   * 7. 연결 종료
   */
  close() {
    this.analyticsDb.close()
    this.operationalDb.close()
    console.log('\n🎉 Master Database 생성 완료!')
    console.log(`📍 위치: ${ANALYTICS_DB_PATH}`)
  }

  /**
   * 전체 실행
   */
  async run() {
    try {
      this.createTables()
      this.createIndexes()
      this.createViews()
      this.loadOrganizationData()
      this.createSampleData()
      this.optimizeDatabase()
    } catch (error) {
      console.error('❌ 오류 발생:', error)
      throw error
    } finally {
      this.close()
    }
  }
}

// 실행
if (require.main === module) {
  const creator = new MasterDatabaseCreator()
  creator.run().catch(console.error)
}

export { MasterDatabaseCreator }