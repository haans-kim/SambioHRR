import { NextRequest, NextResponse } from 'next/server';
import { getFromCache, setToCache, buildCacheHeaders } from '@/lib/cache';
import { getOrganizationsWithStats, getOrganizationsWithStatsForPeriod } from "@/lib/db/queries/organization";
import { getOrganizationsWithClaimStats } from "@/lib/db/queries/organization-claim";
import {
  getOrganizationStatsForPeriod,
  getOrganizationWeeklyStatsForPeriod,
  getOrganizationDataReliabilityStatsForPeriod,
  getGradeEfficiencyMatrix30Days,
  getGradeWeeklyWorkHoursMatrix30Days,
  getGradeWeeklyClaimedHoursMatrix30Days,
  getGradeDataReliabilityMatrix30Days,
  getGradeEfficiencyMatrixForPeriod,
  getGradeWeeklyWorkHoursMatrixForPeriod,
  getGradeWeeklyClaimedHoursMatrixForPeriod,
  getGradeAdjustedWeeklyWorkHoursMatrixForPeriod,
  getGradeDataReliabilityMatrixForPeriod,
  getMetricThresholdsForGrid,
  getMetricThresholdsForGridForPeriod,
  getAvailableMonths,
  getMonthDateRange,
  getAnalysisModeForMonth,
  getAvailableMetrics,
  type AnalysisMode
} from "@/lib/db/queries/analytics";
import {
  getWeeklyClaimedHoursFromClaim,
  getGradeWeeklyClaimedHoursMatrixFromClaim,
  getTotalEmployeesFromClaim
} from "@/lib/db/queries/claim-analytics";
import { calculateAdjustedWorkHours } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const selectedMonth = searchParams.get('month'); // "2025-06" 형식
    
    const cacheKey = `dashboard:v44:month=${selectedMonth || ''}`; // 시그모이드 함수 표준화
    const cached = getFromCache<any>(cacheKey);
    if (cached) {
      return new NextResponse(JSON.stringify(cached), {
        headers: buildCacheHeaders(true, 180),
      });
    }

    // 사용 가능한 월 목록 가져오기
    const availableMonths = getAvailableMonths();
    const currentMonth = selectedMonth || (availableMonths.length > 0 ? availableMonths[0] : '2025-06');
    
    // 분석 모드 결정 (Enhanced: 2025-06+, Legacy: 2025-01~2025-05)
    const analysisMode = getAnalysisModeForMonth(currentMonth);
    const availableMetrics = getAvailableMetrics(analysisMode);

    // 선택된 월의 날짜 범위 가져오기
    const { startDate, endDate } = getMonthDateRange(currentMonth);
    
    // claim_data 기반 정확한 센터별 통계 사용
    const centers = getOrganizationsWithClaimStats('center', startDate, endDate);
    
    // Get organization-wide statistics for selected month
    const orgStats = getOrganizationStatsForPeriod(startDate, endDate);
    const weeklyStats = getOrganizationWeeklyStatsForPeriod(startDate, endDate);
    const dataReliabilityStats = getOrganizationDataReliabilityStatsForPeriod(startDate, endDate);

    // claim_data 기반 정확한 계산
    const claimStats = getWeeklyClaimedHoursFromClaim(startDate, endDate);
    const totalEmployees = claimStats?.totalEmployees || getTotalEmployeesFromClaim(startDate, endDate) || 0;
    const avgEfficiency = orgStats?.avgEfficiencyRatio || 0;

    const avgWeeklyWorkHours = weeklyStats?.avgWeeklyWorkHours || 40.0;
    // claim_data 기반 정확한 주간 근태시간 사용
    const avgWeeklyClaimedHours = claimStats?.avgWeeklyClaimedHours || 38.9;
    const avgDataReliability = dataReliabilityStats?.avgDataReliability || 83.6;
    // avgWeeklyWorkHours already has flexible work adjustment applied from weeklyStats
    const avgAdjustedWeeklyWorkHours = avgDataReliability 
      ? calculateAdjustedWorkHours(avgWeeklyWorkHours, avgDataReliability)
      : 0;
    
    // Get grade matrices for selected period
    const gradeMatrix = getGradeEfficiencyMatrixForPeriod(startDate, endDate);
    const weeklyWorkHoursMatrix = getGradeWeeklyWorkHoursMatrixForPeriod(startDate, endDate);
    // claim_data 기반 정확한 레벨별 주간 근태시간 매트릭스 사용
    const weeklyClaimedHoursMatrix = getGradeWeeklyClaimedHoursMatrixFromClaim(startDate, endDate);
    const adjustedWeeklyWorkHoursMatrix = getGradeAdjustedWeeklyWorkHoursMatrixForPeriod(startDate, endDate);
    const dataReliabilityMatrix = getGradeDataReliabilityMatrixForPeriod(startDate, endDate);
    
    
    // Get dynamic thresholds for selected period
    const efficiencyThresholds = getMetricThresholdsForGridForPeriod('efficiency', startDate, endDate);
    const weeklyClaimedThresholds = getMetricThresholdsForGridForPeriod('weeklyClaimedHours', startDate, endDate);
    const dataReliabilityThresholds = getMetricThresholdsForGridForPeriod('dataReliability', startDate, endDate);
    const adjustedWeeklyWorkThresholds = getMetricThresholdsForGridForPeriod('adjustedWeeklyWorkHours', startDate, endDate);
    
    // Debug threshold values
    console.log('[Thresholds Debug]', {
      month: currentMonth,
      period: `${startDate} - ${endDate}`,
      efficiency: efficiencyThresholds,
      dataReliability: dataReliabilityThresholds
    });
    
    const payload = {
      centers,
      totalEmployees,
      avgEfficiency,
      avgWeeklyWorkHours,
      avgWeeklyClaimedHours,
      avgAdjustedWeeklyWorkHours,
      avgDataReliability,
      gradeMatrix,
      weeklyWorkHoursMatrix,
      weeklyClaimedHoursMatrix,
      adjustedWeeklyWorkHoursMatrix,
      dataReliabilityMatrix,
      thresholds: {
        efficiency: efficiencyThresholds,
        adjustedWeeklyWorkHours: adjustedWeeklyWorkThresholds,
        weeklyClaimedHours: weeklyClaimedThresholds,
        dataReliability: dataReliabilityThresholds
      },
      // 월 선택 관련 데이터 추가
      availableMonths,
      currentMonth,
      // 분석 모드 및 메트릭 가용성 정보 추가
      analysisMode,
      availableMetrics,
      dataQuality: {
        mode: analysisMode,
        description: analysisMode === 'enhanced' 
          ? '전체 데이터 기반 상세 분석' 
          : '제한 데이터 기반 기본 분석 (Tag + Claim 데이터만)',
        limitations: analysisMode === 'legacy' 
          ? ['장비 사용 시간 미포함', '식사 시간 추정치', '회의실 이용 데이터 제한'] 
          : []
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