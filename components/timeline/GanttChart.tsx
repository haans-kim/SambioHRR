'use client'

import { useQuery } from '@tanstack/react-query'
import useAppStore from '@/stores/useAppStore'
import { ActivityState, WorkJudgment } from '@/types/analytics'
import type { TimelineEntry } from '@/types/analytics'

interface GanttChartProps {
  className?: string
}

// State color mapping with RGBA for transparency
const STATE_COLORS = {
  [ActivityState.ENTRY]: 'rgba(16, 185, 129, 0.6)', // green
  [ActivityState.EXIT]: 'rgba(239, 68, 68, 0.6)', // red
  [ActivityState.WORK]: 'rgba(59, 130, 246, 0.6)', // blue
  [ActivityState.PREPARATION]: 'rgba(96, 165, 250, 0.6)', // light blue
  [ActivityState.MEETING]: 'rgba(139, 92, 246, 0.6)', // purple
  [ActivityState.EDUCATION]: 'rgba(99, 102, 241, 0.6)', // indigo
  [ActivityState.REST]: 'rgba(249, 115, 22, 0.6)', // orange
  [ActivityState.MEAL]: 'rgba(245, 158, 11, 0.6)', // amber
  [ActivityState.TRANSIT]: 'rgba(100, 116, 139, 0.6)', // slate
  [ActivityState.NON_WORK]: 'rgba(236, 72, 153, 0.6)', // pink
}

// Judgment color mapping for summary bars with lighter alpha
const JUDGMENT_COLORS = {
  [WorkJudgment.CLOCK_IN]: 'rgba(16, 185, 129, 0.5)',
  [WorkJudgment.CLOCK_OUT]: 'rgba(239, 68, 68, 0.5)',
  [WorkJudgment.WORK]: 'rgba(59, 130, 246, 0.5)',
  [WorkJudgment.FOCUSED]: 'rgba(30, 64, 175, 0.5)',
  [WorkJudgment.NON_WORK]: 'rgba(236, 72, 153, 0.5)',
  [WorkJudgment.MOVEMENT]: 'rgba(100, 116, 139, 0.5)',
  [WorkJudgment.MEAL]: 'rgba(245, 158, 11, 0.5)',
}

// State labels in Korean
const STATE_LABELS = {
  [ActivityState.ENTRY]: '출근',
  [ActivityState.EXIT]: '퇴근',
  [ActivityState.WORK]: '작업',
  [ActivityState.PREPARATION]: '작업준비',
  [ActivityState.MEETING]: '회의',
  [ActivityState.EDUCATION]: '교육',
  [ActivityState.REST]: '휴식',
  [ActivityState.MEAL]: '식사',
  [ActivityState.TRANSIT]: '이동',
  [ActivityState.NON_WORK]: '비업무',
}

// Judgment labels in Korean
const JUDGMENT_LABELS = {
  [WorkJudgment.CLOCK_IN]: '출근',
  [WorkJudgment.CLOCK_OUT]: '퇴근',
  [WorkJudgment.WORK]: '업무',
  [WorkJudgment.FOCUSED]: '집중업무',
  [WorkJudgment.NON_WORK]: '비업무',
  [WorkJudgment.MOVEMENT]: '이동',
  [WorkJudgment.MEAL]: '식사',
}

export default function GanttChart({ className = '' }: GanttChartProps) {
  const { selectedEmployee, selectedDate } = useAppStore()
  
  const { data: timeline = [], isLoading } = useQuery<TimelineEntry[]>({
    queryKey: ['timeline', selectedEmployee, selectedDate],
    queryFn: async () => {
      if (!selectedEmployee) throw new Error('No employee selected')
      
      const res = await fetch(
        `/api/employees/${selectedEmployee.employee_id}/timeline?` + 
        `date=${selectedDate.toISOString().split('T')[0]}`
      )
      
      if (!res.ok) throw new Error('Failed to fetch timeline')
      const data = await res.json()
      return data.timeline || []
    },
    enabled: !!selectedEmployee
  })

  if (!selectedEmployee) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">활동 타임라인</h3>
        <div className="text-center text-gray-500 py-8">
          직원을 선택해주세요
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">활동 타임라인</h3>
        <div className="text-center text-gray-500 py-8">
          로딩 중...
        </div>
      </div>
    )
  }

  if (!timeline || timeline.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">활동 타임라인</h3>
        <div className="text-center text-gray-500 py-8">
          데이터가 없습니다
        </div>
      </div>
    )
  }

  // Calculate time range
  const startTime = new Date(timeline[0].timestamp)
  const endTime = new Date(timeline[timeline.length - 1].timestamp)
  const totalMinutes = (endTime.getTime() - startTime.getTime()) / 60000

  // Calculate focus time segments using the same logic as API
  // Group timeline by hour and find hours with 3+ O tags
  const hourWindows: Map<number, TimelineEntry[]> = new Map()
  
  // Group events by hour
  for (const entry of timeline) {
    const hour = Math.floor(new Date(entry.timestamp).getTime() / (60 * 60 * 1000))
    if (!hourWindows.has(hour)) {
      hourWindows.set(hour, [])
    }
    hourWindows.get(hour)!.push(entry)
  }
  
  // Find focus segments (hours with 2+ O tags) - Updated from 3+
  const focusSegments: { start: Date; end: Date; oTagCount: number }[] = []
  
  for (const [hour, entries] of hourWindows) {
    const oTags = entries.filter(e => e.tagCode === 'O')
    if (oTags.length >= 2) {
      // Find work entries in this hour
      const workEntries = entries.filter(e => 
        e.state === ActivityState.WORK || 
        e.state === ActivityState.PREPARATION
      )
      
      if (workEntries.length > 0) {
        // Create focus segments from work entries
        for (const entry of workEntries) {
          if (entry.duration && entry.duration > 0) {
            const start = new Date(entry.timestamp)
            const end = new Date(entry.timestamp)
            end.setMinutes(end.getMinutes() + entry.duration)
            
            // Check if this can be merged with the last segment
            if (focusSegments.length > 0) {
              const lastSegment = focusSegments[focusSegments.length - 1]
              const gap = start.getTime() - lastSegment.end.getTime()
              
              // If gap is less than 10 minutes, merge segments
              if (gap < 10 * 60 * 1000) {
                lastSegment.end = end
                lastSegment.oTagCount += oTags.length
                continue
              }
            }
            
            focusSegments.push({
              start,
              end,
              oTagCount: oTags.length
            })
          }
        }
      }
    }
  }

  // Group timeline by state for rendering
  const stateGroups = new Map<ActivityState, TimelineEntry[]>()
  const judgmentGroups = new Map<WorkJudgment, { start: Date; end: Date }[]>()

  // Initialize state groups
  Object.values(ActivityState).forEach(state => {
    if (typeof state === 'string') {
      stateGroups.set(state as ActivityState, [])
    }
  })

  // Group entries by state
  timeline.forEach(entry => {
    const group = stateGroups.get(entry.state)
    if (group) {
      group.push(entry)
    }
  })

  // Calculate judgment summary bars
  let currentJudgment: WorkJudgment | null = null
  let judgmentStart: Date | null = null

  timeline.forEach((entry, index) => {
    if (entry.judgment !== currentJudgment) {
      // End previous judgment period
      if (currentJudgment && judgmentStart) {
        const periods = judgmentGroups.get(currentJudgment) || []
        periods.push({ start: judgmentStart, end: new Date(entry.timestamp) })
        judgmentGroups.set(currentJudgment, periods)
      }
      
      // Start new judgment period
      currentJudgment = entry.judgment
      judgmentStart = new Date(entry.timestamp)
    }
    
    // Handle last entry
    if (index === timeline.length - 1 && currentJudgment && judgmentStart) {
      const periods = judgmentGroups.get(currentJudgment) || []
      const endDate = new Date(entry.timestamp)
      if (entry.duration) {
        endDate.setMinutes(endDate.getMinutes() + entry.duration)
      }
      periods.push({ start: judgmentStart, end: endDate })
      judgmentGroups.set(currentJudgment, periods)
    }
  })

  // Helper function to calculate position
  const getPosition = (time: Date) => {
    const minutes = (time.getTime() - startTime.getTime()) / 60000
    return (minutes / totalMinutes) * 100
  }

  // Helper function to format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
  }

  // Generate hour markers
  const hourMarkers = []
  const currentHour = new Date(startTime)
  currentHour.setMinutes(0, 0, 0)
  currentHour.setHours(currentHour.getHours() + 1)
  
  while (currentHour <= endTime) {
    hourMarkers.push(new Date(currentHour))
    currentHour.setHours(currentHour.getHours() + 1)
  }

  // Create a timeline with all events for point visualization
  const allEvents = timeline.map((entry, index) => ({
    ...entry,
    position: getPosition(new Date(entry.timestamp)),
    index
  }))

  // Group consecutive events with same judgment for connection lines
  const connectionLines: { start: number; end: number; judgment: WorkJudgment }[] = []
  let lineStart = 0
  let currentLineJudgment = timeline[0]?.judgment

  timeline.forEach((entry, index) => {
    if (entry.judgment !== currentLineJudgment) {
      if (index > 0) {
        connectionLines.push({
          start: allEvents[lineStart].position,
          end: allEvents[index - 1].position,
          judgment: currentLineJudgment
        })
      }
      lineStart = index
      currentLineJudgment = entry.judgment
    }
    if (index === timeline.length - 1) {
      connectionLines.push({
        start: allEvents[lineStart].position,
        end: allEvents[index].position,
        judgment: currentLineJudgment
      })
    }
  })

  return (
    <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4">활동 타임라인</h3>
      
      <div className="relative">
        {/* Time axis labels */}
        <div className="flex justify-between text-sm font-medium text-gray-600 mb-4">
          <span>{formatTime(startTime)}</span>
          {hourMarkers.map((hour, index) => (
            <span 
              key={index}
              className="absolute text-sm"
              style={{ left: `${getPosition(hour)}%` }}
            >
              {formatTime(hour)}
            </span>
          ))}
          <span>{formatTime(endTime)}</span>
        </div>

        {/* Focus time bars (집중시간) */}
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-700 mb-2 ml-20">
            집중작업시간 
            <span className="ml-2 text-xs text-gray-500">
              (시간당 O태그 2개 이상)
            </span>
          </div>
          <div className="relative ml-20 h-10 bg-gray-100 rounded">
            {focusSegments.length > 0 ? (
              focusSegments.map((segment, index) => {
                const left = getPosition(segment.start)
                const width = getPosition(segment.end) - left
                const duration = (segment.end.getTime() - segment.start.getTime()) / 60000 // minutes
                
                return (
                  <div
                    key={`focus-${index}`}
                    className="absolute rounded"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      height: '4px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      backgroundColor: 'rgba(34, 197, 94, 0.9)', // Green color for focus time
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                    }}
                    title={`집중작업 (${formatTime(segment.start)} - ${formatTime(segment.end)}) | ${Math.floor(duration)}분 | O태그: ${segment.oTagCount}개`}
                  />
                )
              })
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-gray-500">
                집중작업시간 없음
              </div>
            )}
          </div>
        </div>

        {/* Judgment summary bars (top level) */}
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-700 mb-2 ml-20">판정구분</div>
          <div className="relative ml-20 h-10 bg-gray-100 rounded">
            {Array.from(judgmentGroups.entries()).map(([judgment, periods]) => (
              periods.map((period, index) => {
                const left = getPosition(period.start)
                const width = getPosition(period.end) - left
                
                return (
                  <div
                    key={`${judgment}-${index}`}
                    className="absolute h-full rounded"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: JUDGMENT_COLORS[judgment]
                    }}
                    title={`${JUDGMENT_LABELS[judgment]} (${formatTime(period.start)} - ${formatTime(period.end)})`}
                  />
                )
              })
            ))}
          </div>
        </div>

        {/* Single continuous flow visualization */}
        <div className="mt-6">
          <div className="text-sm font-medium text-gray-700 mb-3">활동 흐름</div>
          <div className="relative ml-20 h-64 bg-gradient-to-b from-gray-50 to-white rounded border border-gray-100">
            {/* Y-axis state labels */}
            <div className="absolute left-0 top-0 bottom-0 -ml-20 flex flex-col justify-around text-xs font-medium text-gray-700 pr-2">
              <span>출근</span>
              <span>작업준비</span>
              <span>작업</span>
              <span>회의/교육</span>
              <span>휴식</span>
              <span>식사</span>
              <span>이동</span>
              <span>비업무</span>
              <span>퇴근</span>
            </div>
            
            {/* Map states to Y positions - Fixed mapping */}
            {(() => {
              const stateYPositions: Record<string, number> = {
                [ActivityState.ENTRY]: 10,
                [ActivityState.PREPARATION]: 20,
                [ActivityState.WORK]: 30,  // 작업 라인 위치
                [ActivityState.MEETING]: 40,  // 회의 라인 위치  
                [ActivityState.EDUCATION]: 40,  // 교육도 회의와 같은 라인
                [ActivityState.REST]: 50,
                [ActivityState.MEAL]: 60,
                [ActivityState.TRANSIT]: 70,
                [ActivityState.NON_WORK]: 80,
                [ActivityState.EXIT]: 90
              }
              
              // Draw continuous line connecting all events
              const pathData = timeline.map((entry, index) => {
                const x = getPosition(new Date(entry.timestamp))
                const y = stateYPositions[entry.state] || 50
                return { x, y, entry }
              })
              
              return (
                <>
                  {/* Draw connecting lines */}
                  {pathData.map((point, index) => {
                    if (index === 0) return null
                    const prevPoint = pathData[index - 1]
                    
                    // Horizontal line to new time position
                    const horizontalLine = (
                      <line
                        key={`h-${index}`}
                        x1={`${prevPoint.x}%`}
                        y1={`${prevPoint.y}%`}
                        x2={`${point.x}%`}
                        y2={`${prevPoint.y}%`}
                        stroke={JUDGMENT_COLORS[prevPoint.entry.judgment]}
                        strokeWidth="2"
                      />
                    )
                    
                    // Vertical line to new state
                    const verticalLine = prevPoint.y !== point.y ? (
                      <line
                        key={`v-${index}`}
                        x1={`${point.x}%`}
                        y1={`${prevPoint.y}%`}
                        x2={`${point.x}%`}
                        y2={`${point.y}%`}
                        stroke={JUDGMENT_COLORS[point.entry.judgment]}
                        strokeWidth="2"
                        strokeDasharray="2,2"
                      />
                    ) : null
                    
                    return (
                      <svg key={`svg-${index}`} className="absolute inset-0 w-full h-full">
                        {horizontalLine}
                        {verticalLine}
                      </svg>
                    )
                  })}
                  
                  {/* Draw points */}
                  {pathData.map((point, index) => {
                    const isKeyPoint = point.entry.state === ActivityState.ENTRY || 
                                      point.entry.state === ActivityState.EXIT ||
                                      point.entry.tagCode === 'O' ||
                                      point.entry.tagCode?.startsWith('M')
                    
                    // Knox 데이터는 tagType이 'Knox'이거나 location에 'Knox'가 포함된 경우
                    const isKnoxData = point.entry.tagType === 'Knox' || 
                                      point.entry.tagName?.includes('Knox')
                    
                    // M2는 테이크아웃
                    const isM2 = point.entry.tagCode === 'M2'
                    
                    return (
                      <div
                        key={`point-${index}`}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                        style={{ 
                          left: `${point.x}%`,
                          top: `${point.y}%`
                        }}
                      >
                        <div
                          className={`${isKeyPoint ? 'w-5 h-5' : 'w-4 h-4'} ${isM2 ? 'rotate-45' : 'rounded-full'} border-2 border-white shadow-lg cursor-pointer hover:scale-150 transition-transform`}
                          style={{
                            backgroundColor: isKnoxData ? 'rgba(139, 92, 246, 0.8)' : STATE_COLORS[point.entry.state]
                          }}
                          title={`${formatTime(new Date(point.entry.timestamp))} - ${point.entry.tagName} [${point.entry.tagCode}] ${STATE_LABELS[point.entry.state]} (${point.entry.duration || 0}분, ${Math.round((point.entry.confidence || 0) * 100)}%)`}
                        />
                        {/* Show tag code for key points */}
                        {isKeyPoint && (
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap text-gray-700">
                            {point.entry.tagCode}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )
            })()}
          </div>
        </div>


        {/* Vertical hour grid lines - very subtle */}
        {hourMarkers.map((hour, index) => (
          <div
            key={index}
            className="absolute top-0 bottom-0 border-l border-gray-200 opacity-20"
            style={{ left: `${getPosition(hour)}%` }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-6 text-xs">
          <div className="flex-1">
            <span className="font-medium text-gray-600">상태:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {Object.entries(STATE_LABELS).map(([state, label]) => (
                <div key={state} className="flex items-center gap-1">
                  <div 
                    className="w-3 h-3 rounded-sm border border-gray-200"
                    style={{ backgroundColor: STATE_COLORS[state as ActivityState] }}
                  />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="font-medium text-gray-600">집중작업:</span>
            <div className="flex items-center gap-2 mt-1">
              <div 
                className="w-6 rounded-sm"
                style={{ 
                  height: '4px',
                  backgroundColor: 'rgba(34, 197, 94, 0.9)',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                }}
              />
              <span>시간당 O태그 3개↑</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}