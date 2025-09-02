import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET() {
  try {
    // Get available dates from daily_analysis_results
    const dates = db.prepare(`
      SELECT DISTINCT 
        DATE(analysis_date) as date
      FROM daily_analysis_results
      WHERE analysis_date IS NOT NULL
      ORDER BY date DESC
      LIMIT 90
    `).all() as { date: string }[]
    
    return NextResponse.json({ 
      dates: dates.map(d => d.date),
      latestDate: dates[0]?.date || new Date().toISOString().split('T')[0],
      earliestDate: dates[dates.length - 1]?.date || new Date().toISOString().split('T')[0]
    })
  } catch (error) {
    console.error('Error fetching available dates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch available dates' },
      { status: 500 }
    )
  }
}