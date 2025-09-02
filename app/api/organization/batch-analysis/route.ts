import { NextResponse } from 'next/server'
import { getEmployeeById, getClaimData, saveDailyAnalysisResult } from '@/lib/database/queries'
import { TagEnricher } from '@/lib/classifier/TagEnricher'
import { ActivityStateMachine } from '@/lib/classifier/StateMachine'
import { WorkHourCalculator } from '@/lib/analytics/WorkHourCalculator'
import { JobGroupClassifier } from '@/lib/classifier/JobGroupClassifier'
import type { WorkMetrics } from '@/types/analytics'

interface BatchAnalysisRequest {
  employees: Array<{ 
    employeeId: number; 
    employeeName: string;
    dates?: string[];  // Optional specific dates to analyze
  }>
  startDate: string
  endDate: string
  saveToDb?: boolean  // Optional flag to save results to DB
}

interface BatchAnalysisResult {
  date: string
  employeeId: number
  employeeName: string
  metrics: WorkMetrics
  claimedHours?: number
}

export async function POST(request: Request) {
  try {
    const body: BatchAnalysisRequest = await request.json()
    const { employees, startDate, endDate, saveToDb = true } = body // 기본값을 true로 변경
    
    const results: BatchAnalysisResult[] = []
    const errors: any[] = []
    
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
          
          // Calculate metrics
          const calculator = new WorkHourCalculator()
          const metrics = calculator.calculateMetrics(timeline)
          metrics.employeeId = emp.employeeId
          metrics.date = dateStr
          
          // Get claimed hours
          const claimData = getClaimData(emp.employeeId, dateStr) as any
          const claimedHours = claimData?.근무시간 || null
          
          results.push({
            date: dateStr,
            employeeId: emp.employeeId,
            employeeName: emp.employeeName,
            metrics,
            claimedHours
          })
          
          // Save to DB if requested
          if (saveToDb) {
            try {
              saveDailyAnalysisResult({
                employeeId: emp.employeeId,
                analysisDate: dateStr,
                totalHours: metrics.totalTime / 60,  // Convert minutes to hours
                actualWorkHours: metrics.workTime / 60,  // Convert minutes to hours
                claimedWorkHours: claimedHours,
                efficiencyRatio: metrics.workRatio,
                focusedWorkMinutes: metrics.focusTime,
                meetingMinutes: metrics.meetingTime,
                mealMinutes: metrics.mealTime,
                movementMinutes: metrics.transitTime,
                restMinutes: metrics.restTime,
                confidenceScore: metrics.reliabilityScore
              })
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
    
    return NextResponse.json({
      results,
      errors,
      summary: {
        totalProcessed: results.length,
        totalErrors: errors.length,
        dateRange: { startDate, endDate },
        employeeCount: employees.length,
        totalOperations,
        completedOperations
      }
    })
    
  } catch (error) {
    console.error('Batch analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to process batch analysis' },
      { status: 500 }
    )
  }
}