import { NextResponse } from 'next/server';
import { getRealTimeMetrics } from '@/lib/queries/statistics';

export async function GET() {
  try {
    const metrics = getRealTimeMetrics();
    return NextResponse.json(metrics || {
      currently_working: 0,
      overtime_today: 0,
      data_reliability: 0,
      work_efficiency: 0
    });
  } catch (error) {
    console.error('Failed to fetch real-time metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}