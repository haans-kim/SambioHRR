import { NextRequest, NextResponse } from 'next/server';
import { 
  getOrganizationsWithStats,
  getOrganizationById,
  getChildOrganizations
} from '@/lib/db/queries/organization';
import { getFromCache, setToCache, buildCacheHeaders } from '@/lib/cache';
import db from '@/lib/db/client';
import { calculateAdjustedWorkHours, FLEXIBLE_WORK_ADJUSTMENT_FACTOR } from '@/lib/utils';

// Helper function to get 30-day date range
function get30DayDateRange(): { startDate: string; endDate: string } {
  const result = db.prepare(`
    SELECT 
      date(MAX(analysis_date), '-30 days') as startDate, 
      MAX(analysis_date) as endDate 
    FROM daily_analysis_results
  `).get() as any;
  
  return {
    startDate: result?.startDate || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0],
    endDate: result?.endDate || new Date().toISOString().split('T')[0]
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const centerCode = searchParams.get('center');
  const divisionCode = searchParams.get('division');
  const cacheKey = `teams:v5:center=${centerCode || ''}:division=${divisionCode || ''}`;
  const cached = getFromCache<any>(cacheKey);
  if (cached) {
    return new NextResponse(JSON.stringify(cached), { headers: buildCacheHeaders(true, 180) });
  }
  
  let parentOrg = null;
  let teams = [];
  const breadcrumb: { label: string; href?: string }[] = [
    { label: '센터', href: '/' }
  ];
  
  if (divisionCode) {
    // Show teams under a specific division
    parentOrg = getOrganizationById(divisionCode);
    teams = getChildOrganizations(divisionCode).filter((org: any) => org.orgLevel === 'team');
    
    // 통합 함수로 팀 통계 가져오기
    const teamsWithStats = getOrganizationsWithStats('team');
    teams = teams.map((team: any) => {
      const statsData = teamsWithStats.find(t => t.orgCode === team.orgCode);
      return {
        ...team,
        stats: statsData?.stats || {
          avgWorkEfficiency: 0,
          avgActualWorkHours: 0,
          avgAttendanceHours: 0,
          avgWeeklyWorkHours: 0,
          avgWeeklyClaimedHours: 0,
          avgFocusedWorkHours: 0,
          avgDataReliability: 0,
          totalEmployees: 0
        }
      };
    });
    
    // breadcrumb: 센터명 -> 담당명
    if (parentOrg && parentOrg.parentOrgCode) {
      const center = getOrganizationById(parentOrg.parentOrgCode);
      if (center) {
        breadcrumb.push({ label: center.orgName, href: `/teams?center=${center.orgCode}` });
      }
    }
    if (parentOrg) {
      breadcrumb.push({ label: parentOrg.orgName, href: `/teams?division=${parentOrg.orgCode}` });
    }
  } else if (centerCode) {
    // Show divisions or teams under a specific center
    parentOrg = getOrganizationById(centerCode);
    const children = getChildOrganizations(centerCode);
    
    // 센터 직속 팀과 담당 모두 표시
    const centerTeams = getOrganizationsWithStats('team')
      .filter((team: any) => team.parentOrgCode === centerCode);
    const centerDivisions = getOrganizationsWithStats('division')
      .filter((div: any) => div.parentOrgCode === centerCode);
    teams = [...centerDivisions, ...centerTeams];
    
    // breadcrumb: 센터명
    if (parentOrg) {
      breadcrumb.push({ label: parentOrg.orgName, href: `/teams?center=${parentOrg.orgCode}` });
    }
  } else {
    // Default: show all teams
    teams = getOrganizationsWithStats('team');
  }
  
  // Filter out teams with 0 employees
  teams = teams.filter((team: any) => team.stats?.totalEmployees > 0);
  
  // Calculate totals and weighted averages based on 30-day data
  const { startDate, endDate } = get30DayDateRange();
  let totalEmployees = 0;
  let avgEfficiency = 0;
  let avgWorkHours = 0;
  let avgClaimedHours = 0;
  let avgFocusedWorkHours = 0;
  let avgDataReliability = 0;
  
  try {
    let where = 'dar.analysis_date BETWEEN ? AND ?';
    const params: any[] = [startDate, endDate];
    
    if (divisionCode) {
      // Filter by teams under division
      const divisionTeams = getChildOrganizations(divisionCode).filter((org: any) => org.orgLevel === 'team');
      const teamNames = divisionTeams.map((t: any) => t.orgName).filter(Boolean);
      if (teamNames.length > 0) {
        where += ` AND e.team_name IN (${teamNames.map(() => '?').join(',')})`;
        params.push(...teamNames);
      } else {
        // Division에 직접 속한 직원도 포함
        where += ' AND (e.team_name = ? OR e.team_name IN (SELECT org_name FROM organization_master WHERE parent_org_code = ?))';
        params.push(parentOrg?.orgName, divisionCode);
      }
    } else if (centerCode && parentOrg) {
      where += ' AND e.center_name = ?';
      params.push(parentOrg.orgName);
    }
    
    const summary = db.prepare(`
      WITH flexible_workers AS (
        SELECT DISTINCT CAST(사번 AS TEXT) as employee_id
        FROM claim_data
        WHERE WORKSCHDTYPNM = '탄력근무제'
      )
      SELECT 
        COUNT(DISTINCT dar.employee_id) as unique_employees,
        COUNT(DISTINCT fw.employee_id) as flexible_count,
        COUNT(*) as man_days,
        SUM(dar.actual_work_hours) as sum_actual,
        SUM(dar.claimed_work_hours) as sum_claimed,
        SUM(CASE 
          WHEN fw.employee_id IS NOT NULL THEN dar.actual_work_hours * ${FLEXIBLE_WORK_ADJUSTMENT_FACTOR}
          ELSE dar.actual_work_hours
        END) as sum_actual_adjusted,
        SUM(CASE 
          WHEN fw.employee_id IS NOT NULL THEN dar.claimed_work_hours * ${FLEXIBLE_WORK_ADJUSTMENT_FACTOR}
          ELSE dar.claimed_work_hours
        END) as sum_claimed_adjusted,
        ROUND(AVG(dar.focused_work_minutes / 60.0), 1) as avgFocusedHours,
        ROUND(AVG(dar.confidence_score), 1) as avgDataReliability
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      LEFT JOIN flexible_workers fw ON fw.employee_id = dar.employee_id
      WHERE ${where}
        AND (dar.actual_work_hours > 0 OR dar.claimed_work_hours > 0)
    `).get(...params) as any;
    
    const manDays = summary?.man_days || 0;
    const sumActual = summary?.sum_actual || 0;
    const sumClaimed = summary?.sum_claimed || 0;
    const sumActualAdjusted = summary?.sum_actual_adjusted || sumActual;
    const sumClaimedAdjusted = summary?.sum_claimed_adjusted || sumClaimed;
    totalEmployees = summary?.unique_employees || 0;
    avgEfficiency = sumClaimed > 0 ? Math.round((sumActual / sumClaimed) * 1000) / 10 : 0;
    // 탄력근무제 보정 적용된 평균 사용
    avgWorkHours = manDays > 0 ? Math.round((sumActualAdjusted / manDays) * 10) / 10 : 0;
    avgClaimedHours = manDays > 0 ? Math.round((sumClaimedAdjusted / manDays) * 10) / 10 : 0;
    avgFocusedWorkHours = summary?.avgFocusedHours || 0;
    avgDataReliability = summary?.avgDataReliability || 0;
  } catch (e) {
    console.error('Failed to compute weighted team summary:', e);
  }
  
  // Weekly averages
  const avgWeeklyWorkHours = avgWorkHours * 5;
  const avgWeeklyClaimedHours = avgClaimedHours * 5;
  const avgAdjustedWeeklyWorkHours = avgWeeklyWorkHours && avgDataReliability 
    ? calculateAdjustedWorkHours(avgWeeklyWorkHours, avgDataReliability)
    : 0;
  
  // Calculate thresholds (20th and 80th percentiles) - 현재 화면에 표시되는 조직들을 기준으로 계산
  const efficiencyValues = teams.map((org: any) => org.stats?.avgWorkEfficiency || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const workHoursValues = teams.map((org: any) => org.stats?.avgActualWorkHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const claimedHoursValues = teams.map((org: any) => org.stats?.avgAttendanceHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const weeklyWorkHoursValues = teams.map((org: any) => org.stats?.avgWeeklyWorkHours || (org.stats?.avgActualWorkHours || 0) * 5).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const adjustedWeeklyWorkHoursValues = teams.map((org: any) => org.stats?.avgAdjustedWeeklyWorkHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const weeklyClaimedHoursValues = teams.map((org: any) => org.stats?.avgWeeklyClaimedHours || (org.stats?.avgAttendanceHours || 0) * 5).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const focusedHoursValues = teams.map((org: any) => org.stats?.avgFocusedWorkHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const dataReliabilityValues = teams.map((org: any) => org.stats?.avgDataReliability || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  
  // Ensure we have valid values for thresholds
  if (efficiencyValues.length === 0) {
    efficiencyValues.push(73.2, 88.4);
  }
  if (workHoursValues.length === 0) {
    workHoursValues.push(6.0, 8.0);
  }
  if (claimedHoursValues.length === 0) {
    claimedHoursValues.push(7.0, 9.0);
  }
  if (focusedHoursValues.length === 0) {
    focusedHoursValues.push(2.0, 5.0);
  }
  if (dataReliabilityValues.length === 0) {
    dataReliabilityValues.push(70.0, 85.0);
  }
  if (adjustedWeeklyWorkHoursValues.length === 0) {
    adjustedWeeklyWorkHoursValues.push(35.0, 45.0);
  }
  
  const getPercentile = (arr: number[], percentile: number) => {
    if (arr.length === 0) return 0;
    
    // 3개 이하일 때 특별 처리
    if (arr.length <= 3) {
      if (percentile <= 20) return arr[0]; // 최소값
      if (percentile >= 80) return arr[arr.length - 1]; // 최대값
      return arr[Math.floor(arr.length / 2)]; // 중간값
    }
    
    // 일반적인 백분위수 계산
    const index = Math.ceil((percentile / 100) * arr.length) - 1;
    return arr[Math.max(0, Math.min(index, arr.length - 1))];
  };
  
  const thresholds = {
    efficiency: {
      low: `≤${getPercentile(efficiencyValues, 20).toFixed(1)}%`,
      lowValue: getPercentile(efficiencyValues, 20),
      middle: `${getPercentile(efficiencyValues, 20).toFixed(1)}-${getPercentile(efficiencyValues, 80).toFixed(1)}%`,
      midLow: getPercentile(efficiencyValues, 20),
      midHigh: getPercentile(efficiencyValues, 80),
      high: `≥${getPercentile(efficiencyValues, 80).toFixed(1)}%`,
      highValue: getPercentile(efficiencyValues, 80),
      thresholds: { low: getPercentile(efficiencyValues, 20), high: getPercentile(efficiencyValues, 80) }
    },
    workHours: {
      low: `≤${getPercentile(workHoursValues, 20).toFixed(1)}h`,
      lowValue: getPercentile(workHoursValues, 20),
      middle: `${getPercentile(workHoursValues, 20).toFixed(1)}-${getPercentile(workHoursValues, 80).toFixed(1)}h`,
      midLow: getPercentile(workHoursValues, 20),
      midHigh: getPercentile(workHoursValues, 80),
      high: `≥${getPercentile(workHoursValues, 80).toFixed(1)}h`,
      highValue: getPercentile(workHoursValues, 80),
      thresholds: { low: getPercentile(workHoursValues, 20), high: getPercentile(workHoursValues, 80) }
    },
    claimedHours: {
      low: `≤${getPercentile(claimedHoursValues, 20).toFixed(1)}h`,
      lowValue: getPercentile(claimedHoursValues, 20),
      middle: `${getPercentile(claimedHoursValues, 20).toFixed(1)}-${getPercentile(claimedHoursValues, 80).toFixed(1)}h`,
      midLow: getPercentile(claimedHoursValues, 20),
      midHigh: getPercentile(claimedHoursValues, 80),
      high: `≥${getPercentile(claimedHoursValues, 80).toFixed(1)}h`,
      highValue: getPercentile(claimedHoursValues, 80),
      thresholds: { low: getPercentile(claimedHoursValues, 20), high: getPercentile(claimedHoursValues, 80) }
    },
    weeklyWorkHours: {
      low: `≤${getPercentile(weeklyWorkHoursValues, 20).toFixed(0)}h`,
      lowValue: getPercentile(weeklyWorkHoursValues, 20),
      middle: `${getPercentile(weeklyWorkHoursValues, 20).toFixed(0)}-${getPercentile(weeklyWorkHoursValues, 80).toFixed(0)}h`,
      midLow: getPercentile(weeklyWorkHoursValues, 20),
      midHigh: getPercentile(weeklyWorkHoursValues, 80),
      high: `≥${getPercentile(weeklyWorkHoursValues, 80).toFixed(0)}h`,
      highValue: getPercentile(weeklyWorkHoursValues, 80),
      thresholds: { low: getPercentile(weeklyWorkHoursValues, 20), high: getPercentile(weeklyWorkHoursValues, 80) }
    },
    adjustedWeeklyWorkHours: {
      low: `≤${getPercentile(adjustedWeeklyWorkHoursValues, 20).toFixed(0)}h`,
      lowValue: getPercentile(adjustedWeeklyWorkHoursValues, 20),
      middle: `${getPercentile(adjustedWeeklyWorkHoursValues, 20).toFixed(0)}-${getPercentile(adjustedWeeklyWorkHoursValues, 80).toFixed(0)}h`,
      midLow: getPercentile(adjustedWeeklyWorkHoursValues, 20),
      midHigh: getPercentile(adjustedWeeklyWorkHoursValues, 80),
      high: `≥${getPercentile(adjustedWeeklyWorkHoursValues, 80).toFixed(0)}h`,
      highValue: getPercentile(adjustedWeeklyWorkHoursValues, 80),
      thresholds: { low: getPercentile(adjustedWeeklyWorkHoursValues, 20), high: getPercentile(adjustedWeeklyWorkHoursValues, 80) }
    },
    weeklyClaimedHours: {
      low: `≤${getPercentile(weeklyClaimedHoursValues, 20).toFixed(0)}h`,
      lowValue: getPercentile(weeklyClaimedHoursValues, 20),
      middle: `${getPercentile(weeklyClaimedHoursValues, 20).toFixed(0)}-${getPercentile(weeklyClaimedHoursValues, 80).toFixed(0)}h`,
      midLow: getPercentile(weeklyClaimedHoursValues, 20),
      midHigh: getPercentile(weeklyClaimedHoursValues, 80),
      high: `≥${getPercentile(weeklyClaimedHoursValues, 80).toFixed(0)}h`,
      highValue: getPercentile(weeklyClaimedHoursValues, 80),
      thresholds: { low: getPercentile(weeklyClaimedHoursValues, 20), high: getPercentile(weeklyClaimedHoursValues, 80) }
    },
    focusedWorkHours: {
      low: `≤${getPercentile(focusedHoursValues, 20).toFixed(1)}h`,
      lowValue: getPercentile(focusedHoursValues, 20),
      middle: `${getPercentile(focusedHoursValues, 20).toFixed(1)}-${getPercentile(focusedHoursValues, 80).toFixed(1)}h`,
      midLow: getPercentile(focusedHoursValues, 20),
      midHigh: getPercentile(focusedHoursValues, 80),
      high: `≥${getPercentile(focusedHoursValues, 80).toFixed(1)}h`,
      highValue: getPercentile(focusedHoursValues, 80),
      thresholds: { low: getPercentile(focusedHoursValues, 20), high: getPercentile(focusedHoursValues, 80) }
    },
    dataReliability: {
      low: `≤${getPercentile(dataReliabilityValues, 20).toFixed(0)}%`,
      lowValue: getPercentile(dataReliabilityValues, 20),
      middle: `${getPercentile(dataReliabilityValues, 20).toFixed(0)}-${getPercentile(dataReliabilityValues, 80).toFixed(0)}%`,
      midLow: getPercentile(dataReliabilityValues, 20),
      midHigh: getPercentile(dataReliabilityValues, 80),
      high: `≥${getPercentile(dataReliabilityValues, 80).toFixed(0)}%`,
      highValue: getPercentile(dataReliabilityValues, 80),
      thresholds: { low: getPercentile(dataReliabilityValues, 20), high: getPercentile(dataReliabilityValues, 80) }
    }
  };
  
  const response = {
    teams,
    parentOrg,
    breadcrumb,
    summary: {
      totalEmployees,
      avgEfficiency,
      avgWorkHours,
      avgClaimedHours,
      avgWeeklyWorkHours,
      avgWeeklyClaimedHours,
      avgFocusedWorkHours,
      avgDataReliability,
      avgAdjustedWeeklyWorkHours,
    },
    thresholds
  };
  
  setToCache(cacheKey, response, 180);
  return new NextResponse(JSON.stringify(response), { headers: buildCacheHeaders(false, 180) });
}