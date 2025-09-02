import { NextResponse } from 'next/server'
import { getGroupsByTeam } from '@/lib/database/queries'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamCode: string }> }
) {
  try {
    const { teamCode } = await params
    const groupsData = getGroupsByTeam(teamCode)
    const groups = groupsData.map(group => ({
      orgCode: group.code,
      orgName: group.name,
      orgLevel: 'group',
      parentOrgCode: teamCode,
      childrenCount: 0
    }))
    return NextResponse.json({ groups })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    )
  }
}