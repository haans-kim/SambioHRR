import { NextResponse } from 'next/server';
import { getFromCache, setToCache, buildCacheHeaders } from '@/lib/cache';
import { getOrganizationsWithStats } from "@/lib/db/queries/organization";
import { 
  getOrganizationStats30Days, 
  getOrganizationWeeklyStats30Days,
  getOrganizationFocusedStats30Days,
  getOrganizationDataReliabilityStats30Days,
  getGradeEfficiencyMatrix30Days, 
  getGradeWorkHoursMatrix30Days, 
  getGradeClaimedHoursMatrix30Days,
  getGradeWeeklyWorkHoursMatrix30Days,
  getGradeWeeklyClaimedHoursMatrix30Days,
  getGradeFocusedWorkHoursMatrix30Days,
  getGradeDataReliabilityMatrix30Days,
  getMetricThresholdsForGrid,
  getFocusedWorkTableData
} from "@/lib/db/queries/analytics";

export async function GET() {
  try {
    const cacheKey = 'dashboard:v1';
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
    const focusedStats = getOrganizationFocusedStats30Days();
    const dataReliabilityStats = getOrganizationDataReliabilityStats30Days();
    const totalEmployees = orgStats?.totalEmployees || 0;
    const avgEfficiency = orgStats?.avgEfficiencyRatio || 0;
    const avgWorkHours = orgStats?.avgActualWorkHours || 8.2;
    const avgClaimedHours = orgStats?.avgClaimedHours || 8.5;
    const avgWeeklyWorkHours = weeklyStats?.avgWeeklyWorkHours || 40.0;
    const avgWeeklyClaimedHours = weeklyStats?.avgWeeklyClaimedHours || 42.5;
    const avgFocusedWorkHours = focusedStats?.avgFocusedWorkHours || 4.2;
    const avgDataReliability = dataReliabilityStats?.avgDataReliability || 83.6;
    
    // Get grade efficiency, work hours, and claimed hours matrices for 30 days
    const gradeMatrix = getGradeEfficiencyMatrix30Days();
    const workHoursMatrix = getGradeWorkHoursMatrix30Days();
    const claimedHoursMatrix = getGradeClaimedHoursMatrix30Days();
    const weeklyWorkHoursMatrix = getGradeWeeklyWorkHoursMatrix30Days();
    const weeklyClaimedHoursMatrix = getGradeWeeklyClaimedHoursMatrix30Days();
    const focusedWorkHoursMatrix = getGradeFocusedWorkHoursMatrix30Days();
    const dataReliabilityMatrix = getGradeDataReliabilityMatrix30Days();
    
    // Get dynamic thresholds based on grid matrix data (center-grade averages)
    const efficiencyThresholds = getMetricThresholdsForGrid('efficiency');
    const workHoursThresholds = getMetricThresholdsForGrid('workHours');
    const claimedHoursThresholds = getMetricThresholdsForGrid('claimedHours');
    const weeklyWorkThresholds = getMetricThresholdsForGrid('weeklyWorkHours');
    const weeklyClaimedThresholds = getMetricThresholdsForGrid('weeklyClaimedHours');
    const focusedWorkThresholds = getMetricThresholdsForGrid('focusedWorkHours');
    const dataReliabilityThresholds = getMetricThresholdsForGrid('dataReliability');
    
    // Get focused work table data
    const focusedWorkTable = getFocusedWorkTableData();

    const payload = {
      centers,
      totalEmployees,
      avgEfficiency,
      avgWorkHours,
      avgClaimedHours,
      avgWeeklyWorkHours,
      avgWeeklyClaimedHours,
      avgFocusedWorkHours,
      avgDataReliability,
      gradeMatrix,
      workHoursMatrix,
      claimedHoursMatrix,
      weeklyWorkHoursMatrix,
      weeklyClaimedHoursMatrix,
      focusedWorkHoursMatrix,
      dataReliabilityMatrix,
      focusedWorkTable,
      thresholds: {
        efficiency: efficiencyThresholds,
        workHours: workHoursThresholds,
        claimedHours: claimedHoursThresholds,
        weeklyWorkHours: weeklyWorkThresholds,
        weeklyClaimedHours: weeklyClaimedThresholds,
        focusedWorkHours: focusedWorkThresholds,
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