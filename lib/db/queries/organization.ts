import db from '../client';
import type { Organization, OrganizationWithStats, OrgLevel } from '@/lib/types/organization';

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
  const workDate = date || new Date().toISOString().split('T')[0];
  
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