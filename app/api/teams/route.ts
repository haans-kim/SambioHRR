import { NextRequest, NextResponse } from 'next/server';
import { 
  getOrganizationsWithStats,
  getOrganizationById,
  getChildOrganizations
} from '@/lib/db/queries/organization';
import { getTeamStats } from '@/lib/db/queries/teamStats';
import { getFromCache, setToCache, buildCacheHeaders } from '@/lib/cache';
import db from '@/lib/db/client';
import { get30DayDateRange } from '@/lib/db/queries/analytics';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const centerCode = searchParams.get('center');
  const divisionCode = searchParams.get('division');
  const cacheKey = `teams:v1:center=${centerCode || ''}:division=${divisionCode || ''}`;
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
    // Fallback: 일부 데이터에 조직마스터 누락 시 통계 테이블 기반으로 보강
    if (teams.length === 0) {
      teams = getOrganizationsWithStats('team')
        .filter((team: any) => team.parentOrgCode === divisionCode);
    }
    // Fallback 2: active 플래그 무시하고 하위 팀 조회
    if (teams.length === 0) {
      const stmt = db.prepare(`
        SELECT 
          org_code as orgCode,
          org_name as orgName,
          org_level as orgLevel,
          parent_org_code as parentOrgCode,
          display_order as displayOrder,
          is_active as isActive
        FROM organization_master
        WHERE parent_org_code = ? AND org_level = 'team'
        ORDER BY display_order, org_name
      `);
      teams = (stmt.all(divisionCode) as any[]).map(row => ({
        orgCode: row.orgCode,
        orgName: row.orgName,
        orgLevel: row.orgLevel,
        parentOrgCode: row.parentOrgCode,
        displayOrder: row.displayOrder,
        isActive: Boolean(row.isActive),
        childrenCount: 0,
        stats: undefined,
      }));
    }
    // Fallback 3: 이 division이 실무적으로 팀을 직접 거느리지 않고 센터 직속일 때
    if (teams.length === 0 && parentOrg?.parentOrgCode) {
      teams = getOrganizationsWithStats('team')
        .filter((team: any) => team.parentOrgCode === parentOrg.parentOrgCode);
    }

    // breadcrumb: 센터명 -> 담당명
    if (parentOrg && parentOrg.parentOrgCode) {
      const center = getOrganizationById(parentOrg.parentOrgCode);
      if (center) {
        breadcrumb.push({ label: center.orgName, href: `/division?center=${center.orgCode}` });
      }
    }
    if (parentOrg) {
      breadcrumb.push({ label: parentOrg.orgName, href: `/teams?division=${parentOrg.orgCode}` });
    }
  } else if (centerCode) {
    // Show divisions or teams under a specific center
    parentOrg = getOrganizationById(centerCode);
    const children = getChildOrganizations(centerCode);
    
    // Check if this center has divisions
    const divisions = children.filter((org: any) => org.orgLevel === 'division');
    // Always show both: 센터 직속 팀 + 담당 목록
    const centerTeams = getOrganizationsWithStats('team')
      .filter((team: any) => team.parentOrgCode === centerCode)
      .map((t: any) => ({ ...t, orgLevel: 'team' }));
    const centerDivisions = getOrganizationsWithStats('division')
      .filter((div: any) => div.parentOrgCode === centerCode)
      .map((d: any) => ({ ...d, orgLevel: 'division' }));
    teams = [...centerDivisions, ...centerTeams];

    // breadcrumb: 센터명
    if (parentOrg) {
      breadcrumb.push({ label: parentOrg.orgName, href: `/division?center=${parentOrg.orgCode}` });
    }
  } else {
    // Default: show all teams
    teams = getOrganizationsWithStats('team');
  }
  
  // Get aggregated team stats from database
  const teamStatsMap = getTeamStats(centerCode || undefined);
  
  // Merge stats with team info
  teams = teams.map((team: any) => {
    // division(담당)은 상단에서 산정한 30일 유니크 인원 등 기존 stats를 유지
    if (team.orgLevel === 'division') {
      return team;
    }
    const stats = teamStatsMap.get(team.orgCode);
    if (stats) {
      team.stats = { ...stats };
    } else {
      team.stats = {
        avgWorkEfficiency: team.stats?.avgWorkEfficiency || 0,
        avgActualWorkHours: team.stats?.avgActualWorkHours || 0,
        avgAttendanceHours: team.stats?.avgAttendanceHours || 0,
        totalEmployees: team.stats?.totalEmployees || 0
      };
    }
    return team;
  });

  // 보강: division(담당) 카드의 통계는 최신일 통계가 없어 0이 될 수 있으므로
  // 30일 구간의 실제 합계/Man-Day 기반으로 재계산하여 주입
  try {
    const { startDate, endDate } = get30DayDateRange();
    const divisionTeams = teams.filter((t: any) => t.orgLevel === 'division');
    divisionTeams.forEach((div: any) => {
      const row = db.prepare(
        `SELECT 
           COUNT(DISTINCT dar.employee_id) as unique_employees,
           COUNT(*) as man_days,
           SUM(dar.actual_work_hours) as sum_actual,
           SUM(dar.claimed_work_hours) as sum_claimed
         FROM daily_analysis_results dar
         JOIN employees e ON e.employee_id = dar.employee_id
         WHERE dar.analysis_date BETWEEN ? AND ?
           AND e.team_name IN (
             SELECT org_name FROM organization_master
             WHERE parent_org_code = ? AND org_level = 'team'
           )`
      ).get(startDate, endDate, div.orgCode) as any;

      const manDays = row?.man_days || 0;
      const sumActual = row?.sum_actual || 0;
      const sumClaimed = row?.sum_claimed || 0;
      const avgWorkHours = manDays > 0 ? Math.round((sumActual / manDays) * 10) / 10 : 0;
      const avgClaimedHours = manDays > 0 ? Math.round((sumClaimed / manDays) * 10) / 10 : 0;
      const avgEfficiency = sumClaimed > 0 ? Math.round((sumActual / sumClaimed) * 1000) / 10 : 0;

      div.stats = {
        ...(div.stats || {}),
        avgWorkEfficiency: avgEfficiency,
        avgActualWorkHours: avgWorkHours,
        avgAttendanceHours: avgClaimedHours,
        totalEmployees: div.stats?.totalEmployees || row?.unique_employees || 0
      };
    });
  } catch (e) {
    console.error('Failed to compute division stats:', e);
  }
  
  // Calculate totals and weighted averages based on real man-days (30일 누적)
  const { startDate, endDate } = get30DayDateRange();
  let totalEmployees = 0;
  let avgEfficiency = 0;
  let avgWorkHours = 0;
  let avgClaimedHours = 0;

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
        // No teams found; return zeros
        where += ' AND 1=0';
      }
    } else if (centerCode && parentOrg) {
      where += ' AND e.center_name = ?';
      params.push(parentOrg.orgName);
    }

    const row = db.prepare(
      `SELECT 
         COUNT(DISTINCT dar.employee_id) as unique_employees,
         COUNT(*) as man_days,
         SUM(dar.actual_work_hours) as sum_actual,
         SUM(dar.claimed_work_hours) as sum_claimed
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
  } catch (e) {
    console.error('Failed to compute weighted team summary:', e);
  }
  
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

  const payload = {
    teams,
    parentOrg,
    totalEmployees,
    avgEfficiency,
    avgWorkHours,
    avgClaimedHours,
    avgWeeklyWorkHours,
    avgWeeklyClaimedHours,
    thresholds,
    breadcrumb
  };
  setToCache(cacheKey, payload, 180_000);
  return new NextResponse(JSON.stringify(payload), { headers: buildCacheHeaders(false, 180) });
}