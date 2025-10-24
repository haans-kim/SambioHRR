import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ centerCode: string }> }
) {
  try {
    const { centerCode } = await params

    // Get teams directly under center OR under divisions of this center
    const teams = db.prepare(`
      SELECT
        org_code as orgCode,
        org_name as orgName,
        'team' as orgLevel,
        parent_org_code as parentOrgCode,
        1 as childrenCount
      FROM organization_master
      WHERE org_level = 'team'
        AND is_active = 1
        AND (
          parent_org_code = ?
          OR parent_org_code IN (
            SELECT org_code FROM organization_master
            WHERE org_level = 'division' AND parent_org_code = ? AND is_active = 1
          )
        )
      ORDER BY display_order, org_name
    `).all(centerCode, centerCode)

    return NextResponse.json({ teams })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    )
  }
}