'use client'

import { useState, useEffect } from 'react'
import { Progress } from '@/components/ui/progress'

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
    groundRulesMetrics?: {
      groundRulesWorkTime: number
      groundRulesConfidence: number
      t1WorkMovement: number
      t1NonWorkMovement: number
      teamBaselineUsed: number
      anomalyScore: number
      appliedRulesCount: number
    }
  }
  claimedHours?: number
}

export default function OrganizationAnalysisPage() {
  // 기간 선택 (년/월 단위)
  const [startMonth, setStartMonth] = useState<string>('')
  const [endMonth, setEndMonth] = useState<string>('')

  // Analysis 상태
  const [startDate, setStartDate] = useState<Date>(new Date('2025-06-01'))
  const [endDate, setEndDate] = useState<Date>(new Date('2025-06-30'))
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])
  const [saveToDb] = useState(true) // 항상 DB에 저장
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

  // Master Migration 상태
  const [isMigrating, setIsMigrating] = useState(false)

  // 페이지 로드 시 최신 데이터 월 조회
  useEffect(() => {
    const fetchLatestMonth = async () => {
      try {
        const response = await fetch('/api/organization/latest-data-month')
        const data = await response.json()

        if (data.latestMonth) {
          setStartMonth(data.latestMonth)
          setEndMonth(data.latestMonth)

          // 분석용 날짜도 설정
          const [year, month] = data.latestMonth.split('-').map(Number)
          setStartDate(new Date(year, month - 1, 1))

          // 해당 월의 마지막 날
          const lastDay = new Date(year, month, 0).getDate()
          setEndDate(new Date(year, month - 1, lastDay))
        }
      } catch (error) {
        console.error('최신 데이터 월 조회 실패:', error)
        // 실패 시 현재 월 사용
        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        setStartMonth(currentMonth)
        setEndMonth(currentMonth)
      }
    }

    fetchLatestMonth()
  }, [])

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
            업무패턴 분석 및 근무시간 추정
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="space-y-6">
          {/* Month Range Selection Panel */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">기간 선택 (년/월)</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-700 font-medium">시작월:</label>
                <input
                  type="month"
                  value={startMonth}
                  onChange={(e) => {
                    setStartMonth(e.target.value)
                    // 분석용 날짜도 자동 업데이트
                    setStartDate(new Date(e.target.value + '-01'))
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <span className="text-gray-400">~</span>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-700 font-medium">종료월:</label>
                <input
                  type="month"
                  value={endMonth}
                  onChange={(e) => {
                    setEndMonth(e.target.value)
                    // 분석용 날짜도 자동 업데이트 (해당 월 마지막 날)
                    const [year, month] = e.target.value.split('-').map(Number)
                    const lastDay = new Date(year, month, 0).getDate()
                    setEndDate(new Date(year, month - 1, lastDay))
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => {
                  setStartMonth('2025-01')
                  setEndMonth('2025-09')
                  setStartDate(new Date('2025-01-01'))
                  setEndDate(new Date('2025-09-30'))
                }}
                className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                전체 구간 선택 (1~9월)
              </button>
            </div>
          </div>

          {/* Master Table Migration */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                🔄 Master Table 마이그레이션
              </h2>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                tag_data → master_events_table
              </span>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-purple-700">
                sambio_human.db의 tag_data를 sambio_analytics.db의 master_events_table로 마이그레이션합니다.
                <br />
                <strong className="font-semibold">터미널에서 진행 상황을 확인</strong>하세요. (npm run dev 실행 중인 터미널)
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={async () => {
                  if (!confirm(`${startMonth} ~ ${endMonth} 기간의 데이터를 마이그레이션하시겠습니까?\n\n⚠️ 터미널(npm run dev)에서 진행 상황을 확인하세요.`)) {
                    return
                  }

                  setIsMigrating(true)

                  try {
                    console.log(`🔄 Master 마이그레이션 시작: ${startMonth} ~ ${endMonth}`)

                    const response = await fetch('/api/organization/migrate-master', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        startMonth,
                        endMonth
                      })
                    })

                    const data = await response.json()

                    if (data.success) {
                      const { summary } = data
                      alert(`✅ 마이그레이션 완료!\n\n성공: ${summary.successMonths}개월\n실패: ${summary.failMonths}개월\n총 이벤트: ${summary.totalEvents.toLocaleString()}개\n소요시간: ${(summary.totalDuration / 1000).toFixed(1)}초`)
                    } else {
                      alert(`❌ 마이그레이션 실패\n\n${data.error || '알 수 없는 오류'}`)
                    }

                  } catch (error) {
                    console.error('Migration error:', error)
                    alert(`마이그레이션 중 오류가 발생했습니다.\n\n${error instanceof Error ? error.message : '알 수 없는 오류'}`)
                  } finally {
                    setIsMigrating(false)
                  }
                }}
                disabled={isMigrating}
                className={`px-12 py-3 text-white text-base font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors ${
                  isMigrating
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {isMigrating ? '마이그레이션 중... (터미널 확인)' : 'Master 마이그레이션 시작'}
              </button>

              {isMigrating && (
                <div className="flex-1 text-sm text-purple-700">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-700"></div>
                    <span>처리 중... npm run dev 터미널에서 진행 상황을 확인하세요.</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 조직 분석 */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                🔍 조직 분석
              </h2>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                업무패턴 분석 및 근무시간 추정
              </span>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-700">
                선택한 기간 동안 근무시간이 기록된 모든 직원을 대상으로 분석합니다.
                분석 방식을 선택하고 "분석 시작" 버튼을 클릭하세요.
              </p>
            </div>

            <h3 className="text-base font-semibold text-gray-900 mb-4">분석 방식 선택</h3>

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