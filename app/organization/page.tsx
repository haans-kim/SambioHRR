'use client'

import { useState, useEffect } from 'react'
import { Progress } from '@/components/ui/progress'

export default function OrganizationAnalysisPage() {
  // 기간 선택 (년/월 단위)
  const [startMonth, setStartMonth] = useState<string>('')
  const [endMonth, setEndMonth] = useState<string>('')

  // Analysis 상태
  const [startDate, setStartDate] = useState<Date>(new Date('2025-06-01'))
  const [endDate, setEndDate] = useState<Date>(new Date('2025-06-30'))
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [analysisInfo, setAnalysisInfo] = useState<{
    totalRecords?: number
    elapsedTime?: number
    startTime?: number
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
                className="ml-4 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-md hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                전체 구간 선택 (1~9월)
              </button>
            </div>
          </div>

          {/* Master Table Migration */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Master Table 마이그레이션
              </h2>
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                tag_data → master_events_table
              </span>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700">
                sambio_human.db의 tag_data를 sambio_analytics.db의 master_events_table로 마이그레이션합니다.
                <br />
                <strong className="font-semibold">터미널에서 진행 상황을 확인</strong>하세요. (npm run dev 실행 중인 터미널)
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={async () => {
                  if (!confirm(`${startMonth} ~ ${endMonth} 기간의 데이터를 마이그레이션하시겠습니까?\n\n터미널(npm run dev)에서 진행 상황을 확인하세요.`)) {
                    return
                  }

                  setIsMigrating(true)

                  try {
                    console.log(`Master 마이그레이션 시작: ${startMonth} ~ ${endMonth}`)

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
                      alert(`마이그레이션 완료\n\n성공: ${summary.successMonths}개월\n실패: ${summary.failMonths}개월\n총 이벤트: ${summary.totalEvents.toLocaleString()}개\n소요시간: ${(summary.totalDuration / 1000).toFixed(1)}초`)
                    } else {
                      alert(`마이그레이션 실패\n\n${data.error || '알 수 없는 오류'}`)
                    }

                  } catch (error) {
                    console.error('Migration error:', error)
                    alert(`마이그레이션 중 오류가 발생했습니다.\n\n${error instanceof Error ? error.message : '알 수 없는 오류'}`)
                  } finally {
                    setIsMigrating(false)
                  }
                }}
                disabled={isMigrating}
                className={`px-8 py-3 text-white text-base font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors ${
                  isMigrating
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gray-800 hover:bg-black'
                }`}
              >
                {isMigrating ? '마이그레이션 중... (터미널 확인)' : 'Master 마이그레이션 시작'}
              </button>

              {isMigrating && (
                <div className="flex-1 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
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
                조직 분석
              </h2>
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                업무패턴 분석 및 근무시간 추정
              </span>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                선택한 기간 동안 근무시간이 기록된 모든 직원을 대상으로 분석합니다.
                <br />
                팀별 이동 패턴의 조직 집단지성을 활용하여 T1 태그의 업무 관련성을 정확하게 판단합니다.
              </p>
            </div>

            {/* Analysis Execution Area */}
            <div className="flex items-center gap-4">
              <button
                onClick={async () => {
  const analysisStartTime = Date.now()
                  setIsAnalyzing(true)
                  setProgress(0)
                  setAnalysisInfo({ startTime: analysisStartTime })

                  try {
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
                      setProgress(100)

                      const elapsedTime = Date.now() - analysisStartTime
                      setAnalysisInfo(prev => ({ ...prev, elapsedTime }))

                      const workerCount = data.summary?.workerCount || 'Unknown'
                      alert(`분석 완료!\n분석된 항목: ${data.results.length.toLocaleString()}건\n소요시간: ${(elapsedTime / 1000).toFixed(1)}초\n처리 모드: ${workerCount}개 워커`)
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
                className={`px-8 py-3 text-white text-base font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors ${
                  isAnalyzing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gray-800 hover:bg-black'
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
                    </span>
                  )}
                  {!isAnalyzing && analysisInfo.elapsedTime && (
                    <span>
                      분석 완료 : 소요시간 {(analysisInfo.elapsedTime / 1000).toFixed(1)}초
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}