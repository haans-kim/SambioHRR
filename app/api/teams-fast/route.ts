import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationById, getChildOrganizations } from '@/lib/db/queries/organization';
import { getPrecomputedTeamStats } from '@/lib/db/queries/precompute-stats';
import { getLatestMonth } from '@/lib/db/queries/analytics';
import { getFromCache, setToCache, buildCacheHeaders } from '@/lib/cache';
import { mapOrganizationName } from '@/lib/organization-mapping';
import db from '@/lib/db/client';

export const dynamic = 'force-dynamic';

interface TeamStats {
  month: string;
  team_name: string;
  center_name: string;
  total_employees: number;
  weekly_claimed_hours: number;
  weekly_adjusted_hours: number;
  efficiency: number;
  data_reliability: number;
  org_code?: string;
  parent_org_code?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const centerCode = searchParams.get('center');
    const divisionCode = searchParams.get('division');
    const selectedMonth = searchParams.get('month') || getLatestMonth();

    const cacheKey = `teams-fast:v1:center=${centerCode || ''}:division=${divisionCode || ''}:month=${selectedMonth}`;
    const cached = getFromCache<any>(cacheKey);
    if (cached) {
      return new NextResponse(JSON.stringify(cached), {
        headers: buildCacheHeaders(true, 300),
      });
    }

    const currentMonth = selectedMonth;

    let parentOrg: any = null;
    let teams: any[] = [];
    const breadcrumb: { label: string; href?: string }[] = [
      { label: '센터', href: '/' }
    ];

    // Get precomputed team stats for the current month
    const precomputedTeams = getPrecomputedTeamStats(currentMonth, centerCode || undefined) as TeamStats[];

    if (divisionCode) {
      // Show teams under a specific division
      parentOrg = getOrganizationById(divisionCode);
      if (!parentOrg) {
        const orgByName = db.prepare(`
          SELECT
            org_code as orgCode,
            org_name as orgName,
            org_level as orgLevel,
            parent_org_code as parentOrgCode
          FROM organization_master
          WHERE org_name = ? AND org_level = 'division' AND is_active = 1
          LIMIT 1
        `).get(divisionCode) as any;
        if (orgByName) {
          parentOrg = orgByName;
        }
      }

      if (parentOrg) {
        const childTeams = getChildOrganizations(parentOrg.orgCode).filter((org: any) => org.orgLevel === 'team');

        // Map precomputed stats to teams
        teams = childTeams.map((team: any) => {
          const statsData = precomputedTeams.find((t) => t.org_code === team.orgCode || t.team_name === team.orgName);
          return {
            ...team,
            stats: statsData ? {
              avgWorkEfficiency: statsData.efficiency || 0,
              avgWeeklyWorkHours: 40.0,
              avgWeeklyClaimedHours: statsData.weekly_claimed_hours || 0,
              avgAdjustedWeeklyWorkHours: statsData.weekly_adjusted_hours || 0,
              avgDataReliability: statsData.data_reliability || 0,
              totalEmployees: statsData.total_employees || 0
            } : {
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

      // Breadcrumb
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

      const divisions = children.filter((c: any) => c.orgLevel === 'division');
      const directTeams = children.filter((c: any) => c.orgLevel === 'team');

      // Get all precomputed team stats for this center (without centerCode filter to get all)
      const allTeamStats = getPrecomputedTeamStats(currentMonth) as TeamStats[];

      // Map stats for divisions (aggregate from their teams)
      const divisionsWithStats = divisions.map((div: any) => {
        const divTeams = getChildOrganizations(div.orgCode).filter((t: any) => t.orgLevel === 'team');
        const divTeamStats = allTeamStats.filter((t) =>
          divTeams.some((dt: any) => dt.orgCode === t.org_code || dt.orgName === t.team_name)
        );

        const totalEmployees = divTeamStats.reduce((sum: number, t) => sum + (t.total_employees || 0), 0);
        const totalClaimed = divTeamStats.reduce((sum: number, t) => sum + (t.total_employees || 0) * (t.weekly_claimed_hours || 0), 0);
        const totalAdjusted = divTeamStats.reduce((sum: number, t) => sum + (t.total_employees || 0) * (t.weekly_adjusted_hours || 0), 0);
        const avgReliability = divTeamStats.length > 0
          ? divTeamStats.reduce((sum: number, t) => sum + (t.data_reliability || 0), 0) / divTeamStats.length
          : 0;

        return {
          ...div,
          stats: {
            avgWorkEfficiency: totalEmployees > 0 ? Math.round(totalAdjusted / totalClaimed * 100 * 10) / 10 : 0,
            avgWeeklyWorkHours: 40.0,
            avgWeeklyClaimedHours: totalEmployees > 0 ? Math.round(totalClaimed / totalEmployees * 10) / 10 : 0,
            avgAdjustedWeeklyWorkHours: totalEmployees > 0 ? Math.round(totalAdjusted / totalEmployees * 10) / 10 : 0,
            avgDataReliability: Math.round(avgReliability * 10) / 10,
            totalEmployees
          }
        };
      });

      // Map stats for direct teams
      const directTeamsWithStats = directTeams.map((team: any) => {
        const statsData = precomputedTeams.find((t) => t.org_code === team.orgCode || t.team_name === team.orgName);
        return {
          ...team,
          stats: statsData ? {
            avgWorkEfficiency: statsData.efficiency || 0,
            avgWeeklyWorkHours: 40.0,
            avgWeeklyClaimedHours: statsData.weekly_claimed_hours || 0,
            avgAdjustedWeeklyWorkHours: statsData.weekly_adjusted_hours || 0,
            avgDataReliability: statsData.data_reliability || 0,
            totalEmployees: statsData.total_employees || 0
          } : {
            avgWorkEfficiency: 0,
            avgWeeklyWorkHours: 0,
            avgWeeklyClaimedHours: 0,
            avgAdjustedWeeklyWorkHours: 0,
            avgDataReliability: 0,
            totalEmployees: 0
          }
        };
      });

      teams = [...divisionsWithStats, ...directTeamsWithStats];

      // Breadcrumb
      if (parentOrg) {
        breadcrumb.push({ label: parentOrg.orgName, href: `/teams?center=${parentOrg.orgCode}` });
      }
    } else {
      // Default: show all teams with precomputed stats
      const allTeamStats = getPrecomputedTeamStats(currentMonth) as TeamStats[];
      teams = allTeamStats.map((statsData) => {
        return {
          orgCode: statsData.org_code || '',
          orgName: statsData.team_name,
          orgLevel: 'team',
          parentOrgCode: statsData.parent_org_code,
          stats: {
            avgWorkEfficiency: statsData.efficiency || 0,
            avgWeeklyWorkHours: 40.0,
            avgWeeklyClaimedHours: statsData.weekly_claimed_hours || 0,
            avgAdjustedWeeklyWorkHours: statsData.weekly_adjusted_hours || 0,
            avgDataReliability: statsData.data_reliability || 0,
            totalEmployees: statsData.total_employees || 0
          }
        };
      });
    }

    // Filter out teams with 0 employees
    teams = teams.filter((team: any) => team.stats?.totalEmployees > 0);

    // Apply organization name mapping
    teams = teams.map((team: any) => ({
      ...team,
      orgName: mapOrganizationName(team.orgName),
    }));
    if (parentOrg) {
      parentOrg = { ...parentOrg, orgName: mapOrganizationName(parentOrg.orgName) };
    }
    breadcrumb.forEach((item, i) => {
      if (i > 0) item.label = mapOrganizationName(item.label);
    });

    // Calculate summary from precomputed data
    const totalEmployees = teams.reduce((sum: number, t: any) => sum + (t.stats?.totalEmployees || 0), 0);
    const weightedEfficiency = teams.reduce((sum: number, t: any) => sum + (t.stats?.avgWorkEfficiency || 0) * (t.stats?.totalEmployees || 0), 0);
    const weightedReliability = teams.reduce((sum: number, t: any) => sum + (t.stats?.avgDataReliability || 0) * (t.stats?.totalEmployees || 0), 0);
    const weightedClaimed = teams.reduce((sum: number, t: any) => sum + (t.stats?.avgWeeklyClaimedHours || 0) * (t.stats?.totalEmployees || 0), 0);
    const weightedAdjusted = teams.reduce((sum: number, t: any) => sum + (t.stats?.avgAdjustedWeeklyWorkHours || 0) * (t.stats?.totalEmployees || 0), 0);

    const avgEfficiency = totalEmployees > 0 ? Math.round(weightedEfficiency / totalEmployees * 10) / 10 : 0;
    const avgDataReliability = totalEmployees > 0 ? Math.round(weightedReliability / totalEmployees * 10) / 10 : 0;
    const avgWeeklyClaimedHours = totalEmployees > 0 ? Math.round(weightedClaimed / totalEmployees * 10) / 10 : 0;
    const avgAdjustedWeeklyWorkHours = totalEmployees > 0 ? Math.round(weightedAdjusted / totalEmployees * 10) / 10 : 0;

    // Calculate local thresholds (relative comparison)
    const efficiencyValues = teams.map((t: any) => t.stats?.avgWorkEfficiency || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
    const adjustedWeeklyWorkHoursValues = teams.map((t: any) => t.stats?.avgAdjustedWeeklyWorkHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
    const weeklyClaimedHoursValues = teams.map((t: any) => t.stats?.avgWeeklyClaimedHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
    const dataReliabilityValues = teams.map((t: any) => t.stats?.avgDataReliability || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);

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
        avgWeeklyWorkHours: 40.0,
        avgWeeklyClaimedHours,
        avgAdjustedWeeklyWorkHours,
        avgDataReliability,
      },
      thresholds,
      currentMonth,
      isPrecomputed: true
    };

    setToCache(cacheKey, response, 300_000); // 5분 캐시
    return new NextResponse(JSON.stringify(response), {
      headers: buildCacheHeaders(false, 300),
    });
  } catch (error) {
    console.error('Failed to fetch team data (fast):', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch team data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
