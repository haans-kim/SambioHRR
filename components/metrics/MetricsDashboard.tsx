'use client'

import { useQuery } from '@tanstack/react-query'
import useAppStore from '@/stores/useAppStore'

interface AnalyticsData {
  employee: any
  metrics: any
  comparison: any
  statistics: any
  groundRulesAnalysis?: {
    teamUsed: string
    workScheduleUsed: string
    accuracyImprovement: number
    anomalyReport: {
      hasAnomalies: boolean
      anomalyLevel: 'none' | 'low' | 'medium' | 'high'
      summary: string
      recommendations: string[]
    }
    comparison: any
  }
  claimData: {
    date: string
    employeeId: number
    name: string
    department: string
    position: string
    workScheduleType: string
    claimedHours: string
    startTime: string
    endTime: string
    excludedMinutes: number
    leaveType: string
    actualWorkHours: number
  } | null
  nonWorkData: Array<{
    type: string
    code: string
    startTime: string
    endTime: string
    minutes: number
    inputType: string
    status: string
  }>
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}시간 ${mins}분`
}

export default function MetricsDashboard() {
  const { selectedEmployee, selectedDate, useGroundRules, setUseGroundRules } = useAppStore()
  
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics', selectedEmployee, selectedDate, useGroundRules],
    queryFn: async () => {
      if (!selectedEmployee) throw new Error('No employee selected')
      
      const params = new URLSearchParams({
        date: selectedDate.toISOString().split('T')[0],
        ...(useGroundRules && { useGroundRules: 'true' })
      })
      
      const res = await fetch(
        `/api/employees/${selectedEmployee.employee_id}/analytics?${params}`
      )
      
      if (!res.ok) throw new Error('Failed to fetch analytics')
      return res.json()
    },
    enabled: !!selectedEmployee
  })
  
  if (!selectedEmployee) {
    return (
      <div className="text-center text-gray-500 py-12">
        조직 브라우저에서 직원을 선택해주세요
      </div>
    )
  }
  
  if (isLoading) {
    return (
      <div className="text-center text-gray-500 py-12">
        분석 중...
      </div>
    )
  }
  
  if (!data) {
    return (
      <div className="text-center text-gray-500 py-12">
        데이터를 불러올 수 없습니다
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Ground Rules Toggle */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useGroundRules}
              onChange={(e) => setUseGroundRules(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">
              Ground Rules 분석 활성화
            </span>
          </label>
          {useGroundRules && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              🎯 Enhanced
            </span>
          )}
        </div>
        {data?.statistics?.groundRulesEnabled && (
          <div className="text-sm text-gray-600">
            Ground Rules 분석 적용됨
          </div>
        )}
      </div>

      {/* Employee Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {data.employee.name} ({data.employee.employee_id})
            </h3>
            <p className="text-sm text-gray-600">
              {data.employee.department} | {data.employee.position}
            </p>
            {/* Claim Data Info */}
            {data.claimData && (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">근무제도:</span> {data.claimData.workScheduleType}
                </p>
                <p className="text-sm text-blue-700">
                  {data.claimData.actualWorkHours && (
                    <>
                      <span className="font-medium">실제근무시간(Claim):</span> {data.claimData.actualWorkHours.toFixed(2)}시간
                      <span className="mx-2">|</span>
                    </>
                  )}
                  {data.claimData.excludedMinutes > 0 && (
                    <>
                      <span className="font-medium">제외시간:</span> {data.claimData.excludedMinutes}분
                      <span className="mx-2">|</span>
                    </>
                  )}
                  <span className="font-medium">신청 근무시간:</span> {data.claimData.claimedHours || '0:00'} 
                  {data.claimData.startTime && data.claimData.endTime && (
                    <span className="text-gray-600"> ({data.claimData.startTime} ~ {data.claimData.endTime})</span>
                  )}
                  {data.claimData.leaveType && (
                    <>
                      <span className="mx-2">|</span>
                      <span className="font-medium">근태:</span> {data.claimData.leaveType}
                    </>
                  )}
                </p>
                {/* Non-work time data */}
                {data.nonWorkData && data.nonWorkData.length > 0 && (
                  <p className="text-sm text-red-700">
                    <span className="font-medium">비업무시간:</span> {
                      data.nonWorkData.map((item, idx) => (
                        <span key={idx}>
                          {idx > 0 && ', '}
                          {item.type} {item.minutes}분
                          {item.startTime && item.endTime && (
                            <span className="text-gray-600"> ({item.startTime}~{item.endTime})</span>
                          )}
                        </span>
                      ))
                    }
                    <span className="text-gray-600 ml-1">
                      (총 {data.nonWorkData.reduce((sum, item) => sum + (parseInt(String(item.minutes)) || 0), 0)}분)
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">직군</div>
            <div className="text-lg font-semibold text-blue-600">
              {data.employee.jobGroupName}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {/* Total Time Card */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            총 체류시간
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {Math.floor(data.metrics.totalTime / 60)}h {data.metrics.totalTime % 60}m
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.metrics.totalTime}분
          </div>
        </div>

        {/* Work Time Card */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-1">
            실제 작업시간
          </div>
          <div className="text-2xl font-bold text-blue-700">
            {Math.floor(data.metrics.workTime / 60)}h {data.metrics.workTime % 60}m
          </div>
          <div className="text-xs text-blue-600 mt-1">
            {data.metrics.workRatio}% of total
          </div>
        </div>

        {/* Focus Time Card */}
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-xs font-medium text-green-600 uppercase tracking-wider mb-1">
            집중작업시간
          </div>
          <div className="text-2xl font-bold text-green-700">
            {Math.floor(data.metrics.focusTime / 60)}h {data.metrics.focusTime % 60}m
          </div>
          <div className="text-xs text-green-600 mt-1">
            O태그 밀도 &gt;3/h
          </div>
        </div>

        {/* Meeting Time Card */}
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="text-xs font-medium text-purple-600 uppercase tracking-wider mb-1">
            회의시간
          </div>
          <div className="text-2xl font-bold text-purple-700">
            {Math.floor(data.metrics.meetingTime / 60)}h {data.metrics.meetingTime % 60}m
          </div>
          <div className="text-xs text-purple-600 mt-1">
            Knox PIMS 기준
          </div>
        </div>

        {/* Meal Time Card */}
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="text-xs font-medium text-orange-600 uppercase tracking-wider mb-1">
            식사시간
          </div>
          <div className="text-2xl font-bold text-orange-700">
            {Math.floor(data.metrics.mealTime / 60)}h {data.metrics.mealTime % 60}m
          </div>
          <div className="text-xs text-orange-600 mt-1">
            구내식당 기준
          </div>
        </div>

        {/* Transit Time Card */}
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="text-xs font-medium text-yellow-600 uppercase tracking-wider mb-1">
            이동시간
          </div>
          <div className="text-2xl font-bold text-yellow-700">
            {Math.floor(data.metrics.transitTime / 60)}h {data.metrics.transitTime % 60}m
          </div>
          <div className="text-xs text-yellow-600 mt-1">
            통로 + 출입 시간
          </div>
        </div>

        {/* Non-Work Time Card */}
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="text-xs font-medium text-red-600 uppercase tracking-wider mb-1">
            비업무시간
          </div>
          <div className="text-2xl font-bold text-red-700">
            {Math.floor(data.metrics.restTime / 60)}h {data.metrics.restTime % 60}m
          </div>
          <div className="text-xs text-red-600 mt-1">
            휴식 + 외출 시간
          </div>
        </div>

        {/* Reliability Score Card */}
        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
          <div className="text-xs font-medium text-indigo-600 uppercase tracking-wider mb-1">
            데이터 신뢰도
          </div>
          <div className="text-2xl font-bold text-indigo-700">
            {data.metrics.reliabilityScore}%
          </div>
          <div className="text-xs text-indigo-600 mt-1">
            {data.metrics.reliabilityScore >= 80 ? '높음' : 
             data.metrics.reliabilityScore >= 60 ? '보통' : '낮음'}
          </div>
        </div>

        {/* Ground Rules Metrics - Only show when enabled and available */}
        {data.metrics.groundRulesMetrics && (
          <>
            {/* Ground Rules Work Time Card */}
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
              <div className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-1">
                Ground Rules 작업시간
              </div>
              <div className="text-2xl font-bold text-emerald-700">
                {Math.floor(data.metrics.groundRulesMetrics.groundRulesWorkTime / 60)}h{' '}
                {data.metrics.groundRulesMetrics.groundRulesWorkTime % 60}m
              </div>
              <div className="text-xs text-emerald-600 mt-1">
                팀 맥락 기반 분석
              </div>
            </div>

            {/* Ground Rules Confidence Card */}
            <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
              <div className="text-xs font-medium text-teal-600 uppercase tracking-wider mb-1">
                T1 이동 신뢰도
              </div>
              <div className="text-2xl font-bold text-teal-700">
                {data.metrics.groundRulesMetrics.groundRulesConfidence}%
              </div>
              <div className="text-xs text-teal-600 mt-1">
                {data.metrics.groundRulesMetrics.groundRulesConfidence >= 70 ? '높음' : 
                 data.metrics.groundRulesMetrics.groundRulesConfidence >= 50 ? '보통' : '낮음'}
              </div>
            </div>

            {/* Work Movement Card */}
            <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
              <div className="text-xs font-medium text-cyan-600 uppercase tracking-wider mb-1">
                업무 관련 이동
              </div>
              <div className="text-2xl font-bold text-cyan-700">
                {Math.floor(data.metrics.groundRulesMetrics.t1WorkMovement / 60)}h{' '}
                {data.metrics.groundRulesMetrics.t1WorkMovement % 60}m
              </div>
              <div className="text-xs text-cyan-600 mt-1">
                T1 태그 분석
              </div>
            </div>

            {/* Anomaly Score Card */}
            <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
              <div className="text-xs font-medium text-rose-600 uppercase tracking-wider mb-1">
                이상치 점수
              </div>
              <div className="text-2xl font-bold text-rose-700">
                {data.metrics.groundRulesMetrics.anomalyScore}%
              </div>
              <div className="text-xs text-rose-600 mt-1">
                {data.metrics.groundRulesMetrics.anomalyScore === 0 ? '정상' : 
                 data.metrics.groundRulesMetrics.anomalyScore <= 20 ? '낮음' : '높음'}
              </div>
            </div>
          </>
        )}
      </div>
      
      
      {/* Statistics */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          데이터 통계
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">총 이벤트</span>
            <span className="font-medium">{data.statistics.totalEvents}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">O 태그</span>
            <span className="font-medium">{data.statistics.oTags}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">T1 태그</span>
            <span className="font-medium">{data.statistics.t1Tags}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">T1 업무복귀</span>
            <span className="font-medium text-blue-600">
              {data.statistics.t1WorkReturns}
            </span>
          </div>
          {data.metrics.groundRulesMetrics && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-600">팀 기준선 사용</span>
                <span className="font-medium text-teal-600">
                  {data.metrics.groundRulesMetrics.teamBaselineUsed}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">적용된 규칙</span>
                <span className="font-medium text-emerald-600">
                  {data.metrics.groundRulesMetrics.appliedRulesCount}개
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ground Rules Analysis - Only show when enabled and available */}
      {data.groundRulesAnalysis && (
        <div className="bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-green-800 mb-2 flex items-center">
            🎯 Ground Rules 분석 결과
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Analysis Info */}
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium text-gray-700">적용 팀:</span>
                <span className="ml-2 text-green-700">{data.groundRulesAnalysis.teamUsed}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">근무제도:</span>
                <span className="ml-2 text-green-700">{data.groundRulesAnalysis.workScheduleUsed}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">정확도 개선:</span>
                <span className="ml-2 text-green-700 font-semibold">
                  +{data.groundRulesAnalysis.accuracyImprovement}%
                </span>
              </div>
            </div>

            {/* Anomaly Report */}
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium text-gray-700">이상치 상태:</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                  data.groundRulesAnalysis.anomalyReport.anomalyLevel === 'none' 
                    ? 'bg-green-100 text-green-800'
                    : data.groundRulesAnalysis.anomalyReport.anomalyLevel === 'low'
                    ? 'bg-yellow-100 text-yellow-800' 
                    : data.groundRulesAnalysis.anomalyReport.anomalyLevel === 'medium'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {data.groundRulesAnalysis.anomalyReport.anomalyLevel === 'none' ? '정상' :
                   data.groundRulesAnalysis.anomalyReport.anomalyLevel === 'low' ? '낮음' :
                   data.groundRulesAnalysis.anomalyReport.anomalyLevel === 'medium' ? '중간' : '높음'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {data.groundRulesAnalysis.anomalyReport.summary}
              </div>
              {data.groundRulesAnalysis.anomalyReport.recommendations.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-medium text-gray-700 mb-1">권장사항:</div>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {data.groundRulesAnalysis.anomalyReport.recommendations.slice(0, 2).map((rec, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-green-600 mr-1">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}