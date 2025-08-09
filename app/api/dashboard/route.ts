import { NextResponse } from 'next/server';
import { getOrganizationsWithStats } from "@/lib/db/queries/organization";
import { getOrganizationStats30Days, getGradeEfficiencyMatrix30Days, getGradeWorkHoursMatrix30Days, getGradeClaimedHoursMatrix30Days, getMetricThresholdsForGrid } from "@/lib/db/queries/analytics";

export async function GET() {
  try {
    const centers = getOrganizationsWithStats('center');
    
    // Get organization-wide statistics for 30 days
    const orgStats = getOrganizationStats30Days();
    const totalEmployees = orgStats?.totalEmployees || 0;
    const avgEfficiency = orgStats?.avgEfficiencyRatio || 0;
    const avgWorkHours = orgStats?.avgActualWorkHours || 8.2;
    const avgClaimedHours = orgStats?.avgClaimedHours || 8.5;
    
    // Get grade efficiency, work hours, and claimed hours matrices for 30 days
    const gradeMatrix = getGradeEfficiencyMatrix30Days();
    const workHoursMatrix = getGradeWorkHoursMatrix30Days();
    const claimedHoursMatrix = getGradeClaimedHoursMatrix30Days();
    
    // Get dynamic thresholds based on grid matrix data (center-grade averages)
    const efficiencyThresholds = getMetricThresholdsForGrid('efficiency');
    const workHoursThresholds = getMetricThresholdsForGrid('workHours');
    const claimedHoursThresholds = getMetricThresholdsForGrid('claimedHours');

    return NextResponse.json({
      centers,
      totalEmployees,
      avgEfficiency,
      avgWorkHours,
      avgClaimedHours,
      gradeMatrix,
      workHoursMatrix,
      claimedHoursMatrix,
      thresholds: {
        efficiency: efficiencyThresholds,
        workHours: workHoursThresholds,
        claimedHours: claimedHoursThresholds
      }
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}