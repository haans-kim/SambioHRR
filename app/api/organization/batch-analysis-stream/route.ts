import { getEmployeeById, getClaimData, saveDailyAnalysisResult } from '@/lib/database/queries'
import { TagEnricher } from '@/lib/classifier/TagEnricher'
import { ActivityStateMachine } from '@/lib/classifier/StateMachine'
import { WorkHourCalculator } from '@/lib/analytics/WorkHourCalculator'
import { JobGroupClassifier } from '@/lib/classifier/JobGroupClassifier'

export async function POST(request: Request) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await request.json()
        const { employees, startDate, endDate, saveToDb = false } = body
        
        const results: any[] = []
        const errors: any[] = []
        
        // Calculate total operations
        const start = new Date(startDate)
        const end = new Date(endDate)
        const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
        const totalOperations = employees.length * dayCount
        let completedOperations = 0
        
        // Send initial progress
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'progress', 
          progress: 10,
          total: totalOperations,
          completed: 0 
        })}\n\n`))
        
        // Process each employee for each date
        for (let dateObj = new Date(start); dateObj <= end; dateObj.setDate(dateObj.getDate() + 1)) {
          const dateStr = dateObj.toISOString().split('T')[0]
          
          for (const emp of employees) {
            try {
              // Get employee data
              const employee = getEmployeeById(emp.employeeId)
              if (!employee) {
                errors.push({ employeeId: emp.employeeId, date: dateStr, error: 'Employee not found' })
                completedOperations++
                continue
              }
              
              // Classify job group
              const jobGroupClassifier = new JobGroupClassifier()
              const jobGroup = jobGroupClassifier.classifyEmployee(employee)
              
              // Enrich tags
              const tagEnricher = new TagEnricher()
              let events = await tagEnricher.enrichTags(emp.employeeId, dateStr, 'day')
              
              // Auto-detect night shift
              const detectedShift = tagEnricher.detectShiftType(events)
              if (detectedShift === 'night') {
                events = await tagEnricher.enrichTags(emp.employeeId, dateStr, 'night')
              }
              
              // Skip if no events
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
                  })
                } catch (dbError) {
                  console.error('Error saving to DB:', dbError)
                }
              }
              
              completedOperations++
              
              // Send progress update
              const progress = Math.round((completedOperations / totalOperations) * 100)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'progress', 
                progress,
                total: totalOperations,
                completed: completedOperations 
              })}\n\n`))
              
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
        
        // Send final results
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
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
        })}\n\n`))
        
        controller.close()
        
      } catch (error) {
        console.error('Stream error:', error)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'error', 
          error: 'Failed to process analysis' 
        })}\n\n`))
        controller.close()
      }
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}