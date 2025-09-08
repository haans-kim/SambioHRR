// T1 Ground Rules 관련 타입 정의

export type MobilityLevel = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW'

export interface T1Context {
  teamName: string
  workScheduleType: string
  hour: number
  prevTag: string | null
  nextTag: string | null
  duration: number
  employeeId: number
  date: string
}

export interface ConfidenceResult {
  finalConfidence: number       // 최종 신뢰도 (0.05-0.95)
  teamBaseline: number         // 팀 기준선
  sequenceMultiplier: number   // 시퀀스 조정값
  timeWeight: number           // 시간 가중치
  specialRulesAdjustment: number // 특별규칙 조정값
  appliedRules: string[]       // 적용된 규칙들
  anomalyFlag: boolean         // 이상치 여부
}

export interface TeamCharacteristics {
  teamName: string
  workScheduleType: string
  mobilityLevel: MobilityLevel
  baselineConfidence: number
  timeWeights: Record<string, number>
  specialRules: SpecialRule[]
  t1Statistics: {
    totalEvents: number
    t1Events: number
    t1ToORatio: number
    hourlyPatterns: Record<number, number>
  }
}

export interface SpecialRule {
  ruleId: string
  condition: string
  action: 'BOOST_CONFIDENCE' | 'REDUCE_CONFIDENCE' | 'FLAG_ANOMALY'
  adjustment: number
  reason: string
}

export interface TeamStatistics {
  teamName: string
  workScheduleType: string
  totalEvents: number
  t1Events: number
  oEvents: number
  t1Percentage: number
  t1ToORatio: number
  teamSize: number
  morningT1Rate: number    // 06-08시 T1 비율
  lunchT1Rate: number      // 12-13시 T1 비율
  eveningT1Rate: number    // 17-19시 T1 비율
}

export interface GroundRulesMetrics {
  groundRulesWorkTime: number        // Ground Rules 기반 업무시간 (분)
  groundRulesConfidence: number      // 평균 T1 신뢰도 (0-100)
  t1WorkMovement: number            // 업무 관련 이동시간 (분)
  t1NonWorkMovement: number         // 비업무 이동시간 (분)
  teamBaselineUsed: number          // 적용된 팀 기준선 (0-100)
  anomalyScore: number              // 조직 대비 이상치 점수 (0-100)
  appliedRulesCount: number         // 적용된 특별 규칙 수
}