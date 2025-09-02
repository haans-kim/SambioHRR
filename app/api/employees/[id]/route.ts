import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id
    
    // Get employee information from employees table
    const employee = db.prepare(`
      SELECT 
        employee_id,
        employee_name as name,
        center_name as center,
        group_name as department,
        team_name as team,
        grade as position
      FROM employees
      WHERE employee_id = ?
      LIMIT 1
    `).get(employeeId)
    
    if (!employee) {
      // Try to find in daily_analysis_results
      const analysisEmployee = db.prepare(`
        SELECT DISTINCT
          employee_id,
          employee_id as name,
          center_name as center,
          group_name as department,
          team_name as team,
          'N/A' as position
        FROM daily_analysis_results
        WHERE employee_id = ?
        LIMIT 1
      `).get(employeeId)
      
      if (!analysisEmployee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(analysisEmployee)
    }
    
    return NextResponse.json(employee)
  } catch (error) {
    console.error('Error fetching employee:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
      { status: 500 }
    )
  }
}