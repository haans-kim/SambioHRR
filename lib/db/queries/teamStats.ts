import db from '../client';
import { getLatestAnalysisDate } from './analytics';
import { calculateAdjustedWorkHours, FLEXIBLE_WORK_ADJUSTMENT_FACTOR } from '@/lib/utils';

interface TeamStats {
  orgCode: string;
  avgWorkEfficiency: number;
  avgActualWorkHours: number;
  avgAttendanceHours: number;
  avgWeeklyWorkHours: number;
  avgWeeklyClaimedHours: number;
  avgFocusedWorkHours: number;
  avgDataReliability: number;
  totalEmployees: number;
  centerName?: string;
  avgAdjustedWeeklyWorkHours?: number;
  flexibleWorkCount?: number;
  avgWeeklyWorkHoursAdjusted?: number;
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
    
    // Get team summaries for 30-day period
    const teamSummaries = db.prepare(`
      WITH flexible_workers AS (
        SELECT DISTINCT CAST(사번 AS TEXT) as employee_id
        FROM claim_data
        WHERE WORKSCHDTYPNM = '탄력근무제'
      )
      SELECT 
        e.team_name as teamName,
        COUNT(DISTINCT dar.employee_id) as analyzedEmployees,
        COUNT(DISTINCT fw.employee_id) as flexibleWorkCount,
        ROUND(
          SUM(
            dar.actual_work_hours * 
            (0.92 + (1.0 / (1.0 + EXP(-12.0 * (dar.confidence_score / 100.0 - 0.65))) * 0.08))
          ) / SUM(dar.claimed_work_hours) * 100, 
          1
        ) as avgEfficiencyRatio,
        -- 원본 값
        ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgActualWorkHours,
        ROUND(SUM(dar.claimed_work_hours) / COUNT(*), 1) as avgClaimedHours,
        -- 탄력근무제 보정 적용 값
        ROUND(
          SUM(CASE 
            WHEN fw.employee_id IS NOT NULL THEN dar.actual_work_hours * ${FLEXIBLE_WORK_ADJUSTMENT_FACTOR}
            ELSE dar.actual_work_hours
          END) / COUNT(*), 1
        ) as avgActualWorkHoursAdjusted,
        ROUND(
          SUM(CASE 
            WHEN fw.employee_id IS NOT NULL THEN dar.claimed_work_hours * ${FLEXIBLE_WORK_ADJUSTMENT_FACTOR}
            ELSE dar.claimed_work_hours
          END) / COUNT(*), 1
        ) as avgClaimedHoursAdjusted,
        ROUND(
          (SUM(CASE 
            WHEN fw.employee_id IS NOT NULL THEN dar.actual_work_hours * ${FLEXIBLE_WORK_ADJUSTMENT_FACTOR}
            ELSE dar.actual_work_hours
          END) / COUNT(*)) * 5, 1
        ) as avgWeeklyWorkHoursAdjusted,
        ROUND(AVG(dar.focused_work_minutes / 60.0), 1) as avgFocusedHours,
        ROUND(AVG(dar.confidence_score), 1) as avgConfidenceScore
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      LEFT JOIN flexible_workers fw ON fw.employee_id = dar.employee_id
      WHERE dar.analysis_date >= (SELECT date(MAX(analysis_date), '-30 days') FROM daily_analysis_results)
      ${centerFilter ? "AND e.center_name = ?" : ""}
        AND dar.actual_work_hours IS NOT NULL
        AND dar.claimed_work_hours IS NOT NULL
        AND dar.confidence_score IS NOT NULL
      GROUP BY e.team_name
    `).all(...(centerFilter ? [centerFilter] : [])) as any[];
    
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
      
      // 탄력근무제 보정된 값 사용
      const weeklyWorkHours = summary.avgWeeklyWorkHoursAdjusted || (summary.avgActualWorkHours * 5) || 0;
      const weeklyClaimedHours = (summary.avgClaimedHoursAdjusted * 5) || (summary.avgClaimedHours * 5) || 0;
      const dataReliability = summary.avgConfidenceScore || 0;
      
      statsMap.set(orgCode, {
        orgCode: orgCode,
        avgWorkEfficiency: summary.avgEfficiencyRatio || 0,
        avgActualWorkHours: summary.avgActualWorkHoursAdjusted || summary.avgActualWorkHours || 0,
        avgAttendanceHours: summary.avgClaimedHoursAdjusted || summary.avgClaimedHours || 0,
        avgWeeklyWorkHours: weeklyWorkHours,
        avgWeeklyClaimedHours: weeklyClaimedHours,
        avgFocusedWorkHours: summary.avgFocusedHours || 0,
        avgDataReliability: dataReliability,
        totalEmployees: teamUnique.get(summary.teamName) || summary.analyzedEmployees || 0,
        flexibleWorkCount: summary.flexibleWorkCount || 0,
        avgWeeklyWorkHoursAdjusted: weeklyWorkHours,
        avgAdjustedWeeklyWorkHours: dataReliability 
          ? calculateAdjustedWorkHours(weeklyWorkHours, dataReliability)
          : 0
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
    
    // Get group summaries for 30-day period
    const groupSummaries = db.prepare(`
      WITH flexible_workers AS (
        SELECT DISTINCT CAST(사번 AS TEXT) as employee_id
        FROM claim_data
        WHERE WORKSCHDTYPNM = '탄력근무제'
      )
      SELECT 
        e.group_name as groupName,
        e.center_name as centerName,
        COUNT(DISTINCT dar.employee_id) as analyzedEmployees,
        COUNT(DISTINCT fw.employee_id) as flexibleWorkCount,
        ROUND(
          SUM(
            dar.actual_work_hours * 
            (0.92 + (1.0 / (1.0 + EXP(-12.0 * (dar.confidence_score / 100.0 - 0.65))) * 0.08))
          ) / SUM(dar.claimed_work_hours) * 100, 
          1
        ) as avgEfficiencyRatio,
        -- 원본 값
        ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgActualWorkHours,
        ROUND(SUM(dar.claimed_work_hours) / COUNT(*), 1) as avgClaimedHours,
        -- 탄력근무제 보정 적용 값
        ROUND(
          SUM(CASE 
            WHEN fw.employee_id IS NOT NULL THEN dar.actual_work_hours * ${FLEXIBLE_WORK_ADJUSTMENT_FACTOR}
            ELSE dar.actual_work_hours
          END) / COUNT(*), 1
        ) as avgActualWorkHoursAdjusted,
        ROUND(
          SUM(CASE 
            WHEN fw.employee_id IS NOT NULL THEN dar.claimed_work_hours * ${FLEXIBLE_WORK_ADJUSTMENT_FACTOR}
            ELSE dar.claimed_work_hours
          END) / COUNT(*), 1
        ) as avgClaimedHoursAdjusted,
        ROUND(
          (SUM(CASE 
            WHEN fw.employee_id IS NOT NULL THEN dar.actual_work_hours * ${FLEXIBLE_WORK_ADJUSTMENT_FACTOR}
            ELSE dar.actual_work_hours
          END) / COUNT(*)) * 5, 1
        ) as avgWeeklyWorkHoursAdjusted,
        ROUND(AVG(dar.focused_work_minutes / 60.0), 1) as avgFocusedHours,
        ROUND(AVG(dar.confidence_score), 1) as avgConfidenceScore
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      LEFT JOIN flexible_workers fw ON fw.employee_id = dar.employee_id
      WHERE dar.analysis_date >= (SELECT date(MAX(analysis_date), '-30 days') FROM daily_analysis_results)
      ${teamFilter ? "AND e.team_name = ?" : ""}
        AND dar.actual_work_hours IS NOT NULL
        AND dar.claimed_work_hours IS NOT NULL
        AND dar.confidence_score IS NOT NULL
      GROUP BY e.group_name, e.center_name
    `).all(...(teamFilter ? [teamFilter] : [])) as any[];
    
    // Get organization_master mapping for proper org_code
    // If teamCode is provided, only get groups under that team
    let orgMapping: any[];
    if (teamCode && teamCode.startsWith('TEAM_')) {
      orgMapping = db.prepare(`
        SELECT org_code, org_name 
        FROM organization_master 
        WHERE org_level = 'group' AND parent_org_code = ?
      `).all(teamCode) as any[];
    } else {
      orgMapping = db.prepare(`
        SELECT org_code, org_name 
        FROM organization_master 
        WHERE org_level = 'group'
      `).all() as any[];
    }
    
    const nameToCodeMap = new Map<string, string>();
    orgMapping.forEach(org => {
      nameToCodeMap.set(org.org_name, org.org_code);
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
      // Use org_code from organization_master if available
      const orgCode = nameToCodeMap.get(summary.groupName);
      if (!orgCode) {
        console.log(`Warning: No org_code found for group: ${summary.groupName}`);
        return; // Skip this group if no org_code found
      }
      
      // 탄력근무제 보정된 값 사용
      const weeklyWorkHours = summary.avgWeeklyWorkHoursAdjusted || (summary.avgActualWorkHours * 5) || 0;
      const weeklyClaimedHours = (summary.avgClaimedHoursAdjusted * 5) || (summary.avgClaimedHours * 5) || 0;
      const dataReliability = summary.avgConfidenceScore || 0;
      
      statsMap.set(orgCode, {
        orgCode: orgCode,
        avgWorkEfficiency: summary.avgEfficiencyRatio || 0,
        avgActualWorkHours: summary.avgActualWorkHoursAdjusted || summary.avgActualWorkHours || 0,
        avgAttendanceHours: summary.avgClaimedHoursAdjusted || summary.avgClaimedHours || 0,
        avgWeeklyWorkHours: weeklyWorkHours,
        avgWeeklyClaimedHours: weeklyClaimedHours,
        avgFocusedWorkHours: summary.avgFocusedHours || 0,
        avgDataReliability: dataReliability,
        totalEmployees: groupUnique.get(summary.groupName) || summary.analyzedEmployees || 0,
        centerName: summary.centerName || null,
        flexibleWorkCount: summary.flexibleWorkCount || 0,
        avgWeeklyWorkHoursAdjusted: weeklyWorkHours,
        avgAdjustedWeeklyWorkHours: dataReliability 
          ? calculateAdjustedWorkHours(weeklyWorkHours, dataReliability)
          : 0
      });
    });
    
  } catch (error) {
    console.error('Error getting group stats:', error);
  }
  
  return statsMap;
}