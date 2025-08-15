import { NextRequest, NextResponse } from 'next/server';
import { getWorkTimeStatistics } from '@/lib/queries/statistics';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orgLevel = (searchParams.get('level') || 'center') as 'center' | 'team' | 'group';
    const parentId = searchParams.get('parentId') || undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    const dateRange = startDate && endDate 
      ? { start: startDate, end: endDate }
      : undefined;
    
    const statistics = getWorkTimeStatistics(orgLevel, parentId, dateRange);
    
    return NextResponse.json({ statistics });
  } catch (error) {
    console.error('Failed to fetch work time statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}