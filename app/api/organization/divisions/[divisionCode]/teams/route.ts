import { NextResponse } from 'next/server'
import { getTeamsByDivision } from '@/lib/database/queries'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ divisionCode: string }> }
) {
  try {
    const { divisionCode } = await params
    const teamsData = getTeamsByDivision(divisionCode)
    const teams = teamsData.map(team => ({
      orgCode: team.code,
      orgName: team.name,
      orgLevel: 'team',
      parentOrgCode: divisionCode,
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