#!/usr/bin/env ts-node

/**
 * Ground Rules 기능 통합 테스트 스크립트
 * 
 * 이 스크립트는 Ground Rules 시스템이 제대로 작동하는지 테스트합니다:
 * 1. 개별 직원 분석 API (Ground Rules 활성화/비활성화)
 * 2. 배치 분석 API (Ground Rules 지원)
 * 3. 대시보드 통계 API
 * 4. 인사이트 및 권장사항 API
 */

import { performance } from 'perf_hooks'

const BASE_URL = 'http://localhost:3004'
const TEST_EMPLOYEE_ID = 20110113  // 테스트용 직원 ID
const TEST_DATE = '2025-06-30'
const TEST_DATE_RANGE = { startDate: '2025-06-25', endDate: '2025-06-30' }

interface TestResult {
  test: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  duration: number
  error?: string
  data?: any
}

class GroundRulesTestRunner {
  private results: TestResult[] = []

  private async runTest(
    testName: string, 
    testFn: () => Promise<any>
  ): Promise<TestResult> {
    console.log(`🧪 Running: ${testName}`)
    const start = performance.now()
    
    try {
      const data = await testFn()
      const duration = performance.now() - start
      
      console.log(`✅ PASS: ${testName} (${duration.toFixed(0)}ms)`)
      return { test: testName, status: 'PASS', duration, data }
    } catch (error) {
      const duration = performance.now() - start
      console.log(`❌ FAIL: ${testName} (${duration.toFixed(0)}ms)`)
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`)
      
      return { 
        test: testName, 
        status: 'FAIL', 
        duration, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  }

  async testIndividualAnalysisTraditional() {
    const response = await fetch(
      `${BASE_URL}/api/employees/${TEST_EMPLOYEE_ID}/analytics?date=${TEST_DATE}`
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // 기본 분석 데이터 검증
    if (!data.metrics) throw new Error('Missing metrics data')
    if (!data.employee) throw new Error('Missing employee data')
    if (data.statistics.groundRulesEnabled === true) {
      throw new Error('Ground Rules should not be enabled by default')
    }
    
    return data
  }

  async testIndividualAnalysisWithGroundRules() {
    const response = await fetch(
      `${BASE_URL}/api/employees/${TEST_EMPLOYEE_ID}/analytics?date=${TEST_DATE}&useGroundRules=true`
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // Ground Rules 데이터 검증
    if (!data.metrics) throw new Error('Missing metrics data')
    if (!data.metrics.groundRulesMetrics) {
      throw new Error('Missing Ground Rules metrics')
    }
    if (!data.groundRulesAnalysis) {
      throw new Error('Missing Ground Rules analysis')
    }
    if (data.statistics.groundRulesEnabled !== true) {
      throw new Error('Ground Rules should be enabled')
    }
    
    // Ground Rules 메트릭 구조 검증
    const grMetrics = data.metrics.groundRulesMetrics
    const requiredFields = [
      'groundRulesWorkTime', 'groundRulesConfidence', 't1WorkMovement', 
      't1NonWorkMovement', 'teamBaselineUsed', 'anomalyScore', 'appliedRulesCount'
    ]
    
    for (const field of requiredFields) {
      if (!(field in grMetrics)) {
        throw new Error(`Missing Ground Rules metric: ${field}`)
      }
    }
    
    return data
  }

  async testBatchAnalysisWithGroundRules() {
    const requestBody = {
      employees: [
        { employeeId: TEST_EMPLOYEE_ID, employeeName: 'Test Employee' }
      ],
      startDate: TEST_DATE,
      endDate: TEST_DATE,
      useGroundRules: true,
      saveToDb: false  // 테스트이므로 DB 저장 안함
    }
    
    const response = await fetch(
      `${BASE_URL}/api/organization/batch-analysis`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // 배치 분석 결과 검증
    if (!data.results || data.results.length === 0) {
      throw new Error('No batch analysis results')
    }
    
    const result = data.results[0]
    if (!result.metrics.groundRulesMetrics) {
      throw new Error('Missing Ground Rules metrics in batch result')
    }
    
    if (!data.summary.groundRulesEnabled) {
      throw new Error('Ground Rules should be enabled in summary')
    }
    
    if (!data.summary.groundRulesStats) {
      throw new Error('Missing Ground Rules stats in summary')
    }
    
    return data
  }

  async testDashboardStats() {
    const requestBody = {
      organizationType: 'center' as const,
      startDate: TEST_DATE_RANGE.startDate,
      endDate: TEST_DATE_RANGE.endDate,
      includeComparisons: true,
      includeTeamBreakdown: true
    }
    
    const response = await fetch(
      `${BASE_URL}/api/dashboard/ground-rules-stats`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // 대시보드 통계 구조 검증
    if (!data.summary) throw new Error('Missing summary data')
    if (!data.timeSeriesData) throw new Error('Missing time series data')
    if (!data.organizationBreakdown) throw new Error('Missing organization breakdown')
    
    return data
  }

  async testInsightsAndRecommendations() {
    const requestBody = {
      startDate: TEST_DATE_RANGE.startDate,
      endDate: TEST_DATE_RANGE.endDate,
      analysisDepth: 'detailed' as const,
      focusAreas: ['confidence', 'anomalies', 'accuracy'] as const
    }
    
    const response = await fetch(
      `${BASE_URL}/api/insights/ground-rules-recommendations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // 인사이트 데이터 구조 검증
    if (!data.executiveSummary) throw new Error('Missing executive summary')
    if (!data.insights) throw new Error('Missing insights array')
    if (!data.actionPlan) throw new Error('Missing action plan')
    if (!data.analysisScope) throw new Error('Missing analysis scope')
    
    return data
  }

  async testDataComparison() {
    console.log('\n📊 Comparing Traditional vs Ground Rules Analysis...')
    
    // 전통적 분석 실행
    const traditionalData = await this.runTest(
      'Individual Analysis (Traditional)', 
      () => this.testIndividualAnalysisTraditional()
    )
    
    // Ground Rules 분석 실행  
    const groundRulesData = await this.runTest(
      'Individual Analysis (Ground Rules)', 
      () => this.testIndividualAnalysisWithGroundRules()
    )
    
    if (traditionalData.status === 'PASS' && groundRulesData.status === 'PASS') {
      // 결과 비교
      const traditional = traditionalData.data.metrics
      const groundRules = groundRulesData.data.metrics
      
      console.log('\n📈 Comparison Results:')
      console.log(`   Traditional Work Time: ${traditional.workTime} minutes`)
      console.log(`   Ground Rules Work Time: ${groundRules.groundRulesMetrics.groundRulesWorkTime} minutes`)
      console.log(`   Traditional Reliability: ${traditional.reliabilityScore}%`)
      console.log(`   Ground Rules Confidence: ${groundRules.groundRulesMetrics.groundRulesConfidence}%`)
      console.log(`   Anomaly Score: ${groundRules.groundRulesMetrics.anomalyScore}%`)
      console.log(`   Applied Rules Count: ${groundRules.groundRulesMetrics.appliedRulesCount}`)
      
      // Ground Rules 분석 정보
      const analysis = groundRulesData.data.groundRulesAnalysis
      if (analysis) {
        console.log(`   Team Used: ${analysis.teamUsed}`)
        console.log(`   Accuracy Improvement: +${analysis.accuracyImprovement}%`)
        console.log(`   Anomaly Level: ${analysis.anomalyReport.anomalyLevel}`)
      }
    }
    
    this.results.push(traditionalData, groundRulesData)
  }

  async runAllTests() {
    console.log('🎯 Starting Ground Rules Integration Tests...\n')
    const overallStart = performance.now()
    
    // 개별 테스트들
    const tests = [
      { name: 'Batch Analysis (Ground Rules)', fn: () => this.testBatchAnalysisWithGroundRules() },
      { name: 'Dashboard Statistics', fn: () => this.testDashboardStats() },
      { name: 'Insights and Recommendations', fn: () => this.testInsightsAndRecommendations() }
    ]
    
    // 데이터 비교 테스트 (개별적으로 처리)
    await this.testDataComparison()
    
    // 나머지 테스트들
    for (const test of tests) {
      const result = await this.runTest(test.name, test.fn)
      this.results.push(result)
    }
    
    // 결과 요약
    const overallDuration = performance.now() - overallStart
    const passed = this.results.filter(r => r.status === 'PASS').length
    const failed = this.results.filter(r => r.status === 'FAIL').length
    
    console.log('\n' + '='.repeat(60))
    console.log('🎯 Ground Rules Integration Test Results')
    console.log('='.repeat(60))
    console.log(`📊 Total Tests: ${this.results.length}`)
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`⏱️  Total Duration: ${overallDuration.toFixed(0)}ms`)
    console.log(`🎯 Success Rate: ${Math.round((passed / this.results.length) * 100)}%`)
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:')
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   - ${r.test}: ${r.error}`))
    }
    
    console.log('\n' + (passed === this.results.length ? 
      '🎉 All tests passed! Ground Rules system is working correctly.' :
      '⚠️  Some tests failed. Please check the errors above.'))
    
    return { passed, failed, total: this.results.length }
  }
}

// 스크립트 실행
if (require.main === module) {
  const runner = new GroundRulesTestRunner()
  
  runner.runAllTests()
    .then((summary) => {
      process.exit(summary.failed > 0 ? 1 : 0)
    })
    .catch((error) => {
      console.error('🚨 Test runner failed:', error)
      process.exit(1)
    })
}

export { GroundRulesTestRunner }