import { NextResponse } from 'next/server'
import { getOrganizationStatsWithGroundRules, getDailyAnalysisResultsWithGroundRules } from '@/lib/database/queries'

interface GroundRulesStatsRequest {
  organizationType: 'center' | 'division' | 'team' | 'group'
  organizationName: string
  startDate: string
  endDate: string
  includeDetails?: boolean // Include individual employee data
}

interface GroundRulesStatsResponse {
  organizationType: string
  organizationName: string
  dateRange: {
    startDate: string
    endDate: string
  }
  summary: {
    totalRecords: number
    avgWorkHours: number
    avgEfficiency: number
    avgConfidence: number
    avgGroundRulesWorkHours: number
    avgGroundRulesConfidence: number
    avgWorkMovement: number
    avgNonWorkMovement: number
    avgAnomalyScore: number
    anomalyCount: number
    anomalyRate: number
  }
  groundRulesInsights: {
    highConfidenceTeams: number // Teams with >70% Ground Rules confidence
    anomalyTeams: number        // Teams with >20% anomaly score
    improvementPotential: number // Potential accuracy improvement %
    recommendedActions: string[]
  }
  details?: any[] // Individual records if requested
}

export async function POST(request: Request) {
  try {
    const body: GroundRulesStatsRequest = await request.json()
    const { organizationType, organizationName, startDate, endDate, includeDetails = false } = body

    // Get organization statistics with Ground Rules
    const stats = getOrganizationStatsWithGroundRules(
      organizationType,
      organizationName, 
      startDate,
      endDate
    ) as any

    if (!stats) {
      return NextResponse.json(
        { error: 'No data found for the specified organization and date range' },
        { status: 404 }
      )
    }

    // Calculate derived metrics
    const anomalyRate = stats.total_records > 0 
      ? Math.round((stats.anomaly_count / stats.total_records) * 100)
      : 0

    // Generate insights
    const groundRulesInsights = {
      highConfidenceTeams: stats.avg_ground_rules_confidence > 70 ? 1 : 0,
      anomalyTeams: stats.avg_anomaly_score > 20 ? 1 : 0,
      improvementPotential: Math.max(0, Math.round((stats.avg_ground_rules_confidence - 35) / 2)),
      recommendedActions: generateRecommendations(stats)
    }

    // Prepare detailed data if requested
    let details = undefined
    if (includeDetails) {
      // For detailed view, we'd need to get individual employee records
      // This would require additional queries by employee within the organization
      details = []
    }

    const response: GroundRulesStatsResponse = {
      organizationType,
      organizationName,
      dateRange: { startDate, endDate },
      summary: {
        totalRecords: stats.total_records || 0,
        avgWorkHours: Math.round((stats.avg_work_hours || 0) * 100) / 100,
        avgEfficiency: Math.round(stats.avg_efficiency || 0),
        avgConfidence: Math.round(stats.avg_confidence || 0),
        avgGroundRulesWorkHours: Math.round((stats.avg_ground_rules_work_hours || 0) * 100) / 100,
        avgGroundRulesConfidence: Math.round(stats.avg_ground_rules_confidence || 0),
        avgWorkMovement: Math.round(stats.avg_work_movement || 0),
        avgNonWorkMovement: Math.round(stats.avg_non_work_movement || 0),
        avgAnomalyScore: Math.round(stats.avg_anomaly_score || 0),
        anomalyCount: stats.anomaly_count || 0,
        anomalyRate
      },
      groundRulesInsights,
      ...(includeDetails && { details })
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Ground Rules stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Ground Rules statistics' },
      { status: 500 }
    )
  }
}

function generateRecommendations(stats: any): string[] {
  const recommendations: string[] = []

  if (stats.avg_ground_rules_confidence < 50) {
    recommendations.push('팀별 이동 패턴 데이터가 부족합니다. 더 많은 T1 태그 수집이 필요합니다.')
  }

  if (stats.avg_anomaly_score > 20) {
    recommendations.push('높은 이상치 점수가 감지되었습니다. 팀별 근무 패턴을 재검토해보세요.')
  }

  if (stats.avg_work_movement < stats.avg_non_work_movement) {
    recommendations.push('비업무 이동이 업무 관련 이동보다 많습니다. 업무 효율성을 검토해보세요.')
  }

  if (stats.avg_efficiency < 70) {
    recommendations.push('전체적인 업무 효율성이 낮습니다. Ground Rules 기반 분석을 통해 개선점을 찾아보세요.')
  }

  if (recommendations.length === 0) {
    recommendations.push('양호한 Ground Rules 분석 결과입니다. 현재 패턴을 유지하세요.')
  }

  return recommendations
}