import { NextResponse } from 'next/server'
import { getEmployeesByOrganization } from '@/lib/database/queries'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgCode: string }> }
) {
  try {
    const { orgCode } = await params
    const employees = getEmployeesByOrganization(orgCode)
    return NextResponse.json({ employees })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}