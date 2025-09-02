import { NextResponse } from 'next/server'
import { getEmployeesByDepartment } from '@/lib/database/queries'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ department: string }> }
) {
  try {
    const { department: deptParam } = await params
    const department = decodeURIComponent(deptParam)
    const employees = getEmployeesByDepartment(department)
    return NextResponse.json(employees)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employees by department' },
      { status: 500 }
    )
  }
}