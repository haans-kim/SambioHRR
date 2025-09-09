/**
 * Ground Rules 데이터로 organization_monthly_stats 테이블 업데이트 스크립트
 * 
 * 목표: 기존 대시보드 UI 변경 없이 Ground Rules 결과를 반영
 * 
 * 매핑:
 * - 주간 근무시간 = Claim 시간 (기존 유지)
 * - 주간 근무추정시간 = 기존 수치 유지  
 * - 근무추정시간(AI보정) = Ground Rules 업무시간으로 교체
 * - 효율성지표 = Ground Rules / Claim Data로 교체
 * - 데이터 신뢰도 = Ground Rules 신뢰도로 교체
 */

import Database from 'better-sqlite3'
import * as path from 'path'

interface GroundRulesResult {
  date: string
  employeeId: number
  employeeName: string
  claimedHours: number
  groundRulesWorkHours: number
  groundRulesConfidence: number
  efficiency: number
  orgCode: string
  teamName: string
  groupName: string
}

class OrganizationStatsUpdater {
  private humanDb: Database.Database
  private analyticsDb: Database.Database
  
  constructor() {
    this.humanDb = new Database(path.join(process.cwd(), 'sambio_human.db'))
    this.analyticsDb = new Database(path.join(process.cwd(), 'sambio_analytics.db'))
  }

  /**
   * 2025년 6월 Ground Rules 분석 결과를 조직 통계에 반영
   */
  async updateOrganizationStats() {
    console.log('🚀 조직 통계 업데이트 시작 (Ground Rules 반영)')
    
    try {
      // 1. Ground Rules 분석 결과 수집
      const groundRulesData = await this.collectGroundRulesData()
      console.log(`📊 Ground Rules 데이터 수집: ${groundRulesData.length}건`)
      
      // 2. 조직별 집계
      const orgStats = this.aggregateByOrganization(groundRulesData)
      console.log(`🏢 조직별 집계: ${Object.keys(orgStats).length}개 조직`)
      
      // 3. organization_monthly_stats 업데이트
      await this.updateMonthlyStats(orgStats)
      console.log('✅ 조직 통계 업데이트 완료')
      
    } catch (error) {
      console.error('❌ 조직 통계 업데이트 실패:', error)
      throw error
    }
  }

  /**
   * Ground Rules 분석 결과 데이터 수집
   */
  private async collectGroundRulesData(): Promise<GroundRulesResult[]> {
    // daily_analysis_results 테이블에서 Ground Rules 데이터 조회
    const stmt = this.humanDb.prepare(`
      SELECT 
        dar.analysis_date as date,
        dar.employee_id as employeeId,
        em.employee_name as employeeName,
        dar.claimed_work_hours as claimedHours,
        dar.ground_rules_work_hours as groundRulesWorkHours,
        dar.ground_rules_confidence as groundRulesConfidence,
        (dar.ground_rules_work_hours / NULLIF(dar.claimed_work_hours, 0)) * 100 as efficiency,
        om.org_code as orgCode,
        em.team_name as teamName,
        em.group_name as groupName
      FROM daily_analysis_results dar
      JOIN employees em ON dar.employee_id = em.employee_id
      JOIN organization_master om ON em.team_name = om.org_name OR em.group_name = om.org_name
      WHERE dar.analysis_date >= '2025-06-01' 
        AND dar.analysis_date <= '2025-06-30'
        AND dar.ground_rules_work_hours IS NOT NULL
        AND dar.claimed_work_hours > 0
      ORDER BY dar.analysis_date, dar.employee_id
    `)
    
    return stmt.all() as GroundRulesResult[]
  }

  /**
   * 조직별 데이터 집계
   */
  private aggregateByOrganization(data: GroundRulesResult[]): Record<string, any> {
    const orgStats: Record<string, any> = {}
    
    // 조직별 그룹화
    data.forEach(record => {
      const { orgCode } = record
      
      if (!orgStats[orgCode]) {
        orgStats[orgCode] = {
          orgCode,
          records: [],
          totalRecords: 0,
          avgClaimedHours: 0,
          avgGroundRulesWorkHours: 0,
          avgEfficiency: 0,
          avgConfidence: 0
        }
      }
      
      orgStats[orgCode].records.push(record)
    })
    
    // 조직별 평균 계산
    Object.keys(orgStats).forEach(orgCode => {
      const org = orgStats[orgCode]
      const records = org.records
      
      org.totalRecords = records.length
      org.avgClaimedHours = this.calculateAverage(records, 'claimedHours')
      org.avgGroundRulesWorkHours = this.calculateAverage(records, 'groundRulesWorkHours')
      org.avgEfficiency = this.calculateAverage(records, 'efficiency')
      org.avgConfidence = this.calculateAverage(records, 'groundRulesConfidence')
    })
    
    return orgStats
  }

  /**
   * 평균값 계산 헬퍼
   */
  private calculateAverage(records: any[], field: string): number {
    if (records.length === 0) return 0
    const sum = records.reduce((acc, record) => acc + (record[field] || 0), 0)
    return sum / records.length
  }

  /**
   * organization_monthly_stats 테이블 업데이트
   */
  private async updateMonthlyStats(orgStats: Record<string, any>) {
    const updateStmt = this.humanDb.prepare(`
      UPDATE organization_monthly_stats 
      SET 
        avg_actual_work_hours = ?, -- Ground Rules 업무시간으로 교체
        avg_work_efficiency = ?,  -- Ground Rules / Claim 효율성으로 교체
        avg_data_confidence = ?,  -- Ground Rules 신뢰도로 교체
        updated_at = datetime('now')
      WHERE org_code = ? 
        AND year = 2025 
        AND month = 6
    `)
    
    let updatedCount = 0
    
    Object.keys(orgStats).forEach(orgCode => {
      const stats = orgStats[orgCode]
      
      try {
        const result = updateStmt.run(
          stats.avgGroundRulesWorkHours,     // avg_actual_work_hours
          stats.avgEfficiency,               // avg_work_efficiency  
          stats.avgConfidence,               // avg_data_confidence
          orgCode
        )
        
        if (result.changes > 0) {
          updatedCount++
          console.log(`✅ ${orgCode}: Ground Rules 데이터 업데이트 완료`)
          console.log(`   - 평균 업무시간: ${stats.avgGroundRulesWorkHours.toFixed(2)}h`)
          console.log(`   - 효율성: ${stats.avgEfficiency.toFixed(1)}%`)
          console.log(`   - 신뢰도: ${stats.avgConfidence.toFixed(1)}%`)
        } else {
          console.log(`⚠️  ${orgCode}: 업데이트할 레코드가 없음 (2025년 6월 데이터 없음?)`)
        }
      } catch (error) {
        console.error(`❌ ${orgCode} 업데이트 실패:`, error)
      }
    })
    
    console.log(`📊 총 ${updatedCount}개 조직의 통계 업데이트 완료`)
  }

  /**
   * 리소스 정리
   */
  close() {
    this.humanDb.close()
    this.analyticsDb.close()
  }
}

// 실행
async function main() {
  const updater = new OrganizationStatsUpdater()
  
  try {
    await updater.updateOrganizationStats()
  } finally {
    updater.close()
  }
}

// 스크립트로 직접 실행될 때만 main 함수 실행
if (require.main === module) {
  main().catch(console.error)
}

export default OrganizationStatsUpdater