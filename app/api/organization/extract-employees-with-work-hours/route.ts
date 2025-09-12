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
    
    // 해당 기간에 실제근무시간이 0보다 큰 모든 직원들 추출
    const query = `
      SELECT DISTINCT
        c.사번 as employeeId,
        c.성명 as employeeName,
        o.센터 as center,
        o.팀 as team,
        o.그룹 as groupName,
        o.직급명 as position
      FROM claim_data c
      LEFT JOIN organization_data o ON c.사번 = o.사번
      WHERE date(c.근무일) >= date(?) 
        AND date(c.근무일) <= date(?)
        AND c.실제근무시간 > 0
        AND c.사번 IS NOT NULL
      ORDER BY c.사번
    `
    
    const stmt = db.getDb().prepare(query)
    const employees = stmt.all(startDate, endDate)
    
    console.log(`📊 Period: ${startDate} ~ ${endDate}`)
    console.log(`👥 Employees with work hours > 0: ${employees.length}`)
    console.log(`🎯 Sample employees:`, employees.slice(0, 3).map(e => `${e.employeeName}(${e.employeeId})`))
    
    return NextResponse.json({
      employees,
      count: employees.length,
      period: { startDate, endDate },
      criteria: 'work_hours > 0'
    })
  } catch (error) {
    console.error('❌ Error extracting employees with work hours:', error)
    return NextResponse.json(
      { 
        error: 'Failed to extract employees with work hours',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}