import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamCode: string }> }
) {
  try {
    const { teamCode } = await params

    const groups = db.prepare(`
      SELECT
        org_code as orgCode,
        org_name as orgName,
        'group' as orgLevel,
        parent_org_code as parentOrgCode,
        0 as childrenCount
      FROM organization_master
      WHERE org_level = 'group'
        AND parent_org_code = ?
        AND is_active = 1
      ORDER BY display_order, org_name
    `).all(teamCode)

    return NextResponse.json({ groups })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    )
  }
}