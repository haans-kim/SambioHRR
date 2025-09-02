import { NextResponse } from 'next/server'
import { getEmployeeById } from '@/lib/database/queries'
import { TagEnricher } from '@/lib/classifier/TagEnricher'
import { ActivityStateMachine } from '@/lib/classifier/StateMachine'
import { JobGroupClassifier } from '@/lib/classifier/JobGroupClassifier'
import type { TimelineEntry } from '@/types/analytics'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0]
    const shift = url.searchParams.get('shift') as 'day' | 'night' || 'day'
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '100')
    
    const employeeId = parseInt(id)
    
    // Get employee data
    const employee = getEmployeeById(employeeId)
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }
    
    // Classify job group
    const jobGroupClassifier = new JobGroupClassifier()
    const jobGroup = jobGroupClassifier.classifyEmployee(employee)
    
    // Enrich tags
    const tagEnricher = new TagEnricher()
    const events = await tagEnricher.enrichTags(employeeId, date, shift)
    
    // Find first and last T tags for the day (including T1, T2, T3)
    const firstTTagIndex = events.findIndex(e => 
      e.tagCode === 'T1' || e.tagCode === 'T2' || e.tagCode === 'T3'
    )
    const reversedIndex = events.slice().reverse().findIndex(e => 
      e.tagCode === 'T1' || e.tagCode === 'T2' || e.tagCode === 'T3'
    )
    const lastTTagIndex = reversedIndex !== -1 ? events.length - 1 - reversedIndex : -1
    
    // Create timeline with state classification
    const stateMachine = new ActivityStateMachine()
    const timeline: TimelineEntry[] = []
    
    for (let i = 0; i < events.length; i++) {
      const current = events[i]
      const prev = i > 0 ? events[i - 1] : null
      const next = i < events.length - 1 ? events[i + 1] : null
      
      // Determine if this is first or last T tag
      const isFirstTTag = i === firstTTagIndex
      const isLastTTag = i === lastTTagIndex && lastTTagIndex !== -1
      
      const entry = stateMachine.classifyEvent(
        current, 
        prev, 
        next, 
        jobGroup,
        isFirstTTag,
        isLastTTag
      )
      timeline.push(entry)
    }
    
    // Paginate results
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedTimeline = timeline.slice(startIndex, endIndex)
    
    return NextResponse.json({
      timeline: paginatedTimeline,
      pagination: {
        page,
        limit,
        total: timeline.length,
        totalPages: Math.ceil(timeline.length / limit)
      }
    })
  } catch (error) {
    console.error('Timeline API Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate timeline' },
      { status: 500 }
    )
  }
}