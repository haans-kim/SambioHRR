#!/usr/bin/env ts-node

/**
 * Ground Rules 전체 팀 검증 스크립트
 * 
 * 이 스크립트는 모든 팀의 Ground Rules 분류가 올바른지 검증합니다:
 * 1. 각 팀의 T1/O 비율과 이동성 레벨 분류 확인
 * 2. 현장직 vs 사무직 특성 분석
 * 3. 기준 신뢰도가 적절한지 검증
 * 4. 이상하게 분류된 팀들 식별
 */

import Database from 'better-sqlite3'
import { performance } from 'perf_hooks'
import path from 'path'

interface TeamAnalysis {
  teamName: string
  workScheduleType: string
  totalEvents: number
  t1Events: number
  oEvents: number
  t1Percentage: number
  t1ToORatio: number
  teamSize: number
  
  // Ground Rules 분류 결과
  mobilityLevel: string
  baselineConfidence: number
  
  // 검증 결과
  expectedMobilityLevel: string
  isCorrectClassification: boolean
  recommendedAction: string
}

class GroundRulesValidator {
  private analyticsDb: Database.Database
  private humanDb: Database.Database
  
  constructor() {
    this.analyticsDb = new Database(path.join(process.cwd(), 'sambio_analytics.db'), { readonly: true })
    this.humanDb = new Database(path.join(process.cwd(), 'sambio_human.db'), { readonly: true })
  }
  
  /**
   * 모든 팀의 통계 데이터 조회
   */
  private getAllTeamStats(): any[] {
    const query = `
      SELECT 
        team_name,
        work_schedule_type,
        COUNT(*) as total_events,
        SUM(CASE WHEN tag_code = 'T1' THEN 1 ELSE 0 END) as t1_events,
        SUM(CASE WHEN tag_code = 'O' THEN 1 ELSE 0 END) as o_events,
        ROUND(100.0 * SUM(CASE WHEN tag_code = 'T1' THEN 1 ELSE 0 END) / COUNT(*), 2) as t1_percentage,
        ROUND(1.0 * SUM(CASE WHEN tag_code = 'T1' THEN 1 ELSE 0 END) / 
              NULLIF(SUM(CASE WHEN tag_code = 'O' THEN 1 ELSE 0 END), 0), 3) as t1_to_o_ratio,
        COUNT(DISTINCT employee_id) as team_size
      FROM master_events_table 
      WHERE team_name IS NOT NULL 
        AND team_name != ''
        AND work_schedule_type IS NOT NULL
      GROUP BY team_name, work_schedule_type
      HAVING COUNT(*) > 500
      ORDER BY t1_to_o_ratio DESC
    `
    
    return this.analyticsDb.prepare(query).all()
  }
  
  /**
   * 팀 이름을 기반으로 업무 특성 추정
   */
  private estimateTeamCharacteristics(teamName: string): { expectedMobility: string, teamType: string } {
    const name = teamName.toLowerCase()
    
    // 현장직/고이동성 팀 키워드
    if (name.includes('안전') || name.includes('환경') || name.includes('시설') || 
        name.includes('plant') || name.includes('제조') || name.includes('생산') ||
        name.includes('maintenance') || name.includes('engineering') || name.includes('operations')) {
      return { expectedMobility: 'HIGH', teamType: '현장직' }
    }
    
    // 중이동성 팀 키워드
    if (name.includes('qc') || name.includes('qa') || name.includes('품질') ||
        name.includes('검사') || name.includes('시험') || name.includes('분석')) {
      return { expectedMobility: 'MEDIUM', teamType: '품질관리' }
    }
    
    // 사무직/저이동성 팀 키워드  
    if (name.includes('인사') || name.includes('hr') || name.includes('전략') ||
        name.includes('기획') || name.includes('재무') || name.includes('회계') ||
        name.includes('법무') || name.includes('감사')) {
      return { expectedMobility: 'LOW', teamType: '사무직' }
    }
    
    // 개발/연구직 - 중저이동성
    if (name.includes('개발') || name.includes('연구') || name.includes('r&d') ||
        name.includes('dev') || name.includes('lab')) {
      return { expectedMobility: 'LOW', teamType: '개발/연구직' }
    }
    
    return { expectedMobility: 'UNKNOWN', teamType: '기타' }
  }
  
  /**
   * 현재 Ground Rules 로직으로 이동성 레벨 계산 (팀 특성 고려)
   */
  private calculateMobilityLevel(t1ToORatio: number, teamName: string): string {
    const teamType = this.classifyTeamByName(teamName)
    
    // 극고이동성: 특수한 경우들
    if (t1ToORatio >= 200) return 'VERY_HIGH'
    
    // 사무직 특별 처리
    if (teamType === 'OFFICE') {
      if (t1ToORatio >= 50) return 'HIGH'
      if (t1ToORatio >= 10) return 'MEDIUM'
      if (t1ToORatio >= 2.0) return 'LOW'
      return 'VERY_LOW'
    }
    
    // 현장직 특별 처리
    if (teamType === 'FIELD') {
      if (t1ToORatio >= 50) return 'VERY_HIGH'
      if (t1ToORatio >= 5.0) return 'HIGH'
      if (t1ToORatio >= 1.0) return 'MEDIUM'
      return 'MEDIUM'
    }
    
    // 일반적인 분류
    if (t1ToORatio >= 100) return 'VERY_HIGH'
    if (t1ToORatio >= 50) return 'HIGH'
    if (t1ToORatio >= 30) return 'MEDIUM'
    if (t1ToORatio >= 5.0) return 'HIGH'
    if (t1ToORatio >= 2.0) return 'MEDIUM'
    if (t1ToORatio >= 0.5) return 'LOW'
    return 'VERY_LOW'
  }
  
  /**
   * 팀 이름으로 업무 특성 분류
   */
  private classifyTeamByName(teamName: string): 'OFFICE' | 'FIELD' | 'UNKNOWN' {
    const name = teamName.toLowerCase()
    
    // 현장직 키워드
    if (name.includes('plant') || name.includes('제조') || name.includes('생산') ||
        name.includes('qc') || name.includes('qa') || name.includes('품질') ||
        name.includes('안전') || name.includes('환경') || name.includes('시설') ||
        name.includes('maintenance') || name.includes('operations')) {
      return 'FIELD'
    }
    
    // 사무직 키워드
    if (name.includes('hr') || name.includes('인사') || name.includes('전략') ||
        name.includes('기획') || name.includes('재무') || name.includes('회계') ||
        name.includes('법무') || name.includes('감사') || name.includes('개발') ||
        name.includes('연구') || name.includes('r&d') || name.includes('dev') ||
        name.includes('lab') || name.includes('strategy')) {
      return 'OFFICE'
    }
    
    return 'UNKNOWN'
  }
  
  /**
   * 기준 신뢰도 계산
   */
  private calculateBaselineConfidence(mobilityLevel: string): number {
    const baseConfidenceMap: Record<string, number> = {
      'VERY_HIGH': 0.65,
      'HIGH': 0.50,
      'MEDIUM': 0.35,
      'LOW': 0.25,
      'VERY_LOW': 0.20
    }
    
    return baseConfidenceMap[mobilityLevel] || 0.25
  }
  
  /**
   * 분류가 올바른지 검증
   */
  private validateClassification(analysis: TeamAnalysis): { isCorrect: boolean, action: string } {
    const { teamName, t1ToORatio, mobilityLevel, expectedMobilityLevel } = analysis
    
    // 현장직인데 LOW로 분류된 경우
    if (expectedMobilityLevel === 'HIGH' && (mobilityLevel === 'LOW' || mobilityLevel === 'VERY_LOW')) {
      return {
        isCorrect: false,
        action: `현장직이지만 ${mobilityLevel}로 분류됨. HIGH로 조정 필요 (현재 비율: ${t1ToORatio})`
      }
    }
    
    // 사무직인데 HIGH로 분류된 경우
    if (expectedMobilityLevel === 'LOW' && (mobilityLevel === 'HIGH' || mobilityLevel === 'VERY_HIGH')) {
      return {
        isCorrect: false,
        action: `사무직이지만 ${mobilityLevel}로 분류됨. 임계값 조정 검토 필요 (현재 비율: ${t1ToORatio})`
      }
    }
    
    // T1/O 비율이 매우 높은데 LOW로 분류된 경우
    if (t1ToORatio > 10 && mobilityLevel === 'LOW') {
      return {
        isCorrect: false,
        action: `높은 T1/O 비율(${t1ToORatio})이지만 LOW로 분류됨. 임계값 조정 필요`
      }
    }
    
    return { isCorrect: true, action: '올바른 분류' }
  }
  
  /**
   * 전체 검증 실행
   */
  async validateAllTeams(): Promise<void> {
    console.log('🔍 Ground Rules 전체 팀 검증 시작...\n')
    
    const teamStats = this.getAllTeamStats()
    const analyses: TeamAnalysis[] = []
    
    // 각 팀 분석
    for (const stats of teamStats) {
      const teamCharacteristics = this.estimateTeamCharacteristics(stats.team_name)
      const mobilityLevel = this.calculateMobilityLevel(stats.t1_to_o_ratio || 0, stats.team_name)
      const baselineConfidence = this.calculateBaselineConfidence(mobilityLevel)
      
      const analysis: TeamAnalysis = {
        teamName: stats.team_name,
        workScheduleType: stats.work_schedule_type,
        totalEvents: stats.total_events,
        t1Events: stats.t1_events,
        oEvents: stats.o_events,
        t1Percentage: stats.t1_percentage,
        t1ToORatio: stats.t1_to_o_ratio || 0,
        teamSize: stats.team_size,
        mobilityLevel,
        baselineConfidence: Math.round(baselineConfidence * 100),
        expectedMobilityLevel: teamCharacteristics.expectedMobility,
        isCorrectClassification: false,
        recommendedAction: ''
      }
      
      const validation = this.validateClassification(analysis)
      analysis.isCorrectClassification = validation.isCorrect
      analysis.recommendedAction = validation.action
      
      analyses.push(analysis)
    }
    
    // 결과 출력
    this.printValidationResults(analyses)
  }
  
  /**
   * 검증 결과 출력
   */
  private printValidationResults(analyses: TeamAnalysis[]): void {
    const correctClassifications = analyses.filter(a => a.isCorrectClassification)
    const incorrectClassifications = analyses.filter(a => !a.isCorrectClassification)
    
    console.log('📊 === Ground Rules 전체 팀 검증 결과 ===')
    console.log(`총 ${analyses.length}개 팀-근무제 조합 분석`)
    console.log(`✅ 올바른 분류: ${correctClassifications.length}개 (${Math.round((correctClassifications.length / analyses.length) * 100)}%)`)
    console.log(`❌ 문제 분류: ${incorrectClassifications.length}개 (${Math.round((incorrectClassifications.length / analyses.length) * 100)}%)\n`)
    
    // 이동성 레벨별 통계
    console.log('📈 === 이동성 레벨별 분포 ===')
    const mobilityStats = this.getMobilityStats(analyses)
    Object.entries(mobilityStats).forEach(([level, count]) => {
      console.log(`${level}: ${count}개 팀`)
    })
    console.log()
    
    // 문제 있는 분류들 상세 출력
    if (incorrectClassifications.length > 0) {
      console.log('⚠️  === 수정이 필요한 팀들 ===')
      incorrectClassifications
        .sort((a, b) => b.t1ToORatio - a.t1ToORatio)
        .slice(0, 10) // 상위 10개만
        .forEach(analysis => {
          console.log(`📋 ${analysis.teamName} (${analysis.workScheduleType})`)
          console.log(`   T1/O 비율: ${analysis.t1ToORatio} | T1%: ${analysis.t1Percentage}%`)
          console.log(`   현재: ${analysis.mobilityLevel} (${analysis.baselineConfidence}%) | 예상: ${analysis.expectedMobilityLevel}`)
          console.log(`   👉 ${analysis.recommendedAction}\n`)
        })
    }
    
    // 높은 T1/O 비율 팀들 (TOP 10)
    console.log('🔥 === T1/O 비율 상위 10개 팀 ===')
    analyses
      .sort((a, b) => b.t1ToORatio - a.t1ToORatio)
      .slice(0, 10)
      .forEach((analysis, index) => {
        const status = analysis.isCorrectClassification ? '✅' : '❌'
        console.log(`${index + 1}. ${status} ${analysis.teamName} - T1/O: ${analysis.t1ToORatio} (${analysis.mobilityLevel})`)
      })
    
    console.log('\n🎯 검증 완료!')
  }
  
  /**
   * 이동성 레벨별 통계 계산
   */
  private getMobilityStats(analyses: TeamAnalysis[]): Record<string, number> {
    return analyses.reduce((stats, analysis) => {
      stats[analysis.mobilityLevel] = (stats[analysis.mobilityLevel] || 0) + 1
      return stats
    }, {} as Record<string, number>)
  }
  
  /**
   * 리소스 정리
   */
  close(): void {
    this.analyticsDb.close()
    this.humanDb.close()
  }
}

// 스크립트 실행
if (require.main === module) {
  const validator = new GroundRulesValidator()
  
  validator.validateAllTeams()
    .then(() => {
      validator.close()
      console.log('\n✨ 검증 완료!')
    })
    .catch((error) => {
      console.error('🚨 검증 중 오류 발생:', error)
      validator.close()
      process.exit(1)
    })
}

export { GroundRulesValidator }