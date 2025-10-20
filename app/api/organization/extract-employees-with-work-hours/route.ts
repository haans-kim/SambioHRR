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
    
    // 해당 기간에 근무시간이 0보다 큰 모든 직원들 추출
    // 근무일 컬럼은 정수(YYYYMMDD) 또는 텍스트('YYYY-MM-DD') 형식
    // 근무시간은 Excel에서 "HH:MM" 형식으로 업로드되어 decimal hours로 변환됨
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
      WHERE CAST(
              CASE
                WHEN typeof(c.근무일) = 'integer' THEN c.근무일
                WHEN typeof(c.근무일) = 'text' THEN CAST(substr(replace(c.근무일, '-', ''), 1, 8) AS INTEGER)
              END AS INTEGER
            ) >= CAST(replace(?, '-', '') AS INTEGER)
        AND CAST(
              CASE
                WHEN typeof(c.근무일) = 'integer' THEN c.근무일
                WHEN typeof(c.근무일) = 'text' THEN CAST(substr(replace(c.근무일, '-', ''), 1, 8) AS INTEGER)
              END AS INTEGER
            ) <= CAST(replace(?, '-', '') AS INTEGER)
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