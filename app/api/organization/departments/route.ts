import { NextResponse } from 'next/server'
import { getDepartments } from '@/lib/database/queries'

export async function GET() {
  try {
    const departments = getDepartments()
    return NextResponse.json(departments)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    )
  }
}