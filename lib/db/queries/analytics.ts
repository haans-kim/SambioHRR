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
  avgClaimedHours: number;
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
  avgClaimedHours: number;
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
      avg_claimed_hours as avgClaimedHours,
      avg_meeting_hours as avgMeetingHours,
      avg_meal_hours as avgMealHours
    FROM v_team_daily_summary
    WHERE analysis_date = ?
  `;
  
  const params: any[] = [analysisDate];
  
  if (centerId) {
    // Check if it's a center code or center name
    if (centerId.startsWith('CENTER_')) {
      query += ' AND center_id = ?';
    } else {
      query += ' AND center_name = ?';
    }
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
      avg_actual_work_hours as avgActualWorkHours,
      avg_claimed_hours as avgClaimedHours
    FROM v_group_daily_summary
    WHERE analysis_date = ?
  `;
  
  const params: any[] = [analysisDate];
  
  if (teamId) {
    // Check if it's a team code or team name
    if (teamId.startsWith('TEAM_')) {
      query += ' AND team_id = ?';
    } else {
      query += ' AND team_name = ?';
    }
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
      AND (e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문') OR e.center_name IS NULL)
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

// Get organization-wide weekly statistics for 30 days
export function getOrganizationWeeklyStats30Days() {
  const { startDate, endDate } = get30DayDateRange();
  
  const query = `
    SELECT 
      COUNT(DISTINCT emp_weekly.employee_id) as totalEmployees,
      ROUND(AVG(emp_weekly.avgEfficiency), 1) as avgEfficiencyRatio,
      ROUND(AVG(emp_weekly.weeklyWorkHours), 1) as avgWeeklyWorkHours,
      ROUND(AVG(emp_weekly.weeklyClaimedHours), 1) as avgWeeklyClaimedHours,
      ROUND(AVG(emp_weekly.avgConfidence), 1) as avgConfidenceScore
    FROM (
      SELECT 
        dar.employee_id,
        strftime('%W-%Y', dar.analysis_date) as week,
        AVG(dar.efficiency_ratio) as avgEfficiency,
        SUM(dar.actual_work_hours) as weeklyWorkHours,
        SUM(dar.claimed_work_hours) as weeklyClaimedHours,
        AVG(dar.confidence_score) as avgConfidence
      FROM daily_analysis_results dar
      LEFT JOIN employees e ON e.employee_id = dar.employee_id
      WHERE dar.analysis_date BETWEEN ? AND ?
        AND (e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문') OR e.center_name IS NULL)
      GROUP BY dar.employee_id, strftime('%W-%Y', dar.analysis_date)
    ) emp_weekly
  `;
  
  const stmt = db.prepare(query);
  return stmt.get(startDate, endDate) as {
    totalEmployees: number;
    avgEfficiencyRatio: number;
    avgWeeklyWorkHours: number;
    avgWeeklyClaimedHours: number;
    avgConfidenceScore: number;
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
      AND (e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문') OR e.center_name IS NULL)
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
      AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
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

// Get grade-level work hours matrix for 30 days
export function getGradeWorkHoursMatrix30Days() {
  const { startDate, endDate } = get30DayDateRange();
  
  const query = `
    SELECT 
      e.center_name as centerName,
      'Lv.' || e.job_grade as grade,
      COUNT(DISTINCT dar.employee_id) as employeeCount,
      ROUND(AVG(dar.actual_work_hours), 1) as avgWorkHours
    FROM daily_analysis_results dar
    JOIN employees e ON e.employee_id = dar.employee_id
    WHERE dar.analysis_date BETWEEN ? AND ?
      AND e.job_grade IS NOT NULL
      AND e.center_name IS NOT NULL
      AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
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
    matrix[row.grade][row.centerName] = row.avgWorkHours;
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
      AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
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

// Get grade-level weekly claimed hours matrix for 30 days
export function getGradeWeeklyClaimedHoursMatrix30Days() {
  const { startDate, endDate } = get30DayDateRange();
  
  const query = `
    SELECT 
      e.center_name as centerName,
      'Lv.' || e.job_grade as grade,
      COUNT(DISTINCT weekly_claimed.employee_id) as employeeCount,
      ROUND(AVG(weekly_claimed.weeklyTotal), 1) as avgWeeklyClaimedHours
    FROM (
      SELECT 
        employee_id,
        strftime('%W-%Y', analysis_date) as week,
        SUM(claimed_work_hours) as weeklyTotal
      FROM daily_analysis_results
      WHERE analysis_date BETWEEN ? AND ?
      GROUP BY employee_id, strftime('%W-%Y', analysis_date)
    ) weekly_claimed
    JOIN employees e ON e.employee_id = weekly_claimed.employee_id
    WHERE e.job_grade IS NOT NULL
      AND e.center_name IS NOT NULL
      AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
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
    matrix[row.grade][row.centerName] = row.avgWeeklyClaimedHours;
  });
  
  return {
    grades,
    centers: Array.from(centers),
    matrix
  };
}

// Get grade-level weekly work hours matrix for 30 days
export function getGradeWeeklyWorkHoursMatrix30Days() {
  const { startDate, endDate } = get30DayDateRange();
  
  const query = `
    SELECT 
      e.center_name as centerName,
      'Lv.' || e.job_grade as grade,
      COUNT(DISTINCT weekly_work.employee_id) as employeeCount,
      ROUND(AVG(weekly_work.weeklyTotal), 1) as avgWeeklyWorkHours
    FROM (
      SELECT 
        employee_id,
        strftime('%W-%Y', analysis_date) as week,
        SUM(actual_work_hours) as weeklyTotal
      FROM daily_analysis_results
      WHERE analysis_date BETWEEN ? AND ?
      GROUP BY employee_id, strftime('%W-%Y', analysis_date)
    ) weekly_work
    JOIN employees e ON e.employee_id = weekly_work.employee_id
    WHERE e.job_grade IS NOT NULL
      AND e.center_name IS NOT NULL
      AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
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
    matrix[row.grade][row.centerName] = row.avgWeeklyWorkHours;
  });
  
  return {
    grades,
    centers: Array.from(centers),
    matrix
  };
}

// Get grade-level claimed hours matrix for 30 days
export function getGradeClaimedHoursMatrix30Days() {
  const { startDate, endDate } = get30DayDateRange();
  
  const query = `
    SELECT 
      e.center_name as centerName,
      'Lv.' || e.job_grade as grade,
      COUNT(DISTINCT dar.employee_id) as employeeCount,
      ROUND(AVG(dar.claimed_work_hours), 1) as avgClaimedHours
    FROM daily_analysis_results dar
    JOIN employees e ON e.employee_id = dar.employee_id
    WHERE dar.analysis_date BETWEEN ? AND ?
      AND e.job_grade IS NOT NULL
      AND e.center_name IS NOT NULL
      AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
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
    matrix[row.grade][row.centerName] = row.avgClaimedHours;
  });
  
  return {
    grades,
    centers: Array.from(centers),
    matrix
  };
}

// Get metric thresholds based on grid matrix data (center-grade averages)
export function getMetricThresholdsForGrid(metricType: 'efficiency' | 'workHours' | 'claimedHours' | 'weeklyWorkHours' | 'weeklyClaimedHours') {
  const { startDate, endDate } = get30DayDateRange();
  
  let column = '';
  let isWeekly = false;
  switch (metricType) {
    case 'efficiency':
      column = 'efficiency_ratio';
      break;
    case 'workHours':
      column = 'actual_work_hours';
      break;
    case 'claimedHours':
      column = 'claimed_work_hours';
      break;
    case 'weeklyWorkHours':
      column = 'actual_work_hours';
      isWeekly = true;
      break;
    case 'weeklyClaimedHours':
      column = 'claimed_work_hours';
      isWeekly = true;
      break;
  }
  
  // Get center-grade averages (same as what's displayed in the grid)
  let dataQuery = '';
  if (isWeekly) {
    dataQuery = `
      SELECT 
        e.center_name as centerName,
        'Lv.' || e.job_grade as grade,
        ROUND(AVG(weekly_data.weeklyTotal), 1) as avgValue
      FROM (
        SELECT 
          employee_id,
          strftime('%W-%Y', analysis_date) as week,
          SUM(${column}) as weeklyTotal
        FROM daily_analysis_results
        WHERE analysis_date BETWEEN ? AND ?
          AND ${column} IS NOT NULL
        GROUP BY employee_id, strftime('%W-%Y', analysis_date)
      ) weekly_data
      JOIN employees e ON e.employee_id = weekly_data.employee_id
      WHERE e.job_grade IS NOT NULL
        AND e.center_name IS NOT NULL
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
      GROUP BY e.center_name, e.job_grade
      ORDER BY avgValue ASC
    `;
  } else {
    dataQuery = `
      SELECT 
        e.center_name as centerName,
        'Lv.' || e.job_grade as grade,
        ROUND(AVG(dar.${column}), 1) as avgValue
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      WHERE dar.analysis_date BETWEEN ? AND ?
        AND e.job_grade IS NOT NULL
        AND e.center_name IS NOT NULL
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND dar.${column} IS NOT NULL
      GROUP BY e.center_name, e.job_grade
      ORDER BY avgValue ASC
    `;
  }
  
  const stmt = db.prepare(dataQuery);
  const results = stmt.all(startDate, endDate) as { centerName: string; grade: string; avgValue: number }[];
  
  if (results.length === 0) {
    // Return default values if no data
    if (metricType === 'efficiency') {
      return {
        low: '≤73.2%',
        middle: '73.3-88.3%',
        high: '≥88.4%',
        thresholds: { low: 73.2, high: 88.4 }
      };
    } else if (metricType === 'workHours') {
      return {
        low: '<6.0h',
        middle: '6.0-7.9h',
        high: '≥8.0h',
        thresholds: { low: 6.0, high: 8.0 }
      };
    } else if (metricType === 'claimedHours') {
      return {
        low: '<7.0h',
        middle: '7.0-8.9h',
        high: '≥9.0h',
        thresholds: { low: 7.0, high: 9.0 }
      };
    } else if (metricType === 'weeklyWorkHours') {
      return {
        low: '<35.0h',
        middle: '35.0-44.9h',
        high: '≥45.0h',
        thresholds: { low: 35.0, high: 45.0 }
      };
    } else {
      // weeklyClaimedHours
      return {
        low: '<38.0h',
        middle: '38.0-47.9h',
        high: '≥48.0h',
        thresholds: { low: 38.0, high: 48.0 }
      };
    }
  }
  
  // Calculate percentiles from center-grade averages
  const values = results.map(r => r.avgValue).sort((a, b) => a - b);
  const p20Index = Math.floor(values.length * 0.2);
  const p80Index = Math.floor(values.length * 0.8);
  
  const percentile20 = Math.round(values[p20Index] * 10) / 10;
  const percentile80 = Math.round(values[p80Index] * 10) / 10;
  
  if (metricType === 'efficiency') {
    return {
      low: `≤${percentile20}%`,
      middle: `${(percentile20 + 0.1).toFixed(1)}-${percentile80.toFixed(1)}%`,
      high: `≥${(percentile80 + 0.1).toFixed(1)}%`,
      thresholds: {
        low: percentile20,
        high: percentile80
      }
    };
  } else if (metricType === 'weeklyWorkHours' || metricType === 'weeklyClaimedHours') {
    return {
      low: `<${percentile20}h`,
      middle: `${percentile20.toFixed(1)}-${percentile80.toFixed(1)}h`,
      high: `≥${percentile80}h`,
      thresholds: {
        low: percentile20,
        high: percentile80
      }
    };
  } else {
    return {
      low: `<${percentile20}h`,
      middle: `${percentile20.toFixed(1)}-${percentile80.toFixed(1)}h`,
      high: `≥${percentile80}h`,
      thresholds: {
        low: percentile20,
        high: percentile80
      }
    };
  }
}

// Get metric thresholds based on actual data percentiles
export function getMetricThresholds(metricType: 'efficiency' | 'workHours' | 'claimedHours') {
  const { startDate, endDate } = get30DayDateRange();
  
  let column = '';
  switch (metricType) {
    case 'efficiency':
      column = 'efficiency_ratio';
      break;
    case 'workHours':
      column = 'actual_work_hours';
      break;
    case 'claimedHours':
      column = 'claimed_work_hours';
      break;
  }
  
  // Get all values and calculate percentiles in JavaScript for now
  const dataQuery = `
    SELECT dar.${column} as value
    FROM daily_analysis_results dar
    JOIN employees e ON e.employee_id = dar.employee_id
    WHERE dar.analysis_date BETWEEN ? AND ?
      AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
      AND dar.${column} IS NOT NULL
    ORDER BY dar.${column} ASC
  `;
  
  const stmt = db.prepare(dataQuery);
  const results = stmt.all(startDate, endDate) as { value: number }[];
  
  if (results.length === 0) {
    // Return default values if no data
    if (metricType === 'efficiency') {
      return {
        low: '≤73.2%',
        middle: '73.3-88.3%',
        high: '≥88.4%',
        thresholds: { low: 73.2, high: 88.4 }
      };
    } else if (metricType === 'workHours') {
      return {
        low: '<6.0h',
        middle: '6.0-7.9h',
        high: '≥8.0h',
        thresholds: { low: 6.0, high: 8.0 }
      };
    } else {
      return {
        low: '<7.0h',
        middle: '7.0-8.9h',
        high: '≥9.0h',
        thresholds: { low: 7.0, high: 9.0 }
      };
    }
  }
  
  // Calculate percentiles
  const values = results.map(r => r.value).sort((a, b) => a - b);
  const p20Index = Math.floor(values.length * 0.2);
  const p80Index = Math.floor(values.length * 0.8);
  
  const percentile20 = Math.round(values[p20Index] * 10) / 10;
  const percentile80 = Math.round(values[p80Index] * 10) / 10;
  
  if (metricType === 'efficiency') {
    return {
      low: `≤${percentile20}%`,
      middle: `${(percentile20 + 0.1).toFixed(1)}-${percentile80.toFixed(1)}%`,
      high: `≥${(percentile80 + 0.1).toFixed(1)}%`,
      thresholds: {
        low: percentile20,
        high: percentile80
      }
    };
  } else if (metricType === 'weeklyWorkHours' || metricType === 'weeklyClaimedHours') {
    return {
      low: `<${percentile20}h`,
      middle: `${percentile20.toFixed(1)}-${percentile80.toFixed(1)}h`,
      high: `≥${percentile80}h`,
      thresholds: {
        low: percentile20,
        high: percentile80
      }
    };
  } else {
    return {
      low: `<${percentile20}h`,
      middle: `${percentile20.toFixed(1)}-${percentile80.toFixed(1)}h`,
      high: `≥${percentile80}h`,
      thresholds: {
        low: percentile20,
        high: percentile80
      }
    };
  }
}