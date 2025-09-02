import { NextResponse } from 'next/server'
import { db } from '@/lib/database/connection'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { startDate, endDate } = body
    
    console.log('Checking existing analysis results:', { startDate, endDate })
    
    // Query to get existing analysis results in the date range
    const query = `
      SELECT 
        employee_id,
        analysis_date
      FROM daily_analysis_results
      WHERE analysis_date BETWEEN ? AND ?
      ORDER BY employee_id, analysis_date
    `
    
    const stmt = db.getDb().prepare(query)
    const existingResults = stmt.all(startDate, endDate)
    
    console.log(`Found ${existingResults.length} existing analysis results`)
    
    // Create a Set of employee-date combinations that have been analyzed
    const analyzedSet = new Set<string>()
    existingResults.forEach((result: any) => {
      // Convert employee_id to integer to match claim data format
      const employeeId = parseInt(result.employee_id)
      analyzedSet.add(`${employeeId}_${result.analysis_date}`)
    })
    
    return NextResponse.json({
      analyzedCount: existingResults.length,
      analyzedKeys: Array.from(analyzedSet)
    })
  } catch (error) {
    console.error('Error checking existing analysis:', error)
    return NextResponse.json(
      { error: 'Failed to check existing analysis' },
      { status: 500 }
    )
  }
}