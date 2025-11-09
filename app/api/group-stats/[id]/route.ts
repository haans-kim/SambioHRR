import { NextResponse } from 'next/server'
import DatabaseManager from '@/lib/database/connection'
import { calculateAdjustedWorkHours } from '@/lib/utils'
import { getLatestMonth } from '@/lib/db/queries/analytics'

const db = DatabaseManager.getInstance().getDb()

interface GroupStatsResult {
  group: {
    orgCode: string
    orgName: string
    parentTeam: string
    parentCenter: string
    parentDivision?: string | null
  }
  summary: {
    totalEmployees: number
    totalRecords: number
    avgEfficiency: number
    avgWorkHours: number
    avgClaimedHours: number
    avgGroundRulesWorkHours: number
    avgGroundRulesConfidence: number
    avgAdjustedWeeklyWorkHours: number
    totalManDays: number
  }
  distributions: {
    efficiencyDistribution: Array<{range: string, count: number, percentage: number}>
    workHoursDistribution: Array<{range: string, count: number, percentage: number}>
    confidenceDistribution: Array<{range: string, count: number, percentage: number}>
    groundRulesDistribution: Array<{range: string, count: number, percentage: number}>
  }
  metrics: {
    // 시간 관련 지표
    avgTotalHours: number
    avgActualWorkHours: number
    avgClaimedWorkHours: number
    avgEfficiencyRatio: number
    
    // 활동별 시간 (분 단위)
    avgWorkMinutes: number
    avgFocusedWorkMinutes: number
    avgEquipmentMinutes: number
    avgMeetingMinutes: number
    avgTrainingMinutes: number
    
    // 식사 시간 상세
    avgMealMinutes: number
    avgBreakfastMinutes: number
    avgLunchMinutes: number
    avgDinnerMinutes: number
    avgMidnightMealMinutes: number
    
    // 기타 활동 시간
    avgMovementMinutes: number
    avgRestMinutes: number
    avgFitnessMinutes: number
    avgCommuteInMinutes: number
    avgCommuteOutMinutes: number
    avgPreparationMinutes: number
    
    // 구역별 시간
    avgWorkAreaMinutes: number
    avgNonWorkAreaMinutes: number
    avgGateAreaMinutes: number
    
    // Ground Rules 지표
    avgGroundRulesWorkHours: number
    avgGroundRulesConfidence: number
    avgWorkMovementMinutes: number
    avgNonWorkMovementMinutes: number
    avgAnomalyScore: number
    
    // 기타 지표
    avgConfidenceScore: number
    avgActivityCount: number
    avgMealCount: number
    avgTagCount: number
  }
  ranges: {
    efficiencyRange: {min: number, max: number}
    workHoursRange: {min: number, max: number}
    confidenceRange: {min: number, max: number}
  }
  analysisDate: string
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const groupCodeOrName = decodeURIComponent(id)

    // Get month parameter from query string
    const url = new URL(request.url)
    const selectedMonth = url.searchParams.get('month') || getLatestMonth()

    // Calculate date range based on selected month
    const [year, month] = selectedMonth.split('-')
    const startDate = `${selectedMonth}-01`
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
    const endDate = `${selectedMonth}-${lastDay.toString().padStart(2, '0')}`

    // First resolve org_code to org_name if needed
    let groupName = groupCodeOrName
    const orgLookup = db.prepare('SELECT org_name FROM organization_master WHERE org_code = ? AND org_level = ? AND is_active = 1 AND display_order = 0').get(groupCodeOrName, 'group') as any
    if (orgLookup) {
      groupName = orgLookup.org_name
    }

    // Check if group exists in daily_analysis_results
    const groupExistsQuery = `
      SELECT DISTINCT group_name, center_name, team_name
      FROM daily_analysis_results
      WHERE group_name = ?
      LIMIT 1
    `
    const groupInfo = db.prepare(groupExistsQuery).get(groupName) as any

    if (!groupInfo) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Get hierarchy info from organization_master table
    const hierarchyQuery = `
      SELECT 
        g.org_name as group_name,
        g.parent_org_code as parent_team_code,
        t.org_name as parent_team,
        t.parent_org_code as parent_div_or_center_code,
        dt.org_name as parent_division,
        dt.org_level as parent_div_level,
        c.org_name as parent_center
      FROM organization_master g
      LEFT JOIN organization_master t ON g.parent_org_code = t.org_code
      LEFT JOIN organization_master dt ON t.parent_org_code = dt.org_code  
      LEFT JOIN organization_master c ON (
        CASE 
          WHEN dt.org_level = 'center' THEN dt.org_code
          ELSE dt.parent_org_code 
        END = c.org_code AND c.org_level = 'center'
      )
      WHERE g.org_name = ? AND g.org_level = 'group'
      LIMIT 1
    `
    
    const hierarchy = db.prepare(hierarchyQuery).get(groupName) as any
    
    const parentTeam = hierarchy?.parent_team || groupInfo.team_name || 'Unknown'
    const parentCenter = hierarchy?.parent_center || groupInfo.center_name || 'Unknown' 
    const parentDivision = hierarchy?.parent_div_level === 'division' ? hierarchy.parent_division : null

    // Get group statistics from daily_analysis_results
    const statsQuery = `
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT employee_id) as total_employees,
        COUNT(DISTINCT analysis_date) as total_days,

        -- 기본 시간 지표 (주간 기준으로 변환 - 30일 기준)
        ROUND(
          SUM(total_hours) /
          COUNT(DISTINCT CASE WHEN total_hours > 0 THEN employee_id END) /
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7,
          1
        ) as avg_total_hours,
        ROUND(
          SUM(actual_work_hours) /
          COUNT(DISTINCT CASE WHEN actual_work_hours > 0 THEN employee_id END) /
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7,
          1
        ) as avg_actual_work_hours,
        ROUND(
          SUM(claimed_work_hours) /
          COUNT(DISTINCT CASE WHEN claimed_work_hours > 0 THEN employee_id END) /
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7,
          1
        ) as avg_claimed_work_hours,
        AVG(CASE
          WHEN claimed_work_hours > 0 THEN (actual_work_hours / claimed_work_hours) * 100
          ELSE 0
        END) as avg_efficiency_ratio,

        -- 활동별 시간 (분 단위)
        AVG(work_minutes) as avg_work_minutes,
        AVG(focused_work_minutes) as avg_focused_work_minutes,
        AVG(equipment_minutes) as avg_equipment_minutes,
        AVG(meeting_minutes) as avg_meeting_minutes,
        AVG(training_minutes) as avg_training_minutes,

        -- 식사 시간 상세
        AVG(meal_minutes) as avg_meal_minutes,
        AVG(breakfast_minutes) as avg_breakfast_minutes,
        AVG(lunch_minutes) as avg_lunch_minutes,
        AVG(dinner_minutes) as avg_dinner_minutes,
        AVG(midnight_meal_minutes) as avg_midnight_meal_minutes,

        -- 기타 활동 시간
        AVG(movement_minutes) as avg_movement_minutes,
        AVG(rest_minutes) as avg_rest_minutes,
        AVG(fitness_minutes) as avg_fitness_minutes,
        AVG(commute_in_minutes) as avg_commute_in_minutes,
        AVG(commute_out_minutes) as avg_commute_out_minutes,
        AVG(preparation_minutes) as avg_preparation_minutes,

        -- 구역별 시간
        AVG(work_area_minutes) as avg_work_area_minutes,
        AVG(non_work_area_minutes) as avg_non_work_area_minutes,
        AVG(gate_area_minutes) as avg_gate_area_minutes,

        -- Ground Rules 지표
        AVG(ground_rules_work_hours) as avg_ground_rules_work_hours,
        AVG(ground_rules_confidence) as avg_ground_rules_confidence,

        -- 주간 근무시간 (30일 기준으로 정확히 계산)
        ROUND(
          SUM(actual_work_hours) /
          COUNT(DISTINCT CASE WHEN actual_work_hours > 0 THEN employee_id END) /
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7,
          1
        ) as avg_weekly_work_hours,
        AVG(work_movement_minutes) as avg_work_movement_minutes,
        AVG(non_work_movement_minutes) as avg_non_work_movement_minutes,
        AVG(anomaly_score) as avg_anomaly_score,
        
        -- 기타 지표
        AVG(confidence_score) as avg_confidence_score,
        AVG(activity_count) as avg_activity_count,
        AVG(meal_count) as avg_meal_count,
        AVG(tag_count) as avg_tag_count,
        
        -- 범위
        MIN(CASE 
          WHEN total_hours > 0 THEN (actual_work_hours / total_hours) * 100
          ELSE 0 
        END) as min_efficiency,
        MAX(CASE 
          WHEN total_hours > 0 THEN (actual_work_hours / total_hours) * 100
          ELSE 0 
        END) as max_efficiency,
        MIN(actual_work_hours) as min_work_hours,
        MAX(actual_work_hours) as max_work_hours,
        MIN(confidence_score) as min_confidence,
        MAX(confidence_score) as max_confidence,
        
        MAX(analysis_date) as latest_analysis_date
      FROM daily_analysis_results
      WHERE group_name = ?
        AND analysis_date BETWEEN ? AND ?
    `
    
    const stats = db.prepare(statsQuery).get(
      endDate, startDate, // for avg_total_hours JULIANDAY calculation
      endDate, startDate, // for avg_actual_work_hours JULIANDAY calculation
      endDate, startDate, // for avg_claimed_work_hours JULIANDAY calculation
      endDate, startDate, // for avg_weekly_work_hours JULIANDAY calculation
      groupName, startDate, endDate // for WHERE clause
    ) as any
    
    if (!stats || stats.total_records === 0) {
      return NextResponse.json({ 
        error: 'No analysis data found for this group',
        group: {
          orgCode: groupName,
          orgName: groupName,
          parentTeam: parentTeam,
          parentCenter: parentCenter,
          parentDivision: parentDivision
        }
      }, { status: 404 })
    }

    // Calculate distributions
    const distributionQueries = {
      efficiency: `
        SELECT 
          CASE 
            WHEN total_hours <= 0 THEN '<50%'
            WHEN (actual_work_hours / total_hours) * 100 >= 90 THEN '90%+'
            WHEN (actual_work_hours / total_hours) * 100 >= 80 THEN '80-89%'
            WHEN (actual_work_hours / total_hours) * 100 >= 70 THEN '70-79%'
            WHEN (actual_work_hours / total_hours) * 100 >= 60 THEN '60-69%'
            WHEN (actual_work_hours / total_hours) * 100 >= 50 THEN '50-59%'
            ELSE '<50%'
          END as range,
          COUNT(*) as count
        FROM daily_analysis_results
        WHERE group_name = ? AND analysis_date BETWEEN ? AND ?
        GROUP BY range
        ORDER BY MIN(CASE 
          WHEN total_hours > 0 THEN (actual_work_hours / total_hours) * 100
          ELSE 0 
        END) DESC
      `,
      workHours: `
        SELECT 
          CASE 
            WHEN (actual_work_hours * 5) >= 50 THEN '50h+'
            WHEN (actual_work_hours * 5) >= 45 THEN '45-50h'
            WHEN (actual_work_hours * 5) >= 40 THEN '40-45h'
            WHEN (actual_work_hours * 5) >= 35 THEN '35-40h'
            WHEN (actual_work_hours * 5) >= 30 THEN '30-35h'
            ELSE '<30h'
          END as range,
          COUNT(*) as count
        FROM daily_analysis_results
        WHERE group_name = ? AND analysis_date BETWEEN ? AND ?
        GROUP BY range
        ORDER BY MIN(actual_work_hours * 5) DESC
      `,
      confidence: `
        SELECT 
          CASE 
            WHEN confidence_score >= 95 THEN '95%+'
            WHEN confidence_score >= 90 THEN '90-94%'
            WHEN confidence_score >= 85 THEN '85-89%'
            WHEN confidence_score >= 80 THEN '80-84%'
            WHEN confidence_score >= 75 THEN '75-79%'
            ELSE '<75%'
          END as range,
          COUNT(*) as count
        FROM daily_analysis_results
        WHERE group_name = ? AND analysis_date BETWEEN ? AND ?
        GROUP BY range
        ORDER BY MIN(confidence_score) DESC
      `,
      groundRules: `
        SELECT 
          CASE 
            WHEN ground_rules_confidence >= 95 THEN '95%+'
            WHEN ground_rules_confidence >= 90 THEN '90-94%'
            WHEN ground_rules_confidence >= 85 THEN '85-89%'
            WHEN ground_rules_confidence >= 80 THEN '80-84%'
            WHEN ground_rules_confidence >= 75 THEN '75-79%'
            ELSE '<75%'
          END as range,
          COUNT(*) as count
        FROM daily_analysis_results
        WHERE group_name = ? AND ground_rules_confidence > 0 AND analysis_date BETWEEN ? AND ?
        GROUP BY range
        ORDER BY MIN(ground_rules_confidence) DESC
      `
    }

    const efficiencyDist = db.prepare(distributionQueries.efficiency).all(groupName, startDate, endDate) as any[]
    const workHoursDist = db.prepare(distributionQueries.workHours).all(groupName, startDate, endDate) as any[]
    const confidenceDist = db.prepare(distributionQueries.confidence).all(groupName, startDate, endDate) as any[]
    const groundRulesDist = db.prepare(distributionQueries.groundRules).all(groupName, startDate, endDate) as any[]

    // Calculate percentages for distributions
    const calculatePercentages = (dist: any[], total: number) => {
      return dist.map(item => ({
        range: item.range,
        count: item.count,
        percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
      }))
    }

    const result: GroupStatsResult = {
      group: {
        orgCode: groupName,
        orgName: groupName,
        parentTeam: parentTeam,
        parentCenter: parentCenter,
        parentDivision: parentDivision
      },
      summary: {
        totalEmployees: stats.total_employees || 0,
        totalRecords: stats.total_records || 0,
        avgEfficiency: Number((stats.avg_efficiency_ratio || 0).toFixed(1)),
        avgWorkHours: Number((stats.avg_actual_work_hours || 0).toFixed(1)),
        avgClaimedHours: Number((stats.avg_claimed_work_hours || 0).toFixed(1)),
        avgGroundRulesWorkHours: Number((stats.avg_ground_rules_work_hours || 0).toFixed(1)),
        avgGroundRulesConfidence: Number((stats.avg_ground_rules_confidence || 0).toFixed(1)),
        avgAdjustedWeeklyWorkHours: stats.avg_weekly_work_hours || 0,
        totalManDays: stats.total_records || 0
      },
      distributions: {
        efficiencyDistribution: calculatePercentages(efficiencyDist, stats.total_records),
        workHoursDistribution: calculatePercentages(workHoursDist, stats.total_records),
        confidenceDistribution: calculatePercentages(confidenceDist, stats.total_records),
        groundRulesDistribution: calculatePercentages(groundRulesDist, stats.total_records)
      },
      metrics: {
        // 시간 관련 지표
        avgTotalHours: Number((stats.avg_total_hours || 0).toFixed(1)),
        avgActualWorkHours: Number((stats.avg_actual_work_hours || 0).toFixed(1)),
        avgClaimedWorkHours: Number((stats.avg_claimed_work_hours || 0).toFixed(1)),
        avgEfficiencyRatio: Number((stats.avg_efficiency_ratio || 0).toFixed(1)),
        
        // 활동별 시간 (분 단위)
        avgWorkMinutes: Math.round(stats.avg_work_minutes || 0),
        avgFocusedWorkMinutes: Math.round(stats.avg_focused_work_minutes || 0),
        avgEquipmentMinutes: Math.round(stats.avg_equipment_minutes || 0),
        avgMeetingMinutes: Math.round(stats.avg_meeting_minutes || 0),
        avgTrainingMinutes: Math.round(stats.avg_training_minutes || 0),
        
        // 식사 시간 상세
        avgMealMinutes: Math.round(stats.avg_meal_minutes || 0),
        avgBreakfastMinutes: Math.round(stats.avg_breakfast_minutes || 0),
        avgLunchMinutes: Math.round(stats.avg_lunch_minutes || 0),
        avgDinnerMinutes: Math.round(stats.avg_dinner_minutes || 0),
        avgMidnightMealMinutes: Math.round(stats.avg_midnight_meal_minutes || 0),
        
        // 기타 활동 시간
        avgMovementMinutes: Math.round(stats.avg_movement_minutes || 0),
        avgRestMinutes: Math.round(stats.avg_rest_minutes || 0),
        avgFitnessMinutes: Math.round(stats.avg_fitness_minutes || 0),
        avgCommuteInMinutes: Math.round(stats.avg_commute_in_minutes || 0),
        avgCommuteOutMinutes: Math.round(stats.avg_commute_out_minutes || 0),
        avgPreparationMinutes: Math.round(stats.avg_preparation_minutes || 0),
        
        // 구역별 시간
        avgWorkAreaMinutes: Math.round(stats.avg_work_area_minutes || 0),
        avgNonWorkAreaMinutes: Math.round(stats.avg_non_work_area_minutes || 0),
        avgGateAreaMinutes: Math.round(stats.avg_gate_area_minutes || 0),
        
        // Ground Rules 지표
        avgGroundRulesWorkHours: Number((stats.avg_ground_rules_work_hours || 0).toFixed(1)),
        avgGroundRulesConfidence: Number((stats.avg_ground_rules_confidence || 0).toFixed(1)),
        avgWorkMovementMinutes: Math.round(stats.avg_work_movement_minutes || 0),
        avgNonWorkMovementMinutes: Math.round(stats.avg_non_work_movement_minutes || 0),
        avgAnomalyScore: Number((stats.avg_anomaly_score || 0).toFixed(1)),
        
        // 기타 지표
        avgConfidenceScore: Number((stats.avg_confidence_score || 0).toFixed(1)),
        avgActivityCount: Math.round(stats.avg_activity_count || 0),
        avgMealCount: Number((stats.avg_meal_count || 0).toFixed(1)),
        avgTagCount: Math.round(stats.avg_tag_count || 0)
      },
      ranges: {
        efficiencyRange: {
          min: Number((stats.min_efficiency || 0).toFixed(1)),
          max: Number((stats.max_efficiency || 0).toFixed(1))
        },
        workHoursRange: {
          min: Number((stats.min_work_hours || 0).toFixed(1)),
          max: Number((stats.max_work_hours || 0).toFixed(1))
        },
        confidenceRange: {
          min: Number((stats.min_confidence || 0).toFixed(1)),
          max: Number((stats.max_confidence || 0).toFixed(1))
        }
      },
      analysisDate: stats.latest_analysis_date || new Date().toISOString().split('T')[0]
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Group stats API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch group statistics' },
      { status: 500 }
    )
  }
}