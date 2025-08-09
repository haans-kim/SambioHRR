import db from '../client';

// Types for analytics data
export interface CenterSummary {
  centerId: string;
  centerName: string;
  analysisDate: string;
  analyzedEmployees: number;
  totalEmployees: number;
  coverageRate: number;
  avgEfficiencyRatio: number;
  avgActualWorkHours: number;
  avgClaimedHours: number;
  avgWorkHours: number;
  avgMeetingHours: number;
  avgMealHours: number;
  avgMovementHours: number;
  avgRestHours: number;
  efficiency90Plus: number;
  efficiency80To90: number;
  efficiency70To80: number;
  efficiencyBelow70: number;
  avgConfidenceScore: number;
}

export interface TeamSummary {
  teamId: string;
  teamName: string;
  centerId: string;
  centerName: string;
  analysisDate: string;
  analyzedEmployees: number;
  avgEfficiencyRatio: number;
  avgActualWorkHours: number;
  avgWorkHours: number;
  avgMeetingHours: number;
  avgMealHours: number;
}

export interface GroupSummary {
  groupId: string;
  groupName: string;
  teamId: string;
  teamName: string;
  analysisDate: string;
  analyzedEmployees: number;
  avgEfficiencyRatio: number;
  avgActualWorkHours: number;
}

export interface GradeDistribution {
  grade: string;
  employeeCount: number;
  avgEfficiencyRatio: number;
  avgActualWorkHours: number;
}

// Get the latest date with analysis data
export function getLatestAnalysisDate(): string {
  const stmt = db.prepare(`
    SELECT MAX(analysis_date) as latestDate 
    FROM daily_analysis_results 
    WHERE analysis_date IS NOT NULL
  `);
  const result = stmt.get() as { latestDate: string } | undefined;
  
  if (result?.latestDate) {
    return result.latestDate.split(' ')[0];
  }
  
  return new Date().toISOString().split('T')[0];
}

// Get 30-day date range for analysis
export function get30DayDateRange(): { startDate: string, endDate: string } {
  const stmt = db.prepare(`
    SELECT MIN(analysis_date) as startDate, MAX(analysis_date) as endDate
    FROM daily_analysis_results 
    WHERE analysis_date IS NOT NULL
  `);
  const result = stmt.get() as { startDate: string, endDate: string } | undefined;
  
  if (result?.startDate && result?.endDate) {
    return {
      startDate: result.startDate.split(' ')[0],
      endDate: result.endDate.split(' ')[0]
    };
  }
  
  // Fallback to last 30 days if no data found
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return { startDate, endDate };
}

// Get center-level summary
export function getCenterSummary(centerId?: string, date?: string): CenterSummary[] {
  const analysisDate = date || getLatestAnalysisDate();
  
  let query = `
    SELECT 
      center_id as centerId,
      center_name as centerName,
      analysis_date as analysisDate,
      analyzed_employees as analyzedEmployees,
      total_employees as totalEmployees,
      coverage_rate as coverageRate,
      avg_efficiency_ratio as avgEfficiencyRatio,
      avg_actual_work_hours as avgActualWorkHours,
      avg_claimed_hours as avgClaimedHours,
      avg_work_hours as avgWorkHours,
      avg_meeting_hours as avgMeetingHours,
      avg_meal_hours as avgMealHours,
      avg_movement_hours as avgMovementHours,
      avg_rest_hours as avgRestHours,
      efficiency_90_plus as efficiency90Plus,
      efficiency_80_90 as efficiency80To90,
      efficiency_70_80 as efficiency70To80,
      efficiency_below_70 as efficiencyBelow70,
      avg_confidence_score as avgConfidenceScore
    FROM v_center_daily_summary
    WHERE analysis_date = ?
  `;
  
  const params: any[] = [analysisDate];
  
  if (centerId) {
    query += ' AND center_id = ?';
    params.push(centerId);
  }
  
  query += ' ORDER BY center_name';
  
  const stmt = db.prepare(query);
  return stmt.all(...params) as CenterSummary[];
}

// Get team-level summary
export function getTeamSummary(centerId?: string, teamId?: string, date?: string): TeamSummary[] {
  const analysisDate = date || getLatestAnalysisDate();
  
  let query = `
    SELECT 
      team_id as teamId,
      team_name as teamName,
      center_id as centerId,
      center_name as centerName,
      analysis_date as analysisDate,
      analyzed_employees as analyzedEmployees,
      avg_efficiency_ratio as avgEfficiencyRatio,
      avg_actual_work_hours as avgActualWorkHours,
      avg_work_hours as avgWorkHours,
      avg_meeting_hours as avgMeetingHours,
      avg_meal_hours as avgMealHours
    FROM v_team_daily_summary
    WHERE analysis_date = ?
  `;
  
  const params: any[] = [analysisDate];
  
  if (centerId) {
    query += ' AND center_id = ?';
    params.push(centerId);
  }
  
  if (teamId) {
    query += ' AND team_id = ?';
    params.push(teamId);
  }
  
  query += ' ORDER BY center_name, team_name';
  
  const stmt = db.prepare(query);
  return stmt.all(...params) as TeamSummary[];
}

// Get group-level summary
export function getGroupSummary(teamId?: string, groupId?: string, date?: string): GroupSummary[] {
  const analysisDate = date || getLatestAnalysisDate();
  
  let query = `
    SELECT 
      group_id as groupId,
      group_name as groupName,
      team_id as teamId,
      team_name as teamName,
      analysis_date as analysisDate,
      analyzed_employees as analyzedEmployees,
      avg_efficiency_ratio as avgEfficiencyRatio,
      avg_actual_work_hours as avgActualWorkHours
    FROM v_group_daily_summary
    WHERE analysis_date = ?
  `;
  
  const params: any[] = [analysisDate];
  
  if (teamId) {
    query += ' AND team_id = ?';
    params.push(teamId);
  }
  
  if (groupId) {
    query += ' AND group_id = ?';
    params.push(groupId);
  }
  
  query += ' ORDER BY team_name, group_name';
  
  const stmt = db.prepare(query);
  return stmt.all(...params) as GroupSummary[];
}

// Get grade distribution for an organization level
export function getGradeDistribution(
  orgLevel: 'center' | 'team' | 'group',
  orgId: string,
  date?: string
): GradeDistribution[] {
  const analysisDate = date || getLatestAnalysisDate();
  
  let whereClause = '';
  switch (orgLevel) {
    case 'center':
      whereClause = 'center_id = ?';
      break;
    case 'team':
      whereClause = 'team_id = ?';
      break;
    case 'group':
      whereClause = 'group_id = ?';
      break;
  }
  
  const query = `
    SELECT 
      job_grade as grade,
      COUNT(DISTINCT employee_id) as employeeCount,
      ROUND(AVG(efficiency_ratio), 1) as avgEfficiencyRatio,
      ROUND(AVG(actual_work_hours), 1) as avgActualWorkHours
    FROM daily_analysis_results
    WHERE analysis_date = ? AND ${whereClause}
    GROUP BY job_grade
    ORDER BY job_grade
  `;
  
  const stmt = db.prepare(query);
  return stmt.all(analysisDate, orgId) as GradeDistribution[];
}

// Get organization-wide statistics
export function getOrganizationStats(date?: string) {
  const analysisDate = date || getLatestAnalysisDate();
  
  const query = `
    SELECT 
      COUNT(DISTINCT dar.employee_id) as totalEmployees,
      ROUND(AVG(dar.efficiency_ratio), 1) as avgEfficiencyRatio,
      ROUND(AVG(dar.actual_work_hours), 1) as avgActualWorkHours,
      ROUND(AVG(dar.claimed_work_hours), 1) as avgClaimedHours,
      ROUND(AVG(dar.confidence_score), 1) as avgConfidenceScore,
      SUM(CASE WHEN dar.efficiency_ratio >= 90 THEN 1 ELSE 0 END) as efficiency90Plus,
      SUM(CASE WHEN dar.efficiency_ratio >= 80 AND dar.efficiency_ratio < 90 THEN 1 ELSE 0 END) as efficiency80To90,
      SUM(CASE WHEN dar.efficiency_ratio >= 70 AND dar.efficiency_ratio < 80 THEN 1 ELSE 0 END) as efficiency70To80,
      SUM(CASE WHEN dar.efficiency_ratio < 70 THEN 1 ELSE 0 END) as efficiencyBelow70
    FROM daily_analysis_results dar
    LEFT JOIN employees e ON e.employee_id = dar.employee_id
    WHERE dar.analysis_date = ?
      AND (e.center_name NOT IN ('경영진단팀', '대표이사') OR e.center_name IS NULL)
  `;
  
  const stmt = db.prepare(query);
  return stmt.get(analysisDate) as {
    totalEmployees: number;
    avgEfficiencyRatio: number;
    avgActualWorkHours: number;
    avgClaimedHours: number;
    avgConfidenceScore: number;
    efficiency90Plus: number;
    efficiency80To90: number;
    efficiency70To80: number;
    efficiencyBelow70: number;
  };
}

// Get organization-wide statistics for 30 days
export function getOrganizationStats30Days() {
  const { startDate, endDate } = get30DayDateRange();
  
  const query = `
    SELECT 
      COUNT(DISTINCT dar.employee_id) as totalEmployees,
      ROUND(AVG(dar.efficiency_ratio), 1) as avgEfficiencyRatio,
      ROUND(AVG(dar.actual_work_hours), 1) as avgActualWorkHours,
      ROUND(AVG(dar.claimed_work_hours), 1) as avgClaimedHours,
      ROUND(AVG(dar.confidence_score), 1) as avgConfidenceScore,
      SUM(CASE WHEN dar.efficiency_ratio >= 90 THEN 1 ELSE 0 END) as efficiency90Plus,
      SUM(CASE WHEN dar.efficiency_ratio >= 80 AND dar.efficiency_ratio < 90 THEN 1 ELSE 0 END) as efficiency80To90,
      SUM(CASE WHEN dar.efficiency_ratio >= 70 AND dar.efficiency_ratio < 80 THEN 1 ELSE 0 END) as efficiency70To80,
      SUM(CASE WHEN dar.efficiency_ratio < 70 THEN 1 ELSE 0 END) as efficiencyBelow70
    FROM daily_analysis_results dar
    LEFT JOIN employees e ON e.employee_id = dar.employee_id
    WHERE dar.analysis_date BETWEEN ? AND ?
      AND (e.center_name NOT IN ('경영진단팀', '대표이사') OR e.center_name IS NULL)
  `;
  
  const stmt = db.prepare(query);
  return stmt.get(startDate, endDate) as {
    totalEmployees: number;
    avgEfficiencyRatio: number;
    avgActualWorkHours: number;
    avgClaimedHours: number;
    avgConfidenceScore: number;
    efficiency90Plus: number;
    efficiency80To90: number;
    efficiency70To80: number;
    efficiencyBelow70: number;
  };
}

// Get grade-level efficiency matrix for the dashboard grid
export function getGradeEfficiencyMatrix(date?: string) {
  const analysisDate = date || getLatestAnalysisDate();
  
  const query = `
    SELECT 
      e.center_name as centerName,
      'Lv.' || e.job_grade as grade,
      COUNT(DISTINCT dar.employee_id) as employeeCount,
      ROUND(AVG(dar.efficiency_ratio), 1) as avgEfficiency
    FROM daily_analysis_results dar
    JOIN employees e ON e.employee_id = dar.employee_id
    WHERE dar.analysis_date = ? 
      AND e.job_grade IS NOT NULL
      AND e.center_name IS NOT NULL
      AND e.center_name != '경영진단팀'
      AND e.center_name != '대표이사'
    GROUP BY e.center_name, e.job_grade
    ORDER BY e.center_name, e.job_grade
  `;
  
  const stmt = db.prepare(query);
  const results = stmt.all(analysisDate) as any[];
  
  // Transform to matrix format
  const matrix: Record<string, Record<string, number>> = {};
  const centers: Set<string> = new Set();
  const grades = ['Lv.4', 'Lv.3', 'Lv.2', 'Lv.1'];
  
  // Initialize matrix
  results.forEach(row => {
    centers.add(row.centerName);
    if (!matrix[row.grade]) {
      matrix[row.grade] = {};
    }
    matrix[row.grade][row.centerName] = row.avgEfficiency;
  });
  
  return {
    grades,
    centers: Array.from(centers),
    matrix
  };
}

// Get grade-level efficiency matrix for 30 days
export function getGradeEfficiencyMatrix30Days() {
  const { startDate, endDate } = get30DayDateRange();
  
  const query = `
    SELECT 
      e.center_name as centerName,
      'Lv.' || e.job_grade as grade,
      COUNT(DISTINCT dar.employee_id) as employeeCount,
      ROUND(AVG(dar.efficiency_ratio), 1) as avgEfficiency
    FROM daily_analysis_results dar
    JOIN employees e ON e.employee_id = dar.employee_id
    WHERE dar.analysis_date BETWEEN ? AND ?
      AND e.job_grade IS NOT NULL
      AND e.center_name IS NOT NULL
      AND e.center_name NOT IN ('경영진단팀', '대표이사')
    GROUP BY e.center_name, e.job_grade
    ORDER BY e.center_name, e.job_grade
  `;
  
  const stmt = db.prepare(query);
  const results = stmt.all(startDate, endDate) as any[];
  
  // Transform to matrix format
  const matrix: Record<string, Record<string, number>> = {};
  const centers: Set<string> = new Set();
  const grades = ['Lv.4', 'Lv.3', 'Lv.2', 'Lv.1'];
  
  // Initialize matrix
  results.forEach(row => {
    centers.add(row.centerName);
    if (!matrix[row.grade]) {
      matrix[row.grade] = {};
    }
    matrix[row.grade][row.centerName] = row.avgEfficiency;
  });
  
  return {
    grades,
    centers: Array.from(centers),
    matrix
  };
}