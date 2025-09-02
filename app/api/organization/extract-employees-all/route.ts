import { NextResponse } from 'next/server'
import { db } from '@/lib/database/connection'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { startDate, endDate } = body
    
    console.log('Extract all employees with non-zero claim hours:', { startDate, endDate })
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }
    
    // Query to get all employee-date combinations with non-zero claim hours
    const query = `
      SELECT 
        c.사번 as employeeId,
        c.성명 as employeeName,
        c.근무일 as workDate,
        o.센터 as center,
        o.팀 as team,
        o.그룹 as groupName,
        o.직급명 as position
      FROM claim_data c
      LEFT JOIN organization_data o ON c.사번 = o.사번
      WHERE c.근무일 BETWEEN ? AND ?
        AND CAST(c.근무시간 AS REAL) > 0
      ORDER BY c.사번, c.근무일
    `
    
    const stmt = db.getDb().prepare(query)
    const employees = stmt.all(startDate, endDate)
    
    console.log(`Found ${employees.length} employee-date records with non-zero claim hours`)
    
    // Group by employee-date for processing
    const employeeDateMap = new Map<string, any>()
    employees.forEach(emp => {
      const key = `${emp.employeeId}_${emp.workDate}`
      employeeDateMap.set(key, emp)
    })
    
    // Get additional stats
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT 사번) as uniqueEmployees,
        COUNT(*) as totalRecords,
        SUM(CAST(근무시간 AS REAL)) as totalHours
      FROM claim_data
      WHERE 근무일 BETWEEN ? AND ?
        AND CAST(근무시간 AS REAL) > 0
    `
    
    const statsStmt = db.getDb().prepare(statsQuery)
    const stats = statsStmt.get(startDate, endDate) as any
    
    return NextResponse.json({
      employeeDates: Array.from(employeeDateMap.values()),
      count: employeeDateMap.size,
      stats: {
        uniqueEmployees: stats.uniqueEmployees,
        totalRecords: stats.totalRecords,
        totalHours: stats.totalHours,
        dateRange: { startDate, endDate }
      }
    })
  } catch (error) {
    console.error('Error extracting all employees:', error)
    return NextResponse.json(
      { error: 'Failed to extract employees' },
      { status: 500 }
    )
  }
}