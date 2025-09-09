import { NextResponse } from 'next/server'
import { getEmployeeById, getClaimData, getNonWorkTimeData } from '@/lib/database/queries'
import { TagEnricher } from '@/lib/classifier/TagEnricher'
import { ActivityStateMachine } from '@/lib/classifier/StateMachine'
import { WorkHourCalculator } from '@/lib/analytics/WorkHourCalculator'
import { EnhancedWorkHourCalculator } from '@/lib/analytics/EnhancedWorkHourCalculator'
import { JobGroupClassifier } from '@/lib/classifier/JobGroupClassifier'
import type { TimelineEntry, WorkMetrics } from '@/types/analytics'
import path from 'path'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Initialize Enhanced Calculator outside try block for proper cleanup
  let enhancedCalculator: EnhancedWorkHourCalculator | null = null
  
  try {
    // Performance timing start
    const startTime = performance.now()
    const timings: Record<string, number> = {}
    
    const { id } = await params
    const url = new URL(request.url)
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0]
    const shift = url.searchParams.get('shift') as 'day' | 'night' || 'day'
    const useGroundRules = url.searchParams.get('useGroundRules') === 'true'
    
    const employeeId = parseInt(id)
    
    // Initialize Enhanced Calculator if Ground Rules enabled
    try {
      if (useGroundRules) {
        const analyticsDbPath = path.join(process.cwd(), 'sambio_analytics.db')
        enhancedCalculator = new EnhancedWorkHourCalculator(analyticsDbPath)
        console.log('🎯 Ground Rules enabled for individual analysis')
      }
    } catch (error) {
      console.error('Failed to initialize Enhanced Calculator:', error)
      enhancedCalculator = null
    }
    
    // Get employee data
    const employeeQueryStart = performance.now()
    const employee = getEmployeeById(employeeId)
    timings.employeeQuery = performance.now() - employeeQueryStart
    
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }
    
    // Classify job group
    const jobGroupStart = performance.now()
    const jobGroupClassifier = new JobGroupClassifier()
    const jobGroup = jobGroupClassifier.classifyEmployee(employee)
    const jobGroupName = jobGroupClassifier.getJobGroupName(jobGroup)
    const defaultProbability = jobGroupClassifier.getJobGroupProbability(jobGroup)
    timings.jobGroupClassification = performance.now() - jobGroupStart
    
    // Enrich tags (merge all data sources)
    const enrichStart = performance.now()
    const tagEnricher = new TagEnricher()
    let events = await tagEnricher.enrichTags(employeeId, date, shift)
    // Auto-detect night shift and re-enrich if needed so callers don't have to pass shift=night
    const detectedShift = tagEnricher.detectShiftType(events)
    if (shift !== 'night' && detectedShift === 'night') {
      events = await tagEnricher.enrichTags(employeeId, date, 'night')
    }
    timings.tagEnrichment = performance.now() - enrichStart
    
    // Find first and last T tags for the day (including T1, T2, T3)
    const tTags = events.filter(e => 
      e.tagCode === 'T1' || e.tagCode === 'T2' || e.tagCode === 'T3'
    )
    const firstTTagIndex = events.findIndex(e => 
      e.tagCode === 'T1' || e.tagCode === 'T2' || e.tagCode === 'T3'
    )
    const reversedIndex = events.slice().reverse().findIndex(e => 
      e.tagCode === 'T1' || e.tagCode === 'T2' || e.tagCode === 'T3'
    )
    const lastTTagIndex = reversedIndex !== -1 ? events.length - 1 - reversedIndex : -1
    
    
    // Create timeline with state classification
    const classificationStart = performance.now()
    const stateMachine = new ActivityStateMachine()
    const timeline: TimelineEntry[] = []
    
    for (let i = 0; i < events.length; i++) {
      const current = events[i]
      const prev = i > 0 ? events[i - 1] : null
      const next = i < events.length - 1 ? events[i + 1] : null
      
      // Special handling for T1 -> T1 -> G1 pattern
      // Check if current is T1, next is T1, and the one after that is G1
      let isT1ToG1Pattern = false
      if (current.tagCode === 'T1' && next && next.tagCode === 'T1') {
        const nextNext = i < events.length - 2 ? events[i + 2] : null
        if (nextNext && nextNext.tagCode === 'G1') {
          // Check if the next T1's duration is within 30 minutes
          const nextDuration = Math.floor((nextNext.timestamp.getTime() - next.timestamp.getTime()) / 60000)
          if (nextDuration <= 30) {
            isT1ToG1Pattern = true
          }
        }
      }
      
      // Determine if this is first or last T tag
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
    timings.stateClassification = performance.now() - classificationStart
    
    // Calculate work metrics with Ground Rules if enabled
    const metricsStart = performance.now()
    let metrics: WorkMetrics
    let groundRulesAnalysis: any = undefined
    
    if (enhancedCalculator && useGroundRules) {
      // Extract team and work schedule info from employee data
      const employeeInfo = {
        employeeId: employeeId,
        teamName: employee.team_name || employee.group_name || employee.department || 'Unknown Team',
        workScheduleType: employee.work_schedule_type || employee.shift_type || '선택근무제'
      }
      
      metrics = enhancedCalculator.calculateEnhancedMetrics(timeline, employeeInfo, date)
      
      // Generate Ground Rules analysis
      if (metrics.groundRulesMetrics) {
        const claimData = getClaimData(employeeId, date) as any
        const claimedHours = claimData?.근무시간 || 8.0 // Default to 8 hours if no claim
        
        const comparison = enhancedCalculator.compareWithGroundRules(metrics, claimedHours)
        const anomalyReport = enhancedCalculator.generateAnomalyReport(metrics)
        
        groundRulesAnalysis = {
          teamUsed: employeeInfo.teamName,
          workScheduleUsed: employeeInfo.workScheduleType,
          accuracyImprovement: comparison.improvement,
          anomalyReport,
          comparison
        }
      }
    } else {
      // Use traditional calculator
      const calculator = new WorkHourCalculator()
      metrics = calculator.calculateMetrics(timeline)
      metrics.employeeId = employeeId
      metrics.date = date
    }
    timings.metricsCalculation = performance.now() - metricsStart
    
    // Get claimed hours for comparison
    const claimStart = performance.now()
    const claimData = getClaimData(employeeId, date) as any
    let comparison = null
    
    if (claimData && claimData.근무시간) {
      if (enhancedCalculator && useGroundRules) {
        comparison = enhancedCalculator.compareWithGroundRules(metrics, claimData.근무시간)
      } else {
        // Use traditional calculator for comparison
        const traditionalCalculator = new WorkHourCalculator()
        comparison = traditionalCalculator.compareWithClaim(metrics, claimData.근무시간)
      }
    }
    
    timings.claimDataQuery = performance.now() - claimStart
    
    // Get non-work time data
    const nonWorkStart = performance.now()
    const nonWorkData = getNonWorkTimeData(employeeId, date) as any[]
    timings.nonWorkDataQuery = performance.now() - nonWorkStart
    
    // Count T1 tags and work returns
    const t1Tags = timeline.filter(e => e.tagCode === 'T1')
    const t1WorkReturns = t1Tags.filter(e => e.assumption === 'T1_WORK_RETURN')
    
    // Calculate total time
    timings.totalTime = performance.now() - startTime
    
    // Clean up calculator
    if (enhancedCalculator) {
      enhancedCalculator.close()
    }
    
    return NextResponse.json({
      employee: {
        ...employee,
        jobGroup,
        jobGroupName
      },
      metrics,
      comparison,
      claimData: claimData ? {
        date: claimData.근무일,
        employeeId: claimData.사번,
        name: claimData.성명,
        department: claimData.부서,
        position: claimData.직급,
        workScheduleType: claimData.근무제도,
        claimedHours: claimData.근무시간,
        startTime: claimData.시작,
        endTime: claimData.종료,
        excludedMinutes: claimData.제외시간,
        leaveType: claimData.근태명,
        actualWorkHours: claimData.실제근무시간
      } : null,
      nonWorkData: nonWorkData.map(item => ({
        type: item.제외시간구분,
        code: item.제외시간코드,
        startTime: item.시작,
        endTime: item.종료,
        minutes: item.제외시간,
        inputType: item.입력구분,
        status: item.반영여부
      })),
      timeline: timeline.slice(0, 100), // Limit for initial response
      groundRulesAnalysis, // Ground Rules analysis if enabled
      statistics: {
        totalEvents: events.length,
        totalEntries: timeline.length,
        t1Tags: t1Tags.length,
        t1WorkReturns: t1WorkReturns.length,
        t1DefaultProbability: defaultProbability,
        oTags: timeline.filter(e => e.tagCode === 'O').length,
        shift: detectedShift,
        groundRulesEnabled: useGroundRules
      },
      performance: {
        totalTimeMs: timings.totalTime,
        breakdownMs: {
          employeeQuery: timings.employeeQuery,
          jobGroupClassification: timings.jobGroupClassification,
          tagEnrichment: timings.tagEnrichment,
          stateClassification: timings.stateClassification,
          metricsCalculation: timings.metricsCalculation,
          claimDataQuery: timings.claimDataQuery,
          nonWorkDataQuery: timings.nonWorkDataQuery
        },
        eventsPerSecond: Math.round(events.length / (timings.totalTime / 1000))
      }
    })
  } catch (error) {
    console.error('Analytics API Error:', error)
    
    // Clean up calculator in case of error
    try {
      if (enhancedCalculator) {
        enhancedCalculator.close()
      }
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError)
    }
    
    return NextResponse.json(
      { error: 'Failed to generate analytics', details: error },
      { status: 500 }
    )
  }
}