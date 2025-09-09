/**
 * 배치 결과 저장 엔진
 * 모든 계산 완료 후 sambio_human.db에 일괄 저장하여 DB lock 최소화
 */

import { saveDailyAnalysisResult } from '../database/queries'
import type { MemoryCalculationResult } from './MemoryCalculator'

export interface BatchSaveResult {
  totalResults: number
  savedResults: number
  errors: Array<{
    employeeId: number
    date: string
    error: string
  }>
  duration: number
}

export class BatchSaver {
  
  /**
   * 계산 결과를 일괄로 저장
   */
  async saveBatch(results: MemoryCalculationResult[]): Promise<BatchSaveResult> {
    console.log(`💾 Starting batch save of ${results.length} results...`)
    const startTime = Date.now()
    
    const errors: Array<{ employeeId: number, date: string, error: string }> = []
    let savedResults = 0

    // 유효한 결과만 필터링
    const validResults = results.filter(result => 
      !result.error && result.metrics && result.metrics.totalTime > 0
    )

    console.log(`📊 Filtered ${validResults.length} valid results from ${results.length} total`)

    // 단일 트랜잭션으로 모든 결과 저장
    for (const result of validResults) {
      try {
        const saveData = this.convertToSaveFormat(result)
        saveDailyAnalysisResult(saveData)
        savedResults++
      } catch (error) {
        console.error(`❌ Save error for employee ${result.employeeId} on ${result.date}:`, error)
        errors.push({
          employeeId: result.employeeId,
          date: result.date,
          error: error instanceof Error ? error.message : 'Unknown save error'
        })
      }
    }

    const duration = Date.now() - startTime
    
    console.log(`✅ Batch save completed: ${savedResults}/${validResults.length} saved in ${duration}ms`)
    if (errors.length > 0) {
      console.log(`⚠️ ${errors.length} save errors occurred`)
    }

    return {
      totalResults: results.length,
      savedResults,
      errors,
      duration
    }
  }

  /**
   * 메모리 계산 결과를 DB 저장 형식으로 변환
   * Ground Rules 분석 시에는 기존 지표들도 Ground Rules 값으로 동시 업데이트
   */
  private convertToSaveFormat(result: MemoryCalculationResult) {
    const metrics = result.metrics
    
    // Ground Rules가 있는 경우, 기존 지표들을 Ground Rules 값으로 대체
    if (metrics.groundRulesMetrics) {
      const groundRulesWorkHours = metrics.groundRulesMetrics.groundRulesWorkTime / 60
      const groundRulesConfidence = metrics.groundRulesMetrics.groundRulesConfidence
      const claimedHours = result.claimedHours || 0
      
      // Ground Rules 기반 효율성 계산 (Ground Rules 업무시간 / 신고시간)
      const groundRulesEfficiency = claimedHours > 0 ? groundRulesWorkHours / claimedHours : 0
      
      const saveData = {
        employeeId: result.employeeId,
        analysisDate: result.date,
        // 조직 정보 추가
        centerId: result.centerId,
        centerName: result.centerName,
        teamId: result.teamId,
        teamName: result.teamName,
        groupId: result.groupId,
        groupName: result.groupName,
        totalHours: metrics.totalTime / 60,
        // 🔄 기존 지표들을 Ground Rules 값으로 대체
        actualWorkHours: groundRulesWorkHours,           // ← Ground Rules 업무시간
        claimedWorkHours: claimedHours,
        efficiencyRatio: groundRulesEfficiency,          // ← Ground Rules 효율성
        focusedWorkMinutes: metrics.focusTime,
        meetingMinutes: metrics.meetingTime,
        mealMinutes: metrics.mealTime,
        movementMinutes: metrics.transitTime,
        restMinutes: metrics.restTime,
        confidenceScore: groundRulesConfidence,          // ← Ground Rules 신뢰도
        // Ground Rules 전용 컬럼들도 동시 저장
        groundRulesWorkHours: groundRulesWorkHours,
        groundRulesConfidence: groundRulesConfidence,
        workMovementMinutes: metrics.groundRulesMetrics.t1WorkMovement,
        nonWorkMovementMinutes: metrics.groundRulesMetrics.t1NonWorkMovement,
        anomalyScore: metrics.groundRulesMetrics.anomalyScore
      }

      return saveData
    }
    
    // Ground Rules가 없는 경우 기존 로직 사용
    const saveData = {
      employeeId: result.employeeId,
      analysisDate: result.date,
      // 조직 정보 추가
      centerId: result.centerId,
      centerName: result.centerName,
      teamId: result.teamId,
      teamName: result.teamName,
      groupId: result.groupId,
      groupName: result.groupName,
      totalHours: metrics.totalTime / 60,
      actualWorkHours: metrics.workTime / 60,
      claimedWorkHours: result.claimedHours,
      efficiencyRatio: metrics.workRatio,
      focusedWorkMinutes: metrics.focusTime,
      meetingMinutes: metrics.meetingTime,
      mealMinutes: metrics.mealTime,
      movementMinutes: metrics.transitTime,
      restMinutes: metrics.restTime,
      confidenceScore: metrics.reliabilityScore
    }

    return saveData
  }

  /**
   * 저장 전 결과 검증
   */
  validateResults(results: MemoryCalculationResult[]): { valid: MemoryCalculationResult[], invalid: MemoryCalculationResult[] } {
    const valid: MemoryCalculationResult[] = []
    const invalid: MemoryCalculationResult[] = []

    for (const result of results) {
      if (this.isValidResult(result)) {
        valid.push(result)
      } else {
        invalid.push(result)
      }
    }

    return { valid, invalid }
  }

  private isValidResult(result: MemoryCalculationResult): boolean {
    // 기본 검증
    if (result.error) return false
    if (!result.metrics) return false
    if (result.employeeId <= 0) return false
    if (!result.date) return false

    // 메트릭 검증
    const metrics = result.metrics
    if (metrics.totalTime < 0) return false
    if (metrics.workTime < 0) return false
    if (metrics.workRatio < 0 || metrics.workRatio > 1) return false

    return true
  }

  /**
   * 저장 성능 최적화를 위한 배치 크기 제안
   */
  getOptimalBatchSize(totalResults: number): number {
    // 결과 수에 따른 최적 배치 크기
    if (totalResults <= 100) return totalResults
    if (totalResults <= 500) return 100
    if (totalResults <= 1000) return 200
    return 500
  }

  /**
   * 대용량 결과를 청크 단위로 저장
   */
  async saveInChunks(results: MemoryCalculationResult[], chunkSize?: number): Promise<BatchSaveResult> {
    const optimalChunkSize = chunkSize || this.getOptimalBatchSize(results.length)
    
    console.log(`🔄 Saving ${results.length} results in chunks of ${optimalChunkSize}`)
    
    const chunks: MemoryCalculationResult[][] = []
    for (let i = 0; i < results.length; i += optimalChunkSize) {
      chunks.push(results.slice(i, i + optimalChunkSize))
    }

    let totalSaved = 0
    const allErrors: Array<{ employeeId: number, date: string, error: string }> = []
    const totalStartTime = Date.now()

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      console.log(`💾 Processing chunk ${i + 1}/${chunks.length} (${chunk.length} results)`)
      
      const chunkResult = await this.saveBatch(chunk)
      totalSaved += chunkResult.savedResults
      allErrors.push(...chunkResult.errors)
    }

    const totalDuration = Date.now() - totalStartTime

    return {
      totalResults: results.length,
      savedResults: totalSaved,
      errors: allErrors,
      duration: totalDuration
    }
  }
}