import { NextResponse } from 'next/server'
import { getEmployeeInfo } from '@/lib/database/queries'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const employeeId = parseInt(id, 10)
    
    if (isNaN(employeeId)) {
      return NextResponse.json(
        { error: 'Invalid employee ID' },
        { status: 400 }
      )
    }

    const employeeInfo = await getEmployeeInfo(employeeId)
    
    if (!employeeInfo) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(employeeInfo)
  } catch (error) {
    console.error('Error fetching employee:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee data' },
      { status: 500 }
    )
  }
}