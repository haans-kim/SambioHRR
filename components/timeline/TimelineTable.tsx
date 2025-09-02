'use client'

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import useAppStore from '@/stores/useAppStore'
import type { TimelineEntry } from '@/types/analytics'

interface TimelineData {
  timeline: TimelineEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const getStateColor = (state: string) => {
  switch (state) {
    case '업무':
    case '준비':
      return 'text-blue-600'
    case '회의':
      return 'text-purple-600'
    case '교육':
      return 'text-indigo-600'
    case '식사':
      return 'text-orange-600'
    case '휴게':
    case '비업무':
      return 'text-red-600'
    case '경유':
    case '출입IN':
    case '출입OUT':
      return 'text-gray-600'
    default:
      return 'text-gray-900'
  }
}

const getTagCodeBadgeColor = (tagCode: string) => {
  if (tagCode === 'O') return 'bg-green-100 text-green-800'
  if (tagCode.startsWith('G')) return 'bg-blue-100 text-blue-800'
  if (tagCode.startsWith('N')) return 'bg-red-100 text-red-800'
  if (tagCode.startsWith('T')) return 'bg-gray-100 text-gray-800'
  if (tagCode.startsWith('M')) return 'bg-orange-100 text-orange-800'
  return 'bg-gray-100 text-gray-800'
}

export default function TimelineTable() {
  const { selectedEmployee, selectedDate } = useAppStore()
  
  const { data: timeline = [], isLoading, error } = useQuery<TimelineEntry[]>({
    queryKey: ['timeline', selectedEmployee, selectedDate],
    queryFn: async () => {
      if (!selectedEmployee) throw new Error('No employee selected')
      
      const res = await fetch(
        `/api/employees/${selectedEmployee.employee_id}/timeline?` + 
        `date=${selectedDate.toISOString().split('T')[0]}&` +
        `limit=200`
      )
      
      if (!res.ok) throw new Error('Failed to fetch timeline')
      const data = await res.json()
      console.log('Timeline API response:', data) // 디버깅용
      return data.timeline || []
    },
    enabled: !!selectedEmployee
  })
  
  if (!selectedEmployee) {
    return (
      <div className="text-center text-gray-500 py-8">
        직원을 선택하면 타임라인이 표시됩니다
      </div>
    )
  }
  
  if (isLoading) {
    return (
      <div className="text-center text-gray-500 py-8">
        타임라인 로딩 중...
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="text-center text-red-600 py-8">
        타임라인을 불러오는 중 오류가 발생했습니다
      </div>
    )
  }
  
  if (!timeline || timeline.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        선택한 날짜에 데이터가 없습니다
      </div>
    )
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              시간
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              태그 종류
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              위치
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              태그
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              시간(분)
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              상태
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              판정
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              확신도
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {timeline.map((entry, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                {format(new Date(entry.timestamp), 'HH:mm:ss', { locale: ko })}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  entry.tagType === 'Equipment' ? 'bg-green-100 text-green-800' :
                  entry.tagType === 'Meal' ? 'bg-orange-100 text-orange-800' :
                  entry.tagType === 'Knox' ? 'bg-purple-100 text-purple-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {entry.tagType}
                </span>
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 max-w-xs truncate">
                {entry.tagName}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  getTagCodeBadgeColor(entry.tagCode)
                }`}>
                  {entry.tagCode}
                </span>
                {entry.assumption && (
                  <span className="ml-1 text-xs text-yellow-600" title={entry.assumption}>
                    *
                  </span>
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                {entry.duration || '-'}
              </td>
              <td className={`px-3 py-2 whitespace-nowrap text-sm font-medium ${
                getStateColor(entry.state)
              }`}>
                {entry.state}
              </td>
              <td className={`px-3 py-2 whitespace-nowrap text-sm ${
                entry.judgment === '업무' || entry.judgment === '집중업무' 
                  ? 'text-blue-600 font-medium'
                  : 'text-gray-600'
              }`}>
                {entry.judgment}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                {entry.confidence 
                  ? `${Math.round(entry.confidence * 100)}%`
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {timeline.length > 100 && (
        <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-700">
          총 {timeline.length}개 항목
        </div>
      )}
    </div>
  )
}