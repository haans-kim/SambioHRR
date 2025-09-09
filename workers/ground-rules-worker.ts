import { parentPort, workerData } from 'worker_threads'
import { EnhancedWorkHourCalculator } from '../lib/analytics/EnhancedWorkHourCalculator'
import { TagEnricher } from '../lib/classifier/TagEnricher'
import { ActivityStateMachine } from '../lib/classifier/StateMachine'
import { JobGroupClassifier } from '../lib/classifier/JobGroupClassifier'
import { getEmployeeById } from '../lib/database/queries'
import type { WorkMetrics } from '../types/analytics'

interface WorkerTask {
  employeeId: number
  employeeName: string
  startDate: string
  endDate: string
  analyticsDbPath: string
  workerId: number
}

interface WorkerResult {
  workerId: number
  employeeId: number
  employeeName: string
  date: string
  metrics: WorkMetrics
  groundRulesAnalysis?: any
  error?: string
}

async function processEmployee(task: WorkerTask): Promise<WorkerResult[]> {
  const results: WorkerResult[] = []
  
  try {
    // Initialize Enhanced Calculator
    const calculator = new EnhancedWorkHourCalculator(task.analyticsDbPath)
    
    // Get employee data
    const employee = getEmployeeById(task.employeeId)
    if (!employee) {
      return [{
        workerId: task.workerId,
        employeeId: task.employeeId,
        employeeName: task.employeeName,
        date: task.startDate,
        metrics: {} as WorkMetrics,
        error: 'Employee not found'
      }]
    }
    
    // Classify job group
    const jobGroupClassifier = new JobGroupClassifier()
    const jobGroup = jobGroupClassifier.classifyEmployee(employee)
    
    // Process each date in range
    const start = new Date(task.startDate)
    const end = new Date(task.endDate)
    
    for (let dateObj = new Date(start); dateObj <= end; dateObj.setDate(dateObj.getDate() + 1)) {
      const dateStr = dateObj.toISOString().split('T')[0]
      
      try {
        // Enrich tags
        const tagEnricher = new TagEnricher()
        let events = await tagEnricher.enrichTags(task.employeeId, dateStr, 'day')
        
        // Auto-detect night shift if needed
        const detectedShift = tagEnricher.detectShiftType(events)
        if (detectedShift === 'night') {
          events = await tagEnricher.enrichTags(task.employeeId, dateStr, 'night')
        }
        
        // Skip if no events for this date
        if (events.length === 0) {
          continue
        }
        
        // 1시간 미만 Claim은 Ground Rules 분석에서 제외 (의미 없는 극단적 효율성 방지)
        const { getClaimData } = await import('../lib/database/queries')
        let totalClaimedForValidation = 0
        if (detectedShift === 'night') {
          // 야간근무: 전날+당일 합산으로 검사
          const prevDate = new Date(dateStr)
          prevDate.setDate(prevDate.getDate() - 1)
          const prevDateStr = prevDate.toISOString().split('T')[0]
          
          const currentClaimData = getClaimData(task.employeeId, dateStr) as any
          const prevClaimData = getClaimData(task.employeeId, prevDateStr) as any
          
          const currentHours = currentClaimData?.근무시간 || 0
          const prevHours = prevClaimData?.근무시간 || 0
          totalClaimedForValidation = currentHours + prevHours
        } else {
          // 주간근무: 해당 날짜만
          const preliminaryClaimData = getClaimData(task.employeeId, dateStr) as any
          totalClaimedForValidation = preliminaryClaimData?.근무시간 || 0
        }
        
        if (totalClaimedForValidation < 1.0) {
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
          employeeId: task.employeeId,
          teamName: employee.team_name || employee.group_name || employee.department || 'Unknown Team',
          workScheduleType: employee.work_schedule_type || employee.shift_type || '선택근무제'
        }
        
        const metrics = calculator.calculateEnhancedMetrics(timeline, employeeInfo, dateStr)
        
        // Generate Ground Rules analysis
        let groundRulesAnalysis = undefined
        if (metrics.groundRulesMetrics) {
          // 야간근무일 때는 전날+당일 Claim 데이터 사용
          let analysisClaimedHours = 8.0 // Default
          if (detectedShift === 'night') {
            const prevDate = new Date(dateStr)
            prevDate.setDate(prevDate.getDate() - 1)
            const prevDateStr = prevDate.toISOString().split('T')[0]
            
            const currentClaimData = getClaimData(task.employeeId, dateStr) as any
            const prevClaimData = getClaimData(task.employeeId, prevDateStr) as any
            
            const currentHours = currentClaimData?.근무시간 || 0
            const prevHours = prevClaimData?.근무시간 || 0
            analysisClaimedHours = (currentHours + prevHours) || 8.0
          } else {
            const claimData = getClaimData(task.employeeId, dateStr) as any
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
        
        results.push({
          workerId: task.workerId,
          employeeId: task.employeeId,
          employeeName: task.employeeName,
          date: dateStr,
          metrics,
          groundRulesAnalysis
        })
        
      } catch (dateError) {
        results.push({
          workerId: task.workerId,
          employeeId: task.employeeId,
          employeeName: task.employeeName,
          date: dateStr,
          metrics: {} as WorkMetrics,
          error: dateError instanceof Error ? dateError.message : 'Date processing error'
        })
      }
    }
    
    // Clean up calculator
    calculator.close()
    
  } catch (error) {
    results.push({
      workerId: task.workerId,
      employeeId: task.employeeId,
      employeeName: task.employeeName,
      date: task.startDate,
      metrics: {} as WorkMetrics,
      error: error instanceof Error ? error.message : 'Worker processing error'
    })
  }
  
  return results
}

// Worker main execution
async function main() {
  const task: WorkerTask = workerData
  
  try {
    const results = await processEmployee(task)
    
    // Send results back to main thread
    if (parentPort) {
      parentPort.postMessage({
        type: 'success',
        workerId: task.workerId,
        results
      })
    }
    
  } catch (error) {
    // Send error back to main thread
    if (parentPort) {
      parentPort.postMessage({
        type: 'error',
        workerId: task.workerId,
        error: error instanceof Error ? error.message : 'Unknown worker error'
      })
    }
  }
}

main().catch(console.error)