import { NextRequest, NextResponse } from 'next/server';
import {
  getOrganizationsWithStats,
  getOrganizationsWithStatsForPeriod,
  getOrganizationById,
  getChildOrganizations,
  getOrganizationByName
} from '@/lib/db/queries/organization';
import { getGroupStats } from '@/lib/db/queries/teamStats';
import { getFromCache, setToCache, buildCacheHeaders } from '@/lib/cache';
import db from '@/lib/db/client';
import { calculateAdjustedWorkHours, calculateAIAdjustmentFactor, FLEXIBLE_WORK_ADJUSTMENT_FACTOR } from '@/lib/utils';
import { getLatestMonth } from '@/lib/db/queries/analytics';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const teamCode = searchParams.get('team');
  const selectedMonth = searchParams.get('month') || getLatestMonth();
  const cacheKey = `groups:v12:team=${teamCode || ''}:month=${selectedMonth}`;
  const cached = getFromCache<any>(cacheKey);
  if (cached) {
    return new NextResponse(JSON.stringify(cached), { headers: buildCacheHeaders(true, 180) });
  }

  // 월별 데이터 사용
  const startDate = `${selectedMonth}-01`;
  const endDate = `${selectedMonth}-31`;
  
  let parentOrg = null;
  let groups = [];
  const breadcrumb: { label: string; href?: string }[] = [{ label: '센터', href: '/' }];
  
  if (teamCode) {
    // Show groups under a specific team
    // First try to get by orgCode, then by orgName if not found
    parentOrg = getOrganizationById(teamCode);
    let resolvedTeamCode = teamCode;
    
    if (!parentOrg) {
      // Try to find by orgName and get the orgCode
      const orgByName = getOrganizationByName(teamCode, 'team');
      if (orgByName) {
        parentOrg = orgByName;
        resolvedTeamCode = orgByName.orgCode;
      }
    }
    
    if (parentOrg) {
      const allChildren = getChildOrganizations(resolvedTeamCode);
      groups = allChildren.filter((org: any) => org.orgLevel === 'group');
    }

    // breadcrumb: Center -> (optional) Division -> Team 
    if (parentOrg && parentOrg.parentOrgCode) {
      const divisionOrCenter = getOrganizationById(parentOrg.parentOrgCode);
      if (divisionOrCenter) {
        if (divisionOrCenter.orgLevel === 'division') {
          const center = divisionOrCenter.parentOrgCode ? getOrganizationById(divisionOrCenter.parentOrgCode) : null;
          if (center) {
            breadcrumb.push({ label: center.orgName, href: `/teams?center=${center.orgCode}` });
          }
          breadcrumb.push({ label: divisionOrCenter.orgName, href: `/teams?division=${divisionOrCenter.orgCode}` });
        } else if (divisionOrCenter.orgLevel === 'center') {
          breadcrumb.push({ label: divisionOrCenter.orgName, href: `/teams?center=${divisionOrCenter.orgCode}` });
        }
      }
    }
    // Add team to breadcrumb (team should come before group in hierarchy)
    if (parentOrg) {
      breadcrumb.push({ label: parentOrg.orgName, href: `/groups?team=${parentOrg.orgCode}` });
    }
  } else {
    // Default: show all groups - 월별 데이터 사용
    groups = getOrganizationsWithStatsForPeriod('group', startDate, endDate);
  }

  // getOrganizationsWithStatsForPeriod already has stats, so we don't need getGroupStats
  // If groups don't have stats (when filtered by teamCode), get them
  if (teamCode && groups.length > 0) {
    const groupsWithStats = getOrganizationsWithStatsForPeriod('group', startDate, endDate);
    groups = groups.map((group: any) => {
      const statsData = groupsWithStats.find(g => g.orgCode === group.orgCode);
      return {
        ...group,
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
  }
  
  // Calculate totals and weighted averages based on monthly data
  // startDate와 endDate는 이미 위에서 선언됨
  let totalEmployees = 0;
  let avgEfficiency = 0;
  let avgDataReliability = 0;

  try {
    let where = 'dar.analysis_date BETWEEN ? AND ?';
    const params: any[] = [startDate, endDate];

    if (teamCode && parentOrg) {
      where += ' AND e.team_name = ?';
      params.push(parentOrg.orgName);
    }

    const row = db.prepare(
      `SELECT
         COUNT(DISTINCT dar.employee_id) as unique_employees,
         AVG(dar.confidence_score) as avg_confidence
       FROM daily_analysis_results dar
       JOIN employees e ON e.employee_id = dar.employee_id
       WHERE ${where}
         AND (dar.actual_work_hours > 0 OR dar.claimed_work_hours > 0)`
    ).get(...params) as any;

    totalEmployees = row?.unique_employees || 0;
    avgDataReliability = row?.avg_confidence ? Math.round(row.avg_confidence * 10) / 10 : 0;

  // If totalEmployees is 0 (no data in daily_analysis_results for this month), return empty groups
  if (totalEmployees === 0) {
    console.log('No data in daily_analysis_results for selected month, returning empty groups');
    groups = [];
  } else {
    // Filter out groups with 0 employees only if we have data
    console.log('Groups before filtering:', groups.length, groups.map(g => ({name: g.orgName, employees: g.stats?.totalEmployees})));
    groups = groups.filter((group: any) => group.stats?.totalEmployees > 0);
    console.log('Groups after filtering:', groups.length);
  }
    
    // Calculate efficiency from groups stats instead of raw data
    if (groups.length > 0) {
      let totalWeightedEfficiency = 0;
      let totalGroupEmployees = 0;
      groups.forEach(group => {
        const employees = group.stats?.totalEmployees || 0;
        const efficiency = group.stats?.avgWorkEfficiency || 0;
        totalWeightedEfficiency += efficiency * employees;
        totalGroupEmployees += employees;
      });
      avgEfficiency = totalGroupEmployees > 0 ? totalWeightedEfficiency / totalGroupEmployees : 0;
    }
  } catch (e) {
    console.error('Failed to compute weighted group summary:', e);
  }
  
  // Calculate weekly averages from groups stats  
  let avgWeeklyWorkHours = 0;
  let avgWeeklyClaimedHours = 0;
  
  if (groups.length > 0) {
    let totalWeightedWeeklyWorkHours = 0;
    let totalWeightedWeeklyClaimedHours = 0;
    let totalGroupEmployees = 0;
    
    groups.forEach(group => {
      const employees = group.stats?.totalEmployees || 0;
      // Natural 방식 사용 (30일 합계 / 30일 * 7)  
      const weeklyWorkHours = group.stats?.avgWeeklyWorkHoursAdjusted || group.stats?.avgWeeklyWorkHours || 0;
      const weeklyClaimedHours = group.stats?.avgWeeklyClaimedHoursAdjusted || group.stats?.avgWeeklyClaimedHours || 0;
      
      totalWeightedWeeklyWorkHours += weeklyWorkHours * employees;
      totalWeightedWeeklyClaimedHours += weeklyClaimedHours * employees;
      totalGroupEmployees += employees;
    });
    
    avgWeeklyWorkHours = totalGroupEmployees > 0 ? totalWeightedWeeklyWorkHours / totalGroupEmployees : 0;
    avgWeeklyClaimedHours = totalGroupEmployees > 0 ? totalWeightedWeeklyClaimedHours / totalGroupEmployees : 0;
  }
  
  const avgAdjustedWeeklyWorkHours = avgWeeklyWorkHours && avgDataReliability 
    ? calculateAdjustedWorkHours(avgWeeklyWorkHours, avgDataReliability)
    : 0;
  

  // Calculate thresholds (20th and 80th percentiles) - Natural 방식 사용
  const efficiencyValues = groups.map((org: any) => org.stats?.avgWorkEfficiency || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const adjustedWeeklyWorkHoursValues = groups.map((org: any) => org.stats?.avgAdjustedWeeklyWorkHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  // Natural 방식 사용: avgWeeklyClaimedHoursAdjusted 우선
  const weeklyClaimedHoursValues = groups.map((org: any) => org.stats?.avgWeeklyClaimedHoursAdjusted || org.stats?.avgWeeklyClaimedHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const dataReliabilityValues = groups.map((org: any) => org.stats?.avgDataReliability || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  
  // Ensure we have valid values for thresholds
  if (efficiencyValues.length === 0) {
    efficiencyValues.push(73.2, 88.4);
  }
  if (dataReliabilityValues.length === 0) {
    dataReliabilityValues.push(50.0, 80.0);
  }
  if (adjustedWeeklyWorkHoursValues.length === 0) {
    adjustedWeeklyWorkHoursValues.push(35.0, 45.0);
  }
  if (weeklyClaimedHoursValues.length === 0) {
    weeklyClaimedHoursValues.push(35.0, 45.0);
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
      middle: `${getPercentile(efficiencyValues, 20).toFixed(1)}-${getPercentile(efficiencyValues, 80).toFixed(1)}%`,
      high: `≥${getPercentile(efficiencyValues, 80).toFixed(1)}%`,
      thresholds: {
        low: getPercentile(efficiencyValues, 20),
        high: getPercentile(efficiencyValues, 80)
      }
    },
    weeklyClaimedHours: {
      low: `≤${getPercentile(weeklyClaimedHoursValues, 20).toFixed(0)}h`,
      middle: `${getPercentile(weeklyClaimedHoursValues, 20).toFixed(0)}-${getPercentile(weeklyClaimedHoursValues, 80).toFixed(0)}h`,
      high: `≥${getPercentile(weeklyClaimedHoursValues, 80).toFixed(0)}h`,
      thresholds: {
        low: getPercentile(weeklyClaimedHoursValues, 20),
        high: getPercentile(weeklyClaimedHoursValues, 80)
      }
    },
    dataReliability: {
      low: `≤${getPercentile(dataReliabilityValues, 20).toFixed(1)}%`,
      middle: `${getPercentile(dataReliabilityValues, 20).toFixed(1)}-${getPercentile(dataReliabilityValues, 80).toFixed(1)}%`,
      high: `≥${getPercentile(dataReliabilityValues, 80).toFixed(1)}%`,
      thresholds: {
        low: getPercentile(dataReliabilityValues, 20),
        high: getPercentile(dataReliabilityValues, 80)
      }
    },
    adjustedWeeklyWorkHours: {
      low: `≤${getPercentile(adjustedWeeklyWorkHoursValues, 20).toFixed(0)}h`,
      middle: `${getPercentile(adjustedWeeklyWorkHoursValues, 20).toFixed(0)}-${getPercentile(adjustedWeeklyWorkHoursValues, 80).toFixed(0)}h`,
      high: `≥${getPercentile(adjustedWeeklyWorkHoursValues, 80).toFixed(0)}h`,
      thresholds: {
        low: getPercentile(adjustedWeeklyWorkHoursValues, 20),
        high: getPercentile(adjustedWeeklyWorkHoursValues, 80)
      }
    }
  };

  const payload = {
    groups,
    parentOrg,
    totalEmployees,
    avgEfficiency,
    avgWeeklyWorkHours,
    avgWeeklyClaimedHours,
    avgAdjustedWeeklyWorkHours,
    avgDataReliability,
    thresholds,
    breadcrumb
  };
  setToCache(cacheKey, payload, 180_000);
  return new NextResponse(JSON.stringify(payload), { headers: buildCacheHeaders(false, 180) });
}