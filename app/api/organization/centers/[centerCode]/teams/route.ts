import { NextResponse } from 'next/server'
import { getTeamsByCenter } from '@/lib/database/queries'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ centerCode: string }> }
) {
  try {
    const { centerCode } = await params
    const teamsData = getTeamsByCenter(centerCode)
    const teams = teamsData.map(team => ({
      orgCode: team.code,
      orgName: team.name,
      orgLevel: 'team',
      parentOrgCode: centerCode,
      childrenCount: 1
    }))
    return NextResponse.json({ teams })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    )
  }
}