'use client'

import { useState, lazy, Suspense } from 'react'
import useAppStore from '@/stores/useAppStore'
import { Progress } from '@/components/ui/progress'

// Lazy load MillerColumn component to improve initial page load
const MillerColumn = lazy(() => import('@/components/organization/MillerColumn'))

interface AnalysisResult {
  date: string
  employeeId: number
  employeeName: string
  metrics: {
    totalTime: number
    workTime: number
    estimatedWorkTime: number
    workRatio: number
    focusTime: number
    meetingTime: number
    mealTime: number
    transitTime: number
    restTime: number
    reliabilityScore: number
  }
  claimedHours?: number
}

export default function OrganizationAnalysisPage() {
  const { organizationPath } = useAppStore()

  // 사용 가능한 월 목록 (2025-01 ~ 2025-06)
  const availableMonths = [
    '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'
  ]

  const [selectedMonth, setSelectedMonth] = useState<string>('2025-06')
  const [startDate, setStartDate] = useState<Date>(new Date('2025-06-01'))
  const [endDate, setEndDate] = useState<Date>(new Date('2025-06-30'))
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])
  const [saveToDb, setSaveToDb] = useState(true) // 항상 DB에 저장
  const [showOrgSelector, setShowOrgSelector] = useState(false) // Miller Column 표시 여부
  const [analysisMode, setAnalysisMode] = useState<'basic' | 'groundrules'>('groundrules') // 분석 방식
  const [analysisInfo, setAnalysisInfo] = useState<{
    totalRecords?: number
    completedRecords?: number
    elapsedTime?: number
    startTime?: number
    currentMonth?: string
    completedMonths?: number
    totalMonths?: number
  }>({})

  // 월 변경 핸들러
  const handleMonthChange = (month: string) => {
    setSelectedMonth(month)
    // 날짜 범위 업데이트 (해당 월의 전체 기간으로)
    const year = parseInt(month.split('-')[0])
    const monthNum = parseInt(month.split('-')[1])
    const startOfMonth = new Date(year, monthNum - 1, 1)
    const endOfMonth = new Date(year, monthNum, 0) // 다음 달 0일 = 현재 달 마지막 일
    setStartDate(startOfMonth)
    setEndDate(endOfMonth)
  }

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}시간 ${mins}분`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Title Section - Same as Trends */}
      <div className="bg-gradient-to-br from-blue-50 to-white border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            조직 분석
          </h1>
          <p className="text-gray-600">
            실시간 업무패턴 분석 및 근무 추정시간 모니터링
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="space-y-6">
          {/* Date Range Selection Panel */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">기간 선택</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-700 font-medium">시작일:</label>
                <input
                  type="date"
                  value={startDate.toISOString().split('T')[0]}
                  onChange={(e) => setStartDate(new Date(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <span className="text-gray-400">~</span>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-700 font-medium">종료일:</label>
                <input
                  type="date"
                  value={endDate.toISOString().split('T')[0]}
                  onChange={(e) => setEndDate(new Date(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => {
                  setStartDate(new Date('2025-01-01'))
                  setEndDate(new Date('2025-06-30'))
                }}
                className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                전체 구간 선택
              </button>
            </div>
          </div>

          {/* Organization Selection (Optional) */}
          <div className="bg-white rounded-lg border border-gray-500 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-medium text-gray-900">조직 선택</h2>
                {organizationPath.center && (
                  <span className="text-sm text-gray-500">
                    ({organizationPath.center}
                    {organizationPath.division && ` > ${organizationPath.division}`}
                    {organizationPath.team && ` > ${organizationPath.team}`}
                    {organizationPath.group && ` > ${organizationPath.group}`})
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowOrgSelector(!showOrgSelector)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {showOrgSelector ? '조직 선택 닫기' : '조직 선택하기'}
              </button>
            </div>

            {!showOrgSelector && !organizationPath.center && (
              <div className="py-4 text-center text-gray-500 text-sm">
                전체 조직을 대상으로 분석합니다. 특정 조직만 분석하려면 "조직 선택하기"를 클릭하세요.
              </div>
            )}

            {showOrgSelector && (
              <Suspense fallback={
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                    <span className="text-gray-600">조직 데이터 로딩중...</span>
                  </div>
                </div>
              }>
                <MillerColumn />
              </Suspense>
            )}
          </div>

          {/* Analysis Method Selection & Execution Panel */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">분석 방식 선택</h2>

            {/* Analysis Mode Radio Buttons */}
            <div className="mb-6 space-y-3">
              <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="analysisMode"
                  value="basic"
                  checked={analysisMode === 'basic'}
                  onChange={(e) => setAnalysisMode(e.target.value as 'basic' | 'groundrules')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">일반 분석 (빠름)</div>
                  <div className="text-sm text-gray-600 mt-1">
                    개인의 태그 데이터만으로 업무시간을 추정합니다. 빠른 처리가 필요한 경우 사용하세요.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 border-blue-200 bg-blue-50 rounded-lg cursor-pointer">
                <input
                  type="radio"
                  name="analysisMode"
                  value="groundrules"
                  checked={analysisMode === 'groundrules'}
                  onChange={(e) => setAnalysisMode(e.target.value as 'basic' | 'groundrules')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">Ground Rules 분석 (정확함, 권장)</span>
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded">추천</span>
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    팀별 이동 패턴의 조직 집단지성을 활용하여 T1 태그의 업무 관련성을 정확하게 판단합니다.
                    <span className="font-medium text-blue-700"> 평균 15-25% 향상된 정확도</span>를 제공합니다.
                  </div>
                </div>
              </label>
            </div>

            {/* Analysis Execution Area */}
            <div className="flex items-center gap-4">
              <button
                onClick={async () => {
                  const analysisStartTime = Date.now()
                  setIsAnalyzing(true)
                  setProgress(0)
                  setAnalysisResults([])
                  setAnalysisInfo({ startTime: analysisStartTime })

                  try {
                    if (analysisMode === 'basic') {
                      // 기본 분석 로직
                      setProgress(5)
                      const extractRes = await fetch('/api/organization/extract-employees-all', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          startDate: startDate.toISOString().split('T')[0],
                          endDate: endDate.toISOString().split('T')[0]
                        })
                      })

                      const extractData = await extractRes.json()

                      if (!extractData.employeeDates || extractData.employeeDates.length === 0) {
                        alert('분석할 데이터가 없습니다.')
                        setIsAnalyzing(false)
                        setProgress(0)
                        return
                      }

                      const totalRecords = extractData.count || extractData.employeeDates.length
                      setAnalysisInfo(prev => ({ ...prev, totalRecords }))

                      // 기본 분석 실행
                      const allResults: AnalysisResult[] = []
                      const batchSize = 200

                      for (let i = 0; i < extractData.employeeDates.length; i += batchSize) {
                        const batch = extractData.employeeDates.slice(i, i + batchSize)
                        const progressPercent = 5 + Math.floor((i / extractData.employeeDates.length) * 90)
                        setProgress(progressPercent)

                        const analysisRes = await fetch('/api/organization/batch-analysis', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            employees: batch,
                            startDate: startDate.toISOString().split('T')[0],
                            endDate: endDate.toISOString().split('T')[0],
                            saveToDb
                          })
                        })

                        const analysisData = await analysisRes.json()
                        if (analysisData.results) {
                          allResults.push(...analysisData.results)
                        }
                      }

                      setAnalysisResults(allResults)
                      setProgress(100)

                      const elapsedTime = Date.now() - analysisStartTime
                      setAnalysisInfo(prev => ({ ...prev, elapsedTime }))

                      alert(`일반 분석 완료!\n분석된 항목: ${allResults.length.toLocaleString()}건\n소요시간: ${(elapsedTime / 1000).toFixed(1)}초`)

                    } else {
                      // Ground Rules 분석 로직
                      setProgress(10)
                      const extractRes = await fetch('/api/organization/extract-employees-with-work-hours', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          startDate: startDate.toISOString().split('T')[0],
                          endDate: endDate.toISOString().split('T')[0]
                        })
                      })

                      const extractData = await extractRes.json()

                      if (!extractData.employees || extractData.employees.length === 0) {
                        alert('분석할 데이터가 없습니다.')
                        setIsAnalyzing(false)
                        setProgress(0)
                        return
                      }

                      const startTime = startDate.getTime()
                      const endTime = endDate.getTime()
                      const dayCount = Math.max(1, Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)) + 1)
                      const totalRecords = extractData.employees.length * dayCount
                      setAnalysisInfo(prev => ({ ...prev, totalRecords }))

                      setProgress(20)
                      const response = await fetch('/api/organization/ground-rules-worker-analysis', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          employees: extractData.employees.map((emp: any) => ({
                            employeeId: emp.employeeId,
                            employeeName: emp.employeeName
                          })),
                          startDate: startDate.toISOString().split('T')[0],
                          endDate: endDate.toISOString().split('T')[0],
                          saveToDb: true
                        })
                      })

                      if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`)
                      }

                      const data = await response.json()

                      if (data.results) {
                        setAnalysisResults(data.results)
                        setProgress(100)

                        const elapsedTime = Date.now() - analysisStartTime
                        setAnalysisInfo(prev => ({ ...prev, elapsedTime }))

                        const workerCount = data.summary?.workerCount || 'Unknown'
                        alert(`Ground Rules 분석 완료!\n분석된 항목: ${data.results.length.toLocaleString()}건\n소요시간: ${(elapsedTime / 1000).toFixed(1)}초\n처리 모드: ${workerCount}개 워커`)
                      }
                    }

                    setTimeout(() => {
                      setIsAnalyzing(false)
                    }, 500)

                  } catch (error) {
                    console.error('Analysis error:', error)
                    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
                    alert(`분석 중 오류가 발생했습니다: ${errorMessage}`)
                    setIsAnalyzing(false)
                    setProgress(0)
                    setAnalysisInfo({})
                  }
                }}
                disabled={isAnalyzing}
                className={`px-16 py-4 text-white text-lg font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
                  isAnalyzing
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isAnalyzing ? '분석 중...' : '분석 시작'}
              </button>

              {/* Progress Bar */}
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <Progress value={progress} className="flex-1" />
                  <span className="text-sm font-medium text-gray-700 min-w-[45px]">
                    {progress}%
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {isAnalyzing && analysisInfo.totalRecords && (
                    <span>
                      총 {analysisInfo.totalRecords.toLocaleString()}건 분석 중
                      {analysisInfo.completedRecords && (
                        <> ({analysisInfo.completedRecords.toLocaleString()}건 완료)</>
                      )}
                    </span>
                  )}
                  {!isAnalyzing && analysisInfo.elapsedTime && analysisResults.length > 0 && (
                    <span>
                      완료 {analysisResults.length.toLocaleString()}건 : 소요시간 {(analysisInfo.elapsedTime / 1000).toFixed(1)}초
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Analysis Results Table */}
          <div className="bg-white rounded-lg border border-gray-500 shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">분석 결과</h2>
              {analysisResults.length > 0 && (
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/organization/export-excel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ results: analysisResults })
                      })
                      
                      if (response.ok) {
                        const blob = await response.blob()
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `organization_analysis_${new Date().toISOString().split('T')[0]}.xlsx`
                        document.body.appendChild(a)
                        a.click()
                        window.URL.revokeObjectURL(url)
                        document.body.removeChild(a)
                      } else {
                        alert('엑셀 다운로드 중 오류가 발생했습니다.')
                      }
                    } catch (error) {
                      console.error('Export error:', error)
                      alert('엑셀 다운로드 중 오류가 발생했습니다.')
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  엑셀 다운로드
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      날짜
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      사번
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      성명
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      총 체류시간
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      신고 근무시간
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      실제 작업시간
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      추정T1작업시간
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작업추정률
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      집중작업시간
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      회의시간
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      식사시간
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      이동시간
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      비업무시간
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      데이터 신뢰도
                    </th>
                    {/* Ground Rules Columns */}
                    <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider bg-blue-50">
                      Ground Rules 업무시간
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider bg-blue-50">
                      Ground Rules 신뢰도
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider bg-blue-50">
                      업무 관련 이동
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider bg-blue-50">
                      비업무 이동
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider bg-blue-50">
                      팀 기준선
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider bg-blue-50">
                      이상치 점수
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider bg-blue-50">
                      적용 규칙수
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analysisResults.length === 0 ? (
                    <tr>
                      <td colSpan={20} className="px-4 py-8 text-center text-sm text-gray-500">
                        분석 결과가 표시됩니다. 조직을 선택하고 분석 시작 버튼을 클릭하세요.
                      </td>
                    </tr>
                  ) : (
                    analysisResults.map((result, index) => (
                      <tr key={`${result.date}-${result.employeeId}-${index}`}>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {result.date}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {result.employeeId}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {result.employeeName}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {formatMinutes(Math.round(result.metrics.totalTime))}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {result.claimedHours || '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {formatMinutes(Math.round(result.metrics.workTime))}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {formatMinutes(Math.round(result.metrics.estimatedWorkTime))}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {result.metrics.workRatio.toFixed(1)}%
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {formatMinutes(Math.round(result.metrics.focusTime))}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {formatMinutes(Math.round(result.metrics.meetingTime))}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {formatMinutes(Math.round(result.metrics.mealTime))}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {formatMinutes(Math.round(result.metrics.transitTime))}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {formatMinutes(Math.round(result.metrics.restTime))}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {result.metrics.reliabilityScore.toFixed(1)}%
                        </td>
                        {/* Ground Rules Columns */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-700 text-center font-medium bg-blue-50">
                          {result.metrics.groundRulesMetrics ? 
                            formatMinutes(Math.round(result.metrics.groundRulesMetrics.groundRulesWorkTime)) : 
                            '-'
                          }
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-700 text-center font-medium bg-blue-50">
                          {result.metrics.groundRulesMetrics ? 
                            `${result.metrics.groundRulesMetrics.groundRulesConfidence}%` : 
                            '-'
                          }
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-700 text-center bg-blue-50">
                          {result.metrics.groundRulesMetrics ? 
                            formatMinutes(Math.round(result.metrics.groundRulesMetrics.t1WorkMovement)) : 
                            '-'
                          }
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-700 text-center bg-blue-50">
                          {result.metrics.groundRulesMetrics ? 
                            formatMinutes(Math.round(result.metrics.groundRulesMetrics.t1NonWorkMovement)) : 
                            '-'
                          }
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-700 text-center bg-blue-50">
                          {result.metrics.groundRulesMetrics ? 
                            `${result.metrics.groundRulesMetrics.teamBaselineUsed}%` : 
                            '-'
                          }
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-700 text-center bg-blue-50">
                          {result.metrics.groundRulesMetrics ? 
                            `${result.metrics.groundRulesMetrics.anomalyScore}%` : 
                            '-'
                          }
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-700 text-center bg-blue-50">
                          {result.metrics.groundRulesMetrics ? 
                            result.metrics.groundRulesMetrics.appliedRulesCount : 
                            '-'
                          }
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}