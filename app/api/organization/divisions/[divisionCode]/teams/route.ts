import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ divisionCode: string }> }
) {
  try {
    const { divisionCode } = await params

    const teams = db.prepare(`
      SELECT
        org_code as orgCode,
        org_name as orgName,
        'team' as orgLevel,
        parent_org_code as parentOrgCode,
        1 as childrenCount
      FROM organization_master
      WHERE org_level = 'team'
        AND parent_org_code = ?
        AND is_active = 1
      ORDER BY display_order, org_name
    `).all(divisionCode)

    return NextResponse.json({ teams })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    )
  }
}