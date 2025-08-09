import db from '../client';
import type { Organization, OrganizationWithStats, OrgLevel } from '@/lib/types/organization';

// Helper function to get the latest date with data
function getLatestDataDate(): string {
  // Try daily_analysis_results first (actual employee data)
  let stmt = db.prepare(`
    SELECT MAX(analysis_date) as latestDate 
    FROM daily_analysis_results 
    WHERE analysis_date IS NOT NULL
  `);
  let result = stmt.get() as { latestDate: string } | undefined;
  
  if (result?.latestDate) {
    // Handle datetime format from database
    return result.latestDate.split(' ')[0];
  }
  
  // Fallback to organization_daily_stats
  stmt = db.prepare(`
    SELECT MAX(work_date) as latestDate 
    FROM organization_daily_stats 
    WHERE total_employees > 0
  `);
  result = stmt.get() as { latestDate: string } | undefined;
  
  if (result?.latestDate) {
    // Handle datetime format from database
    return result.latestDate.split(' ')[0];
  }
  
  return new Date().toISOString().split('T')[0];
}

// Get total employees across all organizations for a specific date
export function getTotalEmployees(date?: string): number {
  const workDate = date || getLatestDataDate();
  
  // Use daily_analysis_results table which has actual employee data
  const stmt = db.prepare(`
    SELECT COUNT(DISTINCT employee_id) as total 
    FROM daily_analysis_results 
    WHERE analysis_date = ?
  `);
  
  const result = stmt.get(workDate) as { total: number | null } | undefined;
  return result?.total || 0;
}

export function getOrganizationsByLevel(level: OrgLevel): Organization[] {
  const stmt = db.prepare(`
    SELECT 
      org_code as orgCode,
      org_name as orgName,
      org_level as orgLevel,
      parent_org_code as parentOrgCode,
      display_order as displayOrder,
      is_active as isActive
    FROM organization_master
    WHERE org_level = ? AND is_active = 1
      AND org_name != '경영진단팀'
      AND org_name != '대표이사'
    ORDER BY display_order, org_name
  `);
  
  return stmt.all(level) as Organization[];
}

export function getOrganizationById(orgCode: string): Organization | null {
  const stmt = db.prepare(`
    SELECT 
      org_code as orgCode,
      org_name as orgName,
      org_level as orgLevel,
      parent_org_code as parentOrgCode,
      display_order as displayOrder,
      is_active as isActive
    FROM organization_master
    WHERE org_code = ? AND is_active = 1
  `);
  
  return stmt.get(orgCode) as Organization | null;
}

export function getChildOrganizations(parentOrgCode: string): Organization[] {
  const stmt = db.prepare(`
    SELECT 
      org_code as orgCode,
      org_name as orgName,
      org_level as orgLevel,
      parent_org_code as parentOrgCode,
      display_order as displayOrder,
      is_active as isActive
    FROM organization_master
    WHERE parent_org_code = ? AND is_active = 1
    ORDER BY display_order, org_name
  `);
  
  return stmt.all(parentOrgCode) as Organization[];
}

export function getOrganizationsWithStats(level: OrgLevel, date?: string): OrganizationWithStats[] {
  // Use the latest date with data if no date is provided
  const workDate = date || getLatestDataDate();
  
  const stmt = db.prepare(`
    SELECT 
      o.org_code as orgCode,
      o.org_name as orgName,
      o.org_level as orgLevel,
      o.parent_org_code as parentOrgCode,
      o.display_order as displayOrder,
      o.is_active as isActive,
      s.avg_work_efficiency as avgWorkEfficiency,
      s.avg_actual_work_hours as avgActualWorkHours,
      s.avg_attendance_hours as avgAttendanceHours,
      s.total_employees as totalEmployees,
      (SELECT COUNT(*) FROM organization_master WHERE parent_org_code = o.org_code) as childrenCount
    FROM organization_master o
    LEFT JOIN organization_daily_stats s ON o.org_code = s.org_code AND s.work_date = ?
    WHERE o.org_level = ? AND o.is_active = 1
      AND o.org_name != '경영진단팀'
      AND o.org_name != '대표이사'
    ORDER BY o.display_order, o.org_name
  `);
  
  const results = stmt.all(workDate, level) as any[];
  
  return results.map(row => ({
    orgCode: row.orgCode,
    orgName: row.orgName,
    orgLevel: row.orgLevel,
    parentOrgCode: row.parentOrgCode,
    displayOrder: row.displayOrder,
    isActive: Boolean(row.isActive),
    childrenCount: row.childrenCount || 0,
    stats: row.avgWorkEfficiency ? {
      id: 0,
      orgCode: row.orgCode,
      workDate: new Date(workDate),
      avgWorkEfficiency: row.avgWorkEfficiency || 0,
      avgActualWorkHours: row.avgActualWorkHours || 0,
      avgAttendanceHours: row.avgAttendanceHours || 0,
      totalEmployees: row.totalEmployees || 0,
      flexibleWorkCount: 0,
      elasticWorkCount: 0,
      avgMeetingHours: 0,
      avgMealHours: 0,
      avgMovementHours: 0,
      avgRestHours: 0,
      avgDataConfidence: 0,
      stdActualWorkHours: 0,
      stdWorkEfficiency: 0,
      minWorkEfficiency: 0,
      maxWorkEfficiency: 0
    } : undefined
  }));
}