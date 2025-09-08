import Database from 'better-sqlite3'
import type { 
  T1Context, 
  ConfidenceResult, 
  TeamCharacteristics, 
  TeamStatistics, 
  MobilityLevel, 
  SpecialRule 
} from '@/types/ground-rules'

export class T1GroundRulesEngine {
  private teamCharacteristics: Map<string, TeamCharacteristics> = new Map()
  private db: Database.Database
  private specialRules: Map<string, SpecialRule[]> = new Map()
  
  constructor(dbPath: string = './sambio_analytics.db') {
    this.db = new Database(dbPath, { readonly: true })
    this.loadTeamCharacteristics()
    this.initializeSpecialRules()
  }

  /**
   * T1 태그의 신뢰도를 계산하는 메인 메서드
   */
  calculateT1Confidence(context: T1Context): ConfidenceResult {
    // 1. 팀 특성 가져오기
    const teamKey = `${context.teamName}_${context.workScheduleType}`
    const teamChar = this.teamCharacteristics.get(teamKey)
    
    if (!teamChar) {
      // 팀 정보가 없으면 기본값 사용
      return this.getDefaultConfidence(context)
    }

    // 2. 팀 기준 확률로 시작
    let confidence = teamChar.baselineConfidence

    // 3. 시퀀스 기반 조정
    const sequenceMultiplier = this.getSequenceMultiplier(context.prevTag, context.nextTag)
    confidence *= sequenceMultiplier

    // 4. 시간대별 가중치 적용
    const timeWeight = this.getTimeWeight(context.hour, context.workScheduleType)
    confidence *= timeWeight

    // 5. 특별 규칙 적용
    const { adjustment: specialAdjustment, appliedRules } = this.applySpecialRules(context, teamChar)
    confidence += specialAdjustment

    // 6. 이상치 탐지
    const anomalyFlag = this.detectAnomaly(confidence, teamChar.baselineConfidence)

    // 7. 최종 범위 제한 (5%-95%)
    const finalConfidence = Math.max(0.05, Math.min(0.95, confidence))

    return {
      finalConfidence,
      teamBaseline: teamChar.baselineConfidence,
      sequenceMultiplier,
      timeWeight,
      specialRulesAdjustment: specialAdjustment,
      appliedRules,
      anomalyFlag
    }
  }

  /**
   * Master Table에서 팀별 특성 학습
   */
  private loadTeamCharacteristics(): void {
    console.log('🧠 Loading team characteristics from Master Table...')
    
    // Master Table에서 팀별 T1 통계 쿼리
    const teamStatsQuery = `
      SELECT 
        team_name,
        work_schedule_type,
        COUNT(*) as total_events,
        SUM(CASE WHEN tag_code = 'T1' THEN 1 ELSE 0 END) as t1_events,
        SUM(CASE WHEN tag_code = 'O' THEN 1 ELSE 0 END) as o_events,
        ROUND(100.0 * SUM(CASE WHEN tag_code = 'T1' THEN 1 ELSE 0 END) / COUNT(*), 2) as t1_percentage,
        ROUND(1.0 * SUM(CASE WHEN tag_code = 'T1' THEN 1 ELSE 0 END) / 
              NULLIF(SUM(CASE WHEN tag_code = 'O' THEN 1 ELSE 0 END), 0), 3) as t1_to_o_ratio,
        COUNT(DISTINCT employee_id) as team_size,
        ROUND(100.0 * SUM(CASE WHEN tag_code = 'T1' AND hour BETWEEN 6 AND 8 THEN 1 ELSE 0 END) / 
              NULLIF(SUM(CASE WHEN hour BETWEEN 6 AND 8 THEN 1 END), 0), 1) as morning_t1_rate,
        ROUND(100.0 * SUM(CASE WHEN tag_code = 'T1' AND hour BETWEEN 12 AND 13 THEN 1 ELSE 0 END) / 
              NULLIF(SUM(CASE WHEN hour BETWEEN 12 AND 13 THEN 1 END), 0), 1) as lunch_t1_rate,
        ROUND(100.0 * SUM(CASE WHEN tag_code = 'T1' AND hour BETWEEN 17 AND 19 THEN 1 ELSE 0 END) / 
              NULLIF(SUM(CASE WHEN hour BETWEEN 17 AND 19 THEN 1 END), 0), 1) as evening_t1_rate
      FROM master_events_table 
      WHERE team_name IS NOT NULL 
        AND team_name != ''
        AND work_schedule_type IS NOT NULL
      GROUP BY team_name, work_schedule_type
      HAVING COUNT(*) > 500   -- 최소 샘플 사이즈 (더 많은 팀 포함)
      ORDER BY t1_to_o_ratio DESC
    `

    try {
      const teamStats = this.db.prepare(teamStatsQuery).all() as TeamStatistics[]
      
      console.log(`📊 Found ${teamStats.length} team-schedule combinations`)
      
      teamStats.forEach((stats: any) => {
        // SQL 결과를 TeamStatistics 형태로 매핑
        const mappedStats: TeamStatistics = {
          teamName: stats.team_name,
          workScheduleType: stats.work_schedule_type,
          totalEvents: stats.total_events,
          t1Events: stats.t1_events,
          oEvents: stats.o_events,
          t1Percentage: stats.t1_percentage,
          t1ToORatio: stats.t1_to_o_ratio,
          teamSize: stats.team_size,
          morningT1Rate: stats.morning_t1_rate,
          lunchT1Rate: stats.lunch_t1_rate,
          eveningT1Rate: stats.evening_t1_rate
        }
        
        const characteristics = this.classifyTeamCharacteristics(mappedStats)
        const key = `${mappedStats.teamName}_${mappedStats.workScheduleType}`
        this.teamCharacteristics.set(key, characteristics)
      })

      console.log(`✅ Loaded characteristics for ${this.teamCharacteristics.size} teams`)
    } catch (error) {
      console.error('❌ Error loading team characteristics:', error)
    }
  }

  /**
   * 팀 통계를 기반으로 특성 분류
   */
  private classifyTeamCharacteristics(stats: TeamStatistics): TeamCharacteristics {
    // 이동성 레벨 결정
    const mobilityLevel = this.determineMobilityLevel(stats.t1ToORatio || 0, stats.teamName)
    
    // 기준 신뢰도 계산
    const baselineConfidence = this.calculateBaselineConfidence(mobilityLevel, stats)
    
    // 시간대별 가중치 생성
    const timeWeights = this.generateTimeWeights(stats)
    
    // 특별 규칙 가져오기
    const specialRules = this.getSpecialRulesForTeam(stats.teamName)

    return {
      teamName: stats.teamName,
      workScheduleType: stats.workScheduleType,
      mobilityLevel,
      baselineConfidence,
      timeWeights,
      specialRules,
      t1Statistics: {
        totalEvents: stats.totalEvents,
        t1Events: stats.t1Events,
        t1ToORatio: stats.t1ToORatio || 0,
        hourlyPatterns: {
          morning: stats.morningT1Rate || 0,
          lunch: stats.lunchT1Rate || 0,  
          evening: stats.eveningT1Rate || 0
        }
      }
    }
  }

  /**
   * T1/O 비율을 기반으로 이동성 레벨 결정 (팀 특성 고려)
   */
  private determineMobilityLevel(t1ToORatio: number, teamName?: string): MobilityLevel {
    // 팀 이름 기반 현장직/사무직 구분
    const teamType = this.classifyTeamByName(teamName || '')
    
    // 극고이동성: 특수한 경우들
    if (t1ToORatio >= 200) return 'VERY_HIGH'       // 인프라복지팀 (1156)
    
    // 사무직 특별 처리 - 높은 T1/O 비율이더라도 상한선 적용
    if (teamType === 'OFFICE') {
      if (t1ToORatio >= 50) return 'HIGH'           // 사무직 최대 HIGH
      if (t1ToORatio >= 10) return 'MEDIUM'         // 사무직 중이동성
      if (t1ToORatio >= 2.0) return 'LOW'           // 사무직 저이동성
      return 'VERY_LOW'
    }
    
    // 현장직 특별 처리 - 낮은 T1/O 비율이더라도 하한선 적용
    if (teamType === 'FIELD') {
      if (t1ToORatio >= 50) return 'VERY_HIGH'      // 현장직 극고이동성
      if (t1ToORatio >= 5.0) return 'HIGH'          // 안전환경팀 (6.334)
      if (t1ToORatio >= 1.0) return 'MEDIUM'        // QC Operations팀 (1.5), 현장직 최소 MEDIUM
      return 'MEDIUM'                               // Plant팀들, 현장직 최소 보장
    }
    
    // 일반적인 분류 (팀 타입 불명확한 경우)
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
   * 이동성 레벨과 팀 통계를 기반으로 기준 신뢰도 계산
   */
  private calculateBaselineConfidence(mobilityLevel: MobilityLevel, stats: TeamStatistics): number {
    const baseConfidenceMap: Record<MobilityLevel, number> = {
      'VERY_HIGH': 0.65,    // 극고이동성
      'HIGH': 0.50,         // 고이동성
      'MEDIUM': 0.35,       // 중이동성  
      'LOW': 0.25,          // 저이동성
      'VERY_LOW': 0.20      // 극저이동성
    }

    let baseConfidence = baseConfidenceMap[mobilityLevel]
    
    // 팀 크기에 따른 미세 조정
    if (stats.teamSize < 5) {
      baseConfidence *= 0.95  // 소규모팀은 약간 감소
    } else if (stats.teamSize > 50) {
      baseConfidence *= 1.05  // 대규모팀은 약간 증가
    }

    return Math.max(0.15, Math.min(0.70, baseConfidence))
  }

  /**
   * 팀 통계를 기반으로 시간대별 가중치 생성
   */
  private generateTimeWeights(stats: TeamStatistics): Record<string, number> {
    const workSchedule = stats.workScheduleType
    
    if (workSchedule === '선택근무제') {
      return {
        "06-08": 1.3,      // 출근 이동
        "09-11": 1.0,      // 기본 업무 
        "12-13": 1.7,      // 점심/회의 (최고)
        "14-16": 1.0,      // 기본 업무
        "17-19": 1.4,      // 퇴근 준비
        "20-22": 1.1       // 야간 근무
      }
    } else if (workSchedule === '탄력근무제') {
      return {
        "06-08": 1.4,      // 작업장 이동
        "09-11": 0.8,      // 집중 작업
        "12-13": 1.6,      // 교대/휴식  
        "14-16": 0.9,      // 오후 작업
        "17-19": 1.3,      // 교대 시간
        "20-22": 1.2       // 야간 교대
      }
    } else {
      // 기본값 (고정근무제, 모성보호 등)
      return {
        "06-08": 1.2,
        "09-11": 1.0,
        "12-13": 1.5,
        "14-16": 1.0,
        "17-19": 1.3,
        "20-22": 1.0
      }
    }
  }

  /**
   * 시퀀스 기반 조정값 계산
   */
  private getSequenceMultiplier(prevTag: string | null, nextTag: string | null): number {
    if (prevTag === 'O' && nextTag === 'O') return 2.5   // O-T1-O: 95%+ 신뢰도
    if (prevTag === 'O' || nextTag === 'O') return 2.2   // O-T1-X, X-T1-O: 75-90%
    return 1.0  // X-T1-X: 팀별 기준 적용
  }

  /**
   * 시간대별 가중치 계산
   */
  private getTimeWeight(hour: number, workScheduleType: string): number {
    const timeRanges = [
      { range: [6, 8], key: "06-08" },
      { range: [9, 11], key: "09-11" },
      { range: [12, 13], key: "12-13" },
      { range: [14, 16], key: "14-16" },
      { range: [17, 19], key: "17-19" },
      { range: [20, 22], key: "20-22" }
    ]

    for (const timeRange of timeRanges) {
      if (hour >= timeRange.range[0] && hour <= timeRange.range[1]) {
        const weights = this.generateTimeWeights({ workScheduleType } as TeamStatistics)
        return weights[timeRange.key] || 1.0
      }
    }

    return 1.0  // 기본 가중치
  }

  /**
   * 특별 규칙 적용
   */
  private applySpecialRules(context: T1Context, teamChar: TeamCharacteristics): { adjustment: number, appliedRules: string[] } {
    const appliedRules: string[] = []
    let totalAdjustment = 0

    const rules = this.specialRules.get(context.teamName) || []
    
    for (const rule of rules) {
      if (this.evaluateRuleCondition(rule.condition, context)) {
        if (rule.action === 'BOOST_CONFIDENCE' || rule.action === 'REDUCE_CONFIDENCE') {
          totalAdjustment += rule.adjustment
        }
        appliedRules.push(rule.ruleId)
      }
    }

    return { adjustment: totalAdjustment, appliedRules }
  }

  /**
   * 특별 규칙 조건 평가 (개선된 로직)
   */
  private evaluateRuleCondition(condition: string, context: T1Context): boolean {
    // BETWEEN 조건 처리
    if (condition.includes('BETWEEN')) {
      const match = condition.match(/hour BETWEEN (\d+) AND (\d+)/)
      if (match) {
        const start = parseInt(match[1])
        const end = parseInt(match[2])
        return context.hour >= start && context.hour <= end
      }
    }
    
    // 추가적인 조건 처리 가능
    // 예: work_schedule_type, day_of_week, duration 등
    
    return false
  }

  /**
   * 이상치 탐지 (개선된 로직)
   */
  private detectAnomaly(currentConfidence: number, teamBaseline: number): boolean {
    // 팀 기준선의 20% 미만이거나 5% 미만이면 이상치로 판정
    return currentConfidence < Math.max(teamBaseline * 0.2, 0.05)
  }

  /**
   * 기본값 신뢰도 (팀 정보가 없는 경우)
   */
  private getDefaultConfidence(context: T1Context): ConfidenceResult {
    const defaultBaseline = 0.35
    const sequenceMultiplier = this.getSequenceMultiplier(context.prevTag, context.nextTag)
    const timeWeight = this.getTimeWeight(context.hour, context.workScheduleType)
    
    const finalConfidence = Math.max(0.05, Math.min(0.95, defaultBaseline * sequenceMultiplier * timeWeight))

    return {
      finalConfidence,
      teamBaseline: defaultBaseline,
      sequenceMultiplier,
      timeWeight,
      specialRulesAdjustment: 0,
      appliedRules: [],
      anomalyFlag: false
    }
  }

  /**
   * 특별 규칙 초기화 (실제 데이터 기반 팀명)
   */
  private initializeSpecialRules(): void {
    // 인프라복지팀: 극고이동성 (시설관리)
    this.specialRules.set('인프라복지팀', [
      {
        ruleId: 'INFRASTRUCTURE_FACILITY',
        condition: 'hour BETWEEN 6 AND 20',
        action: 'BOOST_CONFIDENCE',
        adjustment: 0.20,
        reason: '인프라 시설관리 업무로 모든 시간대 이동 정상'
      }
    ])

    // Sales&Operation팀: 영업/운영 업무
    this.specialRules.set('Sales&Operation팀', [
      {
        ruleId: 'SALES_OPERATION',
        condition: 'hour BETWEEN 17 AND 20',
        action: 'BOOST_CONFIDENCE',
        adjustment: 0.15,
        reason: '고객 미팅 및 운영 업무로 인한 야간 이동'
      }
    ])

    // HR 관련팀들: 인사업무
    const hrTeams = ['HR Strategy그룹', 'Talent Management팀']
    hrTeams.forEach(teamName => {
      this.specialRules.set(teamName, [
        {
          ruleId: 'HR_CONSULTING',
          condition: 'hour BETWEEN 8 AND 18',
          action: 'BOOST_CONFIDENCE',
          adjustment: 0.10,
          reason: 'HR 컨설팅 업무로 인한 정기적 이동'
        }
      ])
    })

    // 대외협력팀: 외부 업무
    this.specialRules.set('대외협력팀', [
      {
        ruleId: 'EXTERNAL_COOPERATION',
        condition: 'hour BETWEEN 9 AND 18',
        action: 'BOOST_CONFIDENCE',
        adjustment: 0.12,
        reason: '대외협력 업무로 인한 높은 이동성'
      }
    ])

    // 정보보호팀: 보안 업무 (24시간 대응)
    this.specialRules.set('정보보호팀', [
      {
        ruleId: 'SECURITY_PATROL',
        condition: 'hour BETWEEN 0 AND 23',
        action: 'BOOST_CONFIDENCE',
        adjustment: 0.08,
        reason: '24시간 보안 점검 및 순찰 업무'
      }
    ])
  }

  /**
   * 팀별 특별 규칙 가져오기
   */
  private getSpecialRulesForTeam(teamName: string): SpecialRule[] {
    return this.specialRules.get(teamName) || []
  }

  /**
   * 리소스 정리
   */
  close(): void {
    this.db.close()
  }
}