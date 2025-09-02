import { NextResponse } from 'next/server'
import { getDivisionsByCenter } from '@/lib/database/queries'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ centerCode: string }> }
) {
  try {
    const { centerCode } = await params
    const divisionsData = getDivisionsByCenter(centerCode)
    const divisions = divisionsData.map(division => ({
      orgCode: division.code,
      orgName: division.name,
      orgLevel: 'division',
      parentOrgCode: centerCode,
      childrenCount: 1
    }))
    return NextResponse.json({ divisions })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch divisions' },
      { status: 500 }
    )
  }
}