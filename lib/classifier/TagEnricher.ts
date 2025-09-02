import { TagCode, type TagEvent } from '@/types/analytics'
import type { TagData, MealData, KnoxPimsData } from '@/types/database'
import { 
  getTagData, 
  getMealData, 
  getKnoxPimsData,
  getKnoxMailData,
  getKnoxApprovalData,
  getEquipmentData
} from '@/lib/database/queries'

export class TagEnricher {
  // Map location names to tag codes
  private locationToTagCode(location: string): TagCode {
    const lowerLocation = location.toLowerCase()
    
    // G codes (work areas)
    if (lowerLocation.includes('회의') || lowerLocation.includes('meeting')) {
      return TagCode.G3
    }
    if (lowerLocation.includes('교육') || lowerLocation.includes('강의') || lowerLocation.includes('univ')) {
      return TagCode.G4
    }
    if (lowerLocation.includes('locker') || lowerLocation.includes('락커') || 
        lowerLocation.includes('가우닝') || lowerLocation.includes('gowning') ||
        lowerLocation.includes('탈의') || lowerLocation.includes('경의') || 
        lowerLocation.includes('파우더')) {
      return TagCode.G2
    }
    
    // N codes (non-work areas)
    if (lowerLocation.includes('휴게') || lowerLocation.includes('모성') || 
        lowerLocation.includes('대기') || lowerLocation.includes('수면') || 
        lowerLocation.includes('탐배')) {
      return TagCode.N1
    }
    if (lowerLocation.includes('메디컬') || lowerLocation.includes('약국') || 
        lowerLocation.includes('휘트니스') || lowerLocation.includes('마용실') || 
        lowerLocation.includes('세탁소') || lowerLocation.includes('나눔')) {
      return TagCode.N2
    }
    
    // T codes (transit)
    if (lowerLocation.includes('복도') || lowerLocation.includes('브릿지') || 
        lowerLocation.includes('계단') || lowerLocation.includes('연결통로')) {
      return TagCode.T1
    }
    if (lowerLocation.includes('입문') || lowerLocation.includes('정문입') || 
        lowerLocation.includes('스피드게이트입')) {
      return TagCode.T2
    }
    if (lowerLocation.includes('출문') || lowerLocation.includes('정문출') || 
        lowerLocation.includes('스피드게이트출')) {
      return TagCode.T3
    }
    
    // Default to G1 (main work area)
    return TagCode.G1
  }
  
  async enrichTags(
    employeeId: number, 
    date: string, 
    shift: 'day' | 'night' = 'day'
  ): Promise<TagEvent[]> {
    const events: TagEvent[] = []
    
    // Always get current day data first
    const tagData = getTagData(employeeId, date)
    
    // Convert tag data to events
    for (const tag of tagData) {
      events.push({
        timestamp: new Date(tag.ENTE_DT),
        employeeId: tag.사번,
        tagCode: tag.Tag_Code ? tag.Tag_Code as TagCode : this.locationToTagCode(tag.Location),
        location: tag.Location,
        source: 'tag'
      })
    }
    
    // Check if we need to get previous day data for night shift
    // If there's data before 06:00 or shift is explicitly night
    const hasEarlyData = tagData.some(tag => {
      const timeStr = tag.ENTE_DT.split(' ')[1]
      const hour = parseInt(timeStr.split(':')[0])
      return hour < 6
    })

    const isNight = shift === 'night' || hasEarlyData

    // If night shift (explicit or detected), also get previous day's data using the same daily routine
    if (isNight) {
      const prevDate = new Date(date)
      prevDate.setDate(prevDate.getDate() - 1)
      const prevDateStr = prevDate.toISOString().split('T')[0]
      
      const prevDayData = getTagData(employeeId, prevDateStr)
      
      // Add previous day data
      for (const tag of prevDayData) {
        events.push({
          timestamp: new Date(tag.ENTE_DT),
          employeeId: tag.사번,
          tagCode: tag.Tag_Code ? tag.Tag_Code as TagCode : this.locationToTagCode(tag.Location),
          location: tag.Location,
          source: 'tag'
        })
      }
    }
    
    // Get and add meal data (current day)
    const mealData = getMealData(employeeId, date)
    for (const meal of mealData) {
      events.push({
        timestamp: meal.timestamp,
        employeeId: meal.employee_id,
        tagCode: meal.tag_code as TagCode,  // M1 or M2 based on takeout
        location: meal.cafeteria,
        source: 'meal'
      })
    }
    // Night shift: add previous day's meals as well
    if (isNight) {
      const prevDate = new Date(date)
      prevDate.setDate(prevDate.getDate() - 1)
      const prevDateStr = prevDate.toISOString().split('T')[0]
      const prevMealData = getMealData(employeeId, prevDateStr)
      for (const meal of prevMealData) {
        events.push({
          timestamp: meal.timestamp,
          employeeId: meal.employee_id,
          tagCode: meal.tag_code as TagCode,
          location: meal.cafeteria,
          source: 'meal'
        })
      }
    }
    
    // Get and add Knox PIMS data (G3 for meetings, G4 for education)
    const knoxPimsData = getKnoxPimsData(employeeId, date)
    for (const knox of knoxPimsData) {
      const tagCode = knox.meeting_type.includes('회의') || knox.meeting_type.includes('보고') 
        ? TagCode.G3 
        : knox.meeting_type.includes('교육') 
        ? TagCode.G4 
        : TagCode.G1
        
      events.push({
        timestamp: new Date(knox.start_time),
        employeeId: knox.employee_id,
        tagCode,
        location: `Knox PIMS: ${knox.meeting_type}`,
        source: 'knox',
        duration: knox.end_time ? Math.floor((new Date(knox.end_time).getTime() - new Date(knox.start_time).getTime()) / 60000) : undefined
      })
    }
    if (isNight) {
      const prevDate = new Date(date)
      prevDate.setDate(prevDate.getDate() - 1)
      const prevDateStr = prevDate.toISOString().split('T')[0]
      const prevKnoxPims = getKnoxPimsData(employeeId, prevDateStr)
      for (const knox of prevKnoxPims) {
        const tagCode = knox.meeting_type.includes('회의') || knox.meeting_type.includes('보고') 
          ? TagCode.G3 
          : knox.meeting_type.includes('교육') 
          ? TagCode.G4 
          : TagCode.G1
        events.push({
          timestamp: new Date(knox.start_time),
          employeeId: knox.employee_id,
          tagCode,
          location: `Knox PIMS: ${knox.meeting_type}`,
          source: 'knox',
          duration: knox.end_time ? Math.floor((new Date(knox.end_time).getTime() - new Date(knox.start_time).getTime()) / 60000) : undefined
        })
      }
    }
    
    // Get and add Knox Mail data (converted to O tags)
    const knoxMailData = getKnoxMailData(employeeId, date) as any[]
    for (const mail of knoxMailData) {
      events.push({
        timestamp: new Date(mail.timestamp),
        employeeId: mail.employee_id,
        tagCode: TagCode.O,
        location: 'Knox: Mail',
        source: 'equipment'  // Use 'equipment' source so it appears as O tag
      })
    }
    if (isNight) {
      const prevMailData = getKnoxMailData(employeeId, (d => { const t=new Date(d); t.setDate(t.getDate()-1); return t.toISOString().split('T')[0]; })(date)) as any[]
      for (const mail of prevMailData) {
        events.push({
          timestamp: new Date(mail.timestamp),
          employeeId: mail.employee_id,
          tagCode: TagCode.O,
          location: 'Knox: Mail',
          source: 'equipment'
        })
      }
    }
    
    // Get and add Knox Approval data (converted to O tags)
    const knoxApprovalData = getKnoxApprovalData(employeeId, date) as any[]
    for (const approval of knoxApprovalData) {
      events.push({
        timestamp: new Date(approval.timestamp),
        employeeId: approval.employee_id,
        tagCode: TagCode.O,
        location: 'Knox: Approval',
        source: 'equipment'  // Use 'equipment' source so it appears as O tag
      })
    }
    if (isNight) {
      const prevApprovalData = getKnoxApprovalData(employeeId, (d => { const t=new Date(d); t.setDate(t.getDate()-1); return t.toISOString().split('T')[0]; })(date)) as any[]
      for (const approval of prevApprovalData) {
        events.push({
          timestamp: new Date(approval.timestamp),
          employeeId: approval.employee_id,
          tagCode: TagCode.O,
          location: 'Knox: Approval',
          source: 'equipment'
        })
      }
    }
    
    // Get and add equipment data (all converted to O tags)
    const equipmentData = getEquipmentData(employeeId, date) as any[]
    for (const equipment of equipmentData) {
      events.push({
        timestamp: new Date(equipment.Timestamp),
        employeeId: equipment.USERNO,
        tagCode: TagCode.O,
        location: `Equipment: ${equipment.Source}`,
        source: 'equipment'
      })
    }
    if (isNight) {
      const prevEquip = getEquipmentData(employeeId, (d => { const t=new Date(d); t.setDate(t.getDate()-1); return t.toISOString().split('T')[0]; })(date)) as any[]
      for (const equipment of prevEquip) {
        events.push({
          timestamp: new Date(equipment.Timestamp),
          employeeId: equipment.USERNO,
          tagCode: TagCode.O,
          location: `Equipment: ${equipment.Source}`,
          source: 'equipment'
        })
      }
    }
    
    // Sort all events by timestamp
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    
    // Remove duplicates within 1 minute
    const deduplicatedEvents = this.removeDuplicates(events)
    
    // For night shift, filter to previous day 18:00 (local) ~ current day 12:00 (local)
    if (isNight && deduplicatedEvents.length > 0) {
      const start = new Date(date)
      start.setDate(start.getDate() - 1)
      start.setHours(18, 0, 0, 0)
      const end = new Date(date)
      end.setHours(12, 0, 0, 0)

      const filteredEvents = deduplicatedEvents.filter(event => {
        const ts = event.timestamp.getTime()
        return ts >= start.getTime() && ts < end.getTime()
      })

      return filteredEvents
    }
    
    return deduplicatedEvents
  }
  
  private removeDuplicates(events: TagEvent[]): TagEvent[] {
    if (events.length === 0) return []
    
    const result: TagEvent[] = [events[0]]
    
    for (let i = 1; i < events.length; i++) {
      const prev = result[result.length - 1]
      const curr = events[i]
      
      // Skip if same tag within 1 minute
      const timeDiff = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000
      if (timeDiff < 60 && prev.tagCode === curr.tagCode) {
        continue
      }
      
      result.push(curr)
    }
    
    return result
  }
  
  // Detect shift type based on first tag time
  detectShiftType(events: TagEvent[]): 'day' | 'night' {
    if (events.length === 0) return 'day'
    
    const firstHour = events[0].timestamp.getHours()
    
    // Night shift if first tag is:
    // - After 18:00 (evening entry)
    // - Before 06:00 (still working from previous night)
    if (firstHour >= 18 || firstHour < 6) {
      return 'night'
    }
    
    return 'day'
  }
}