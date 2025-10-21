import { NextRequest, NextResponse } from 'next/server';
import {
  getOrganizationsWithStats,
  getOrganizationsWithStatsForPeriod,
  getOrganizationById,
  getChildOrganizations,
  getOrganizationByName
} from '@/lib/db/queries/organization';
import { getFromCache, setToCache, buildCacheHeaders } from '@/lib/cache';
import db from '@/lib/db/client';
import { calculateAdjustedWorkHours, FLEXIBLE_WORK_ADJUSTMENT_FACTOR } from '@/lib/utils';
import { getMetricThresholdsForGrid, getLatestMonth } from '@/lib/db/queries/analytics';

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
  const selectedMonth = searchParams.get('month') || getLatestMonth();
  const cacheKey = `teams:v10:center=${centerCode || ''}:division=${divisionCode || ''}:month=${selectedMonth}`;
  const cached = getFromCache<any>(cacheKey);
  if (cached) {
    return new NextResponse(JSON.stringify(cached), { headers: buildCacheHeaders(true, 180) });
  }

  // 월별 데이터 사용
  const startDate = `${selectedMonth}-01`;
  const endDate = `${selectedMonth}-31`;
  
  let parentOrg = null;
  let teams = [];
  const breadcrumb: { label: string; href?: string }[] = [
    { label: '센터', href: '/' }
  ];
  
  if (divisionCode) {
    // Show teams under a specific division
    // First try to get by orgCode, then by orgName if not found
    parentOrg = getOrganizationById(divisionCode);
    let resolvedDivisionCode = divisionCode;
    
    if (!parentOrg) {
      // Try to find by orgName and get the orgCode
      const orgByName = getOrganizationByName(divisionCode, 'division');
      if (orgByName) {
        parentOrg = orgByName;
        resolvedDivisionCode = orgByName.orgCode;
      }
    }
    
    if (parentOrg) {
      teams = getChildOrganizations(resolvedDivisionCode).filter((org: any) => org.orgLevel === 'team');
    }
    
    // 통합 함수로 팀 통계 가져오기 - 월별 데이터 사용
    const teamsWithStats = getOrganizationsWithStatsForPeriod('team', startDate, endDate);
    teams = teams.map((team: any) => {
      const statsData = teamsWithStats.find(t => t.orgCode === team.orgCode);
      return {
        ...team,
        stats: statsData?.stats || {
          avgWorkEfficiency: 0,
          avgWeeklyWorkHours: 0,
          avgWeeklyClaimedHours: 0,
          avgAdjustedWeeklyWorkHours: 0,
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
    
    // 센터 직속 팀과 담당 모두 표시 - 월별 데이터 사용
    const centerTeams = getOrganizationsWithStatsForPeriod('team', startDate, endDate)
      .filter((team: any) => team.parentOrgCode === centerCode);
    const centerDivisions = getOrganizationsWithStatsForPeriod('division', startDate, endDate)
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
  
  // Calculate totals and weighted averages based on monthly data
  // startDate와 endDate는 이미 위에서 선언됨
  let totalEmployees = 0;
  let avgEfficiency = 0;
  let avgDataReliability = 0;

  try {
    let where = 'dar.analysis_date BETWEEN ? AND ?';
    const params: any[] = [startDate, endDate];
    
    if (parentOrg && parentOrg.orgLevel === 'division') {
      // Filter by teams under division - use the resolved orgCode
      const resolvedDivisionCode = parentOrg.orgCode;
      const divisionTeams = getChildOrganizations(resolvedDivisionCode).filter((org: any) => org.orgLevel === 'team');
      const teamNames = divisionTeams.map((t: any) => t.orgName).filter(Boolean);
      if (teamNames.length > 0) {
        where += ` AND e.team_name IN (${teamNames.map(() => '?').join(',')})`;
        params.push(...teamNames);
      } else {
        // Division에 직접 속한 직원도 포함
        where += ' AND (e.team_name = ? OR e.team_name IN (SELECT org_name FROM organization_master WHERE parent_org_code = ?))';
        params.push(parentOrg?.orgName, resolvedDivisionCode);
      }
    } else if (centerCode && parentOrg) {
      where += ' AND e.center_name = ?';
      params.push(parentOrg.orgName);
    }
    
    const summary = db.prepare(`
      SELECT 
        COUNT(DISTINCT dar.employee_id) as unique_employees,
        ROUND(AVG(dar.confidence_score), 1) as avgDataReliability
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      WHERE ${where}
        AND (dar.actual_work_hours > 0 OR dar.claimed_work_hours > 0)
    `).get(...params) as any;
    
    totalEmployees = summary?.unique_employees || 0;
    avgDataReliability = summary?.avgDataReliability || 0;
    
    // Calculate efficiency from teams stats instead of raw data
    if (teams.length > 0) {
      let totalWeightedEfficiency = 0;
      let totalTeamEmployees = 0;
      teams.forEach(team => {
        const employees = team.stats?.totalEmployees || 0;
        const efficiency = team.stats?.avgWorkEfficiency || 0;
        totalWeightedEfficiency += efficiency * employees;
        totalTeamEmployees += employees;
      });
      avgEfficiency = totalTeamEmployees > 0 ? totalWeightedEfficiency / totalTeamEmployees : 0;
    }
  } catch (e) {
    console.error('Failed to compute weighted team summary:', e);
  }
  
  // Calculate weekly averages from teams stats
  let avgWeeklyWorkHours = 0;
  let avgWeeklyClaimedHours = 0;
  let avgAdjustedWeeklyWorkHours = 0;

  if (teams.length > 0) {
    let totalWeightedWeeklyWorkHours = 0;
    let totalWeightedWeeklyClaimedHours = 0;
    let totalWeightedAdjustedWeeklyWorkHours = 0;
    let totalTeamEmployees = 0;

    teams.forEach(team => {
      const employees = team.stats?.totalEmployees || 0;
      // Natural 방식 사용 (30일 합계 / 30일 * 7)
      const weeklyWorkHours = team.stats?.avgWeeklyWorkHoursAdjusted || team.stats?.avgWeeklyWorkHours || 0;
      const weeklyClaimedHours = team.stats?.avgWeeklyClaimedHoursAdjusted || team.stats?.avgWeeklyClaimedHours || 0;
      const adjustedWeeklyWorkHours = team.stats?.avgAdjustedWeeklyWorkHours || 0;

      totalWeightedWeeklyWorkHours += weeklyWorkHours * employees;
      totalWeightedWeeklyClaimedHours += weeklyClaimedHours * employees;
      totalWeightedAdjustedWeeklyWorkHours += adjustedWeeklyWorkHours * employees;
      totalTeamEmployees += employees;
    });

    avgWeeklyWorkHours = totalTeamEmployees > 0 ? totalWeightedWeeklyWorkHours / totalTeamEmployees : 0;
    avgWeeklyClaimedHours = totalTeamEmployees > 0 ? totalWeightedWeeklyClaimedHours / totalTeamEmployees : 0;
    avgAdjustedWeeklyWorkHours = totalTeamEmployees > 0 ? totalWeightedAdjustedWeeklyWorkHours / totalTeamEmployees : 0;
  }
  
  // Use local thresholds for drill-down views (relative comparison within organization) - Natural 방식 사용
  const efficiencyValues = teams.map((org: any) => org.stats?.avgWorkEfficiency || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const adjustedWeeklyWorkHoursValues = teams.map((org: any) => org.stats?.avgAdjustedWeeklyWorkHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  // Natural 방식 사용: avgWeeklyClaimedHoursAdjusted 우선
  const weeklyClaimedHoursValues = teams.map((org: any) => org.stats?.avgWeeklyClaimedHoursAdjusted || org.stats?.avgWeeklyClaimedHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const dataReliabilityValues = teams.map((org: any) => org.stats?.avgDataReliability || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  
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
      middle: `${getPercentile(efficiencyValues, 20).toFixed(1)}-${getPercentile(efficiencyValues, 80).toFixed(1)}%`,
      high: `≥${getPercentile(efficiencyValues, 80).toFixed(1)}%`,
      thresholds: { low: getPercentile(efficiencyValues, 20), high: getPercentile(efficiencyValues, 80) }
    },
    adjustedWeeklyWorkHours: {
      low: `≤${getPercentile(adjustedWeeklyWorkHoursValues, 20).toFixed(0)}h`,
      middle: `${getPercentile(adjustedWeeklyWorkHoursValues, 20).toFixed(0)}-${getPercentile(adjustedWeeklyWorkHoursValues, 80).toFixed(0)}h`,
      high: `≥${getPercentile(adjustedWeeklyWorkHoursValues, 80).toFixed(0)}h`,
      thresholds: { low: getPercentile(adjustedWeeklyWorkHoursValues, 20), high: getPercentile(adjustedWeeklyWorkHoursValues, 80) }
    },
    weeklyClaimedHours: {
      low: `≤${getPercentile(weeklyClaimedHoursValues, 20).toFixed(0)}h`,
      middle: `${getPercentile(weeklyClaimedHoursValues, 20).toFixed(0)}-${getPercentile(weeklyClaimedHoursValues, 80).toFixed(0)}h`,
      high: `≥${getPercentile(weeklyClaimedHoursValues, 80).toFixed(0)}h`,
      thresholds: { low: getPercentile(weeklyClaimedHoursValues, 20), high: getPercentile(weeklyClaimedHoursValues, 80) }
    },
    dataReliability: {
      low: `≤${getPercentile(dataReliabilityValues, 20).toFixed(0)}%`,
      middle: `${getPercentile(dataReliabilityValues, 20).toFixed(0)}-${getPercentile(dataReliabilityValues, 80).toFixed(0)}%`,
      high: `≥${getPercentile(dataReliabilityValues, 80).toFixed(0)}%`,
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
      avgWeeklyWorkHours,
      avgWeeklyClaimedHours,
      avgDataReliability,
      avgAdjustedWeeklyWorkHours,
    },
    thresholds
  };
  
  setToCache(cacheKey, response, 180);
  return new NextResponse(JSON.stringify(response), { headers: buildCacheHeaders(false, 180) });
}