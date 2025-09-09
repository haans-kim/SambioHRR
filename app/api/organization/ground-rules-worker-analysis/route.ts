/**
 * 메모리 기반 Ground Rules 워커 분석 API
 * 
 * 최적화된 3단계 아키텍처:
 * 1. 데이터 일괄 로딩 (DB 접근 1회)
 * 2. 메모리 병렬 계산 (DB 접근 0회)  
 * 3. 결과 일괄 저장 (DB 접근 1회)
 */

import { NextResponse } from 'next/server'
import { MemoryDataLoader } from '../../../../lib/analytics/MemoryDataLoader'
import { MemoryCalculator } from '../../../../lib/analytics/MemoryCalculator'
import { BatchSaver } from '../../../../lib/analytics/BatchSaver'
import * as path from 'path'

// Helper function to format hours to "X시 Y분" format  
function formatHoursMinutes(hours: number): string {
  const wholeHours = Math.floor(hours)
  const minutes = Math.round((hours - wholeHours) * 60)
  
  if (wholeHours > 0 && minutes > 0) {
    return `${wholeHours}시간 ${minutes}분`
  } else if (wholeHours > 0) {
    return `${wholeHours}시간 0분`
  } else if (minutes > 0) {
    return `0시간 ${minutes}분`
  } else {
    return '0시간 0분'
  }
}

interface WorkerAnalysisRequest {
  employees: Array<{ 
    employeeId: number; 
    employeeName: string;
  }>
  startDate: string
  endDate: string
  saveToDb?: boolean
  workerCount?: number
}

export async function POST(request: Request) {
  const totalStartTime = Date.now()
  
  try {
    const body: WorkerAnalysisRequest = await request.json()
    const { employees, startDate, endDate, saveToDb = true, workerCount = 8 } = body
    
    if (!employees || employees.length === 0) {
      return NextResponse.json(
        { error: 'No employees provided' },
        { status: 400 }
      )
    }
    
    console.log(`🚀 MEMORY-BASED Ground Rules Analysis: ${employees.length} employees, ${startDate} to ${endDate}`)
    
    // ============================================
    // PHASE 1: 데이터 일괄 로딩 (DB 접근 1회)
    // ============================================
    console.log(`📊 PHASE 1: Loading all data from Analytics DB...`)
    const loadStartTime = Date.now()
    
    const employeeIds = employees.map(emp => emp.employeeId)
    const analyticsDbPath = path.join(process.cwd(), 'sambio_analytics.db')
    
    const dataLoader = new MemoryDataLoader(analyticsDbPath)
    const dataset = await dataLoader.loadAllData(employeeIds, startDate, endDate)
    
    const loadDuration = Date.now() - loadStartTime
    console.log(`✅ PHASE 1 completed in ${loadDuration}ms - ${dataset.employees.size} employees, ${dataset.events.size} event sets`)
    
    // ============================================
    // PHASE 2: 메모리 병렬 계산 (DB 접근 0회)
    // ============================================
    console.log(`⚡ PHASE 2: Memory-parallel calculation...`)
    const calcStartTime = Date.now()
    
    const calculator = new MemoryCalculator(dataset)
    
    // Claim 데이터에서 사원별 신고 근무시간 > 0인 날짜들만 추출
    const employeeWorkingDays: Array<{employeeId: number, date: string}> = []
    
    for (const employeeId of employeeIds) {
      const employeeClaimData = dataset.claimData.get(employeeId)
      if (employeeClaimData) {
        for (const [date, claimInfo] of employeeClaimData) {
          if (claimInfo.claimedHours > 0) {
            employeeWorkingDays.push({ employeeId, date })
          }
        }
      }
    }
    
    console.log(`📅 Found ${employeeWorkingDays.length} working days with claimed hours > 0`)
    
    // 사원별 실제 근무일만 병렬 계산 (DB 접근 없음)
    const calculationResults = employeeWorkingDays.map(({ employeeId, date }) => 
      calculator.calculateEmployeeDay(employeeId, date)
    )
    
    const calcDuration = Date.now() - calcStartTime
    console.log(`✅ PHASE 2 completed in ${calcDuration}ms - ${calculationResults.length} results calculated`)
    
    // ============================================
    // PHASE 3: 결과 일괄 저장 (DB 접근 1회)
    // ============================================
    let saveResult = null
    if (saveToDb) {
      console.log(`💾 PHASE 3: Batch saving to Human DB...`)
      const saveStartTime = Date.now()
      
      const batchSaver = new BatchSaver()
      saveResult = await batchSaver.saveBatch(calculationResults)
      
      console.log(`✅ PHASE 3 completed in ${saveResult.duration}ms - ${saveResult.savedResults}/${saveResult.totalResults} saved`)
    }
    
    // ============================================
    // 결과 변환 및 반환
    // ============================================
    const validResults = calculationResults.filter(result => !result.error && result.metrics)
    const errorResults = calculationResults.filter(result => result.error)
    
    // 기존 API 형식으로 변환
    const transformedResults = validResults.map(result => ({
      date: result.date,
      employeeId: result.employeeId,
      employeeName: result.employeeName,
      metrics: result.metrics,
      claimedHours: result.claimedHours ? formatHoursMinutes(result.claimedHours) : null,
      groundRulesAnalysis: {
        teamUsed: dataset.employees.get(result.employeeId)?.teamName || 'Unknown',
        workScheduleUsed: '일반',
        accuracyImprovement: result.metrics.groundRulesMetrics?.groundRulesConfidence || 0,
        anomalyReport: {
          hasAnomalies: (result.metrics.groundRulesMetrics?.anomalyScore || 0) > 0.3,
          anomalyLevel: (result.metrics.groundRulesMetrics?.anomalyScore || 0) > 0.5 ? 'high' : 'low',
          summary: `Anomaly score: ${(result.metrics.groundRulesMetrics?.anomalyScore || 0).toFixed(2)}`,
          recommendations: []
        }
      }
    }))
    
    const totalDuration = Date.now() - totalStartTime
    
    // 성능 분석 로그
    console.log(`🎯 MEMORY-BASED WORKER ANALYSIS COMPLETE:`)
    console.log(`   📊 Total time: ${totalDuration}ms`)
    console.log(`   📈 Phase breakdown:`)
    console.log(`      - Data loading: ${loadDuration}ms (${((loadDuration/totalDuration)*100).toFixed(1)}%)`)
    console.log(`      - Parallel calc: ${calcDuration}ms (${((calcDuration/totalDuration)*100).toFixed(1)}%)`)
    console.log(`      - Batch save: ${saveResult?.duration || 0}ms (${(((saveResult?.duration || 0)/totalDuration)*100).toFixed(1)}%)`)
    console.log(`   🚀 Performance:`)
    console.log(`      - Results/sec: ${(calculationResults.length / (totalDuration/1000)).toFixed(1)}`)
    console.log(`      - Employees/sec: ${(employeeIds.length / (totalDuration/1000)).toFixed(1)}`)
    console.log(`   📋 Results: ${validResults.length} success, ${errorResults.length} errors`)
    
    if (saveResult && saveResult.errors.length > 0) {
      console.log(`   ⚠️ Save errors: ${saveResult.errors.length}`)
    }
    
    return NextResponse.json({
      results: transformedResults,
      errors: errorResults.map(result => ({
        employeeId: result.employeeId,
        date: result.date,
        error: result.error
      })),
      summary: {
        totalResults: calculationResults.length,
        validResults: validResults.length,
        errorResults: errorResults.length,
        dateRange: { startDate, endDate },
        employeeCount: employees.length,
        workerCount,
        groundRulesEnabled: true,
        processingMode: 'memory-based-parallel',
        performance: {
          totalDuration,
          loadDuration,
          calcDuration,
          saveDuration: saveResult?.duration || 0,
          resultsPerSecond: calculationResults.length / (totalDuration/1000),
          employeesPerSecond: employeeIds.length / (totalDuration/1000)
        },
        groundRulesStats: {
          averageConfidence: validResults.reduce((sum, r) => 
            sum + (r.metrics.groundRulesMetrics?.groundRulesConfidence || 0), 0
          ) / Math.max(validResults.length, 1),
          anomalyCount: validResults.filter(r => 
            (r.metrics.groundRulesMetrics?.anomalyScore || 0) > 0.3
          ).length,
          datasetStats: {
            employeesLoaded: dataset.employees.size,
            eventsLoaded: Array.from(dataset.events.values()).reduce((total, empEvents) => 
              total + Array.from(empEvents.values()).reduce((empTotal, dayEvents) => empTotal + dayEvents.length, 0), 0
            ),
            teamsLoaded: dataset.teamCharacteristics.size
          }
        }
      }
    })
    
  } catch (error) {
    const totalDuration = Date.now() - totalStartTime
    console.error(`❌ Memory-based Ground Rules Analysis failed after ${totalDuration}ms:`, error)
    
    return NextResponse.json(
      { 
        error: 'Memory-based Ground Rules analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: totalDuration
      },
      { status: 500 }
    )
  }
}