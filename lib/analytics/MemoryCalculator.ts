/**
 * 메모리 기반 계산 엔진
 * DB 접근 없이 메모리 데이터만 사용하여 병렬 처리 최적화
 */

import type { WorkMetrics, TimelineEntry, TagEvent } from '../../types/analytics'
import type { GroundRulesMetrics } from '../../types/ground-rules'
import { ActivityState, WorkJudgment, TagCode } from '../../types/analytics'
import { ActivityStateMachine } from '../classifier/StateMachine'
import { JobGroupClassifier } from '../classifier/JobGroupClassifier'
import { WorkHourCalculator } from './WorkHourCalculator'
import type { MemoryDataset, EmployeeData, EventData } from './MemoryDataLoader'

export interface MemoryCalculationResult {
  employeeId: number
  employeeName: string
  date: string
  metrics: WorkMetrics
  claimedHours?: number
  groundRulesAnalysis?: any
  error?: string
  // 조직 정보 추가
  centerId?: string
  centerName?: string
  teamId?: string
  teamName?: string
  groupId?: string
  groupName?: string
}

export class MemoryCalculator {
  private dataset: MemoryDataset
  private jobGroupClassifier: JobGroupClassifier

  constructor(dataset: MemoryDataset) {
    this.dataset = dataset
    this.jobGroupClassifier = new JobGroupClassifier()
  }

  /**
   * 단일 직원의 단일 날짜 분석 (완전 메모리 기반)
   */
  calculateEmployeeDay(employeeId: number, date: string): MemoryCalculationResult {
    try {
      // 직원 정보 가져오기 (메모리에서)
      const employee = this.dataset.employees.get(employeeId)
      if (!employee) {
        return {
          employeeId,
          employeeName: 'Unknown',
          date,
          metrics: this.createEmptyMetrics(),
          error: 'Employee not found in memory dataset',
          centerId: '',
          centerName: '',
          teamId: '',
          teamName: '',
          groupId: '',
          groupName: ''
        }
      }

      // 이벤트 데이터 가져오기 (메모리에서)
      const employeeEvents = this.dataset.events.get(employeeId)
      const dayEvents = employeeEvents?.get(date) || []
      
      if (dayEvents.length === 0) {
        return {
          employeeId,
          employeeName: employee.employeeName,
          date,
          metrics: this.createEmptyMetrics(),
          error: 'No events found for this date',
          centerId: employee.centerCode || '',
          centerName: employee.centerName || '',
          teamId: employee.teamCode || '',
          teamName: employee.teamName || '',
          groupId: employee.groupCode || '',
          groupName: employee.groupName || ''
        }
      }

      // 이벤트를 TagEvent 형식으로 변환
      const tagEvents = this.convertToTagEvents(dayEvents)

      // Job group 분류
      const jobGroup = this.jobGroupClassifier.classifyEmployee({
        employee_id: employee.employeeId,
        name: employee.employeeName,
        department: employee.groupName,
        position: '',
        hire_date: '',
        gender: '',
        shift_type: ''
      })

      // Timeline 생성 (메모리 기반)
      const timeline = this.createTimeline(tagEvents, jobGroup)

      // 기존 WorkHourCalculator를 기본으로 사용 (85-120% 효율성 유지)
      const workHourCalculator = new WorkHourCalculator()
      const baseMetrics = workHourCalculator.calculateMetrics(timeline)

      // Ground Rules로 미세 조정 (T1 태그만 보정)
      const groundRulesMetrics = this.calculateGroundRulesAdjustment(
        timeline,
        baseMetrics,
        employee,
        date
      )

      // 신고 근무시간 가져오기
      const claimedHours = this.getClaimedHours(employeeId, date)

      // 최종 메트릭 조합
      const metrics: WorkMetrics = {
        ...baseMetrics,
        employeeId,
        date,
        groundRulesMetrics
      }

      return {
        employeeId,
        employeeName: employee.employeeName,
        date,
        metrics,
        claimedHours,
        centerId: employee.centerCode || '',
        centerName: employee.centerName || '',
        teamId: employee.teamCode || '',
        teamName: employee.teamName || '',
        groupId: employee.groupCode || '',
        groupName: employee.groupName || ''
      }

    } catch (error) {
      // 에러 발생 시에도 employee 정보가 있으면 조직 정보 포함
      const employee = this.dataset.employees.get(employeeId)
      return {
        employeeId,
        employeeName: employee?.employeeName || 'Unknown',
        date,
        metrics: this.createEmptyMetrics(),
        error: error instanceof Error ? error.message : 'Unknown calculation error',
        centerId: employee?.centerCode || '',
        centerName: employee?.centerName || '',
        teamId: employee?.teamCode || '',
        teamName: employee?.teamName || '',
        groupId: employee?.groupCode || '',
        groupName: employee?.groupName || ''
      }
    }
  }

  /**
   * 여러 직원의 여러 날짜 병렬 분석
   */
  async calculateBatch(employeeIds: number[], dates: string[]): Promise<MemoryCalculationResult[]> {
    const tasks: Array<{ employeeId: number, date: string }> = []
    
    // 모든 조합 생성
    for (const employeeId of employeeIds) {
      for (const date of dates) {
        tasks.push({ employeeId, date })
      }
    }

    console.log(`🚀 Starting ${tasks.length} calculations in MEMORY-PARALLEL mode`)
    const startTime = Date.now()

    // 진짜 병렬 처리 (DB 접근 없음)
    const results = await Promise.all(
      tasks.map(async ({ employeeId, date }) => {
        return this.calculateEmployeeDay(employeeId, date)
      })
    )

    const duration = Date.now() - startTime
    console.log(`✅ ${tasks.length} calculations completed in ${duration}ms`)
    
    return results
  }

  private convertToTagEvents(events: EventData[]): TagEvent[] {
    return events.map(event => ({
      timestamp: event.timestamp,
      employeeId: event.employeeId,
      tagCode: event.tagCode as TagCode,
      location: event.tagLocation || '',
      source: event.tagType === 'TagLog' ? 'tag' as const : 
              event.tagType === 'Meal' ? 'meal' as const :
              event.tagType === 'Knox' ? 'knox' as const : 'equipment' as const,
      duration: event.duration || 0
    }))
  }

  private createTimeline(events: TagEvent[], jobGroup: string): TimelineEntry[] {
    const stateMachine = new ActivityStateMachine()
    const timeline: TimelineEntry[] = []

    // T 태그 위치 찾기
    const firstTTagIndex = events.findIndex(e => 
      e.tagCode === 'T1' || e.tagCode === 'T2' || e.tagCode === 'T3'
    )
    const reversedIndex = events.slice().reverse().findIndex(e => 
      e.tagCode === 'T1' || e.tagCode === 'T2' || e.tagCode === 'T3'
    )
    const lastTTagIndex = reversedIndex !== -1 ? events.length - 1 - reversedIndex : -1

    for (let i = 0; i < events.length; i++) {
      const current = events[i]
      const prev = i > 0 ? events[i - 1] : null
      const next = i < events.length - 1 ? events[i + 1] : null

      // T1->T1->G1 패턴 체크
      let isT1ToG1Pattern = false
      if (current.tagCode === 'T1' && next && next.tagCode === 'T1') {
        const nextNext = i < events.length - 2 ? events[i + 2] : null
        if (nextNext && nextNext.tagCode === 'G1') {
          const nextDuration = Math.floor((nextNext.timestamp.getTime() - next.timestamp.getTime()) / 60000)
          if (nextDuration <= 30) {
            isT1ToG1Pattern = true
          }
        }
      }

      const isFirstTTag = i === firstTTagIndex
      const isLastTTag = i === lastTTagIndex && lastTTagIndex !== -1

      const entry = stateMachine.classifyEvent(
        current,
        prev,
        next,
        jobGroup,
        isFirstTTag,
        isLastTTag,
        isT1ToG1Pattern
      )

      timeline.push(entry)
    }

    return timeline
  }

  private calculateBasicMetrics(timeline: TimelineEntry[]): Omit<WorkMetrics, 'employeeId' | 'date' | 'groundRulesMetrics'> {
    let totalTime = 0
    let workTime = 0
    let estimatedWorkTime = 0
    let focusTime = 0
    let meetingTime = 0
    let mealTime = 0
    let transitTime = 0
    let restTime = 0

    for (const current of timeline) {
      const duration = current.duration || 0

      totalTime += duration

      // T1 work return assumptions count as estimated work
      if (current.assumption === 'T1_WORK_RETURN') {
        estimatedWorkTime += duration * (current.confidence || 0.5)
      }

      switch (current.state) {
        case ActivityState.WORK:
          workTime += duration
          if (current.judgment === WorkJudgment.FOCUSED) {
            focusTime += duration
          }
          break
        case ActivityState.MEETING:
          meetingTime += duration
          break
        case ActivityState.MEAL:
          mealTime += duration
          break
        case ActivityState.TRANSIT:
          transitTime += duration
          break
        case ActivityState.REST:
          restTime += duration
          break
      }
    }

    const workRatio = totalTime > 0 ? workTime / totalTime : 0
    const reliabilityScore = this.calculateReliabilityScore(timeline)

    return {
      totalTime,
      workTime,
      estimatedWorkTime,
      workRatio,
      focusTime,
      meetingTime,
      mealTime,
      transitTime,
      restTime,
      reliabilityScore // Already 0-100 range from original logic
    }
  }

  private calculateGroundRulesAdjustment(
    timeline: TimelineEntry[],
    baseMetrics: WorkMetrics,
    employee: EmployeeData,
    date: string
  ): GroundRulesMetrics {
    // AI 보정: 기존 WorkHourCalculator 결과를 기반으로 미세 조정 (±5% 정도만)
    
    // 팀 특성 가져오기 (메모리에서)
    const teamCharacteristics = this.dataset.teamCharacteristics.get(employee.teamName)
    
    // T1 태그 기반 미세 조정 계산
    const t1Events = timeline.filter(entry => entry.tagCode === 'T1')
    let adjustmentFactor = 1.0  // 기본: 조정 없음
    
    // T1 패턴 기반 미세 조정 (최대 ±5%)
    if (t1Events.length > 0) {
      let businessMovementScore = 0
      
      for (let i = 0; i < t1Events.length; i++) {
        const t1Event = t1Events[i]
        const hour = t1Event.timestamp.getHours()
        
        // 전후 태그 확인 (업무 이동인지 판단)
        const prevEvent = i > 0 ? timeline[timeline.findIndex(e => e === t1Event) - 1] : null
        const nextEvent = i < timeline.length - 1 ? timeline[timeline.findIndex(e => e === t1Event) + 1] : null
        
        // O-T1-O 패턴: 업무간 이동으로 간주 (+점수)
        if (prevEvent?.tagCode === 'O' && nextEvent?.tagCode === 'O') {
          businessMovementScore += 2.0
        }
        // 출퇴근 시간대 이동: 업무 관련성 높음 (+점수)  
        else if ((hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 19)) {
          businessMovementScore += 1.5
        }
        // 점심시간 이동: 비업무 관련성 높음 (-점수)
        else if (hour >= 12 && hour <= 13) {
          businessMovementScore -= 0.5
        }
      }
      
      // 평균 점수로 조정 팩터 계산 (0.95 ~ 1.05 범위)
      const avgScore = businessMovementScore / t1Events.length
      adjustmentFactor = Math.max(0.95, Math.min(1.05, 1.0 + (avgScore * 0.01)))
    }
    
    // Ground Rules 조정된 업무시간 = 기존 업무시간 * 조정팩터
    const groundRulesWorkTime = baseMetrics.workTime * adjustmentFactor
    
    // 간단한 신뢰도 계산 (T1 개수와 팀 특성 기반)
    const baseConfidence = teamCharacteristics?.tagRatio || 0.5
    const t1Confidence = Math.min(0.8, baseConfidence + (t1Events.length * 0.02))
    
    // 통계 계산
    let t1WorkMovement = 0
    let t1NonWorkMovement = 0
    const totalConfidence = t1Confidence * t1Events.length
    
    // T1 이동 분류 (조정팩터 기반으로 간단하게 계산)
    if (adjustmentFactor > 1.0) {
      // 업무 이동으로 판정된 경우가 더 많음
      t1WorkMovement = t1Events.length * 5 * 0.8  // 80% 업무 이동으로 간주
      t1NonWorkMovement = t1Events.length * 5 * 0.2
    } else {
      // 비업무 이동으로 판정된 경우가 더 많음
      t1WorkMovement = t1Events.length * 5 * 0.3  // 30% 업무 이동으로 간주
      t1NonWorkMovement = t1Events.length * 5 * 0.7
    }
    
    // 평균 신뢰도 계산 (간단하게)
    const groundRulesConfidence = t1Events.length > 0 ? t1Confidence * 100 : 50
    
    // 이상치 점수 계산 (조정 정도로 판단)
    const adjustmentAmount = Math.abs(adjustmentFactor - 1.0)
    const anomalyScore = adjustmentAmount > 0.02 ? adjustmentAmount * 100 : 0

    return {
      groundRulesWorkTime,
      groundRulesConfidence: Math.round(groundRulesConfidence * 10) / 10, // Convert to % with 1 decimal place
      t1WorkMovement,
      t1NonWorkMovement,
      teamBaselineUsed: 50.0, // Default T1 baseline confidence (50%)
      anomalyScore: Math.round(anomalyScore * 1000) / 10, // Convert to % with 1 decimal place
      appliedRulesCount: 0 // Simplified for now
    }
  }

  private getClaimedHours(employeeId: number, date: string): number | null {
    const employeeClaimData = this.dataset.claimData.get(employeeId)
    if (!employeeClaimData) return null
    
    const dayClaimData = employeeClaimData.get(date)
    return dayClaimData ? dayClaimData.claimedHours : null
  }

  private calculateReliabilityScore(timeline: TimelineEntry[]): number {
    let score = 50 // Base score
    
    // Factors that increase reliability
    const oTagCount = timeline.filter(e => e.tagCode === TagCode.O).length
    const totalEvents = timeline.length
    
    if (totalEvents > 0) {
      // O tag coverage (up to +30 points)
      const oTagRatio = oTagCount / totalEvents
      score += Math.min(oTagRatio * 100, 30)
      
      // Event frequency (up to +20 points)
      const timeSpan = timeline[timeline.length - 1].timestamp.getTime() - timeline[0].timestamp.getTime()
      const eventsPerHour = totalEvents / (timeSpan / 3600000)
      if (eventsPerHour > 5) score += 20
      else if (eventsPerHour > 3) score += 15
      else if (eventsPerHour > 1) score += 10
      else score += 5
    }
    
    // Factors that decrease reliability
    const uncertainEvents = timeline.filter(e => e.assumption === 'T1_UNCERTAIN').length
    const uncertainRatio = totalEvents > 0 ? uncertainEvents / totalEvents : 0
    score -= uncertainRatio * 20
    
    // Long gaps decrease reliability
    let maxGap = 0
    for (let i = 1; i < timeline.length; i++) {
      const gap = timeline[i].timestamp.getTime() - timeline[i-1].timestamp.getTime()
      maxGap = Math.max(maxGap, gap)
    }
    if (maxGap > 2 * 60 * 60 * 1000) score -= 10 // >2 hour gap
    
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  private createEmptyMetrics(): WorkMetrics {
    return {
      employeeId: 0,
      date: '',
      totalTime: 0,
      workTime: 0,
      estimatedWorkTime: 0,
      workRatio: 0,
      focusTime: 0,
      meetingTime: 0,
      mealTime: 0,
      transitTime: 0,
      restTime: 0,
      reliabilityScore: 0,
      groundRulesMetrics: this.createEmptyGroundRulesMetrics()
    }
  }

  private createEmptyGroundRulesMetrics(): GroundRulesMetrics {
    return {
      groundRulesWorkTime: 0,
      groundRulesConfidence: 0,
      t1WorkMovement: 0,
      t1NonWorkMovement: 0,
      teamBaselineUsed: 0,
      anomalyScore: 0,
      appliedRulesCount: 0
    }
  }
}