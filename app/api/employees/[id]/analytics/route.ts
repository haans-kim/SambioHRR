import { NextResponse } from 'next/server'
import { getEmployeeById, getClaimData, getNonWorkTimeData } from '@/lib/database/queries'
import { TagEnricher } from '@/lib/classifier/TagEnricher'
import { ActivityStateMachine } from '@/lib/classifier/StateMachine'
import { WorkHourCalculator } from '@/lib/analytics/WorkHourCalculator'
import { JobGroupClassifier } from '@/lib/classifier/JobGroupClassifier'
import type { TimelineEntry, WorkMetrics } from '@/types/analytics'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Performance timing start
    const startTime = performance.now()
    const timings: Record<string, number> = {}
    
    const { id } = await params
    const url = new URL(request.url)
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0]
    const shift = url.searchParams.get('shift') as 'day' | 'night' || 'day'
    
    const employeeId = parseInt(id)
    
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
    
    // Calculate work metrics
    const metricsStart = performance.now()
    const calculator = new WorkHourCalculator()
    const metrics = calculator.calculateMetrics(timeline)
    metrics.employeeId = employeeId
    metrics.date = date
    timings.metricsCalculation = performance.now() - metricsStart
    
    // Get claimed hours for comparison
    const claimStart = performance.now()
    const claimData = getClaimData(employeeId, date) as any
    const comparison = claimData && claimData.근무시간
      ? calculator.compareWithClaim(metrics, claimData.근무시간)
      : null
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
      statistics: {
        totalEvents: events.length,
        totalEntries: timeline.length,
        t1Tags: t1Tags.length,
        t1WorkReturns: t1WorkReturns.length,
        t1DefaultProbability: defaultProbability,
        oTags: timeline.filter(e => e.tagCode === 'O').length,
        shift: detectedShift
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
    return NextResponse.json(
      { error: 'Failed to generate analytics', details: error },
      { status: 500 }
    )
  }
}