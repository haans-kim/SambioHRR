import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { mapOrganizationName } from '@/lib/organization-mapping'

export async function GET() {
  try {
    const excludedCenters = ['경영진단팀', '대표이사', '이사회', '자문역/고문']
    const centers = db.prepare(`
      SELECT
        org_code as orgCode,
        org_name as orgName,
        'center' as orgLevel,
        NULL as parentOrgCode,
        1 as childrenCount
      FROM organization_master
      WHERE org_level = 'center'
        AND is_active = 1
        AND org_name NOT IN (${excludedCenters.map(() => '?').join(',')})
      ORDER BY display_order, org_name
    `).all(...excludedCenters)

    const mappedCenters = (centers as any[]).map((c: any) => ({
      ...c,
      orgName: mapOrganizationName(c.orgName),
    }))

    return NextResponse.json({ centers: mappedCenters })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch centers' },
      { status: 500 }
    )
  }
}