import { 
  TagCode, 
  ActivityState, 
  WorkJudgment,
  T1_CONFIGS,
  type TagEvent,
  type TimelineEntry
} from '../../types/analytics'

interface StateTransition {
  from: TagCode
  to: TagCode
  state: ActivityState
  probability: number
}

export class ActivityStateMachine {
  private transitions: Map<string, StateTransition>
  
  constructor() {
    this.transitions = new Map()
    this.initializeTransitions()
  }
  
  // Helper to compare tag codes (handles both string and enum)
  private isTagCode(tagCode: TagCode | string, expectedCode: TagCode): boolean {
    return tagCode === expectedCode || tagCode === expectedCode.toString()
  }
  
  private initializeTransitions() {
    // O tag transitions (highest confidence)
    this.addTransition('O', 'O', ActivityState.WORK, 0.98)
    this.addTransition('G1', 'O', ActivityState.WORK, 0.98)
    this.addTransition('O', 'G1', ActivityState.WORK, 0.95)
    this.addTransition('O', 'T1', ActivityState.TRANSIT, 0.90)
    this.addTransition('O', 'M1', ActivityState.MEAL, 1.00)
    this.addTransition('O', 'T2', ActivityState.EXIT, 0.90)
    
    // M1/M2 transitions (meal tags)
    this.addTransition('T1', 'M1', ActivityState.MEAL, 1.00)
    this.addTransition('M1', 'T1', ActivityState.TRANSIT, 1.00)
    this.addTransition('T1', 'M2', ActivityState.TRANSIT, 1.00) // Takeout is transit
    this.addTransition('M2', 'N2', ActivityState.REST, 0.90) // Eating in rest area
    
    // G1-G4 transitions (work areas)
    this.addTransition('G1', 'G1', ActivityState.WORK, 0.85)
    this.addTransition('G2', 'G1', ActivityState.WORK, 0.90)
    this.addTransition('G1', 'G3', ActivityState.MEETING, 0.95)
    this.addTransition('G1', 'G4', ActivityState.EDUCATION, 0.95)
    this.addTransition('T2', 'G2', ActivityState.PREPARATION, 0.95)
    
    // Entry/Exit transitions
    this.addTransition('T2', 'T1', ActivityState.ENTRY, 0.95)
    this.addTransition('T1', 'T2', ActivityState.EXIT, 0.90)
    this.addTransition('T3', 'T1', ActivityState.ENTRY, 0.95)
    this.addTransition('T1', 'T3', ActivityState.EXIT, 0.90)
    
    // Rest transitions
    this.addTransition('G1', 'N1', ActivityState.REST, 0.90)
    this.addTransition('N1', 'G1', ActivityState.WORK, 0.85)
    this.addTransition('N1', 'N1', ActivityState.REST, 0.95)
    this.addTransition('N2', 'N2', ActivityState.REST, 0.95)
  }
  
  private addTransition(from: string, to: string, state: ActivityState, probability: number) {
    const key = `${from}->${to}`
    this.transitions.set(key, {
      from: from as TagCode,
      to: to as TagCode,
      state,
      probability
    })
  }
  
  classifyEvent(
    current: TagEvent,
    prev: TagEvent | null,
    next: TagEvent | null,
    jobGroup: string = 'OFFICE',
    isFirstTTag: boolean = false,
    isLastTTag: boolean = false,
    isT1ToG1Pattern: boolean = false
  ): TimelineEntry {
    const duration = next 
      ? Math.floor((next.timestamp.getTime() - current.timestamp.getTime()) / 60000)
      : 0
    
    // Special handling for O tags
    if (this.isTagCode(current.tagCode, TagCode.O)) {
      return this.classifyOTag(current, prev, next, duration)
    }
    
    // Special handling for T2 tags (Entry/Exit)
    if (this.isTagCode(current.tagCode, TagCode.T2)) {
      // First T tag of the day is entry (clock in)
      if (isFirstTTag) {
        return {
          timestamp: current.timestamp,
          tagType: 'TagLog',
          tagName: current.location,
          tagCode: current.tagCode,
          duration,
          state: ActivityState.ENTRY,
          judgment: WorkJudgment.CLOCK_IN,
          confidence: 1.0
        }
      }
      
      // Last T tag of the day is exit (clock out)
      if (isLastTTag) {
        return {
          timestamp: current.timestamp,
          tagType: 'TagLog',
          tagName: current.location,
          tagCode: current.tagCode,
          duration,
          state: ActivityState.EXIT,
          judgment: WorkJudgment.CLOCK_OUT,
          confidence: 1.0
        }
      }
      
      // Middle T2 tags during the day are non-work (외출)
      return {
        timestamp: current.timestamp,
        tagType: 'TagLog',
        tagName: current.location,
        tagCode: current.tagCode,
        duration,
        state: ActivityState.NON_WORK,
        judgment: WorkJudgment.NON_WORK,
        confidence: 1.0
      }
    }
    
    // Special handling for T3 tags (Exit)
    if (this.isTagCode(current.tagCode, TagCode.T3)) {
      // First T tag of the day is entry (clock in) - rare but possible
      if (isFirstTTag) {
        return {
          timestamp: current.timestamp,
          tagType: 'TagLog',
          tagName: current.location,
          tagCode: current.tagCode,
          duration,
          state: ActivityState.ENTRY,
          judgment: WorkJudgment.CLOCK_IN,
          confidence: 1.0
        }
      }
      
      // Last T tag of the day is exit (clock out)
      if (isLastTTag) {
        return {
          timestamp: current.timestamp,
          tagType: 'TagLog',
          tagName: current.location,
          tagCode: current.tagCode,
          duration,
          state: ActivityState.EXIT,
          judgment: WorkJudgment.CLOCK_OUT,
          confidence: 1.0
        }
      }
      
      // Middle T3 tags during the day are non-work (외출)
      return {
        timestamp: current.timestamp,
        tagType: 'TagLog',
        tagName: current.location,
        tagCode: current.tagCode,
        duration,
        state: ActivityState.NON_WORK,
        judgment: WorkJudgment.NON_WORK,
        confidence: 1.0
      }
    }
    
    // Special handling for T1 tags (critical)
    if (this.isTagCode(current.tagCode, TagCode.T1)) {
      // First T tag of the day is entry (clock in) - for managers with cars
      if (isFirstTTag) {
        return {
          timestamp: current.timestamp,
          tagType: 'TagLog',
          tagName: current.location,
          tagCode: current.tagCode,
          duration,
          state: ActivityState.ENTRY,
          judgment: WorkJudgment.CLOCK_IN,
          confidence: 1.0
        }
      }
      
      // Last T tag of the day is exit (clock out) - for managers with cars
      if (isLastTTag) {
        return {
          timestamp: current.timestamp,
          tagType: 'TagLog',
          tagName: current.location,
          tagCode: current.tagCode,
          duration,
          state: ActivityState.EXIT,
          judgment: WorkJudgment.CLOCK_OUT,
          confidence: 1.0
        }
      }
      
      // Middle T1 tags use existing logic (transit/work movement)
      return this.classifyT1Tag(current, prev, next, duration, jobGroup, isT1ToG1Pattern)
    }
    
    // Special handling for M1 tags (meal in cafeteria - 30 minutes)
    if (this.isTagCode(current.tagCode, TagCode.M1)) {
      return {
        timestamp: current.timestamp,
        tagType: 'Meal',
        tagName: current.location,
        tagCode: current.tagCode,
        duration: 30,  // Fixed 30 minutes for dine-in
        state: ActivityState.MEAL,
        judgment: WorkJudgment.MEAL,
        confidence: 1.0
      }
    }
    
    // Special handling for M2 tags (takeout - 10 minutes)
    if (this.isTagCode(current.tagCode, TagCode.M2)) {
      return {
        timestamp: current.timestamp,
        tagType: 'Meal',
        tagName: current.location,
        tagCode: current.tagCode,
        duration: 10,  // Fixed 10 minutes for takeout
        state: ActivityState.MEAL,
        judgment: WorkJudgment.MEAL,
        confidence: 1.0
      }
    }
    
    // Special handling for G2 tags (preparation space)
    if (this.isTagCode(current.tagCode, TagCode.G2)) {
      return {
        timestamp: current.timestamp,
        tagType: 'TagLog',
        tagName: current.location,
        tagCode: current.tagCode,
        duration,
        state: ActivityState.PREPARATION,
        judgment: WorkJudgment.WORK,
        confidence: 0.9
      }
    }
    
    // Special handling for G3 tags (meeting space)
    if (this.isTagCode(current.tagCode, TagCode.G3)) {
      // If this is a Knox PIMS meeting with a predefined duration
      let actualDuration = duration
      
      // If the meeting is interrupted by a T tag (leaving), adjust the duration
      if (next && (this.isTagCode(next.tagCode, TagCode.T1) ||
                   this.isTagCode(next.tagCode, TagCode.T2) ||
                   this.isTagCode(next.tagCode, TagCode.T3))) {
        // Meeting ended early when person left
        actualDuration = Math.min(duration, actualDuration)
      }
      
      // If source is Knox and has a duration property, use that unless interrupted
      if (current.source === 'knox' && current.duration) {
        actualDuration = Math.min(current.duration, duration)
      }
      
      return {
        timestamp: current.timestamp,
        tagType: current.source === 'knox' ? 'Knox' : 'TagLog',
        tagName: current.location,
        tagCode: current.tagCode,
        duration: actualDuration,
        state: ActivityState.MEETING,
        judgment: WorkJudgment.WORK,
        confidence: 0.95
      }
    }
    
    // Special handling for G4 tags (education space)
    if (this.isTagCode(current.tagCode, TagCode.G4)) {
      return {
        timestamp: current.timestamp,
        tagType: 'TagLog',
        tagName: current.location,
        tagCode: current.tagCode,
        duration,
        state: ActivityState.EDUCATION,
        judgment: WorkJudgment.WORK,
        confidence: 0.95
      }
    }
    
    // Special handling for G1 tags (work space)
    if (this.isTagCode(current.tagCode, TagCode.G1)) {
      // G1 is work space - primary work location
      // G1 is ALWAYS work, regardless of duration
      let state = ActivityState.WORK
      let judgment = WorkJudgment.WORK
      let confidence = 0.85
      
      // Adjust confidence based on duration, but always keep as WORK
      if (duration < 5) {
        // Short stay but still work
        confidence = 0.75
      } else if (duration < 15) {
        // Normal work session
        confidence = 0.85
      } else {
        // Clear work session
        confidence = 0.95
      }
      
      // If previous tag was T2 (entrance) or T1 (corridor), increase confidence
      if (prev && (this.isTagCode(prev.tagCode, TagCode.T2) || 
                   this.isTagCode(prev.tagCode, TagCode.T1))) {
        confidence = Math.max(confidence, 0.85)
      }
      
      // If next tag is also G1, it's continuous work
      if (next && this.isTagCode(next.tagCode, TagCode.G1)) {
        confidence = Math.max(confidence, 0.9)
      }
      
      return {
        timestamp: current.timestamp,
        tagType: 'TagLog',
        tagName: current.location,
        tagCode: current.tagCode,
        duration,
        state,
        judgment,
        confidence
      }
    }
    
    // Special handling for N2 tags
    if (this.isTagCode(current.tagCode, TagCode.N2)) {
      // If previous tag is also N2, this is transit (leaving rest area)
      if (prev && this.isTagCode(prev.tagCode, TagCode.N2)) {
        return {
          timestamp: current.timestamp,
          tagType: 'TagLog',
          tagName: current.location,
          tagCode: current.tagCode,
          duration,
          state: ActivityState.TRANSIT,
          judgment: WorkJudgment.MOVEMENT,
          confidence: 0.95
        }
      }
      // First N2 is rest
      return {
        timestamp: current.timestamp,
        tagType: 'TagLog',
        tagName: current.location,
        tagCode: current.tagCode,
        duration,
        state: ActivityState.REST,
        judgment: WorkJudgment.NON_WORK,
        confidence: 0.95
      }
    }
    
    // Normal transition lookup
    let state = ActivityState.TRANSIT
    let confidence = 0.5
    let assumption = undefined
    
    if (prev) {
      const transitionKey = `${prev.tagCode}->${current.tagCode}`
      const transition = this.transitions.get(transitionKey)
      
      if (transition) {
        state = transition.state
        confidence = transition.probability
      }
    }
    
    // Long duration adjustments
    if (duration > 120 && this.isTagCode(current.tagCode, TagCode.N1)) {
      state = ActivityState.NON_WORK
      confidence = 0.90
    }
    
    return {
      timestamp: current.timestamp,
      tagType: this.getTagType(current.source),
      tagName: current.location,
      tagCode: current.tagCode,
      duration,
      state,
      judgment: this.getWorkJudgment(state),
      confidence,
      assumption
    }
  }
  
  private classifyOTag(
    current: TagEvent,
    prev: TagEvent | null,
    next: TagEvent | null,
    duration: number
  ): TimelineEntry {
    let state = ActivityState.WORK
    let confidence = 0.98
    
    // O->O is strongest work indicator
    if (next && this.isTagCode(next.tagCode, TagCode.O)) {
      confidence = 0.98
    } else if (prev && this.isTagCode(prev.tagCode, TagCode.O)) {
      confidence = 0.98
    } else if (prev && this.isTagCode(prev.tagCode, TagCode.G1)) {
      confidence = 0.98
    }
    
    return {
      timestamp: current.timestamp,
      tagType: 'Equipment',
      tagName: current.location,
      tagCode: current.tagCode,
      duration,
      state,
      judgment: WorkJudgment.WORK,
      confidence
    }
  }
  
  private classifyT1Tag(
    current: TagEvent,
    prev: TagEvent | null,
    next: TagEvent | null,
    duration: number,
    jobGroup: string,
    isT1ToG1Pattern: boolean = false
  ): TimelineEntry {
    const config = T1_CONFIGS[jobGroup] || T1_CONFIGS.OFFICE
    
    // T1 -> O 패턴: 업무 복귀 가능성 높음
    if (next && this.isTagCode(next.tagCode, TagCode.O)) {
      // T1 -> O는 업무 복귀로 판정 (85% 확률)
      return {
        timestamp: current.timestamp,
        tagType: 'TagLog',
        tagName: current.location,
        tagCode: current.tagCode,
        duration,
        state: ActivityState.WORK,
        judgment: WorkJudgment.WORK,
        confidence: 0.85,
        assumption: 'T1_WORK_RETURN'
      }
    }
    
    // T1 -> G1 패턴: G1에서 T1 거쳐 다시 G1으로 가는 경우 (꼬리물기 패턴 등 고려)
    if (next && this.isTagCode(next.tagCode, TagCode.G1)) {
      // G1->T1->G1 패턴은 대부분 업무 이동으로 간주 (꼬리물기 등)
      // 시간과 관계없이 기본적으로 업무로 판정하되, 시간에 따라 확률 조정
      
      if (duration <= 30) {
        // 30분 이내: 높은 확률로 업무
        return {
          timestamp: current.timestamp,
          tagType: 'TagLog',
          tagName: current.location,
          tagCode: current.tagCode,
          duration,
          state: ActivityState.WORK,
          judgment: WorkJudgment.WORK,
          confidence: 0.90,  // 높은 확률
          assumption: 'T1_WORK_RETURN'
        }
      } else if (duration <= 90) {
        // 30-90분: 중간 확률로 업무 (꼬리물기로 들어갔다가 대기 등)
        return {
          timestamp: current.timestamp,
          tagType: 'TagLog',
          tagName: current.location,
          tagCode: current.tagCode,
          duration,
          state: ActivityState.WORK,
          judgment: WorkJudgment.WORK,
          confidence: 0.75,  // 중간 확률
          assumption: 'T1_TAILGATING'  // 꼬리물기 패턴
        }
      } else {
        // 90분 초과: 낮은 확률로 업무 (그래도 G1으로 돌아왔으니 업무 가능성)
        return {
          timestamp: current.timestamp,
          tagType: 'TagLog',
          tagName: current.location,
          tagCode: current.tagCode,
          duration,
          state: ActivityState.WORK,
          judgment: WorkJudgment.WORK,
          confidence: 0.60,  // 낮은 확률
          assumption: 'T1_LONG_WAIT'
        }
      }
    }
    
    // T1 -> T1 간격에 따른 판정
    if (next && this.isTagCode(next.tagCode, TagCode.T1)) {
      // If this is part of T1 -> T1 -> G1 pattern where next T1 leads to G1 within 30 minutes
      if (isT1ToG1Pattern) {
        // First T1 in the pattern should be treated as work movement
        return {
          timestamp: current.timestamp,
          tagType: 'TagLog',
          tagName: current.location,
          tagCode: current.tagCode,
          duration,
          state: ActivityState.WORK,
          judgment: WorkJudgment.WORK,
          confidence: 0.85,
          assumption: 'T1_WORK_RETURN'
        }
      }
      
      // Normal T1 -> T1 pattern handling
      if (duration < 10) {
        // Short duration: likely transit
        return {
          timestamp: current.timestamp,
          tagType: 'TagLog',
          tagName: current.location,
          tagCode: current.tagCode,
          duration,
          state: ActivityState.TRANSIT,
          judgment: WorkJudgment.MOVEMENT,
          confidence: 0.90
        }
      }
      // 10-30분: 85% 업무
      else if (duration <= 30) {
        return {
          timestamp: current.timestamp,
          tagType: 'TagLog',
          tagName: current.location,
          tagCode: current.tagCode,
          duration,
          state: ActivityState.WORK,
          judgment: WorkJudgment.WORK,
          confidence: 0.85,
          assumption: 'T1_WORK_RETURN'
        }
      }
      // > 30분: 90% 업무
      else {
        return {
          timestamp: current.timestamp,
          tagType: 'TagLog',
          tagName: current.location,
          tagCode: current.tagCode,
          duration,
          state: ActivityState.WORK,
          judgment: WorkJudgment.WORK,
          confidence: 0.90,
          assumption: 'T1_WORK_RETURN'
        }
      }
    }
    
    // T1 -> 다른 태그 또는 없음
    if (!next || duration > 30) {
      let probability = this.getT1TimeProbability(duration, config.defaultReturnProbability)
      
      // 30분 이상은 거의 확실히 업무 (꼬리물기 대기)
      // 짧은 시간만 이동으로 판정
      const threshold = 0.5  // 50% 이상이면 업무로 판정
      
      const state = probability > threshold ? ActivityState.WORK : ActivityState.TRANSIT
      const judgment = probability > threshold ? WorkJudgment.WORK : WorkJudgment.MOVEMENT
      
      // 60분 이상 T1 체류 시 assumption 추가
      let assumption: 'T1_WORK_RETURN' | 'T1_TAILGATING' | 'T1_LONG_WAIT' | 'T1_UNCERTAIN'
      if (duration > 120) {
        assumption = 'T1_LONG_WAIT'  // 2시간 이상: 장시간 대기
      } else if (duration > 60) {
        assumption = 'T1_TAILGATING'  // 1-2시간: 꼬리물기 대기
      } else if (probability > threshold) {
        assumption = 'T1_WORK_RETURN'  // 일반 업무 복귀
      } else {
        assumption = 'T1_UNCERTAIN'  // 불확실
      }
      
      return {
        timestamp: current.timestamp,
        tagType: 'TagLog',
        tagName: current.location,
        tagCode: current.tagCode,
        duration,
        state,
        judgment,
        confidence: probability,
        assumption
      }
    }
    
    // Normal transit (short duration to non-T1 tag)
    return {
      timestamp: current.timestamp,
      tagType: 'TagLog',
      tagName: current.location,
      tagCode: current.tagCode,
      duration,
      state: ActivityState.TRANSIT,
      judgment: WorkJudgment.MOVEMENT,
      confidence: 0.90
    }
  }
  
  private getT1TimeProbability(minutes: number, baseProb: number): number {
    // 시간이 길수록 업무 확률 증가 (긴 시간을 비업무로 판정하는 위험 방지)
    // T1에서 장시간 체류 = 꼬리물기 대기 또는 업무 관련 이동
    if (minutes < 5) return baseProb                         // 매우 짧음: 기본 확률
    if (minutes < 15) return Math.min(baseProb * 1.05, 0.90) // 짧음: 약간 증가
    if (minutes < 30) return Math.min(baseProb * 1.10, 0.92) // 보통: 증가
    if (minutes < 60) return Math.min(baseProb * 1.15, 0.95) // 긴편: 꼬리물기 가능성
    if (minutes < 90) return 0.95                            // 1시간 이상: 거의 확실히 업무
    if (minutes < 120) return 0.98                           // 1.5시간 이상: 매우 높은 확률
    return 0.99                                              // 2시간 이상: 거의 100% 업무
  }
  
  private getTagType(source: string): 'TagLog' | 'Meal' | 'Knox' | 'Equipment' {
    switch (source) {
      case 'meal':
        return 'Meal'
      case 'knox':
        return 'Knox'
      case 'equipment':
        return 'Equipment'
      default:
        return 'TagLog'
    }
  }
  
  private getWorkJudgment(state: ActivityState): WorkJudgment {
    switch (state) {
      case ActivityState.WORK:
      case ActivityState.PREPARATION:
      case ActivityState.MEETING:
      case ActivityState.EDUCATION:
        return WorkJudgment.WORK
      case ActivityState.MEAL:
        return WorkJudgment.MEAL
      case ActivityState.REST:
      case ActivityState.NON_WORK:
        return WorkJudgment.NON_WORK
      case ActivityState.TRANSIT:
        return WorkJudgment.MOVEMENT
      case ActivityState.ENTRY:
        return WorkJudgment.CLOCK_IN
      case ActivityState.EXIT:
        return WorkJudgment.CLOCK_OUT
      default:
        return WorkJudgment.MOVEMENT
    }
  }
  
  // Check if focused work (O tag density > 3/hour)
  checkFocusedWork(events: TagEvent[]): boolean {
    const oTags = events.filter(e => this.isTagCode(e.tagCode, TagCode.O))
    return oTags.length >= 3
  }
}