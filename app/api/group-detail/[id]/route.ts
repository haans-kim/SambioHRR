import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupCode } = await params;
  
  try {
    // Get group information
    const groupInfo = db.prepare(`
      WITH team_parent AS (
        SELECT 
          t.org_code AS team_code,
          t.org_name AS team_name,
          p.org_code AS parent_code,
          p.org_level AS parent_level,
          p.parent_org_code AS parent_parent_code
        FROM organization_master t
        LEFT JOIN organization_master p ON t.parent_org_code = p.org_code
      )
      SELECT 
        g.org_code as orgCode,
        g.org_name as orgName,
        tp.team_code as parentTeamCode,
        tp.team_name as parentTeam,
        CASE WHEN tp.parent_level = 'division' THEN tp.parent_code ELSE NULL END as parentDivisionCode,
        CASE WHEN tp.parent_level = 'division' THEN (
          SELECT org_name FROM organization_master WHERE org_code = tp.parent_code
        ) ELSE NULL END as parentDivision,
        CASE WHEN tp.parent_level = 'division' THEN tp.parent_parent_code ELSE tp.parent_code END as parentCenterCode,
        (
          SELECT org_name FROM organization_master 
          WHERE org_code = CASE WHEN tp.parent_level = 'division' THEN tp.parent_parent_code ELSE tp.parent_code END
        ) as parentCenter
      FROM organization_master g
      LEFT JOIN team_parent tp ON g.parent_org_code = tp.team_code
      WHERE g.org_code = ? AND g.org_level = 'group'
    `).get(groupCode) as any;
    
    if (!groupInfo) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    
    // Get date range for analysis period
    const dateRange = db.prepare(`
      SELECT 
        MIN(analysis_date) as start_date,
        MAX(analysis_date) as end_date 
      FROM daily_analysis_results
    `).get() as any;
    
    // Get employees in this group with aggregated data for entire period
    const employees = db.prepare(`
      SELECT 
        e.employee_id as employeeId,
        e.employee_name as name,
        e.center_name as centerName,
        e.team_name as teamName,
        e.group_name as groupName,
        e.job_grade as jobGrade,
        e.position as jobTitle,
        ROUND(SUM(dar.actual_work_hours * dar.efficiency_ratio) / SUM(dar.actual_work_hours), 1) as efficiencyRatio,
        ROUND(SUM(dar.actual_work_hours) / COUNT(dar.employee_id), 1) as actualWorkHours,
        ROUND(SUM(dar.claimed_work_hours) / COUNT(dar.employee_id), 1) as claimedWorkHours,
        SUM(dar.actual_work_hours) as totalActualHours,
        SUM(dar.claimed_work_hours) as totalClaimedHours,
        ROUND(AVG(dar.work_minutes), 0) as workMinutes,
        ROUND(AVG(dar.meeting_minutes), 0) as meetingMinutes,
        ROUND(AVG(dar.meal_minutes), 0) as mealMinutes,
        ROUND(AVG(dar.movement_minutes), 0) as movementMinutes,
        ROUND(AVG(dar.rest_minutes), 0) as restMinutes,
        ROUND(AVG(dar.confidence_score), 1) as confidenceScore,
        COUNT(dar.employee_id) as workDays,
        MAX(dar.analysis_date) as analysisDate
      FROM employees e
      INNER JOIN daily_analysis_results dar ON e.employee_id = dar.employee_id
      WHERE e.group_name = ?
      GROUP BY e.employee_id, e.employee_name, e.center_name, e.team_name, 
               e.group_name, e.job_grade, e.position
      ORDER BY e.employee_id
    `).all(groupInfo.orgName) as any[];
    
    // Calculate summary statistics using weighted average (total hours / total man-days)
    const analyzedEmployees = employees.filter(e => e.efficiencyRatio !== null);
    const totalActualHours = analyzedEmployees.reduce((sum, e) => sum + (e.totalActualHours || 0), 0);
    const totalClaimedHours = analyzedEmployees.reduce((sum, e) => sum + (e.totalClaimedHours || 0), 0);
    const totalManDays = analyzedEmployees.reduce((sum, e) => sum + (e.workDays || 0), 0);
    
    const summary = {
      totalEmployees: employees.length,
      avgEfficiency: totalActualHours > 0 
        ? Math.round((totalActualHours / totalClaimedHours) * 100 * 10) / 10
        : 0,
      avgWorkHours: totalManDays > 0
        ? Math.round((totalActualHours / totalManDays) * 10) / 10
        : 0,
      avgClaimedHours: totalManDays > 0
        ? Math.round((totalClaimedHours / totalManDays) * 10) / 10
        : 0,
      totalManDays: totalManDays
    };
    
    return NextResponse.json({
      group: groupInfo,
      employees: employees.map(e => ({
        ...e,
        efficiencyRatio: e.efficiencyRatio || 0,
        actualWorkHours: e.actualWorkHours || 0,
        claimedWorkHours: e.claimedWorkHours || 0,
        workMinutes: e.workMinutes || 0,
        meetingMinutes: e.meetingMinutes || 0,
        mealMinutes: e.mealMinutes || 0,
        movementMinutes: e.movementMinutes || 0,
        restMinutes: e.restMinutes || 0,
        confidenceScore: e.confidenceScore || 0
      })),
      summary,
      analysisDate: `${dateRange?.start_date} ~ ${dateRange?.end_date}` || null
    });
    
  } catch (error) {
    console.error('Error fetching group detail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group detail', details: String(error) },
      { status: 500 }
    );
  }
}