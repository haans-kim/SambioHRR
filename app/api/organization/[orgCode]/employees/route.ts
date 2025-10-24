import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgCode: string }> }
) {
  try {
    const { orgCode } = await params

    const employees = db.prepare(`
      SELECT
        employee_id,
        name,
        position,
        center_name as department
      FROM employees
      WHERE (
        center_code = ? OR
        division_code = ? OR
        team_code = ? OR
        group_code = ?
      )
      AND is_active = 1
      ORDER BY name
    `).all(orgCode, orgCode, orgCode, orgCode)

    return NextResponse.json({ employees })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}