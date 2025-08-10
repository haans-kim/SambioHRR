import db from '../client';
import { getTeamSummary, getGroupSummary, getLatestAnalysisDate } from './analytics';

interface TeamStats {
  orgCode: string;
  avgWorkEfficiency: number;
  avgActualWorkHours: number;
  avgAttendanceHours: number;
  avgWeeklyWorkHours: number;
  avgWeeklyClaimedHours: number;
  totalEmployees: number;
}

// Get aggregated stats for teams under a center
export function getTeamStats(centerCode?: string): Map<string, TeamStats> {
  const statsMap = new Map<string, TeamStats>();
  
  try {
    // Get the latest analysis date
    const latestDate = getLatestAnalysisDate();
    
    // Convert centerCode to centerName if needed
    let centerFilter = centerCode;
    if (centerCode && centerCode.startsWith('CENTER_')) {
      const centerInfo = db.prepare(`
        SELECT org_name FROM organization_master 
        WHERE org_code = ? AND org_level = 'center'
      `).get(centerCode) as any;
      
      if (centerInfo) {
        // Use the center name for filtering in the view
        centerFilter = centerInfo.org_name;
      }
    }
    
    // Get team summaries using the view (same as center analysis)
    const teamSummaries = getTeamSummary(centerFilter, undefined, latestDate);
    
    // Get organization_master mapping for proper org_code
    const orgMapping = db.prepare(`
      SELECT org_code, org_name 
      FROM organization_master 
      WHERE org_level = 'team'
    `).all() as any[];
    
    const nameToCodeMap = new Map<string, string>();
    orgMapping.forEach(org => {
      nameToCodeMap.set(org.org_name, org.org_code);
    });
    
    // Get weekly data from database
    const weeklyData = db.prepare(`
      SELECT 
        e.team_name,
        AVG(weekly_totals.weekly_work_hours) as avg_weekly_work_hours,
        AVG(weekly_totals.weekly_claimed_hours) as avg_weekly_claimed_hours
      FROM (
        SELECT 
          dar.employee_id,
          strftime('%W-%Y', dar.analysis_date) as week,
          SUM(dar.actual_work_hours) as weekly_work_hours,
          SUM(dar.claimed_work_hours) as weekly_claimed_hours
        FROM daily_analysis_results dar
        WHERE dar.analysis_date >= (SELECT date(MAX(analysis_date), '-30 days') FROM daily_analysis_results)
        GROUP BY dar.employee_id, strftime('%W-%Y', dar.analysis_date)
      ) weekly_totals
      JOIN employees e ON e.employee_id = weekly_totals.employee_id
      ${centerFilter ? "WHERE e.center_name = ?" : ""}
      GROUP BY e.team_name
    `).all(centerFilter ? centerFilter : undefined) as any[];
    
    const weeklyDataMap = new Map<string, { avgWeeklyWorkHours: number; avgWeeklyClaimedHours: number }>();
    weeklyData.forEach(row => {
      weeklyDataMap.set(row.team_name, {
        avgWeeklyWorkHours: row.avg_weekly_work_hours || 0,
        avgWeeklyClaimedHours: row.avg_weekly_claimed_hours || 0
      });
    });
    
    // 30일 유니크 인원으로 totalEmployees 재계산 (팀)
    const teamUniqueRows = db.prepare(`
      SELECT e.team_name as name, COUNT(DISTINCT dar.employee_id) as cnt
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      WHERE dar.analysis_date >= (SELECT date(MAX(analysis_date), '-30 days') FROM daily_analysis_results)
      GROUP BY e.team_name
    `).all() as any[];
    const teamUnique = new Map<string, number>();
    teamUniqueRows.forEach(r => teamUnique.set(r.name, r.cnt || 0));

    // Convert to TeamStats format
    teamSummaries.forEach(summary => {
      // Use org_code from organization_master if available, otherwise use teamId
      const orgCode = nameToCodeMap.get(summary.teamName) || summary.teamId;
      const weeklyStats = weeklyDataMap.get(summary.teamName);
      
      statsMap.set(orgCode, {
        orgCode: orgCode,
        avgWorkEfficiency: summary.avgEfficiencyRatio || 0,
        avgActualWorkHours: summary.avgActualWorkHours || 0,
        avgAttendanceHours: summary.avgWorkHours || 0,  // Using avgWorkHours as attendance hours
        avgWeeklyWorkHours: weeklyStats?.avgWeeklyWorkHours || (summary.avgActualWorkHours * 5) || 0,
        avgWeeklyClaimedHours: weeklyStats?.avgWeeklyClaimedHours || (summary.avgWorkHours * 5) || 0,
        totalEmployees: teamUnique.get(summary.teamName) || summary.analyzedEmployees || 0
      });
    });
    
  } catch (error) {
    console.error('Error getting team stats:', error);
  }
  
  return statsMap;
}

// Get aggregated stats for groups under a team
export function getGroupStats(teamCode?: string): Map<string, TeamStats> {
  const statsMap = new Map<string, TeamStats>();
  
  try {
    // Get the latest analysis date
    const latestDate = getLatestAnalysisDate();
    
    // Convert teamCode to teamName if needed
    let teamFilter = teamCode;
    if (teamCode && teamCode.startsWith('TEAM_')) {
      const teamInfo = db.prepare(`
        SELECT org_name FROM organization_master 
        WHERE org_code = ? AND org_level = 'team'
      `).get(teamCode) as any;
      
      if (teamInfo) {
        // Use the team name for filtering in the view
        teamFilter = teamInfo.org_name;
      }
    }
    
    // Get group summaries for entire period instead of just latest date
    const groupSummaries = db.prepare(`
      SELECT 
        e.group_name as groupName,
        COUNT(DISTINCT dar.employee_id) as analyzedEmployees,
        ROUND(SUM(dar.actual_work_hours) / SUM(dar.claimed_work_hours) * 100, 1) as avgEfficiencyRatio,
        ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgActualWorkHours
      FROM daily_analysis_results dar
      JOIN employees e ON dar.employee_id = e.employee_id
      ${teamFilter ? "WHERE e.team_name = ?" : ""}
      GROUP BY e.group_name
    `).all(teamFilter ? teamFilter : undefined) as any[];
    
    // Get organization_master mapping for proper org_code
    const orgMapping = db.prepare(`
      SELECT org_code, org_name 
      FROM organization_master 
      WHERE org_level = 'group'
    `).all() as any[];
    
    const nameToCodeMap = new Map<string, string>();
    orgMapping.forEach(org => {
      nameToCodeMap.set(org.org_name, org.org_code);
    });
    
    // Get weekly data from database
    const weeklyData = db.prepare(`
      SELECT 
        e.group_name,
        AVG(weekly_totals.weekly_work_hours) as avg_weekly_work_hours,
        AVG(weekly_totals.weekly_claimed_hours) as avg_weekly_claimed_hours
      FROM (
        SELECT 
          dar.employee_id,
          strftime('%W-%Y', dar.analysis_date) as week,
          SUM(dar.actual_work_hours) as weekly_work_hours,
          SUM(dar.claimed_work_hours) as weekly_claimed_hours
        FROM daily_analysis_results dar
        WHERE dar.analysis_date >= (SELECT date(MAX(analysis_date), '-30 days') FROM daily_analysis_results)
        GROUP BY dar.employee_id, strftime('%W-%Y', dar.analysis_date)
      ) weekly_totals
      JOIN employees e ON e.employee_id = weekly_totals.employee_id
      ${teamFilter ? "WHERE e.team_name = ?" : ""}
      GROUP BY e.group_name
    `).all(teamFilter ? teamFilter : undefined) as any[];
    
    const weeklyDataMap = new Map<string, { avgWeeklyWorkHours: number; avgWeeklyClaimedHours: number }>();
    weeklyData.forEach(row => {
      weeklyDataMap.set(row.group_name, {
        avgWeeklyWorkHours: row.avg_weekly_work_hours || 0,
        avgWeeklyClaimedHours: row.avg_weekly_claimed_hours || 0
      });
    });
    
    // 30일 유니크 인원으로 totalEmployees 재계산 (그룹)
    const groupUniqueRows = db.prepare(`
      SELECT e.group_name as name, COUNT(DISTINCT dar.employee_id) as cnt
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      WHERE dar.analysis_date >= (SELECT date(MAX(analysis_date), '-30 days') FROM daily_analysis_results)
      GROUP BY e.group_name
    `).all() as any[];
    const groupUnique = new Map<string, number>();
    groupUniqueRows.forEach(r => groupUnique.set(r.name, r.cnt || 0));

    // Convert to TeamStats format
    groupSummaries.forEach(summary => {
      // Use org_code from organization_master if available, otherwise use groupId
      const orgCode = nameToCodeMap.get(summary.groupName) || summary.groupId;
      const weeklyStats = weeklyDataMap.get(summary.groupName);
      
      statsMap.set(orgCode, {
        orgCode: orgCode,
        avgWorkEfficiency: summary.avgEfficiencyRatio || 0,
        avgActualWorkHours: summary.avgActualWorkHours || 0,
        avgAttendanceHours: summary.avgActualWorkHours || 0,  // Using actual work hours as attendance hours for now
        avgWeeklyWorkHours: weeklyStats?.avgWeeklyWorkHours || (summary.avgActualWorkHours * 5) || 0,
        avgWeeklyClaimedHours: weeklyStats?.avgWeeklyClaimedHours || (summary.avgActualWorkHours * 5) || 0,
        totalEmployees: groupUnique.get(summary.groupName) || summary.analyzedEmployees || 0
      });
    });
    
  } catch (error) {
    console.error('Error getting group stats:', error);
  }
  
  return statsMap;
}