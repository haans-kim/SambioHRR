import { NextResponse } from 'next/server';
import { getFromCache, setToCache, buildCacheHeaders } from '@/lib/cache';
import { getOrganizationsWithStats } from "@/lib/db/queries/organization";
import { 
  getOrganizationStats30Days, 
  getOrganizationWeeklyStats30Days,
  getOrganizationDataReliabilityStats30Days,
  getGradeEfficiencyMatrix30Days, 
  getGradeWeeklyClaimedHoursMatrix30Days,
  getGradeDataReliabilityMatrix30Days,
  getMetricThresholdsForGrid
} from "@/lib/db/queries/analytics";
import { calculateAdjustedWorkHours } from '@/lib/utils';

export async function GET() {
  try {
    const cacheKey = 'dashboard:v28'; // 캐시 강제 무효화
    const cached = getFromCache<any>(cacheKey);
    if (cached) {
      return new NextResponse(JSON.stringify(cached), {
        headers: buildCacheHeaders(true, 180),
      });
    }

    const centers = getOrganizationsWithStats('center');
    
    // Get organization-wide statistics for 30 days
    const orgStats = getOrganizationStats30Days();
    const weeklyStats = getOrganizationWeeklyStats30Days();
    const dataReliabilityStats = getOrganizationDataReliabilityStats30Days();
    const totalEmployees = orgStats?.totalEmployees || 0;
    const avgEfficiency = orgStats?.avgEfficiencyRatio || 0;
    
    // Calculate weighted average from centers for remaining metrics
    let totalWeightedWeeklyClaimedHours = 0;
    let totalCenterEmployees = 0;
    
    centers.forEach(center => {
      const employees = center.stats?.totalEmployees || 0;
      // Natural 방식 사용 (30일 합계 / 30일 * 7)
      const weeklyClaimedHours = center.stats?.avgWeeklyClaimedHoursAdjusted || center.stats?.avgWeeklyClaimedHours || 0;
      
      totalWeightedWeeklyClaimedHours += weeklyClaimedHours * employees;
      totalCenterEmployees += employees;
    });
    const avgWeeklyWorkHours = weeklyStats?.avgWeeklyWorkHours || 40.0;
    const avgWeeklyClaimedHours = totalCenterEmployees > 0 ? totalWeightedWeeklyClaimedHours / totalCenterEmployees : (weeklyStats?.avgWeeklyClaimedHours || 42.5);
    const avgDataReliability = dataReliabilityStats?.avgDataReliability || 83.6;
    // avgWeeklyWorkHours already has flexible work adjustment applied from weeklyStats
    const avgAdjustedWeeklyWorkHours = avgDataReliability 
      ? calculateAdjustedWorkHours(avgWeeklyWorkHours, avgDataReliability)
      : 0;
    
    // Get grade matrices for remaining metrics
    const gradeMatrix = getGradeEfficiencyMatrix30Days();
    const weeklyClaimedHoursMatrix = getGradeWeeklyClaimedHoursMatrix30Days();
    const dataReliabilityMatrix = getGradeDataReliabilityMatrix30Days();
    
    // Get dynamic thresholds for remaining metrics
    const efficiencyThresholds = getMetricThresholdsForGrid('efficiency');
    const weeklyClaimedThresholds = getMetricThresholdsForGrid('weeklyClaimedHours');
    const dataReliabilityThresholds = getMetricThresholdsForGrid('dataReliability');
    const adjustedWeeklyWorkThresholds = getMetricThresholdsForGrid('adjustedWeeklyWorkHours');
    
    const payload = {
      centers,
      totalEmployees,
      avgEfficiency,
      avgWeeklyWorkHours,
      avgWeeklyClaimedHours,
      avgAdjustedWeeklyWorkHours,
      avgDataReliability,
      gradeMatrix,
      weeklyClaimedHoursMatrix,
      dataReliabilityMatrix,
      thresholds: {
        efficiency: efficiencyThresholds,
        adjustedWeeklyWorkHours: adjustedWeeklyWorkThresholds,
        weeklyClaimedHours: weeklyClaimedThresholds,
        dataReliability: dataReliabilityThresholds
      }
    };

    setToCache(cacheKey, payload, 180_000); // 3 minutes
    return new NextResponse(JSON.stringify(payload), {
      headers: buildCacheHeaders(false, 180),
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}