import { NextResponse } from 'next/server'
import { db } from '@/lib/database/connection'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { startDate, endDate } = body
    
    console.log('🔍 Extract employees with work hours request:', { startDate, endDate })
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }
    
    // Ground Rules 분석을 위해 master_events_table 기준으로 직원 추출
    // sambio_analytics.db (READ ONLY)에서 master_events_table 조회
    const path = require('path')
    const Database = require('better-sqlite3')
    const analyticsDbPath = path.join(process.cwd(), 'sambio_analytics.db')
    const humanDbPath = path.join(process.cwd(), 'sambio_human.db')

    const analyticsDb = new Database(analyticsDbPath, { readonly: true })

    try {
      // Attach sambio_human.db to access organization_data
      analyticsDb.exec(`ATTACH DATABASE '${humanDbPath}' AS human`)

      const query = `
        SELECT DISTINCT
          m.employee_id as employeeId,
          m.employee_name as employeeName,
          m.center_name as center,
          m.team_name as team,
          m.group_name as groupName,
          o.직급명 as position
        FROM master_events_table m
        LEFT JOIN human.organization_data o ON m.employee_id = o.사번
        WHERE m.date >= ?
          AND m.date <= ?
          AND m.employee_id IS NOT NULL
        ORDER BY m.employee_id
      `

      const stmt = analyticsDb.prepare(query)
      const employees = stmt.all(startDate, endDate)

      analyticsDb.close()
    
      console.log(`📊 Period: ${startDate} ~ ${endDate}`)
      console.log(`👥 Employees from master_events_table: ${employees.length}`)
      console.log(`🎯 Sample employees:`, employees.slice(0, 3).map(e => `${e.employeeName}(${e.employeeId})`))

      return NextResponse.json({
        employees,
        count: employees.length,
        period: { startDate, endDate },
        criteria: 'master_events_table existence'
      })
    } catch (innerError) {
      if (analyticsDb) {
        try { analyticsDb.close() } catch {}
      }
      throw innerError
    }
  } catch (error) {
    console.error('❌ Error extracting employees:', error)
    return NextResponse.json(
      {
        error: 'Failed to extract employees',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}