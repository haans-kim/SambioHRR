import { NextRequest, NextResponse } from 'next/server';
import { 
  getOrganizationsWithStats,
  getOrganizationById,
  getChildOrganizations
} from '@/lib/db/queries/organization';
import { getTeamStats } from '@/lib/db/queries/teamStats';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const centerCode = searchParams.get('center');
  const divisionCode = searchParams.get('division');
  
  let parentOrg = null;
  let teams = [];
  
  if (divisionCode) {
    // Show teams under a specific division
    parentOrg = getOrganizationById(divisionCode);
    teams = getChildOrganizations(divisionCode).filter((org: any) => org.orgLevel === 'team');
  } else if (centerCode) {
    // Show divisions or teams under a specific center
    parentOrg = getOrganizationById(centerCode);
    const children = getChildOrganizations(centerCode);
    
    // Check if this center has divisions
    const divisions = children.filter((org: any) => org.orgLevel === 'division');
    if (divisions.length > 0) {
      // Show divisions
      teams = getOrganizationsWithStats('division')
        .filter((div: any) => div.parentOrgCode === centerCode);
    } else {
      // Show teams directly
      teams = getOrganizationsWithStats('team')
        .filter((team: any) => team.parentOrgCode === centerCode);
    }
  } else {
    // Default: show all teams
    teams = getOrganizationsWithStats('team');
  }
  
  // Get aggregated team stats from database
  const teamStatsMap = getTeamStats(centerCode || undefined);
  
  // Merge stats with team info
  teams = teams.map((team: any) => {
    const stats = teamStatsMap.get(team.orgCode);
    if (stats) {
      team.stats = stats;
    } else {
      // Fallback for teams without data
      team.stats = {
        avgWorkEfficiency: 85,
        avgActualWorkHours: 7,
        avgAttendanceHours: 9,
        totalEmployees: 100
      };
    }
    return team;
  });
  
  // Calculate total employees and averages
  const totalEmployees = teams.reduce(
    (sum: number, org: any) => sum + (org.stats?.totalEmployees || 0),
    0
  );
  
  const avgEfficiency =
    teams.reduce(
      (sum: number, org: any) => sum + (org.stats?.avgWorkEfficiency || 0),
      0
    ) / (teams.length || 1);
  
  const avgWorkHours =
    teams.reduce(
      (sum: number, org: any) => sum + (org.stats?.avgActualWorkHours || 0),
      0
    ) / (teams.length || 1);
  
  const avgClaimedHours =
    teams.reduce(
      (sum: number, org: any) => sum + (org.stats?.avgAttendanceHours || 0),
      0
    ) / (teams.length || 1);
  
  // Weekly averages (multiply daily by 5)
  const avgWeeklyWorkHours = avgWorkHours * 5;
  const avgWeeklyClaimedHours = avgClaimedHours * 5;

  // Calculate thresholds (20th and 80th percentiles)
  const efficiencyValues = teams.map((org: any) => org.stats?.avgWorkEfficiency || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const workHoursValues = teams.map((org: any) => org.stats?.avgActualWorkHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  const claimedHoursValues = teams.map((org: any) => org.stats?.avgAttendanceHours || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
  
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
    }
  };

  return NextResponse.json({
    teams,
    parentOrg,
    totalEmployees,
    avgEfficiency,
    avgWorkHours,
    avgClaimedHours,
    avgWeeklyWorkHours,
    avgWeeklyClaimedHours,
    thresholds
  });
}