'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, TrendingUp, AlertTriangle, CheckCircle, Target } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface DashboardStats {
  dateRange: { startDate: string; endDate: string }
  summary: {
    totalRecordsWithGroundRules: number
    totalRecordsTraditional: number
    coveragePercent: number
    avgGroundRulesConfidence: number
    avgAccuracyImprovement: number
    highConfidenceRecords: number
    anomalyRecords: number
  }
  timeSeriesData: Array<{
    date: string
    groundRulesRecords: number
    avgConfidence: number
    anomalyCount: number
  }>
  comparisonAnalysis: {
    traditionalVsGroundRules: {
      traditionalAccuracy: number
      groundRulesAccuracy: number
      improvementPercent: number
    }
    topPerformingTeams: Array<{
      teamName: string
      avgConfidence: number
      recordsCount: number
      anomalyRate: number
    }>
    improvementAreas: Array<{
      teamName: string
      currentConfidence: number
      potentialImprovement: number
      recordsCount: number
    }>
  }
}

interface Recommendations {
  executiveSummary: {
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor'
    keyFindings: string[]
    urgentActions: number
    totalInsights: number
    confidenceScore: number
  }
  insights: Array<{
    category: 'confidence' | 'accuracy' | 'anomaly' | 'pattern' | 'team' | 'system'
    severity: 'low' | 'medium' | 'high' | 'critical'
    title: string
    description: string
    impact: string
    recommendations: Array<{
      priority: 'low' | 'medium' | 'high' | 'critical'
      action: string
      expectedImpact: string
      timeframe: 'immediate' | 'short-term' | 'medium-term' | 'long-term'
    }>
  }>
  actionPlan: {
    immediate: Array<{ action: string; impact: string }>
    shortTerm: Array<{ action: string; impact: string; weeks: number }>
    mediumTerm: Array<{ action: string; impact: string; months: number }>
    longTerm: Array<{ action: string; impact: string; months: number }>
  }
}

export default function GroundRulesInsightsPage() {
  const [startDate, setStartDate] = useState(new Date('2025-06-01'))
  const [endDate, setEndDate] = useState(new Date('2025-06-30'))
  const [organizationType, setOrganizationType] = useState<'center' | 'division' | 'team' | 'group'>('center')
  const [organizationName, setOrganizationName] = useState('')

  // Fetch dashboard statistics
  const { data: statsData, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['ground-rules-stats', startDate, endDate, organizationType, organizationName],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/ground-rules-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationType,
          organizationName,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          includeComparisons: true,
          includeTeamBreakdown: true
        })
      })
      if (!response.ok) throw new Error('Failed to fetch stats')
      return response.json()
    }
  })

  // Fetch recommendations
  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery<Recommendations>({
    queryKey: ['ground-rules-recommendations', startDate, endDate, organizationType, organizationName],
    queryFn: async () => {
      const response = await fetch('/api/insights/ground-rules-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationType,
          organizationName,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          analysisDepth: 'comprehensive',
          focusAreas: ['confidence', 'anomalies', 'accuracy', 'patterns']
        })
      })
      if (!response.ok) throw new Error('Failed to fetch recommendations')
      return response.json()
    }
  })

  const isLoading = statsLoading || recommendationsLoading

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                🎯 Ground Rules 인사이트 대시보드
              </h1>
              <p className="text-sm text-gray-600">
                AI 기반 조직 집단지성 분석 및 권장사항
              </p>
            </div>
            
            {/* Date Range Selector */}
            <div className="flex items-center space-x-4">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:border-gray-400 text-sm">
                    <span>시작: {format(startDate, 'MM/dd')}</span>
                    <CalendarIcon className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    locale={ko}
                  />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:border-gray-400 text-sm">
                    <span>종료: {format(endDate, 'MM/dd')}</span>
                    <CalendarIcon className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    locale={ko}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-lg text-gray-600">Ground Rules 인사이트 분석 중...</div>
          </div>
        ) : (
          <>
            {/* Executive Summary */}
            {recommendationsData && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">경영진 요약</h2>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    recommendationsData.executiveSummary.overallHealth === 'excellent' 
                      ? 'bg-green-100 text-green-800'
                      : recommendationsData.executiveSummary.overallHealth === 'good'
                      ? 'bg-blue-100 text-blue-800'
                      : recommendationsData.executiveSummary.overallHealth === 'fair'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {recommendationsData.executiveSummary.overallHealth === 'excellent' ? '우수' :
                     recommendationsData.executiveSummary.overallHealth === 'good' ? '양호' :
                     recommendationsData.executiveSummary.overallHealth === 'fair' ? '보통' : '주의'}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {recommendationsData.executiveSummary.confidenceScore}%
                    </div>
                    <div className="text-sm text-gray-600">신뢰도 점수</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {recommendationsData.executiveSummary.totalInsights}
                    </div>
                    <div className="text-sm text-gray-600">총 인사이트</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {recommendationsData.executiveSummary.urgentActions}
                    </div>
                    <div className="text-sm text-gray-600">긴급 조치</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {statsData?.summary.avgAccuracyImprovement || 0}%
                    </div>
                    <div className="text-sm text-gray-600">정확도 개선</div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">주요 발견사항</h3>
                  <ul className="space-y-1">
                    {recommendationsData.executiveSummary.keyFindings.map((finding, idx) => (
                      <li key={idx} className="flex items-start text-sm text-gray-600">
                        <span className="text-blue-500 mr-2">•</span>
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Key Metrics Cards */}
            {statsData && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Ground Rules 적용률</p>
                      <p className="text-2xl font-bold text-blue-600">{statsData.summary.coveragePercent}%</p>
                    </div>
                    <Target className="h-8 w-8 text-blue-500" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {statsData.summary.totalRecordsWithGroundRules}개 / {statsData.summary.totalRecordsTraditional + statsData.summary.totalRecordsWithGroundRules}개 기록
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">평균 신뢰도</p>
                      <p className="text-2xl font-bold text-green-600">{statsData.summary.avgGroundRulesConfidence}%</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    높은 신뢰도: {statsData.summary.highConfidenceRecords}개 기록
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">정확도 개선</p>
                      <p className="text-2xl font-bold text-purple-600">+{statsData.summary.avgAccuracyImprovement}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-500" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    전통적 방법 대비 향상
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">이상치 감지</p>
                      <p className="text-2xl font-bold text-orange-600">{statsData.summary.anomalyRecords}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-500" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    주의가 필요한 패턴
                  </p>
                </div>
              </div>
            )}

            {/* Time Series Chart Placeholder */}
            {statsData && statsData.timeSeriesData.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Ground Rules 트렌드 분석</h3>
                <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-gray-600 mb-2">시계열 차트</div>
                    <div className="text-sm text-gray-500">
                      {statsData.timeSeriesData.length}일간의 Ground Rules 데이터
                    </div>
                    {/* 실제 구현에서는 Chart.js나 Recharts 등을 사용 */}
                  </div>
                </div>
              </div>
            )}

            {/* Top Performing Teams */}
            {statsData?.comparisonAnalysis?.topPerformingTeams && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">우수 성과 팀</h3>
                <div className="space-y-3">
                  {statsData.comparisonAnalysis.topPerformingTeams.map((team, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">{team.teamName}</div>
                        <div className="text-sm text-gray-600">{team.recordsCount}개 기록</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">{team.avgConfidence}%</div>
                        <div className="text-sm text-gray-500">이상치율: {team.anomalyRate}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Plan */}
            {recommendationsData && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">실행 계획</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {recommendationsData.actionPlan.immediate.length > 0 && (
                    <div>
                      <h4 className="font-medium text-red-700 mb-2 flex items-center">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                        즉시 조치
                      </h4>
                      <div className="space-y-2">
                        {recommendationsData.actionPlan.immediate.map((item, idx) => (
                          <div key={idx} className="p-3 bg-red-50 rounded-lg">
                            <div className="text-sm font-medium text-gray-900">{item.action}</div>
                            <div className="text-xs text-gray-600 mt-1">{item.impact}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {recommendationsData.actionPlan.shortTerm.length > 0 && (
                    <div>
                      <h4 className="font-medium text-orange-700 mb-2 flex items-center">
                        <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                        단기 (4주)
                      </h4>
                      <div className="space-y-2">
                        {recommendationsData.actionPlan.shortTerm.map((item, idx) => (
                          <div key={idx} className="p-3 bg-orange-50 rounded-lg">
                            <div className="text-sm font-medium text-gray-900">{item.action}</div>
                            <div className="text-xs text-gray-600 mt-1">{item.impact}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {recommendationsData.actionPlan.mediumTerm.length > 0 && (
                    <div>
                      <h4 className="font-medium text-blue-700 mb-2 flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        중기 (3개월)
                      </h4>
                      <div className="space-y-2">
                        {recommendationsData.actionPlan.mediumTerm.map((item, idx) => (
                          <div key={idx} className="p-3 bg-blue-50 rounded-lg">
                            <div className="text-sm font-medium text-gray-900">{item.action}</div>
                            <div className="text-xs text-gray-600 mt-1">{item.impact}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {recommendationsData.actionPlan.longTerm.length > 0 && (
                    <div>
                      <h4 className="font-medium text-green-700 mb-2 flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        장기 (12개월)
                      </h4>
                      <div className="space-y-2">
                        {recommendationsData.actionPlan.longTerm.map((item, idx) => (
                          <div key={idx} className="p-3 bg-green-50 rounded-lg">
                            <div className="text-sm font-medium text-gray-900">{item.action}</div>
                            <div className="text-xs text-gray-600 mt-1">{item.impact}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Detailed Insights */}
            {recommendationsData && recommendationsData.insights.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">상세 인사이트</h3>
                <div className="space-y-4">
                  {recommendationsData.insights.slice(0, 5).map((insight, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border-l-4 ${
                      insight.severity === 'critical' ? 'bg-red-50 border-red-400' :
                      insight.severity === 'high' ? 'bg-orange-50 border-orange-400' :
                      insight.severity === 'medium' ? 'bg-yellow-50 border-yellow-400' :
                      'bg-blue-50 border-blue-400'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{insight.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                          <p className="text-sm text-gray-500 mt-2">
                            <span className="font-medium">영향:</span> {insight.impact}
                          </p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          insight.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          insight.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                          insight.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {insight.severity === 'critical' ? '긴급' :
                           insight.severity === 'high' ? '높음' :
                           insight.severity === 'medium' ? '보통' : '낮음'}
                        </span>
                      </div>
                      
                      {insight.recommendations.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-sm font-medium text-gray-700 mb-2">권장사항:</div>
                          <ul className="space-y-1">
                            {insight.recommendations.slice(0, 2).map((rec, recIdx) => (
                              <li key={recIdx} className="flex items-start text-sm text-gray-600">
                                <span className="text-green-500 mr-2">•</span>
                                <div>
                                  <span className="font-medium">{rec.action}</span>
                                  <div className="text-xs text-gray-500">예상 효과: {rec.expectedImpact}</div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}