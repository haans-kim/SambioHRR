import { NextResponse } from 'next/server'
import { getDailyAnalysisResultsWithGroundRules, getOrganizationStatsWithGroundRules } from '@/lib/database/queries'

interface DashboardStatsRequest {
  organizationType: 'center' | 'division' | 'team' | 'group'
  organizationName?: string
  startDate: string
  endDate: string
  includeComparisons?: boolean
  includeTeamBreakdown?: boolean
}

interface DashboardStatsResponse {
  dateRange: {
    startDate: string
    endDate: string
  }
  summary: {
    totalRecordsWithGroundRules: number
    totalRecordsTraditional: number
    coveragePercent: number
    avgGroundRulesConfidence: number
    avgAccuracyImprovement: number
    highConfidenceRecords: number
    anomalyRecords: number
  }
  organizationBreakdown: {
    organizationType: string
    organizationName: string
    recordsCount: number
    avgConfidence: number
    avgAccuracyImprovement: number
    anomalyRate: number
  }[]
  timeSeriesData: {
    date: string
    groundRulesRecords: number
    avgConfidence: number
    anomalyCount: number
  }[]
  comparisonAnalysis?: {
    traditionalVsGroundRules: {
      traditionalAccuracy: number
      groundRulesAccuracy: number
      improvementPercent: number
    }
    topPerformingTeams: {
      teamName: string
      avgConfidence: number
      recordsCount: number
      anomalyRate: number
    }[]
    improvementAreas: {
      teamName: string
      currentConfidence: number
      potentialImprovement: number
      recordsCount: number
    }[]
  }
}

export async function POST(request: Request) {
  try {
    const body: DashboardStatsRequest = await request.json()
    const { 
      organizationType, 
      organizationName, 
      startDate, 
      endDate, 
      includeComparisons = false,
      includeTeamBreakdown = false 
    } = body

    // Get organization-level Ground Rules statistics
    let organizationStats: any = null
    if (organizationName) {
      organizationStats = getOrganizationStatsWithGroundRules(
        organizationType,
        organizationName,
        startDate,
        endDate
      )
    }

    // Get daily analysis results with Ground Rules for time series
    // Note: We'll need to implement a different function for organization-wide stats
    // For now, use dummy data structure
    const dailyResults: any[] = []
    
    if (!dailyResults || dailyResults.length === 0) {
      return NextResponse.json({
        dateRange: { startDate, endDate },
        summary: {
          totalRecordsWithGroundRules: 0,
          totalRecordsTraditional: 0,
          coveragePercent: 0,
          avgGroundRulesConfidence: 0,
          avgAccuracyImprovement: 0,
          highConfidenceRecords: 0,
          anomalyRecords: 0
        },
        organizationBreakdown: [],
        timeSeriesData: [],
        ...(includeComparisons && { comparisonAnalysis: null })
      })
    }

    // Filter by organization if specified
    let filteredResults = dailyResults
    if (organizationName) {
      // This would require a join with employee/organization data
      // For now, we'll use all data and note this limitation
      console.warn('Organization filtering not fully implemented - showing all data')
    }

    // Calculate summary statistics
    const groundRulesRecords = filteredResults.filter(r => r.ground_rules_confidence !== null)
    const traditionalRecords = filteredResults.filter(r => r.ground_rules_confidence === null)
    
    const avgGroundRulesConfidence = groundRulesRecords.length > 0
      ? groundRulesRecords.reduce((sum, r) => sum + (r.ground_rules_confidence || 0), 0) / groundRulesRecords.length
      : 0

    const highConfidenceRecords = groundRulesRecords.filter(r => (r.ground_rules_confidence || 0) >= 70).length
    const anomalyRecords = groundRulesRecords.filter(r => (r.anomaly_score || 0) > 20).length

    // Calculate accuracy improvement (simplified - would need more sophisticated comparison)
    const avgAccuracyImprovement = groundRulesRecords.length > 0
      ? Math.round(Math.random() * 15 + 5) // Placeholder - would calculate actual improvement
      : 0

    const summary = {
      totalRecordsWithGroundRules: groundRulesRecords.length,
      totalRecordsTraditional: traditionalRecords.length,
      coveragePercent: filteredResults.length > 0 
        ? Math.round((groundRulesRecords.length / filteredResults.length) * 100)
        : 0,
      avgGroundRulesConfidence: Math.round(avgGroundRulesConfidence),
      avgAccuracyImprovement,
      highConfidenceRecords,
      anomalyRecords
    }

    // Generate time series data (group by date)
    const timeSeriesMap = new Map<string, {
      groundRulesRecords: number
      confidenceSum: number
      anomalyCount: number
    }>()

    groundRulesRecords.forEach(record => {
      const date = record.analysis_date
      if (!timeSeriesMap.has(date)) {
        timeSeriesMap.set(date, {
          groundRulesRecords: 0,
          confidenceSum: 0,
          anomalyCount: 0
        })
      }
      const dayData = timeSeriesMap.get(date)!
      dayData.groundRulesRecords += 1
      dayData.confidenceSum += record.ground_rules_confidence || 0
      if ((record.anomaly_score || 0) > 20) {
        dayData.anomalyCount += 1
      }
    })

    const timeSeriesData = Array.from(timeSeriesMap.entries())
      .map(([date, data]) => ({
        date,
        groundRulesRecords: data.groundRulesRecords,
        avgConfidence: data.groundRulesRecords > 0 
          ? Math.round(data.confidenceSum / data.groundRulesRecords)
          : 0,
        anomalyCount: data.anomalyCount
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Organization breakdown (simplified - would need actual organization data)
    const organizationBreakdown = organizationStats ? [{
      organizationType,
      organizationName: organizationName || 'All Organizations',
      recordsCount: groundRulesRecords.length,
      avgConfidence: Math.round(avgGroundRulesConfidence),
      avgAccuracyImprovement,
      anomalyRate: groundRulesRecords.length > 0
        ? Math.round((anomalyRecords / groundRulesRecords.length) * 100)
        : 0
    }] : []

    // Comparison analysis (if requested)
    let comparisonAnalysis = undefined
    if (includeComparisons) {
      // Generate mock comparison data (would be real calculations in production)
      comparisonAnalysis = {
        traditionalVsGroundRules: {
          traditionalAccuracy: 78,
          groundRulesAccuracy: Math.round(78 + avgAccuracyImprovement),
          improvementPercent: avgAccuracyImprovement
        },
        topPerformingTeams: [
          {
            teamName: 'Plant 2팀',
            avgConfidence: 85,
            recordsCount: Math.floor(groundRulesRecords.length * 0.15),
            anomalyRate: 5
          },
          {
            teamName: 'QC팀',
            avgConfidence: 82,
            recordsCount: Math.floor(groundRulesRecords.length * 0.12),
            anomalyRate: 8
          },
          {
            teamName: '연구1팀',
            avgConfidence: 80,
            recordsCount: Math.floor(groundRulesRecords.length * 0.18),
            anomalyRate: 10
          }
        ],
        improvementAreas: [
          {
            teamName: '시설팀',
            currentConfidence: 45,
            potentialImprovement: 25,
            recordsCount: Math.floor(groundRulesRecords.length * 0.08)
          },
          {
            teamName: '관리팀',
            currentConfidence: 52,
            potentialImprovement: 18,
            recordsCount: Math.floor(groundRulesRecords.length * 0.06)
          }
        ]
      }
    }

    const response: DashboardStatsResponse = {
      dateRange: { startDate, endDate },
      summary,
      organizationBreakdown,
      timeSeriesData,
      ...(includeComparisons && { comparisonAnalysis })
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Dashboard Ground Rules stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard Ground Rules statistics' },
      { status: 500 }
    )
  }
}