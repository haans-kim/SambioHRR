import { NextRequest, NextResponse } from 'next/server';
import { getFromCache, setToCache, buildCacheHeaders } from '@/lib/cache';
import { getPrecomputedStats } from '@/lib/db/queries/precompute-stats';
import { getAvailableMonths, getAnalysisModeForMonth, getAvailableMetrics } from '@/lib/db/queries/analytics';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const selectedMonth = searchParams.get('month'); // "2025-06" 형식

    const cacheKey = `dashboard-fast:v2:month=${selectedMonth || ''}`;
    const cached = getFromCache<any>(cacheKey);
    if (cached) {
      return new NextResponse(JSON.stringify(cached), {
        headers: buildCacheHeaders(true, 300), // 5분 캐시
      });
    }

    // 사용 가능한 월 목록
    const availableMonths = getAvailableMonths();
    const currentMonth = selectedMonth || (availableMonths.length > 0 ? availableMonths[0] : '2025-06');

    // 분석 모드 및 메트릭 가용성
    const analysisMode = getAnalysisModeForMonth(currentMonth);
    const availableMetrics = getAvailableMetrics(analysisMode);

    // 사전 계산된 통계 가져오기
    const stats = getPrecomputedStats(currentMonth);

    if (!stats.isPrecomputed) {
      // 사전 계산이 없으면 기존 API로 리다이렉트
      return NextResponse.redirect(new URL(`/api/dashboard?month=${currentMonth}`, request.url));
    }

    // 센터별 데이터 변환
    const centers = stats.centers.map((center: any, index: number) => {
      // 한글과 영문, 숫자를 모두 포함하여 orgCode 생성
      let orgCode = center.center_name ?
        center.center_name
          .replace(/센터$/g, '') // "센터" 제거
          .replace(/연구소$/g, 'lab') // "연구소" -> "lab"
          .replace(/개발/g, 'dev') // "개발" -> "dev"
          .replace(/경영지원/g, 'mgmt') // "경영지원" -> "mgmt"
          .replace(/영업/g, 'sales') // "영업" -> "sales"
          .replace(/바이오/g, 'bio') // "바이오" -> "bio"
          .replace(/전략기획/g, 'strategy') // "전략기획" -> "strategy"
          .replace(/품질관리/g, 'qa') // "품질관리" -> "qa"
          .replace(/[^a-z0-9]/gi, '') // 나머지 특수문자 제거
          .toLowerCase()
        : `center_${index}`;

      // 빈 문자열이 되면 인덱스 사용
      if (!orgCode) {
        orgCode = `center_${index}`;
      }

      return {
        orgCode,
        orgName: center.center_name,
        orgLevel: 'center',
        stats: {
        totalEmployees: center.total_employees,
        avgWorkEfficiency: center.efficiency,
        avgDataReliability: center.data_reliability || 0,
        avgWeeklyClaimedHours: center.weekly_claimed_hours,
        avgAdjustedWeeklyWorkHours: center.weekly_adjusted_hours,
        // 나머지 필드는 호환성을 위해 기본값
        avgFocusedWorkHours: 0,
        avgWeeklyClaimedHoursAdjusted: center.weekly_claimed_hours,
        avgWeeklyWorkHours: 0,
        avgWeeklyWorkHoursAdjusted: 0,
        manDays: 0,
        avgActualWorkHours: 0,
        avgAttendanceHours: 0,
        avgGroundRulesWorkHours: 0,
        avgWeeklyGroundRulesWorkHours: 0,
        avgActualWorkHoursAdjusted: 0,
        avgAttendanceHoursAdjusted: 0
      }
    };
  });

    // 등급별 매트릭스 변환
    const grades = ['Special', 'Lv.4', 'Lv.3', 'Lv.2', 'Lv.1'];
    const centerNames = [...new Set(stats.grades.map((g: any) => g.center_name))].sort();

    const gradeMatrix: any = { grades, centers: centerNames, matrix: {} };
    const weeklyClaimedHoursMatrix: any = { grades, centers: centerNames, matrix: {} };
    const adjustedWeeklyWorkHoursMatrix: any = { grades, centers: centerNames, matrix: {} };

    grades.forEach(grade => {
      gradeMatrix.matrix[grade] = {};
      weeklyClaimedHoursMatrix.matrix[grade] = {};
      adjustedWeeklyWorkHoursMatrix.matrix[grade] = {};

      centerNames.forEach(center => {
        const data = stats.grades.find(
          (g: any) => g.grade_level === grade && g.center_name === center
        );
        gradeMatrix.matrix[grade][center] = data?.efficiency || 0;
        weeklyClaimedHoursMatrix.matrix[grade][center] = data?.weekly_claimed_hours || 0;
        adjustedWeeklyWorkHoursMatrix.matrix[grade][center] = data?.weekly_adjusted_hours || 0;
      });
    });

    const payload = {
      centers,
      totalEmployees: stats.overall?.total_employees || 0,
      avgEfficiency: stats.overall?.avg_efficiency || 0,
      avgWeeklyWorkHours: 40.0, // 기본값
      avgWeeklyClaimedHours: stats.overall?.avg_weekly_claimed_hours || 0,
      avgAdjustedWeeklyWorkHours: stats.overall?.avg_weekly_adjusted_hours || 0,
      avgDataReliability: stats.overall?.avg_data_reliability || 0,
      gradeMatrix,
      weeklyWorkHoursMatrix: { grades, centers: centerNames, matrix: {} }, // 빈 매트릭스
      weeklyClaimedHoursMatrix,
      adjustedWeeklyWorkHoursMatrix,
      dataReliabilityMatrix: { grades, centers: centerNames, matrix: {} }, // 빈 매트릭스
      thresholds: {
        efficiency: { low: '≤89.5%', middle: '89.6-93.6%', high: '≥93.7%', thresholds: { low: 89.5, high: 93.7 } },
        adjustedWeeklyWorkHours: { low: '<35.0h', middle: '35.0-41.9h', high: '≥42.0h', thresholds: { low: 35.0, high: 42.0 } },
        weeklyClaimedHours: { low: '<38.0h', middle: '38.0-47.9h', high: '≥48.0h', thresholds: { low: 38.0, high: 48.0 } },
        dataReliability: { low: '<70.0', middle: '70.0-84.9', high: '≥85.0', thresholds: { low: 70.0, high: 85.0 } }
      },
      availableMonths,
      currentMonth,
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
      },
      isPrecomputed: true,
      computedAt: stats.overall?.created_at
    };

    setToCache(cacheKey, payload, 300_000); // 5분 캐시
    return new NextResponse(JSON.stringify(payload), {
      headers: buildCacheHeaders(false, 300),
    });
  } catch (error) {
    console.error('Dashboard Fast API error:', error);
    // 에러 시 기존 API로 폴백
    return NextResponse.redirect(new URL(`/api/dashboard?month=${request.nextUrl.searchParams.get('month') || ''}`, request.url));
  }
}