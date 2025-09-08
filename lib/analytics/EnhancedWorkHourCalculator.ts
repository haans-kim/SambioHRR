import type { WorkMetrics, TimelineEntry, TagEvent } from '@/types/analytics'
import type { GroundRulesMetrics } from '@/types/ground-rules'
import { ActivityState, WorkJudgment, TagCode } from '@/types/analytics'
import { WorkHourCalculator } from './WorkHourCalculator'
import { T1GroundRulesEngine } from './T1GroundRulesEngine'


/**
 * T1 Ground Rules가 통합된 향상된 작업시간 계산기
 * 
 * 기존 WorkHourCalculator 기능에 다음이 추가됩니다:
 * - T1 태그의 조직 맥락 기반 신뢰도 계산
 * - 팀별 이동 패턴 분석
 * - 업무/비업무 이동 구분
 * - 이상치 탐지 및 플래그
 */
export class EnhancedWorkHourCalculator extends WorkHourCalculator {
  private groundRulesEngine: T1GroundRulesEngine
  
  constructor(analyticsDbPath?: string) {
    super()
    this.groundRulesEngine = new T1GroundRulesEngine(analyticsDbPath)
  }
  
  /**
   * Ground Rules가 적용된 메트릭 계산
   */
  calculateEnhancedMetrics(
    timeline: TimelineEntry[], 
    employeeInfo: {
      employeeId: number
      teamName: string
      workScheduleType: string
    },
    date: string
  ): WorkMetrics {
    // 기본 메트릭 계산
    const baseMetrics = this.calculateMetrics(timeline)
    
    // Ground Rules 메트릭 계산
    const groundRulesMetrics = this.calculateGroundRulesMetrics(
      timeline, 
      employeeInfo, 
      date
    )
    
    return {
      ...baseMetrics,
      employeeId: employeeInfo.employeeId,
      date,
      groundRulesMetrics
    }
  }
  
  /**
   * Ground Rules 기반 메트릭 계산
   */
  private calculateGroundRulesMetrics(
    timeline: TimelineEntry[],
    employeeInfo: {
      employeeId: number
      teamName: string
      workScheduleType: string
    },
    date: string
  ): GroundRulesMetrics {
    const metrics: GroundRulesMetrics = {
      groundRulesWorkTime: 0,
      groundRulesConfidence: 0,
      t1WorkMovement: 0,
      t1NonWorkMovement: 0,
      teamBaselineUsed: 0,
      anomalyScore: 0,
      appliedRulesCount: 0
    }
    
    // T1 태그들만 추출하고 Ground Rules 적용
    const t1Entries = timeline.filter(entry => entry.tagCode === TagCode.T1)
    let totalConfidence = 0
    let workMovementTime = 0
    let nonWorkMovementTime = 0
    let anomalyCount = 0
    let appliedRulesTotal = 0
    
    for (let i = 0; i < t1Entries.length; i++) {
      const current = t1Entries[i]
      const prev = i > 0 ? t1Entries[i - 1] : null
      const next = i < t1Entries.length - 1 ? t1Entries[i + 1] : null
      
      // T1Context 생성
      const context = {
        teamName: employeeInfo.teamName,
        workScheduleType: employeeInfo.workScheduleType,
        hour: current.timestamp.getHours(),
        prevTag: prev?.tagCode || null,
        nextTag: next?.tagCode || null,
        duration: current.duration || 0,
        employeeId: employeeInfo.employeeId,
        date
      }
      
      // Ground Rules 신뢰도 계산
      const confidenceResult = this.groundRulesEngine.calculateT1Confidence(context)
      
      totalConfidence += confidenceResult.finalConfidence
      appliedRulesTotal += confidenceResult.appliedRules.length
      
      if (confidenceResult.anomalyFlag) {
        anomalyCount++
      }
      
      // 팀 기준선 사용 (첫 번째 항목에서만)
      if (i === 0) {
        metrics.teamBaselineUsed = Math.round(confidenceResult.teamBaseline * 100)
      }
      
      // 신뢰도에 따라 업무/비업무 이동 분류
      const duration = current.duration || 0
      if (confidenceResult.finalConfidence >= 0.5) {
        workMovementTime += duration
      } else {
        nonWorkMovementTime += duration
      }
    }
    
    // 메트릭 집계
    if (t1Entries.length > 0) {
      metrics.groundRulesConfidence = Math.round((totalConfidence / t1Entries.length) * 100)
      metrics.anomalyScore = Math.round((anomalyCount / t1Entries.length) * 100)
      metrics.appliedRulesCount = appliedRulesTotal
    }
    
    metrics.t1WorkMovement = workMovementTime
    metrics.t1NonWorkMovement = nonWorkMovementTime
    
    // Ground Rules 기반 작업시간 계산
    // 높은 신뢰도의 T1 이동은 업무 관련으로 간주
    metrics.groundRulesWorkTime = workMovementTime
    
    return metrics
  }
  
  /**
   * 기존 reliabilityScore를 Ground Rules 정보로 향상
   */
  protected calculateReliability(timeline: TimelineEntry[]): number {
    const baseScore = super.calculateReliability(timeline)
    
    // T1 태그가 있으면 Ground Rules 신뢰도 정보 반영 가능
    // 현재는 기본 구현 사용, 필요시 확장
    return baseScore
  }
  
  /**
   * Ground Rules 기반 작업시간 비교
   */
  compareWithGroundRules(
    metrics: WorkMetrics, 
    claimedHours: number
  ): {
    traditional: { difference: number; percentage: number; status: 'under' | 'over' | 'match' }
    groundRules: { difference: number; percentage: number; status: 'under' | 'over' | 'match' }
    improvement: number // Ground Rules로 인한 정확도 개선 (%)
  } {
    // 전통적인 계산
    const traditional = this.compareWithClaim(metrics, claimedHours)
    
    // Ground Rules 기반 계산 (T1 업무 이동 시간 포함)
    const groundRulesWorkHours = (metrics.workTime + (metrics.groundRulesMetrics?.t1WorkMovement || 0)) / 60
    const groundRulesDifference = groundRulesWorkHours - claimedHours
    const groundRulesPercentage = claimedHours > 0 
      ? Math.round((groundRulesDifference / claimedHours) * 100)
      : 0
    
    let groundRulesStatus: 'under' | 'over' | 'match'
    if (Math.abs(groundRulesDifference) < 0.5) {
      groundRulesStatus = 'match'
    } else if (groundRulesDifference < 0) {
      groundRulesStatus = 'under'
    } else {
      groundRulesStatus = 'over'
    }
    
    const groundRules = {
      difference: groundRulesDifference,
      percentage: groundRulesPercentage,
      status: groundRulesStatus
    }
    
    // 정확도 개선 계산 (오차 감소율)
    const traditionalError = Math.abs(traditional.percentage)
    const groundRulesError = Math.abs(groundRulesPercentage)
    const improvement = traditionalError > 0 
      ? Math.round(((traditionalError - groundRulesError) / traditionalError) * 100)
      : 0
    
    return {
      traditional,
      groundRules,
      improvement
    }
  }
  
  /**
   * 팀 기준 이상치 분석 보고서
   */
  generateAnomalyReport(metrics: WorkMetrics): {
    hasAnomalies: boolean
    anomalyLevel: 'none' | 'low' | 'medium' | 'high'
    summary: string
    recommendations: string[]
  } {
    const anomalyScore = metrics.groundRulesMetrics?.anomalyScore || 0
    const confidence = metrics.groundRulesMetrics?.groundRulesConfidence || 0
    
    let anomalyLevel: 'none' | 'low' | 'medium' | 'high'
    let summary: string
    const recommendations: string[] = []
    
    if (anomalyScore === 0) {
      anomalyLevel = 'none'
      summary = '팀 패턴과 일치하는 정상적인 이동 패턴입니다.'
    } else if (anomalyScore <= 20) {
      anomalyLevel = 'low'
      summary = `일부 이동 패턴이 팀 기준과 다릅니다 (${anomalyScore}%).`
      recommendations.push('특별한 업무나 일정 변경이 있었는지 확인해보세요.')
    } else if (anomalyScore <= 50) {
      anomalyLevel = 'medium'
      summary = `이동 패턴이 팀 평균과 상당히 다릅니다 (${anomalyScore}%).`
      recommendations.push('업무 일정이나 근무 형태에 변화가 있었는지 검토하세요.')
      recommendations.push('특별 프로젝트나 외부 업무가 있었는지 확인하세요.')
    } else {
      anomalyLevel = 'high'
      summary = `이동 패턴이 팀 기준과 매우 다릅니다 (${anomalyScore}%).`
      recommendations.push('근무 상황에 대한 상세한 검토가 필요합니다.')
      recommendations.push('관리자와 상담을 통해 근무 패턴을 점검하세요.')
      recommendations.push('데이터 수집 오류나 시스템 문제는 없는지 확인하세요.')
    }
    
    if (confidence < 50) {
      recommendations.push(`신뢰도가 낮습니다 (${confidence}%). 더 많은 태그 데이터가 필요할 수 있습니다.`)
    }
    
    return {
      hasAnomalies: anomalyScore > 0,
      anomalyLevel,
      summary,
      recommendations
    }
  }
  
  /**
   * 리소스 정리
   */
  close(): void {
    this.groundRulesEngine.close()
  }
}