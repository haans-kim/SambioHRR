/**
 * 메모리 기반 계산 엔진
 * DB 접근 없이 메모리 데이터만 사용하여 병렬 처리 최적화
 */

import type { WorkMetrics, TimelineEntry, TagEvent } from '../../types/analytics'
import type { GroundRulesMetrics } from '../../types/ground-rules'
import { ActivityState, WorkJudgment, TagCode } from '../../types/analytics'
import { ActivityStateMachine } from '../classifier/StateMachine'
import { JobGroupClassifier } from '../classifier/JobGroupClassifier'
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
          centerId: employee.groupName || '',
          centerName: employee.groupName || '',
          teamId: employee.teamName ? employee.teamName.split(' ')[0] : '',
          teamName: employee.teamName || '',
          groupId: employee.groupName || '',
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

      // 기본 메트릭 계산
      const baseMetrics = this.calculateBasicMetrics(timeline)

      // Ground Rules 메트릭 계산 (메모리 기반)
      const groundRulesMetrics = this.calculateGroundRulesMetrics(
        timeline,
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
        centerId: employee.groupName || '',
        centerName: employee.groupName || '',
        teamId: employee.teamName ? employee.teamName.split(' ')[0] : '',
        teamName: employee.teamName || '',
        groupId: employee.groupName || '',
        groupName: employee.groupName || ''
      }

    } catch (error) {
      return {
        employeeId,
        employeeName: 'Unknown',
        date,
        metrics: this.createEmptyMetrics(),
        error: error instanceof Error ? error.message : 'Unknown calculation error',
        centerId: '',
        centerName: '',
        teamId: '',
        teamName: '',
        groupId: '',
        groupName: ''
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

  private calculateGroundRulesMetrics(
    timeline: TimelineEntry[],
    employee: EmployeeData,
    date: string
  ): GroundRulesMetrics {
    // 팀 특성 가져오기 (메모리에서)
    const teamKey = `${employee.teamName}_일반` // 기본 근무형태
    const teamCharacteristics = this.dataset.teamCharacteristics.get(employee.teamName)
    
    if (!teamCharacteristics) {
      return this.createEmptyGroundRulesMetrics()
    }

    // T1 태그 기반 이동 시간 계산
    const t1Events = timeline.filter(entry => entry.tagCode === 'T1')
    let t1WorkMovement = 0
    let t1NonWorkMovement = 0

    // 각 T1 이벤트에 대해 컨텍스트 기반 신뢰도 계산
    let totalConfidence = 0
    let confidenceCount = 0

    for (let i = 0; i < t1Events.length; i++) {
      const t1Event = t1Events[i]
      const hour = t1Event.timestamp.getHours()
      
      // 시간대별 가중치 계산
      let timeWeight = 1.0
      if (hour >= 6 && hour <= 8) timeWeight = 1.2  // 출근 시간
      else if (hour >= 12 && hour <= 13) timeWeight = 0.8  // 점심 시간
      else if (hour >= 17 && hour <= 19) timeWeight = 1.1  // 퇴근 시간
      
      // 시퀀스 기반 multiplier
      const prevEvent = i > 0 ? timeline[timeline.findIndex(e => e === t1Event) - 1] : null
      const nextEvent = i < timeline.length - 1 ? timeline[timeline.findIndex(e => e === t1Event) + 1] : null
      
      let sequenceMultiplier = 1.0
      if (prevEvent?.tagCode === 'O' && nextEvent?.tagCode === 'O') {
        sequenceMultiplier = 2.5  // O-T1-O 패턴 (업무 이동)
      } else if ((prevEvent?.tagCode === 'O' && nextEvent?.tagCode !== 'O') || 
                 (prevEvent?.tagCode !== 'O' && nextEvent?.tagCode === 'O')) {
        sequenceMultiplier = 2.2  // O-T1-X 또는 X-T1-O 패턴
      }
      
      // 85% baseline 접근: 팀별 기본 신뢰도 상향 조정
      const baseConfidence = teamCharacteristics?.tagRatio ? 
        Math.min(0.75, teamCharacteristics.tagRatio + 0.15) : 0.65 // 85% 목표를 위한 상향 조정
      
      // 최종 신뢰도 계산
      const eventConfidence = Math.min(0.95, Math.max(0.05, 
        baseConfidence * sequenceMultiplier * timeWeight
      ))
      
      totalConfidence += eventConfidence
      confidenceCount++
      
      // 신뢰도에 따라 업무/비업무 이동 분류
      const duration = 5 // 기본 T1 지속 시간 (분)
      if (eventConfidence > 0.6) {
        t1WorkMovement += duration
      } else {
        t1NonWorkMovement += duration
      }
    }

    // Ground Rules 기반 작업시간 재계산
    // 목표: 업무상 합리적인 이동 Loss 반영 (5-15% 감소, 85-95% 효율)
    let groundRulesWorkTime = 0
    let t1TotalTime = 0  // T1 태그 총 시간
    
    for (let i = 0; i < timeline.length - 1; i++) {
      const current = timeline[i]
      const next = timeline[i + 1]
      const duration = Math.floor((next.timestamp.getTime() - current.timestamp.getTime()) / 60000)
      
      if (current.state === ActivityState.WORK) {
        if (current.tagCode === 'T1') {
          // T1 태그: 합리적인 이동 Loss 적용 (보수적 접근)
          const hour = current.timestamp.getHours()
          const prevEvent = i > 0 ? timeline[i - 1] : null
          const nextEvent = next
          
          // 85% baseline 접근: 팀 기반 기본 신뢰도 상향 조정
          const baseConfidence = teamCharacteristics?.tagRatio ? 
            Math.min(0.75, teamCharacteristics.tagRatio + 0.15) : 0.65
          
          // 시간대별 가중치 (탄력근무제 야간근무 포함)
          let timeWeight = 1.0
          if (hour >= 22 || hour <= 6) {
            // 야간시간: 탄력근무제 야간근무 (22:00-06:00)
            timeWeight = 1.1  // 야간 작업 이동에 높은 가중치
          } else if (hour >= 6 && hour <= 8) {
            // 출근시간
            timeWeight = 1.1
          } else if (hour >= 12 && hour <= 13) {
            // 점심시간
            timeWeight = 0.95
          } else if (hour >= 17 && hour <= 19) {
            // 퇴근시간  
            timeWeight = 1.05
          }
          
          // 시퀀스 기반 multiplier (85% baseline 제한)
          let sequenceMultiplier = 1.0
          if (prevEvent?.tagCode === 'O' && nextEvent?.tagCode === 'O') {
            sequenceMultiplier = 1.15  // O-T1-O: 업무간 이동으로 높은 신뢰도
          } else if ((prevEvent?.tagCode === 'O' && nextEvent?.tagCode !== 'O') || 
                     (prevEvent?.tagCode !== 'O' && nextEvent?.tagCode === 'O')) {
            sequenceMultiplier = 1.1   // 부분적 업무 이동
          }
          
          // 85% baseline 제한: 최종 신뢰도가 0.85를 넘지 않도록 조정
          const tentativeConfidence = baseConfidence * sequenceMultiplier * timeWeight
          if (tentativeConfidence > 0.85) {
            sequenceMultiplier = 0.85 / (baseConfidence * timeWeight)
          }
          
          // Ground Rules 신뢰도 계산
          const t1Confidence = Math.min(0.95, Math.max(0.05, 
            baseConfidence * sequenceMultiplier * timeWeight
          ))
          
          // T1 이동시간도 85% 이상은 업무시간으로 인정 (합리적 Loss만 적용)
          groundRulesWorkTime += duration * t1Confidence
          t1TotalTime += duration
        } else {
          // O, G1, G2, G3 등 모든 업무 태그는 100% 업무시간으로 인정
          groundRulesWorkTime += duration
        }
      }
    }

    // 기존 작업시간 계산 (비교용)
    const baselineWorkTime = timeline.reduce((total, entry, index) => {
      if (index < timeline.length - 1 && entry.state === ActivityState.WORK) {
        const next = timeline[index + 1]
        return total + Math.floor((next.timestamp.getTime() - entry.timestamp.getTime()) / 60000)
      }
      return total
    }, 0)

    // 평균 신뢰도 계산
    const groundRulesConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0

    // 이상치 점수 계산 (Ground Rules 작업시간 vs 기존 작업시간 차이)
    const anomalyScore = baselineWorkTime > 0 ? 
      Math.abs(groundRulesWorkTime - baselineWorkTime) / baselineWorkTime : 0

    return {
      groundRulesWorkTime,
      groundRulesConfidence: Math.round(groundRulesConfidence * 1000) / 10, // Convert to % with 1 decimal place
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