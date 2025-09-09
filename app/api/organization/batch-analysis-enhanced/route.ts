import { NextResponse } from 'next/server'
import { getEmployeeById, getClaimData, saveDailyAnalysisResult } from '@/lib/database/queries'
import { TagEnricher } from '@/lib/classifier/TagEnricher'
import { ActivityStateMachine } from '@/lib/classifier/StateMachine'
import { EnhancedWorkHourCalculator } from '@/lib/analytics/EnhancedWorkHourCalculator'
import { JobGroupClassifier } from '@/lib/classifier/JobGroupClassifier'
import type { WorkMetrics } from '@/types/analytics'
import path from 'path'

interface BatchAnalysisRequest {
  employees: Array<{ 
    employeeId: number; 
    employeeName: string;
    dates?: string[];  // Optional specific dates to analyze
  }>
  startDate: string
  endDate: string
  saveToDb?: boolean  // Optional flag to save results to DB
  useGroundRules?: boolean  // Optional flag to enable Ground Rules
}

interface EnhancedBatchAnalysisResult {
  date: string
  employeeId: number
  employeeName: string
  metrics: WorkMetrics
  claimedHours?: number
  groundRulesAnalysis?: {
    teamUsed: string
    workScheduleUsed: string
    accuracyImprovement: number
    anomalyReport: {
      hasAnomalies: boolean
      anomalyLevel: 'none' | 'low' | 'medium' | 'high'
      summary: string
      recommendations: string[]
    }
  }
}

export async function POST(request: Request) {
  try {
    const body: BatchAnalysisRequest = await request.json()
    const { employees, startDate, endDate, saveToDb = true, useGroundRules = true } = body
    
    const results: EnhancedBatchAnalysisResult[] = []
    const errors: any[] = []
    
    // Initialize Enhanced Calculator if Ground Rules enabled
    let calculator: EnhancedWorkHourCalculator | null = null
    if (useGroundRules) {
      const analyticsDbPath = path.join(process.cwd(), 'sambio_analytics.db')
      calculator = new EnhancedWorkHourCalculator(analyticsDbPath)
      console.log('🎯 Ground Rules enabled - Enhanced Calculator initialized')
    }
    
    // Calculate total operations for progress tracking
    const start = new Date(startDate)
    const end = new Date(endDate)
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const totalOperations = employees.length * dayCount
    let completedOperations = 0
    
    // Process each employee
    for (const emp of employees) {
      // Determine which dates to process for this employee
      const datesToProcess: string[] = []
      
      if (emp.dates && emp.dates.length > 0) {
        // Use specific dates if provided
        emp.dates.forEach(dateStr => {
          // Extract date portion if it includes time
          const cleanDate = dateStr.split(' ')[0].split('T')[0]
          datesToProcess.push(cleanDate)
        })
      } else {
        // Otherwise process all dates in range
        for (let dateObj = new Date(start); dateObj <= end; dateObj.setDate(dateObj.getDate() + 1)) {
          datesToProcess.push(dateObj.toISOString().split('T')[0])
        }
      }
      
      // Process each date for this employee
      for (const dateStr of datesToProcess) {
        try {
          // Get employee data
          const employee = getEmployeeById(emp.employeeId)
          if (!employee) {
            errors.push({ employeeId: emp.employeeId, date: dateStr, error: 'Employee not found in database' })
            completedOperations++
            continue
          }
          
          // Classify job group
          const jobGroupClassifier = new JobGroupClassifier()
          const jobGroup = jobGroupClassifier.classifyEmployee(employee)
          
          // Enrich tags
          const tagEnricher = new TagEnricher()
          let events = await tagEnricher.enrichTags(emp.employeeId, dateStr, 'day')
          
          // Auto-detect night shift if needed
          const detectedShift = tagEnricher.detectShiftType(events)
          if (detectedShift === 'night') {
            events = await tagEnricher.enrichTags(emp.employeeId, dateStr, 'night')
          }
          
          // Skip if no events for this date
          if (events.length === 0) {
            completedOperations++
            continue
          }
          
          // 1시간 미만 Claim은 Ground Rules 분석에서 제외 (의미 없는 극단적 효율성 방지)
          let totalClaimedForValidation = 0
          if (detectedShift === 'night') {
            // 야간근무: 전날+당일 합산으로 검사
            const prevDate = new Date(dateStr)
            prevDate.setDate(prevDate.getDate() - 1)
            const prevDateStr = prevDate.toISOString().split('T')[0]
            
            const currentClaimData = getClaimData(emp.employeeId, dateStr) as any
            const prevClaimData = getClaimData(emp.employeeId, prevDateStr) as any
            
            const currentHours = currentClaimData?.근무시간 || 0
            const prevHours = prevClaimData?.근무시간 || 0
            totalClaimedForValidation = currentHours + prevHours
          } else {
            // 주간근무: 해당 날짜만
            const preliminaryClaimData = getClaimData(emp.employeeId, dateStr) as any
            totalClaimedForValidation = preliminaryClaimData?.근무시간 || 0
          }
          
          if (totalClaimedForValidation < 1.0) {
            completedOperations++
            continue
          }
          
          // Find first and last T tags
          const firstTTagIndex = events.findIndex(e => 
            e.tagCode === 'T1' || e.tagCode === 'T2' || e.tagCode === 'T3'
          )
          const reversedIndex = events.slice().reverse().findIndex(e => 
            e.tagCode === 'T1' || e.tagCode === 'T2' || e.tagCode === 'T3'
          )
          const lastTTagIndex = reversedIndex !== -1 ? events.length - 1 - reversedIndex : -1
          
          // Create timeline with state classification
          const stateMachine = new ActivityStateMachine()
          const timeline = []
          
          for (let i = 0; i < events.length; i++) {
            const current = events[i]
            const prev = i > 0 ? events[i - 1] : null
            const next = i < events.length - 1 ? events[i + 1] : null
            
            // Check for T1->T1->G1 pattern
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
          
          let metrics: WorkMetrics
          let groundRulesAnalysis: any = undefined
          
          // Calculate metrics with Ground Rules if enabled
          if (calculator && useGroundRules) {
            // Extract team and work schedule info from employee data
            const employeeInfo = {
              employeeId: emp.employeeId,
              teamName: employee.team_name || employee.group_name || employee.department || 'Unknown Team',
              workScheduleType: employee.work_schedule_type || employee.shift_type || '선택근무제'
            }
            
            metrics = calculator.calculateEnhancedMetrics(timeline, employeeInfo, dateStr)
            
            // Generate Ground Rules analysis
            if (metrics.groundRulesMetrics) {
              // 야간근무일 때는 전날+당일 Claim 데이터 사용
              let analysisClaimedHours = 8.0 // Default
              if (detectedShift === 'night') {
                const prevDate = new Date(dateStr)
                prevDate.setDate(prevDate.getDate() - 1)
                const prevDateStr = prevDate.toISOString().split('T')[0]
                
                const currentClaimData = getClaimData(emp.employeeId, dateStr) as any
                const prevClaimData = getClaimData(emp.employeeId, prevDateStr) as any
                
                const currentHours = currentClaimData?.근무시간 || 0
                const prevHours = prevClaimData?.근무시간 || 0
                analysisClaimedHours = (currentHours + prevHours) || 8.0
              } else {
                const claimData = getClaimData(emp.employeeId, dateStr) as any
                analysisClaimedHours = claimData?.근무시간 || 8.0
              }
              
              const comparison = calculator.compareWithGroundRules(metrics, analysisClaimedHours)
              const anomalyReport = calculator.generateAnomalyReport(metrics)
              
              groundRulesAnalysis = {
                teamUsed: employeeInfo.teamName,
                workScheduleUsed: employeeInfo.workScheduleType,
                accuracyImprovement: comparison.improvement,
                anomalyReport
              }
            }
          } else {
            // Fall back to traditional calculation
            const { WorkHourCalculator } = await import('@/lib/analytics/WorkHourCalculator')
            const traditionalCalculator = new WorkHourCalculator()
            const basicMetrics = traditionalCalculator.calculateMetrics(timeline)
            
            metrics = {
              ...basicMetrics,
              employeeId: emp.employeeId,
              date: dateStr,
              groundRulesMetrics: undefined
            }
          }
          
          // Get claimed hours - 야간근무일 때는 전날+당일 합산
          let claimedHours = null
          if (detectedShift === 'night') {
            // 야간근무: 전날 + 당일 Claim 데이터 합산
            const prevDate = new Date(dateStr)
            prevDate.setDate(prevDate.getDate() - 1)
            const prevDateStr = prevDate.toISOString().split('T')[0]
            
            const currentClaimData = getClaimData(emp.employeeId, dateStr) as any
            const prevClaimData = getClaimData(emp.employeeId, prevDateStr) as any
            
            const currentHours = currentClaimData?.근무시간 || 0
            const prevHours = prevClaimData?.근무시간 || 0
            claimedHours = currentHours + prevHours
          } else {
            // 주간근무: 해당 날짜만
            const claimData = getClaimData(emp.employeeId, dateStr) as any
            claimedHours = claimData?.근무시간 || null
          }
          
          results.push({
            date: dateStr,
            employeeId: emp.employeeId,
            employeeName: emp.employeeName,
            metrics,
            claimedHours,
            groundRulesAnalysis
          })
          
          // Save to DB if requested
          if (saveToDb) {
            try {
              const saveData = {
                employeeId: emp.employeeId,
                analysisDate: dateStr,
                totalHours: metrics.totalTime / 60,
                actualWorkHours: metrics.workTime / 60,
                claimedWorkHours: claimedHours,
                efficiencyRatio: metrics.workRatio,
                focusedWorkMinutes: metrics.focusTime,
                meetingMinutes: metrics.meetingTime,
                mealMinutes: metrics.mealTime,
                movementMinutes: metrics.transitTime,
                restMinutes: metrics.restTime,
                confidenceScore: metrics.reliabilityScore
              }
              
              // Add Ground Rules metrics if available
              if (metrics.groundRulesMetrics) {
                Object.assign(saveData, {
                  groundRulesWorkHours: metrics.groundRulesMetrics.groundRulesWorkTime / 60,
                  groundRulesConfidence: metrics.groundRulesMetrics.groundRulesConfidence,
                  workMovementMinutes: metrics.groundRulesMetrics.t1WorkMovement,
                  nonWorkMovementMinutes: metrics.groundRulesMetrics.t1NonWorkMovement,
                  anomalyScore: metrics.groundRulesMetrics.anomalyScore
                })
              }
              
              saveDailyAnalysisResult(saveData)
            } catch (dbError) {
              console.error('Error saving to DB:', dbError)
              // Continue processing even if DB save fails
            }
          }
          
          completedOperations++
          
        } catch (error) {
          errors.push({ 
            employeeId: emp.employeeId, 
            date: dateStr, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })
          completedOperations++
        }
      }
    }
    
    // Clean up calculator
    if (calculator) {
      calculator.close()
    }
    
    return NextResponse.json({
      results,
      errors,
      summary: {
        totalProcessed: results.length,
        totalErrors: errors.length,
        dateRange: { startDate, endDate },
        employeeCount: employees.length,
        totalOperations,
        completedOperations,
        groundRulesEnabled: useGroundRules,
        ...(useGroundRules && {
          groundRulesStats: {
            averageConfidence: results.reduce((sum, r) => 
              sum + (r.metrics.groundRulesMetrics?.groundRulesConfidence || 0), 0
            ) / Math.max(results.length, 1),
            anomalyCount: results.filter(r => 
              r.groundRulesAnalysis?.anomalyReport.hasAnomalies
            ).length,
            accuracyImprovements: results.map(r => 
              r.groundRulesAnalysis?.accuracyImprovement || 0
            )
          }
        })
      }
    })
    
  } catch (error) {
    console.error('Enhanced batch analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to process enhanced batch analysis' },
      { status: 500 }
    )
  }
}