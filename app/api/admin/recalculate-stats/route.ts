import { NextRequest, NextResponse } from 'next/server';
import { precomputeMonthlyStats, precomputeAllMonthlyStats } from '@/lib/db/queries/precompute-stats';

/**
 * Admin API to recalculate precomputed statistics
 * Usage:
 * - POST /api/admin/recalculate-stats?month=2025-06 (single month)
 * - POST /api/admin/recalculate-stats (all months)
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month');

    const startTime = Date.now();

    if (month) {
      // Single month recalculation
      console.log(`Recalculating stats for ${month}...`);
      precomputeMonthlyStats(month);

      const endTime = Date.now();
      return NextResponse.json({
        success: true,
        message: `Successfully recalculated stats for ${month}`,
        timeElapsed: `${((endTime - startTime) / 1000).toFixed(2)}s`
      });
    } else {
      // All months recalculation
      console.log('Recalculating all monthly stats...');
      precomputeAllMonthlyStats();

      const endTime = Date.now();
      return NextResponse.json({
        success: true,
        message: 'Successfully recalculated all monthly stats',
        timeElapsed: `${((endTime - startTime) / 1000).toFixed(2)}s`
      });
    }
  } catch (error) {
    console.error('Recalculation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to recalculate statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}