import { NextResponse } from 'next/server'
import { getCenters } from '@/lib/database/queries'

export async function GET() {
  try {
    const centersData = getCenters()
    const centers = centersData.map(center => ({
      orgCode: center.code,
      orgName: center.name,
      orgLevel: 'center',
      parentOrgCode: null,
      childrenCount: 1 // We'll assume all centers have children for now
    }))
    return NextResponse.json({ centers })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch centers' },
      { status: 500 }
    )
  }
}