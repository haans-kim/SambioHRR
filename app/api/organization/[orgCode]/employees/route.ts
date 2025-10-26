import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgCode: string }> }
) {
  try {
    const { orgCode } = await params

    // 먼저 orgCode로 조직 정보 조회
    const orgInfo = db.prepare(`
      SELECT org_name, org_level
      FROM organization_master
      WHERE org_code = ?
    `).get(orgCode) as { org_name: string; org_level: string } | undefined

    if (!orgInfo) {
      return NextResponse.json({ employees: [] })
    }

    // 조직 레벨에 따라 적절한 컬럼으로 직원 조회
    // division의 경우 employees 테이블에 division 컬럼이 없으므로
    // 해당 division 하위의 team들을 찾아서 조회
    let query = ''
    let queryParams: any[] = []

    if (orgInfo.org_level === 'division') {
      // Division의 하위 team들의 이름을 가져와서 조회
      query = `
        SELECT
          employee_id,
          employee_name as name,
          position,
          center_name as department
        FROM employees
        WHERE team_name IN (
          SELECT org_name
          FROM organization_master
          WHERE parent_org_code = ? AND org_level = 'team'
        )
        ORDER BY employee_name
      `
      queryParams = [orgCode]
    } else {
      let whereClause = ''
      switch (orgInfo.org_level) {
        case 'center':
          whereClause = 'center_name = ?'
          break
        case 'team':
          whereClause = 'team_name = ?'
          break
        case 'group':
          whereClause = 'group_name = ?'
          break
        default:
          return NextResponse.json({ employees: [] })
      }

      query = `
        SELECT
          employee_id,
          employee_name as name,
          position,
          center_name as department
        FROM employees
        WHERE ${whereClause}
        ORDER BY employee_name
      `
      queryParams = [orgInfo.org_name]
    }

    const employees = db.prepare(query).all(...queryParams)

    return NextResponse.json({ employees })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}