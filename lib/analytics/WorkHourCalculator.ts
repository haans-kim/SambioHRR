import type { WorkMetrics, TimelineEntry, TagEvent } from '@/types/analytics'
import { ActivityState, WorkJudgment, TagCode } from '@/types/analytics'

export type AnalysisMode = 'enhanced' | 'legacy';

export class WorkHourCalculator {
  private mode: AnalysisMode = 'enhanced';
  
  constructor(mode: AnalysisMode = 'enhanced') {
    this.mode = mode;
  }
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
    
    if (this.mode === 'legacy') {
      return this.calculateLegacyMetrics(timeline, metrics);
    }
    
    // Enhanced mode - original calculation
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

  private calculateLegacyMetrics(timeline: TimelineEntry[], metrics: WorkMetrics): WorkMetrics {
    // Legacy mode - Limited to Tag and Claim data only
    // Estimate work time based on tag patterns and basic assumptions
    
    let workTime = 0;
    let meetingTime = 0;
    let mealTime = 0;
    let estimatedWorkTime = 0;
    
    // Count tags by type to estimate activities
    const tagCounts = {
      O: 0,     // Work tags
      G3: 0,    // Meeting tags (Knox PIMS)  
      G4: 0,    // Education tags
      I: 0,     // Entry tags
      T: 0      // Exit tags
    };
    
    for (const entry of timeline) {
      if (entry.tagCode) {
        tagCounts[entry.tagCode as keyof typeof tagCounts] = 
          (tagCounts[entry.tagCode as keyof typeof tagCounts] || 0) + 1;
      }
      
      const duration = entry.duration || 0;
      
      // Basic state-based calculation for available states
      switch (entry.state) {
        case ActivityState.WORK:
        case ActivityState.PREPARATION:
          workTime += duration;
          break;
        case ActivityState.MEETING:
          meetingTime += duration;
          workTime += duration; // Meeting counts as work
          break;
        case ActivityState.EDUCATION:
          workTime += duration; // Education counts as work
          break;
        case ActivityState.MEAL:
          mealTime += duration;
          break;
      }
      
      // T1 work return assumptions count as estimated work
      if (entry.assumption === 'T1_WORK_RETURN') {
        estimatedWorkTime += duration * (entry.confidence || 0.3); // Lower confidence in legacy mode
      }
    }
    
    // Legacy mode estimations based on tag patterns
    if (workTime === 0 && tagCounts.O > 0) {
      // Estimate work time based on O tags if no explicit work state detected
      // Assume each O tag represents 15-30 minutes of work activity
      const avgWorkPerTag = 22.5; // minutes
      workTime = tagCounts.O * avgWorkPerTag;
    }
    
    if (meetingTime === 0 && tagCounts.G3 > 0) {
      // Estimate meeting time from G3 tags
      const avgMeetingPerTag = 45; // minutes per meeting
      meetingTime = tagCounts.G3 * avgMeetingPerTag;
      workTime += meetingTime; // Add to work time
    }
    
    if (mealTime === 0 && metrics.totalTime > 240) { // If present > 4 hours
      // Estimate meal time based on total presence
      if (metrics.totalTime > 480) { // 8+ hours
        mealTime = 60; // 1 hour meal break
      } else if (metrics.totalTime > 360) { // 6+ hours  
        mealTime = 45; // 45 min meal break
      } else {
        mealTime = 30; // 30 min meal break
      }
    }
    
    // Apply legacy mode limitations
    metrics.workTime = workTime;
    metrics.meetingTime = meetingTime;
    metrics.mealTime = mealTime;
    metrics.estimatedWorkTime = estimatedWorkTime;
    
    // Simplified focus time calculation for legacy mode
    metrics.focusTime = this.calculateLegacyFocusTime(timeline);
    
    // Calculate work ratio
    if (metrics.totalTime > 0) {
      metrics.workRatio = Math.round((metrics.workTime / metrics.totalTime) * 100);
    }
    
    // Adjusted reliability score for legacy mode
    metrics.reliabilityScore = this.calculateLegacyReliability(timeline);
    
    return metrics;
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
  
  private calculateLegacyFocusTime(timeline: TimelineEntry[]): number {
    // Simplified focus time calculation for legacy mode
    // Uses only tag-based patterns without detailed state information
    let focusTime = 0;
    const hourWindows: Map<number, TimelineEntry[]> = new Map();
    
    // Group events by hour
    for (const entry of timeline) {
      const hour = Math.floor(entry.timestamp.getTime() / (60 * 60 * 1000));
      if (!hourWindows.has(hour)) {
        hourWindows.set(hour, []);
      }
      hourWindows.get(hour)!.push(entry);
    }
    
    // Check each hour window for focus indicators
    for (const [hour, entries] of hourWindows) {
      const oTags = entries.filter(e => e.tagCode === TagCode.O);
      const g3Tags = entries.filter(e => e.tagCode === TagCode.G3);
      const g4Tags = entries.filter(e => e.tagCode === TagCode.G4);
      
      // Include G3/G4 time as focus time (meetings and education)
      if (g3Tags.length > 0) {
        // Estimate meeting time per G3 tag
        focusTime += g3Tags.length * 45; // 45 minutes per meeting
      }
      if (g4Tags.length > 0) {
        // Estimate education time per G4 tag
        focusTime += g4Tags.length * 60; // 60 minutes per education session
      }
      
      // Relaxed O tag threshold for legacy mode (1+ O tags = potential focus)
      if (oTags.length >= 1) {
        // Estimate focus time based on O tag density
        const estimatedFocusMinutes = Math.min(oTags.length * 20, 60); // Max 1 hour per hour window
        focusTime += estimatedFocusMinutes;
      }
    }
    
    return focusTime;
  }
  
  private calculateLegacyReliability(timeline: TimelineEntry[]): number {
    // Adjusted reliability scoring for legacy mode with limited data
    let score = 40; // Lower base score due to data limitations
    
    const oTagCount = timeline.filter(e => e.tagCode === TagCode.O).length;
    const totalEvents = timeline.length;
    
    if (totalEvents > 0) {
      // O tag coverage (up to +25 points, reduced from +30)
      const oTagRatio = oTagCount / totalEvents;
      score += Math.min(oTagRatio * 80, 25);
      
      // Event frequency (up to +15 points, reduced from +20)
      const timeSpan = timeline[timeline.length - 1].timestamp.getTime() - timeline[0].timestamp.getTime();
      const eventsPerHour = (totalEvents / timeSpan) * 3600000;
      
      if (eventsPerHour > 3) score += 15;
      else if (eventsPerHour > 2) score += 12;
      else if (eventsPerHour > 1) score += 8;
      else score += 3;
      
      // Bonus for having meeting/education tags
      const hasG3 = timeline.some(e => e.tagCode === TagCode.G3);
      const hasG4 = timeline.some(e => e.tagCode === TagCode.G4);
      if (hasG3) score += 5;
      if (hasG4) score += 5;
    }
    
    // Penalty for data gaps (less severe in legacy mode)
    const uncertainEvents = timeline.filter(e => e.assumption === 'T1_UNCERTAIN').length;
    const uncertainRatio = totalEvents > 0 ? uncertainEvents / totalEvents : 0;
    score -= uncertainRatio * 15; // Reduced from 20
    
    // Large time gaps penalty (less severe)
    let maxGap = 0;
    for (let i = 1; i < timeline.length; i++) {
      const gap = timeline[i].timestamp.getTime() - timeline[i-1].timestamp.getTime();
      maxGap = Math.max(maxGap, gap);
    }
    if (maxGap > 3 * 60 * 60 * 1000) score -= 8; // >3 hour gap (relaxed from 2 hours)
    
    return Math.max(0, Math.min(100, Math.round(score)));
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