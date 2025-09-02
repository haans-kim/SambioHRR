// Analytics and processing types

export enum TagCode {
  G1 = 'G1', // 주업무 공간
  G2 = 'G2', // 준비 공간
  G3 = 'G3', // 회의 공간
  G4 = 'G4', // 교육 공간
  N1 = 'N1', // 휴게 공간
  N2 = 'N2', // 복지시설
  T1 = 'T1', // 통로/계단
  T2 = 'T2', // 출입구(입)
  T3 = 'T3', // 출입구(출)
  M1 = 'M1', // 식당 내 식사
  M2 = 'M2', // 테이크아웃
  O = 'O'    // 실제 업무 로그
}

export enum ActivityState {
  WORK = '업무',
  PREPARATION = '준비',
  MEETING = '회의',
  EDUCATION = '교육',
  REST = '휴게',
  MEAL = '식사',
  TRANSIT = '경유',
  ENTRY = '출입IN',
  EXIT = '출입OUT',
  NON_WORK = '비업무'
}

export enum WorkJudgment {
  WORK = '업무',        // 업무, 준비, 회의, 교육
  FOCUSED = '집중업무', // O tag density > 3/hour
  NON_WORK = '비업무',  // 휴게
  MOVEMENT = '이동',    // 경유
  MEAL = '식사',       // 식사
  CLOCK_IN = '출근',    // 출입IN (T2)
  CLOCK_OUT = '퇴근'   // 출입OUT (T3)
}

export interface TagEvent {
  timestamp: Date
  employeeId: number
  tagCode: TagCode
  location: string
  source: 'tag' | 'meal' | 'knox' | 'equipment'
  duration?: number
}

export interface TimelineEntry {
  timestamp: Date
  tagType: 'TagLog' | 'Meal' | 'Knox' | 'Equipment'
  tagName: string
  tagCode: TagCode
  duration: number
  state: ActivityState
  judgment: WorkJudgment
  confidence?: number
  assumption?: 'T1_WORK_RETURN' | 'T1_TAILGATING' | 'T1_LONG_WAIT' | 'T1_UNCERTAIN' | 'T1_NON_WORK'
}

export interface WorkMetrics {
  employeeId: number
  date: string
  totalTime: number           // 총 체류시간 (분)
  workTime: number            // 실제 작업시간 (분)
  estimatedWorkTime: number   // 추정 작업시간 (분)
  workRatio: number           // 작업시간 추정률 (%)
  focusTime: number           // 집중작업시간 (분)
  meetingTime: number         // 회의시간 (분)
  mealTime: number            // 식사시간 (분)
  transitTime: number         // 이동시간 (분)
  restTime: number            // 휴식시간 (분)
  reliabilityScore: number    // 데이터 신뢰도 (0-100)
}

// T1 tag configuration by job group
export interface JobGroupT1Config {
  jobGroup: string
  defaultReturnProbability: number
  timeThresholds: {
    minutes: number
    probability: number
  }[]
  oTagWeight: number
}

export const T1_CONFIGS: Record<string, JobGroupT1Config> = {
  PRODUCTION: {
    jobGroup: 'PRODUCTION',
    defaultReturnProbability: 0.95,
    timeThresholds: [
      { minutes: 5, probability: 0.98 },
      { minutes: 15, probability: 0.95 },
      { minutes: 30, probability: 0.90 },
      { minutes: 60, probability: 0.75 },
      { minutes: 120, probability: 0.50 }
    ],
    oTagWeight: 1.2
  },
  RESEARCH: {
    jobGroup: 'RESEARCH',
    defaultReturnProbability: 0.85,
    timeThresholds: [
      { minutes: 5, probability: 0.95 },
      { minutes: 15, probability: 0.90 },
      { minutes: 30, probability: 0.85 },
      { minutes: 60, probability: 0.70 },
      { minutes: 120, probability: 0.45 }
    ],
    oTagWeight: 1.15
  },
  OFFICE: {
    jobGroup: 'OFFICE',
    defaultReturnProbability: 0.80,
    timeThresholds: [
      { minutes: 5, probability: 0.90 },
      { minutes: 15, probability: 0.85 },
      { minutes: 30, probability: 0.75 },
      { minutes: 60, probability: 0.60 },
      { minutes: 120, probability: 0.40 }
    ],
    oTagWeight: 1.25
  },
  MANAGEMENT: {
    jobGroup: 'MANAGEMENT',
    defaultReturnProbability: 0.75,
    timeThresholds: [
      { minutes: 5, probability: 0.85 },
      { minutes: 15, probability: 0.80 },
      { minutes: 30, probability: 0.70 },
      { minutes: 60, probability: 0.55 },
      { minutes: 120, probability: 0.35 }
    ],
    oTagWeight: 1.1
  }
}