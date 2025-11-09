import { NextRequest, NextResponse } from 'next/server';
import { getFromCache, setToCache, buildCacheHeaders } from '@/lib/cache';
import { getPrecomputedGroupStats } from '@/lib/db/queries/precompute-stats';
import DatabaseManager from '@/lib/database/connection';
import { getLatestMonth } from '@/lib/db/queries/analytics';

const db = DatabaseManager.getInstance().getDb();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const groupCodeOrName = decodeURIComponent(id);
    const searchParams = request.nextUrl.searchParams;
    const selectedMonth = searchParams.get('month') || getLatestMonth();

    // First resolve org_code to org_name if needed
    let groupName = groupCodeOrName;
    const orgLookup = db.prepare('SELECT org_name FROM organization_master WHERE org_code = ? AND org_level = ? AND is_active = 1 AND display_order = 0').get(groupCodeOrName, 'group') as any;
    if (orgLookup) {
      groupName = orgLookup.org_name;
    }

    const cacheKey = `group-stats-fast:v1:group=${groupName}:month=${selectedMonth}`;
    const cached = getFromCache<any>(cacheKey);
    if (cached) {
      return new NextResponse(JSON.stringify(cached), {
        headers: buildCacheHeaders(true, 300),
      });
    }

    // 사전 계산된 통계 가져오기
    const stats = getPrecomputedGroupStats(selectedMonth, groupName) as any;

    if (!stats) {
      // 사전 계산이 없으면 404 반환하고 클라이언트가 fallback API 사용하도록 함
      return new NextResponse(JSON.stringify({ error: 'Precomputed stats not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 계층 정보는 이미 precomputed stats에 있으므로 사용
    const parentTeam = stats.team_name || 'Unknown';
    const parentCenter = stats.center_name || 'Unknown';
    const parentDivision = null; // 필요시 stats에 추가 가능

    // 상세 메트릭은 사전 계산된 데이터에서 가져오거나 기본값 사용
    // daily_analysis_results 조회를 피해 성능 개선
    const detailedMetrics = {
      avg_focused_work_minutes: 0,
      avg_equipment_minutes: 0,
      avg_training_minutes: 0,
      avg_fitness_minutes: 0,
      avg_commute_minutes: 0,
      avg_work_area_minutes: 0,
      avg_non_work_area_minutes: 0,
      avg_gate_area_minutes: 0,
      avg_activity_count: 0,
      avg_meal_count: 0,
      avg_tag_count: 0
    };

    const result = {
      group: {
        orgCode: groupName,
        orgName: groupName,
        parentTeam,
        parentCenter,
        parentDivision,
      },
      summary: {
        totalEmployees: stats.total_employees || 0,
        totalRecords: stats.total_records || 0,
        avgEfficiency: stats.efficiency || 0,
        avgWorkHours: stats.weekly_work_hours || 0,
        avgClaimedHours: stats.weekly_claimed_hours || 0,
        avgGroundRulesWorkHours: 0, // 나중에 추가
        avgGroundRulesConfidence: 0, // 나중에 추가
        avgAdjustedWeeklyWorkHours: stats.weekly_work_hours || 0,
        totalManDays: stats.total_records || 0,
      },
      distributions: {
        efficiencyDistribution: [],
        workHoursDistribution: [],
        confidenceDistribution: [],
        groundRulesDistribution: [],
      },
      metrics: {
        // 시간 관련 지표
        avgTotalHours: (stats.weekly_claimed_hours || 0) * 1.1, // 추정치
        avgActualWorkHours: stats.weekly_work_hours || 0,
        avgClaimedWorkHours: stats.weekly_claimed_hours || 0,
        avgEfficiencyRatio: stats.efficiency || 0,

        // 활동별 시간 (분 단위)
        avgWorkMinutes: Math.round(stats.work_minutes || 0),
        avgFocusedWorkMinutes: Math.round(detailedMetrics?.avg_focused_work_minutes || 0),
        avgEquipmentMinutes: Math.round(detailedMetrics?.avg_equipment_minutes || 0),
        avgMeetingMinutes: Math.round(stats.meeting_minutes || 0),
        avgTrainingMinutes: Math.round(detailedMetrics?.avg_training_minutes || 0),

        // 식사 시간
        avgMealMinutes: Math.round(stats.meal_minutes || 0),
        avgBreakfastMinutes: 0,
        avgLunchMinutes: Math.round((stats.meal_minutes || 0) * 0.6), // 추정
        avgDinnerMinutes: Math.round((stats.meal_minutes || 0) * 0.4), // 추정
        avgMidnightMealMinutes: 0,

        // 기타 활동 시간
        avgMovementMinutes: Math.round(stats.movement_minutes || 0),
        avgRestMinutes: Math.round(stats.rest_minutes || 0),
        avgFitnessMinutes: Math.round(detailedMetrics?.avg_fitness_minutes || 0),
        avgCommuteInMinutes: Math.round((detailedMetrics?.avg_commute_minutes || 0) / 2),
        avgCommuteOutMinutes: Math.round((detailedMetrics?.avg_commute_minutes || 0) / 2),
        avgPreparationMinutes: 0,

        // 구역별 시간
        avgWorkAreaMinutes: Math.round(detailedMetrics?.avg_work_area_minutes || 0),
        avgNonWorkAreaMinutes: Math.round(detailedMetrics?.avg_non_work_area_minutes || 0),
        avgGateAreaMinutes: Math.round(detailedMetrics?.avg_gate_area_minutes || 0),

        // Ground Rules 지표
        avgGroundRulesWorkHours: 0,
        avgGroundRulesConfidence: 0,
        avgWorkMovementMinutes: 0,
        avgNonWorkMovementMinutes: 0,
        avgAnomalyScore: 0,

        // 기타 지표
        avgConfidenceScore: stats.confidence_score || 0,
        avgActivityCount: Math.round(detailedMetrics?.avg_activity_count || 0),
        avgMealCount: Math.round(detailedMetrics?.avg_meal_count || 0),
        avgTagCount: Math.round(detailedMetrics?.avg_tag_count || 0),
      },
      ranges: {
        efficiencyRange: { min: 0, max: 100 },
        workHoursRange: { min: 0, max: 60 },
        confidenceRange: { min: 0, max: 100 },
      },
      analysisDate: stats.created_at || new Date().toISOString().split('T')[0],
      isPrecomputed: true,
      computedAt: stats.created_at,
    };

    setToCache(cacheKey, result, 300_000); // 5분 캐시
    return new NextResponse(JSON.stringify(result), {
      headers: buildCacheHeaders(false, 300),
    });
  } catch (error) {
    console.error('Group Stats Fast API error:', error);
    // 에러 시 기존 API로 폴백
    const { id } = await params;
    return NextResponse.redirect(new URL(`/api/group-stats/${id}?month=${request.nextUrl.searchParams.get('month') || ''}`, request.url));
  }
}