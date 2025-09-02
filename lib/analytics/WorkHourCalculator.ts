import type { WorkMetrics, TimelineEntry, TagEvent } from '@/types/analytics'
import { ActivityState, WorkJudgment, TagCode } from '@/types/analytics'

export class WorkHourCalculator {
  calculateMetrics(timeline: TimelineEntry[]): WorkMetrics {
    const metrics: WorkMetrics = {
      employeeId: 0,
      date: new Date().toISOString().split('T')[0],
      totalTime: 0,
      workTime: 0,
      estimatedWorkTime: 0,
      workRatio: 0,
      focusTime: 0,
      meetingTime: 0,
      mealTime: 0,
      transitTime: 0,
      restTime: 0,
      reliabilityScore: 0
    }
    
    if (timeline.length === 0) return metrics
    
    // Calculate total time (first to last tag)
    const firstTime = timeline[0].timestamp.getTime()
    const lastTime = timeline[timeline.length - 1].timestamp.getTime()
    metrics.totalTime = Math.floor((lastTime - firstTime) / 60000) // minutes
    
    // Aggregate time by state
    for (const entry of timeline) {
      const duration = entry.duration || 0
      
      switch (entry.state) {
        case ActivityState.WORK:
        case ActivityState.PREPARATION:
          metrics.workTime += duration
          break
        case ActivityState.MEETING:
          metrics.meetingTime += duration
          metrics.workTime += duration // Meeting counts as work
          break
        case ActivityState.EDUCATION:
          metrics.workTime += duration // Education counts as work
          break
        case ActivityState.MEAL:
          metrics.mealTime += duration
          break
        case ActivityState.REST:
        case ActivityState.NON_WORK:
          metrics.restTime += duration
          break
        case ActivityState.TRANSIT:
        case ActivityState.ENTRY:
        case ActivityState.EXIT:
          metrics.transitTime += duration
          break
      }
      
      // T1 work return assumptions count as estimated work
      if (entry.assumption === 'T1_WORK_RETURN') {
        metrics.estimatedWorkTime += duration * (entry.confidence || 0.5)
      }
    }
    
    // Calculate focus time (periods with high O tag density)
    metrics.focusTime = this.calculateFocusTime(timeline)
    
    // Calculate work ratio
    if (metrics.totalTime > 0) {
      metrics.workRatio = Math.round((metrics.workTime / metrics.totalTime) * 100)
    }
    
    // Calculate reliability score
    metrics.reliabilityScore = this.calculateReliability(timeline)
    
    return metrics
  }
  
  private calculateFocusTime(timeline: TimelineEntry[]): number {
    let focusTime = 0
    const hourWindows: Map<number, TimelineEntry[]> = new Map()
    
    // Group events by hour
    for (const entry of timeline) {
      const hour = Math.floor(entry.timestamp.getTime() / (60 * 60 * 1000))
      if (!hourWindows.has(hour)) {
        hourWindows.set(hour, [])
      }
      hourWindows.get(hour)!.push(entry)
    }
    
    // Check each hour window for focus (3+ O tags or G3/G4 meeting/education tags)
    for (const [hour, entries] of hourWindows) {
      const oTags = entries.filter(e => e.tagCode === TagCode.O)
      const g3Tags = entries.filter(e => e.tagCode === TagCode.G3)
      const g4Tags = entries.filter(e => e.tagCode === TagCode.G4)
      
      // Include G3 (Knox PIMS meeting) and G4 (education) time as focus time
      if (g3Tags.length > 0) {
        focusTime += g3Tags.reduce((sum, e) => sum + (e.duration || 0), 0)
      }
      if (g4Tags.length > 0) {
        focusTime += g4Tags.reduce((sum, e) => sum + (e.duration || 0), 0)
      }
      
      // Updated logic: 2+ O tags in an hour (changed from 3+)
      if (oTags.length >= 2) {
        // Sum work time in this hour as focus time
        const workEntries = entries.filter(e => 
          e.state === ActivityState.WORK || 
          e.state === ActivityState.PREPARATION
        )
        focusTime += workEntries.reduce((sum, e) => sum + (e.duration || 0), 0)
      }
    }
    
    return focusTime
  }
  
  private calculateReliability(timeline: TimelineEntry[]): number {
    let score = 50 // Base score
    
    // Factors that increase reliability
    const oTagCount = timeline.filter(e => e.tagCode === TagCode.O).length
    const totalEvents = timeline.length
    
    if (totalEvents > 0) {
      // O tag coverage (up to +30 points)
      const oTagRatio = oTagCount / totalEvents
      score += Math.min(oTagRatio * 100, 30)
      
      // Event frequency (up to +20 points)
      const eventsPerHour = totalEvents / (timeline[timeline.length - 1].timestamp.getTime() - 
                                          timeline[0].timestamp.getTime()) * 3600000
      if (eventsPerHour > 5) score += 20
      else if (eventsPerHour > 3) score += 15
      else if (eventsPerHour > 1) score += 10
      else score += 5
    }
    
    // Factors that decrease reliability
    const uncertainEvents = timeline.filter(e => e.assumption === 'T1_UNCERTAIN').length
    const uncertainRatio = totalEvents > 0 ? uncertainEvents / totalEvents : 0
    score -= uncertainRatio * 20
    
    // Long gaps decrease reliability
    let maxGap = 0
    for (let i = 1; i < timeline.length; i++) {
      const gap = timeline[i].timestamp.getTime() - timeline[i-1].timestamp.getTime()
      maxGap = Math.max(maxGap, gap)
    }
    if (maxGap > 2 * 60 * 60 * 1000) score -= 10 // >2 hour gap
    
    return Math.max(0, Math.min(100, Math.round(score)))
  }
  
  // Compare with claimed hours
  compareWithClaim(metrics: WorkMetrics, claimedHours: number): {
    difference: number
    percentage: number
    status: 'under' | 'over' | 'match'
  } {
    const calculatedHours = metrics.workTime / 60
    const difference = calculatedHours - claimedHours
    const percentage = claimedHours > 0 
      ? Math.round((difference / claimedHours) * 100)
      : 0
    
    let status: 'under' | 'over' | 'match'
    if (Math.abs(difference) < 0.5) {
      status = 'match'
    } else if (difference < 0) {
      status = 'under'
    } else {
      status = 'over'
    }
    
    return { difference, percentage, status }
  }
}