import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationById, getChildOrganizations, getOrganizationByName } from '@/lib/db/queries/organization';
import { getPrecomputedGroupStatsAll } from '@/lib/db/queries/precompute-stats';
import { getLatestMonth } from '@/lib/db/queries/analytics';
import { getFromCache, setToCache, buildCacheHeaders } from '@/lib/cache';

export const dynamic = 'force-dynamic';

interface GroupStats {
  month: string;
  group_name: string;
  center_name: string;
  team_name: string;
  total_employees: number;
  total_records: number;
  weekly_claimed_hours: number;
  weekly_work_hours: number;
  efficiency: number;
  confidence_score: number;
  work_minutes: number;
  meeting_minutes: number;
  meal_minutes: number;
  movement_minutes: number;
  rest_minutes: number;
  org_code?: string;
  parent_org_code?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teamCode = searchParams.get('team');
    const selectedMonth = searchParams.get('month') || getLatestMonth();

    const cacheKey = `groups-fast:v1:team=${teamCode || ''}:month=${selectedMonth}`;
    const cached = getFromCache<any>(cacheKey);
    if (cached) {
      return new NextResponse(JSON.stringify(cached), {
        headers: buildCacheHeaders(true, 300),
      });
    }

    let parentOrg: any = null;
    let groups: any[] = [];
    const breadcrumb: { label: string; href?: string }[] = [
      { label: '센터', href: '/' }
    ];

    // Resolve team name for precomputed stats lookup
    let teamName: string | undefined;

    if (teamCode) {
      parentOrg = getOrganizationById(teamCode);
      let resolvedTeamCode = teamCode;

      if (!parentOrg) {
        const orgByName = getOrganizationByName(teamCode, 'team');
        if (orgByName) {
          parentOrg = orgByName;
          resolvedTeamCode = orgByName.orgCode;
        }
      }

      if (parentOrg) {
        teamName = parentOrg.orgName;
        const childGroups = getChildOrganizations(resolvedTeamCode).filter((org: any) => org.orgLevel === 'group');
        const precomputedGroups = getPrecomputedGroupStatsAll(selectedMonth, teamName) as GroupStats[];

        groups = childGroups.map((group: any) => {
          const statsData = precomputedGroups.find(
            (g) => g.org_code === group.orgCode || g.group_name === group.orgName
          );
          return {
            ...group,
            stats: statsData ? {
              avgWorkEfficiency: statsData.efficiency || 0,
              avgWeeklyWorkHours: statsData.weekly_work_hours || 0,
              avgWeeklyClaimedHours: statsData.weekly_claimed_hours || 0,
              avgAdjustedWeeklyWorkHours: statsData.weekly_work_hours || 0,
              avgDataReliability: statsData.confidence_score || 0,
              totalEmployees: statsData.total_employees || 0,
            } : {
              avgWorkEfficiency: 0,
              avgWeeklyWorkHours: 0,
              avgWeeklyClaimedHours: 0,
              avgAdjustedWeeklyWorkHours: 0,
              avgDataReliability: 0,
              totalEmployees: 0,
            }
          };
        });

        // Breadcrumb: Center -> (optional) Division -> Team
        if (parentOrg.parentOrgCode) {
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
      }
    } else {
      // Default: show all groups with precomputed stats
      const allGroupStats = getPrecomputedGroupStatsAll(selectedMonth) as GroupStats[];
      groups = allGroupStats.map((statsData) => {
        return {
          orgCode: statsData.org_code || '',
          orgName: statsData.group_name,
          orgLevel: 'group',
          parentOrgCode: statsData.parent_org_code,
          stats: {
            avgWorkEfficiency: statsData.efficiency || 0,
            avgWeeklyWorkHours: statsData.weekly_work_hours || 0,
            avgWeeklyClaimedHours: statsData.weekly_claimed_hours || 0,
            avgAdjustedWeeklyWorkHours: statsData.weekly_work_hours || 0,
            avgDataReliability: statsData.confidence_score || 0,
            totalEmployees: statsData.total_employees || 0,
          }
        };
      });
    }

    // Filter out groups with 0 employees
    groups = groups.filter((group: any) => group.stats?.totalEmployees > 0);

    // Calculate summary from precomputed data
    const totalEmployees = groups.reduce((sum: number, g: any) => sum + (g.stats?.totalEmployees || 0), 0);
    const weightedEfficiency = groups.reduce((sum: number, g: any) => sum + (g.stats?.avgWorkEfficiency || 0) * (g.stats?.totalEmployees || 0), 0);
    const weightedReliability = groups.reduce((sum: number, g: any) => sum + (g.stats?.avgDataReliability || 0) * (g.stats?.totalEmployees || 0), 0);
    const weightedClaimed = groups.reduce((sum: number, g: any) => sum + (g.stats?.avgWeeklyClaimedHours || 0) * (g.stats?.totalEmployees || 0), 0);
    const weightedAdjusted = groups.reduce((sum: number, g: any) => sum + (g.stats?.avgAdjustedWeeklyWorkHours || 0) * (g.stats?.totalEmployees || 0), 0);

    const avgEfficiency = totalEmployees > 0 ? Math.round(weightedEfficiency / totalEmployees * 10) / 10 : 0;
    const avgDataReliability = totalEmployees > 0 ? Math.round(weightedReliability / totalEmployees * 10) / 10 : 0;
    const avgWeeklyClaimedHours = totalEmployees > 0 ? Math.round(weightedClaimed / totalEmployees * 10) / 10 : 0;
    const avgAdjustedWeeklyWorkHours = totalEmployees > 0 ? Math.round(weightedAdjusted / totalEmployees * 10) / 10 : 0;
    const avgWeeklyWorkHours = avgAdjustedWeeklyWorkHours;

    // Calculate thresholds (20th and 80th percentiles)
    const efficiencyValues = groups.map((g: any) => g.stats?.avgWorkEfficiency || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
    const adjustedWeeklyWorkHoursValues = groups.map((g: any) => g.stats?.avgAdjustedWeeklyWorkHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
    const weeklyClaimedHoursValues = groups.map((g: any) => g.stats?.avgWeeklyClaimedHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
    const dataReliabilityValues = groups.map((g: any) => g.stats?.avgDataReliability || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);

    const getPercentile = (arr: number[], percentile: number) => {
      if (arr.length === 0) return 0;
      if (arr.length <= 3) {
        if (percentile <= 20) return arr[0];
        if (percentile >= 80) return arr[arr.length - 1];
        return arr[Math.floor(arr.length / 2)];
      }
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
        low: `≤${getPercentile(dataReliabilityValues, 20).toFixed(1)}%`,
        middle: `${getPercentile(dataReliabilityValues, 20).toFixed(1)}-${getPercentile(dataReliabilityValues, 80).toFixed(1)}%`,
        high: `≥${getPercentile(dataReliabilityValues, 80).toFixed(1)}%`,
        thresholds: { low: getPercentile(dataReliabilityValues, 20), high: getPercentile(dataReliabilityValues, 80) }
      }
    };

    const response = {
      groups,
      parentOrg,
      breadcrumb,
      totalEmployees,
      avgEfficiency,
      avgWeeklyWorkHours,
      avgWeeklyClaimedHours,
      avgAdjustedWeeklyWorkHours,
      avgDataReliability,
      thresholds,
      currentMonth: selectedMonth,
      isPrecomputed: true
    };

    setToCache(cacheKey, response, 300_000); // 5min cache
    return new NextResponse(JSON.stringify(response), {
      headers: buildCacheHeaders(false, 300),
    });
  } catch (error) {
    console.error('Failed to fetch group data (fast):', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch group data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
