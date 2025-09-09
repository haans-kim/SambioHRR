'use client'

import { useState } from 'react'
import useAppStore from '@/stores/useAppStore'
import MillerColumn from '@/components/organization/MillerColumn'
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
  }
  claimedHours?: number
}

export default function OrganizationAnalysisPage() {
  const { organizationPath } = useAppStore()
  const [startDate, setStartDate] = useState<Date>(new Date('2025-06-01'))
  const [endDate, setEndDate] = useState<Date>(new Date('2025-06-30'))
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])
  const [saveToDb, setSaveToDb] = useState(true) // 항상 DB에 저장
  const [analysisInfo, setAnalysisInfo] = useState<{
    totalRecords?: number
    completedRecords?: number
    elapsedTime?: number
    startTime?: number
  }>({})

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}시간 ${mins}분`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              조직 근무 분석
            </h1>
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={startDate.toISOString().split('T')[0]}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
              <span className="text-gray-500">~</span>
              <input
                type="date"
                value={endDate.toISOString().split('T')[0]}
                onChange={(e) => setEndDate(new Date(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Organization Selection using Miller Column */}
          <div className="bg-white rounded-lg border border-gray-500 shadow-sm p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">조직 선택</h2>
            <MillerColumn />
          </div>

          {/* Analysis Start Button Panel */}
          <div className="bg-white rounded-lg border border-gray-500 shadow-sm p-6">
            <div className="flex items-center gap-4">
              <button
                onClick={async () => {
                  if (!organizationPath.center) {
                    alert('조직을 선택해주세요.')
                    return
                  }
                  
                  const analysisStartTime = Date.now()
                  setIsAnalyzing(true)
                  setProgress(0)
                  setAnalysisResults([])
                  setAnalysisInfo({ startTime: analysisStartTime })
                  
                  try {
                    // Step 1: Extract employees from selected organization
                    setProgress(10)
                    const extractRes = await fetch('/api/organization/extract-employees', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ organizationPath })
                    })
                    
                    const extractData = await extractRes.json()
                    
                    if (!extractData.employees || extractData.employees.length === 0) {
                      alert('선택한 조직에 직원이 없습니다.')
                      setIsAnalyzing(false)
                      setProgress(0)
                      return
                    }
                    
                    // Calculate total records to analyze
                    const startTime = startDate.getTime()
                    const endTime = endDate.getTime()
                    const dayCount = Math.max(1, Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)) + 1)
                    const totalRecords = extractData.employees.length * dayCount
                    setAnalysisInfo(prev => ({ ...prev, totalRecords }))
                    
                    // Step 2: Perform batch analysis in chunks (10% at a time)
                    const allResults: AnalysisResult[] = []
                    const batchSize = Math.ceil(extractData.employees.length / 10) // 10% chunks
                    let processedCount = 0
                    
                    for (let i = 0; i < extractData.employees.length; i += batchSize) {
                      const batch = extractData.employees.slice(i, i + batchSize)
                      
                      // Update progress (20% to 90%)
                      const progressPercent = 20 + Math.floor((i / extractData.employees.length) * 70)
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
                      
                      processedCount += batch.length
                      setAnalysisInfo(prev => ({ 
                        ...prev, 
                        completedRecords: processedCount * dayCount 
                      }))
                    }
                    
                    setAnalysisResults(allResults)
                    setProgress(100)
                    
                    // Calculate elapsed time
                    const elapsedTime = Date.now() - analysisStartTime
                    setAnalysisInfo(prev => ({ ...prev, elapsedTime }))
                    
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
                disabled={isAnalyzing || !organizationPath.center}
                className={`px-12 py-4 text-white text-lg font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors ${
                  isAnalyzing || !organizationPath.center
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-gray-900 hover:bg-gray-800'
                }`}
              >
                {isAnalyzing ? '분석 중...' : '분석 시작'}
              </button>
              
              <button
                onClick={async () => {
                  const analysisStartTime = Date.now()
                  setIsAnalyzing(true)
                  setProgress(0)
                  setAnalysisResults([])
                  setAnalysisInfo({ startTime: analysisStartTime })
                  
                  try {
                    // Step 1: Check existing analysis results from DB
                    setProgress(2)
                    const checkRes = await fetch('/api/organization/check-existing-analysis', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        startDate: startDate.toISOString().split('T')[0],
                        endDate: endDate.toISOString().split('T')[0]
                      })
                    })
                    
                    const checkData = await checkRes.json()
                    const analyzedKeysSet = new Set(checkData.analyzedKeys || [])
                    
                    // Step 2: Extract employees with non-zero claim hours
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
                    
                    // Use actual records count
                    const totalRecords = extractData.count || extractData.employeeDates.length
                    setAnalysisInfo(prev => ({ ...prev, totalRecords }))
                    
                    console.log(`Starting analysis of ${totalRecords} records`)
                    
                    // Filter out already processed records using DB results
                    const remainingRecords = extractData.employeeDates.filter((record: any) => {
                      const key = `${record.employeeId}_${record.workDate.split(' ')[0]}`
                      return !analyzedKeysSet.has(key)
                    })
                    
                    const existingCount = totalRecords - remainingRecords.length
                    
                    console.log(`Found ${existingCount} existing results in DB, ${remainingRecords.length} remaining to process`)
                    
                    if (remainingRecords.length === 0) {
                      alert('모든 분석이 이미 완료되었습니다.')
                      setIsAnalyzing(false)
                      return
                    }
                    
                    // 재시작 알림
                    if (existingCount > 0) {
                      alert(`DB에서 이전 분석 결과 ${existingCount.toLocaleString()}건을 발견했습니다.\n남은 ${remainingRecords.length.toLocaleString()}건을 계속 분석합니다.`)
                    }
                    
                    // Group remaining records by employee for batch processing
                    const employeeGroups = new Map<number, any[]>()
                    remainingRecords.forEach((record: any) => {
                      if (!employeeGroups.has(record.employeeId)) {
                        employeeGroups.set(record.employeeId, [])
                      }
                      employeeGroups.get(record.employeeId)!.push(record)
                    })
                    
                    // Convert to array of employees with their dates
                    const employeesWithDates = Array.from(employeeGroups.entries()).map(([employeeId, records]) => ({
                      employeeId,
                      employeeName: records[0].employeeName,
                      dates: records.map(r => r.workDate)
                    }))
                    
                    // Step 3: Perform batch analysis in smaller chunks
                    const allResults: AnalysisResult[] = []  // New results only
                    // Smaller batch size - process 200 records at a time for better performance
                    const batchSize = 200
                    let processedRecords = existingCount  // Start count from DB existing results
                    
                    // Set initial progress based on existing results
                    if (existingCount > 0) {
                      const initialProgress = Math.floor((existingCount / totalRecords) * 100)
                      setProgress(initialProgress)
                      setAnalysisInfo(prev => ({ 
                        ...prev, 
                        completedRecords: existingCount 
                      }))
                    }
                    
                    // Process remaining records in batches
                    for (let i = 0; i < remainingRecords.length; i += batchSize) {
                      const batchRecords = remainingRecords.slice(i, i + batchSize)
                      
                      // Group batch records by employee for analysis
                      const batchEmployeeGroups = new Map<number, any[]>()
                      batchRecords.forEach((record: any) => {
                        if (!batchEmployeeGroups.has(record.employeeId)) {
                          batchEmployeeGroups.set(record.employeeId, [])
                        }
                        batchEmployeeGroups.get(record.employeeId)!.push(record)
                      })
                      
                      // Convert to batch format
                      const batchEmployees = Array.from(batchEmployeeGroups.entries()).map(([employeeId, records]) => ({
                        employeeId,
                        employeeName: records[0].employeeName,
                        dates: records.map(r => r.workDate)
                      }))
                      
                      try {
                        const analysisRes = await fetch('/api/organization/batch-analysis', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            employees: batchEmployees,
                            startDate: startDate.toISOString().split('T')[0],
                            endDate: endDate.toISOString().split('T')[0],
                            saveToDb
                          })
                        })
                        
                        if (!analysisRes.ok) {
                          throw new Error(`HTTP error! status: ${analysisRes.status}`)
                        }
                      
                        const analysisData = await analysisRes.json()
                        
                        if (analysisData.results) {
                          allResults.push(...analysisData.results)
                        }
                        
                        // Update progress after successful processing
                        processedRecords += batchRecords.length
                        const progressPercent = Math.floor((processedRecords / totalRecords) * 100)
                        setProgress(progressPercent)
                        
                        setAnalysisInfo(prev => ({ 
                          ...prev, 
                          completedRecords: processedRecords 
                        }))
                      } catch (batchError) {
                        console.error(`Batch processing error:`, batchError)
                        
                        // 에러 발생 시 - 계속 진행할지 물어봄
                        const continueAnalysis = confirm(`배치 처리 중 오류가 발생했습니다.\n현재까지 ${allResults.length}건이 완료되었습니다.\n계속 진행하시겠습니까?`)
                        if (!continueAnalysis) {
                          break
                        }
                      }
                    }
                    
                    setAnalysisResults(allResults)
                    setProgress(100)
                    
                    // Calculate elapsed time
                    const elapsedTime = Date.now() - analysisStartTime
                    setAnalysisInfo(prev => ({ ...prev, elapsedTime }))
                    
                    alert(`분석 완료!\n이번 세션: ${allResults.length.toLocaleString()}건\n전체 완료: ${processedRecords.toLocaleString()}건 / ${totalRecords.toLocaleString()}건`)
                    
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
                className={`px-12 py-4 text-white text-lg font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
                  isAnalyzing
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isAnalyzing ? '분석 중...' : '전체 분석'}
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

          {/* Ground Rules Analysis Section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-50 rounded-md">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Ground Rules 분석</h2>
                  <p className="text-sm text-gray-500">T1 조직 집단지성 기반 정밀 분석</p>
                </div>
              </div>
            </div>
            
            <div className="mb-4 p-4 bg-gray-50 rounded-md border">
              <p className="text-sm text-gray-700 leading-relaxed">
                팀별 이동 패턴의 조직 집단지성을 활용하여 T1 태그의 업무 관련성을 보다 정확하게 판단합니다. 
                일반 분석 대비 평균 15-25% 향상된 정확도를 제공합니다.
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Single Thread Ground Rules Analysis */}
              <button
                onClick={async () => {
                  if (!organizationPath.center) {
                    alert('조직을 선택해주세요.')
                    return
                  }

                  try {
                    setIsAnalyzing(true)
                    setProgress(0)
                    setAnalysisInfo({})

                    const analysisStartTime = Date.now()
                    
                    // Step 1: Extract employees from selected organization
                    setProgress(10)
                    const extractRes = await fetch('/api/organization/extract-employees', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ organizationPath })
                    })
                    
                    const extractData = await extractRes.json()
                    
                    if (!extractData.employees || extractData.employees.length === 0) {
                      alert('선택한 조직에 직원이 없습니다.')
                      setIsAnalyzing(false)
                      setProgress(0)
                      return
                    }
                    
                    // Calculate total records to analyze
                    const startTime = startDate.getTime()
                    const endTime = endDate.getTime()
                    const dayCount = Math.max(1, Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)) + 1)
                    const totalRecords = extractData.employees.length * dayCount
                    setAnalysisInfo(prev => ({ ...prev, totalRecords }))
                    
                    // Step 2: Perform Ground Rules analysis in chunks (10% at a time)
                    const allResults: any[] = []
                    const batchSize = Math.ceil(extractData.employees.length / 10) // 10% chunks
                    let processedCount = 0
                    
                    for (let i = 0; i < extractData.employees.length; i += batchSize) {
                      const batch = extractData.employees.slice(i, i + batchSize)
                      
                      // Update progress (20% to 90%)
                      const progressPercent = 20 + Math.floor((i / extractData.employees.length) * 70)
                      setProgress(progressPercent)
                      
                      const analysisRes = await fetch('/api/organization/batch-analysis-enhanced', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          employees: batch.map((emp: any) => ({
                            employeeId: emp.employeeId,
                            employeeName: emp.employeeName
                          })),
                          startDate: startDate.toISOString().split('T')[0],
                          endDate: endDate.toISOString().split('T')[0],
                          useGroundRules: true
                        })
                      })
                      
                      const analysisData = await analysisRes.json()
                      
                      if (analysisData.results) {
                        allResults.push(...analysisData.results)
                      }
                      
                      processedCount += batch.length
                      setAnalysisInfo(prev => ({ 
                        ...prev, 
                        completedRecords: processedCount * dayCount 
                      }))
                    }
                    
                    setAnalysisResults(allResults)
                    setProgress(100)
                    
                    // Calculate elapsed time
                    const elapsedTime = Date.now() - analysisStartTime
                    setAnalysisInfo(prev => ({ ...prev, elapsedTime }))
                    
                    alert(`Ground Rules 분석 완료!\n분석된 항목: ${allResults.length}건\n소요시간: ${(elapsedTime / 1000).toFixed(1)}초\n처리 모드: 싱글 스레드`)

                    setTimeout(() => {
                      setIsAnalyzing(false)
                    }, 500)

                  } catch (error) {
                    console.error('Ground Rules analysis error:', error)
                    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
                    alert(`Ground Rules 분석 중 오류가 발생했습니다: ${errorMessage}`)
                    setIsAnalyzing(false)
                    setProgress(0)
                    setAnalysisInfo({})
                  }
                }}
                disabled={isAnalyzing || !organizationPath.center}
                className={`px-8 py-4 text-white text-lg font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors ${
                  isAnalyzing || !organizationPath.center
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-gray-900 hover:bg-gray-800'
                }`}
              >
                {isAnalyzing ? 'Ground Rules 분석 중...' : 'Ground Rules 분석 (싱글)'}
              </button>

              {/* Multi-Thread Worker Ground Rules Analysis */}
              <button
                onClick={async () => {
                  if (!organizationPath.center) {
                    alert('조직을 선택해주세요.')
                    return
                  }

                  try {
                    setIsAnalyzing(true)
                    setProgress(0)
                    setAnalysisInfo({})

                    const analysisStartTime = Date.now()
                    
                    // Step 1: Extract employees from selected organization
                    setProgress(10)
                    const extractRes = await fetch('/api/organization/extract-employees', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ organizationPath })
                    })
                    
                    const extractData = await extractRes.json()
                    
                    if (!extractData.employees || extractData.employees.length === 0) {
                      alert('선택한 조직에 직원이 없습니다.')
                      setIsAnalyzing(false)
                      setProgress(0)
                      return
                    }
                    
                    // Calculate total records to analyze
                    const startTime = startDate.getTime()
                    const endTime = endDate.getTime()
                    const dayCount = Math.max(1, Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)) + 1)
                    const totalRecords = extractData.employees.length * dayCount
                    setAnalysisInfo(prev => ({ ...prev, totalRecords }))
                    
                    // Step 2: Perform Ground Rules analysis using Workers
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
                      alert(`Ground Rules 워커 분석 완료!\n분석된 항목: ${data.results.length}건\n소요시간: ${(elapsedTime / 1000).toFixed(1)}초\n처리 모드: ${workerCount}개 워커 멀티스레드`)
                    }

                    setTimeout(() => {
                      setIsAnalyzing(false)
                    }, 500)

                  } catch (error) {
                    console.error('Ground Rules worker analysis error:', error)
                    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
                    alert(`Ground Rules 워커 분석 중 오류가 발생했습니다: ${errorMessage}`)
                    setIsAnalyzing(false)
                    setProgress(0)
                    setAnalysisInfo({})
                  }
                }}
                disabled={isAnalyzing || !organizationPath.center}
                className={`px-8 py-4 text-white text-lg font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
                  isAnalyzing || !organizationPath.center
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isAnalyzing ? '워커 분석 중...' : 'Ground Rules 분석 (워커)'}
              </button>
              
              {/* Progress Bar for Ground Rules Analysis */}
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
              
              <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
                팀별 집단지성 활용
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