import { NextResponse } from 'next/server'
import { db } from '@/lib/database/connection'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { center, division, team, group } = body.organizationPath || {}
    
    console.log('Extract employees request:', { center, division, team, group })
    
    if (!center) {
      return NextResponse.json(
        { error: 'No organization selected' },
        { status: 400 }
      )
    }
    
    // Build dynamic query based on selected organization level
    let query = `
      SELECT DISTINCT
        사번 as employeeId,
        성명 as employeeName,
        센터 as center,
        팀 as team,
        그룹 as groupName,
        직급명 as position
      FROM organization_data
      WHERE 1=1
    `
    
    const params: any[] = []
    
    // Always filter by center if provided
    if (center) {
      query += ' AND 센터 = ?'
      params.push(center)
    }
    
    // Only add team filter if explicitly selected (not from previous selection)
    if (team && division !== undefined) {
      query += ' AND 팀 = ?'
      params.push(team)
    }
    
    // Only add group filter if explicitly selected
    if (group && team !== undefined) {
      query += ' AND 그룹 = ?'
      params.push(group)
    }
    
    query += ' ORDER BY 사번'
    
    const stmt = db.getDb().prepare(query)
    const employees = stmt.all(...params)
    
    console.log('Query:', query)
    console.log('Params:', params)
    console.log('Employee count:', employees.length)
    
    return NextResponse.json({
      employees,
      count: employees.length,
      filters: { center, division, team, group }
    })
  } catch (error) {
    console.error('Error extracting employees:', error)
    return NextResponse.json(
      { error: 'Failed to extract employees' },
      { status: 500 }
    )
  }
}