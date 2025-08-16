import { NextRequest, NextResponse } from 'next/server';
import { 
  getOrganizationsWithStats,
  getOrganizationById,
  getChildOrganizations
} from '@/lib/db/queries/organization';
import { getGroupStats } from '@/lib/db/queries/teamStats';
import { getFromCache, setToCache, buildCacheHeaders } from '@/lib/cache';
import db from '@/lib/db/client';
import { get30DayDateRange } from '@/lib/db/queries/analytics';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const teamCode = searchParams.get('team');
  const cacheKey = `groups:v5:team=${teamCode || ''}`; // v5로 변경하여 캐시 무효화
  const cached = getFromCache<any>(cacheKey);
  if (cached) {
    return new NextResponse(JSON.stringify(cached), { headers: buildCacheHeaders(true, 180) });
  }
  
  let parentOrg = null;
  let groups = [];
  const breadcrumb: { label: string; href?: string }[] = [{ label: '센터', href: '/' }];
  
  if (teamCode) {
    // Show groups under a specific team
    parentOrg = getOrganizationById(teamCode);
    const allChildren = getChildOrganizations(teamCode);
    console.log('Team Code:', teamCode);
    console.log('Parent Org:', parentOrg);
    console.log('All Children:', allChildren);
    groups = allChildren.filter((org: any) => org.orgLevel === 'group');
    console.log('Filtered Groups:', groups);

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
    if (parentOrg) {
      breadcrumb.push({ label: parentOrg.orgName, href: `/groups?team=${parentOrg.orgCode}` });
    }
  } else {
    // Default: show all groups
    groups = getOrganizationsWithStats('group');
  }
  
  // Get aggregated group stats from database
  const groupStatsMap = getGroupStats(teamCode || undefined);
  console.log('GroupStatsMap size:', groupStatsMap.size);
  console.log('GroupStatsMap keys:', Array.from(groupStatsMap.keys()));
  
  // Merge stats with group info
  groups = groups.map((group: any) => {
    const stats = groupStatsMap.get(group.orgCode);
    console.log(`Looking for ${group.orgCode} (${group.orgName}), found:`, stats?.totalEmployees || 0);
    if (stats) {
      group.stats = stats;
    } else {
      // No data available for this group
      group.stats = {
        avgWorkEfficiency: 0,
        avgActualWorkHours: 0,
        avgAttendanceHours: 0,
        avgWeeklyWorkHours: 0,
        avgWeeklyClaimedHours: 0,
        totalEmployees: 0
      };
    }
    return group;
  });
  
  // Filter out groups with 0 employees
  console.log('Groups before filtering:', groups.length, groups.map(g => ({name: g.orgName, employees: g.stats?.totalEmployees})));
  groups = groups.filter((group: any) => group.stats?.totalEmployees > 0);
  console.log('Groups after filtering:', groups.length);
  
  // Calculate totals and weighted averages based on real man-days (30일 누적)
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

    if (teamCode && parentOrg) {
      where += ' AND e.team_name = ?';
      params.push(parentOrg.orgName);
    }

    const row = db.prepare(
      `SELECT 
         COUNT(DISTINCT dar.employee_id) as unique_employees,
         COUNT(*) as man_days,
         SUM(dar.actual_work_hours) as sum_actual,
         SUM(dar.claimed_work_hours) as sum_claimed,
         AVG(dar.focused_work_minutes / 60.0) as avg_focused_hours,
         AVG(dar.confidence_score) as avg_confidence
       FROM daily_analysis_results dar
       JOIN employees e ON e.employee_id = dar.employee_id
       WHERE ${where}
         AND (dar.actual_work_hours > 0 OR dar.claimed_work_hours > 0)`
    ).get(...params) as any;

    const manDays = row?.man_days || 0;
    const sumActual = row?.sum_actual || 0;
    const sumClaimed = row?.sum_claimed || 0;
    totalEmployees = row?.unique_employees || 0;
    avgEfficiency = sumClaimed > 0 ? Math.round((sumActual / sumClaimed) * 1000) / 10 : 0;
    avgWorkHours = manDays > 0 ? Math.round((sumActual / manDays) * 10) / 10 : 0;
    avgClaimedHours = manDays > 0 ? Math.round((sumClaimed / manDays) * 10) / 10 : 0;
    avgFocusedWorkHours = row?.avg_focused_hours ? Math.round(row.avg_focused_hours * 10) / 10 : 0;
    avgDataReliability = row?.avg_confidence ? Math.round(row.avg_confidence * 10) / 10 : 0;
  } catch (e) {
    console.error('Failed to compute weighted group summary:', e);
  }
  
  // Weekly averages (multiply daily by 5)
  const avgWeeklyWorkHours = avgWorkHours * 5;
  const avgWeeklyClaimedHours = avgClaimedHours * 5;

  // Calculate thresholds (20th and 80th percentiles)
  const efficiencyValues = groups.map((org: any) => org.stats?.avgWorkEfficiency || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const workHoursValues = groups.map((org: any) => org.stats?.avgActualWorkHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const claimedHoursValues = groups.map((org: any) => org.stats?.avgAttendanceHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const focusedWorkHoursValues = groups.map((org: any) => org.stats?.avgFocusedWorkHours || 0).filter((v: number) => v >= 0).sort((a: number, b: number) => a - b);
  const dataReliabilityValues = groups.map((org: any) => org.stats?.avgDataReliability || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  
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
  if (focusedWorkHoursValues.length === 0) {
    focusedWorkHoursValues.push(0.2, 1.0);
  }
  if (dataReliabilityValues.length === 0) {
    dataReliabilityValues.push(50.0, 80.0);
  }
  
  const getPercentile = (arr: number[], percentile: number) => {
    if (arr.length === 0) return 0;
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
    workHours: {
      low: `≤${getPercentile(workHoursValues, 20).toFixed(1)}h`,
      middle: `${getPercentile(workHoursValues, 20).toFixed(1)}-${getPercentile(workHoursValues, 80).toFixed(1)}h`,
      high: `≥${getPercentile(workHoursValues, 80).toFixed(1)}h`,
      thresholds: {
        low: getPercentile(workHoursValues, 20),
        high: getPercentile(workHoursValues, 80)
      }
    },
    claimedHours: {
      low: `≤${getPercentile(claimedHoursValues, 20).toFixed(1)}h`,
      middle: `${getPercentile(claimedHoursValues, 20).toFixed(1)}-${getPercentile(claimedHoursValues, 80).toFixed(1)}h`,
      high: `≥${getPercentile(claimedHoursValues, 80).toFixed(1)}h`,
      thresholds: {
        low: getPercentile(claimedHoursValues, 20),
        high: getPercentile(claimedHoursValues, 80)
      }
    },
    weeklyWorkHours: {
      low: `≤${(getPercentile(workHoursValues, 20) * 5).toFixed(1)}h`,
      middle: `${(getPercentile(workHoursValues, 20) * 5).toFixed(1)}-${(getPercentile(workHoursValues, 80) * 5).toFixed(1)}h`,
      high: `≥${(getPercentile(workHoursValues, 80) * 5).toFixed(1)}h`,
      thresholds: {
        low: getPercentile(workHoursValues, 20) * 5,
        high: getPercentile(workHoursValues, 80) * 5
      }
    },
    weeklyClaimedHours: {
      low: `≤${(getPercentile(claimedHoursValues, 20) * 5).toFixed(1)}h`,
      middle: `${(getPercentile(claimedHoursValues, 20) * 5).toFixed(1)}-${(getPercentile(claimedHoursValues, 80) * 5).toFixed(1)}h`,
      high: `≥${(getPercentile(claimedHoursValues, 80) * 5).toFixed(1)}h`,
      thresholds: {
        low: getPercentile(claimedHoursValues, 20) * 5,
        high: getPercentile(claimedHoursValues, 80) * 5
      }
    },
    focusedWorkHours: {
      low: `≤${getPercentile(focusedWorkHoursValues, 20).toFixed(1)}h`,
      middle: `${getPercentile(focusedWorkHoursValues, 20).toFixed(1)}-${getPercentile(focusedWorkHoursValues, 80).toFixed(1)}h`,
      high: `≥${getPercentile(focusedWorkHoursValues, 80).toFixed(1)}h`,
      thresholds: {
        low: getPercentile(focusedWorkHoursValues, 20),
        high: getPercentile(focusedWorkHoursValues, 80)
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
    }
  };

  const payload = {
    groups,
    parentOrg,
    totalEmployees,
    avgEfficiency,
    avgWorkHours,
    avgClaimedHours,
    avgWeeklyWorkHours,
    avgWeeklyClaimedHours,
    avgFocusedWorkHours,
    avgDataReliability,
    thresholds,
    breadcrumb
  };
  setToCache(cacheKey, payload, 180_000);
  return new NextResponse(JSON.stringify(payload), { headers: buildCacheHeaders(false, 180) });
}