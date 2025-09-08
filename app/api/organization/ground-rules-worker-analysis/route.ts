import { NextResponse } from 'next/server'
import { saveDailyAnalysisResult, getEmployeeById } from '@/lib/database/queries'
import { EnhancedWorkHourCalculator } from '@/lib/analytics/EnhancedWorkHourCalculator'
import { TagEnricher } from '@/lib/classifier/TagEnricher'
import { ActivityStateMachine } from '@/lib/classifier/StateMachine'
import { JobGroupClassifier } from '@/lib/classifier/JobGroupClassifier'
import path from 'path'

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

interface WorkerAnalysisResult {
  workerId: number
  employeeId: number
  employeeName: string
  date: string
  metrics: any
  groundRulesAnalysis?: any
  error?: string
}

// Helper function to process a single employee with shared calculator and pre-loaded data
async function processEmployeeAsync(
  employeeId: number,
  employeeName: string,
  startDate: string,
  endDate: string,
  calculator: EnhancedWorkHourCalculator,
  employeeDataMap: Map<number, any>
) {
  const results = []
  
  try {
    // Get employee data from pre-loaded map (no DB access)
    const employee = employeeDataMap.get(employeeId)
    if (!employee) {
      return [{
        employeeId,
        employeeName,
        date: startDate,
        metrics: null,
        error: 'Employee not found'
      }]
    }
    
    // Classify job group
    const jobGroupClassifier = new JobGroupClassifier()
    const jobGroup = jobGroupClassifier.classifyEmployee(employee)
    
    // Process each date in range
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    for (let dateObj = new Date(start); dateObj <= end; dateObj.setDate(dateObj.getDate() + 1)) {
      const dateStr = dateObj.toISOString().split('T')[0]
      
      try {
        // Enrich tags
        const tagEnricher = new TagEnricher()
        let events = await tagEnricher.enrichTags(employeeId, dateStr, 'day')
        
        // Auto-detect night shift if needed
        const detectedShift = tagEnricher.detectShiftType(events)
        if (detectedShift === 'night') {
          events = await tagEnricher.enrichTags(employeeId, dateStr, 'night')
        }
        
        // Skip if no events for this date
        if (events.length === 0) {
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
        
        // Calculate metrics with Ground Rules
        const employeeInfo = {
          employeeId,
          teamName: employee.team_name || employee.group_name || 'Unknown Team',
          workScheduleType: employee.work_schedule_type || '선택근무제'
        }
        
        const metrics = calculator.calculateEnhancedMetrics(timeline, employeeInfo, dateStr)
        
        // Generate Ground Rules analysis
        let groundRulesAnalysis = undefined
        if (metrics.groundRulesMetrics) {
          const comparison = calculator.compareWithGroundRules(metrics, 8.0) // Default 8 hours
          const anomalyReport = calculator.generateAnomalyReport(metrics)
          
          groundRulesAnalysis = {
            teamUsed: employeeInfo.teamName,
            workScheduleUsed: employeeInfo.workScheduleType,
            accuracyImprovement: comparison.improvement,
            anomalyReport
          }
        }
        
        results.push({
          employeeId,
          employeeName,
          date: dateStr,
          metrics,
          groundRulesAnalysis
        })
        
      } catch (dateError) {
        results.push({
          employeeId,
          employeeName,
          date: dateStr,
          metrics: null,
          error: dateError instanceof Error ? dateError.message : 'Date processing error'
        })
      }
    }
    
  } catch (error) {
    results.push({
      employeeId,
      employeeName,
      date: startDate,
      metrics: null,
      error: error instanceof Error ? error.message : 'Employee processing error'
    })
  } finally {
    // Calculator cleanup handled by caller
  }
  
  return results
}

export async function POST(request: Request) {
  try {
    const body: WorkerAnalysisRequest = await request.json()
    const { employees, startDate, endDate, saveToDb = true, workerCount = 4 } = body
    
    if (!employees || employees.length === 0) {
      return NextResponse.json(
        { error: 'No employees provided' },
        { status: 400 }
      )
    }
    
    console.log(`🎯 Starting Ground Rules Worker Analysis for ${employees.length} employees`)
    console.log(`📅 Date range: ${startDate} to ${endDate}`)
    console.log(`⚡ Pre-loading all data for memory processing`)
    
    // Pre-load all employee data to avoid DB contention
    const employeeDataMap = new Map()
    for (const emp of employees) {
      const employeeData = getEmployeeById(emp.employeeId)
      if (employeeData) {
        employeeDataMap.set(emp.employeeId, employeeData)
      }
    }
    console.log(`📊 Pre-loaded ${employeeDataMap.size} employee records`)
    
    // Create single shared calculator
    const analyticsDbPath = path.join(process.cwd(), 'sambio_analytics.db')
    const calculator = new EnhancedWorkHourCalculator(analyticsDbPath)
    
    try {
      // Process ALL employees at once with Promise.all (maximum parallelization)
      console.log(`🚀 Processing ALL ${employees.length} employees in FULL PARALLEL mode`)
      const startTime = Date.now()
      
      const employeePromises = employees.map(async (emp, index) => {
        const empStartTime = Date.now()
        console.log(`⚡ Starting employee ${emp.employeeId} (${index + 1}/${employees.length})`)
        
        const results = await processEmployeeAsync(
          emp.employeeId,
          emp.employeeName,
          startDate,
          endDate,
          calculator
        )
        
        const empDuration = Date.now() - empStartTime
        console.log(`✅ Employee ${emp.employeeId} completed in ${empDuration}ms`)
        return results
      })
      
      // Wait for ALL employees to complete simultaneously
      const allResults = await Promise.all(employeePromises)
      const workerResults = allResults.flat()
      
      const totalDuration = Date.now() - startTime
      console.log(`🎉 ALL ${employees.length} employees completed in ${totalDuration}ms`)
    
    // Transform worker results to standard format
    const results = workerResults
      .filter(result => !result.error && result.metrics)
      .map(result => ({
        date: result.date,
        employeeId: result.employeeId,
        employeeName: result.employeeName,
        metrics: result.metrics,
        claimedHours: null, // Will be populated if needed
        groundRulesAnalysis: result.groundRulesAnalysis
      }))
    
    // Save to database if requested
    if (saveToDb) {
      console.log(`💾 Saving ${results.length} results to database...`)
      
      for (const result of results) {
        try {
          const saveData = {
            employeeId: result.employeeId,
            analysisDate: result.date,
            totalHours: result.metrics.totalTime / 60,
            actualWorkHours: result.metrics.workTime / 60,
            claimedWorkHours: result.claimedHours,
            efficiencyRatio: result.metrics.workRatio,
            focusedWorkMinutes: result.metrics.focusTime,
            meetingMinutes: result.metrics.meetingTime,
            mealMinutes: result.metrics.mealTime,
            movementMinutes: result.metrics.transitTime,
            restMinutes: result.metrics.restTime,
            confidenceScore: result.metrics.reliabilityScore
          }
          
          // Add Ground Rules metrics if available
          if (result.metrics.groundRulesMetrics) {
            Object.assign(saveData, {
              groundRulesWorkHours: result.metrics.groundRulesMetrics.groundRulesWorkTime / 60,
              groundRulesConfidence: result.metrics.groundRulesMetrics.groundRulesConfidence,
              workMovementMinutes: result.metrics.groundRulesMetrics.t1WorkMovement,
              nonWorkMovementMinutes: result.metrics.groundRulesMetrics.t1NonWorkMovement,
              anomalyScore: result.metrics.groundRulesMetrics.anomalyScore
            })
          }
          
          saveDailyAnalysisResult(saveData)
        } catch (dbError) {
          console.error(`❌ DB save error for employee ${result.employeeId}:`, dbError)
          // Continue processing even if DB save fails
        }
      }
    }
    
    // Collect errors
    const errors = workerResults
      .filter(result => result.error)
      .map(result => ({
        employeeId: result.employeeId,
        date: result.date,
        error: result.error
      }))
    
    console.log(`✅ Worker analysis completed: ${results.length} results, ${errors.length} errors`)
    console.log(`🚀 Shared calculator cleaned up`)
    
    return NextResponse.json({
      results,
      errors,
      summary: {
        totalProcessed: results.length,
        totalErrors: errors.length,
        dateRange: { startDate, endDate },
        employeeCount: employees.length,
        workerCount,
        groundRulesEnabled: true,
        processingMode: 'worker-batched',
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
      }
    })
    
    } finally {
      // Clean up shared calculator
      calculator.close()
    }
    
  } catch (error) {
    console.error('❌ Ground Rules Worker Analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to process Ground Rules worker analysis' },
      { status: 500 }
    )
  }
}