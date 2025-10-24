import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const center = searchParams.get('center');
    const year = parseInt(searchParams.get('year') || '2025');
    const startMonth = parseInt(searchParams.get('startMonth') || '1');
    const endMonth = parseInt(searchParams.get('endMonth') || '12');

    // 전체 기간 데이터를 한 번에 조회 (성능 최적화)
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // 근태시간 데이터를 사전 계산된 통계에서 조회
    const claimedQuery = `
      SELECT
        grade_level,
        center_name,
        CAST(substr(month, 6, 2) AS INTEGER) as month,
        weekly_claimed_hours as avg_weekly_hours
      FROM monthly_grade_stats
      WHERE substr(month, 1, 4) = ?
      ORDER BY grade_level, center_name, month
    `;

    const allClaimedResults = db.prepare(claimedQuery).all(year.toString()) as any[];

    // 근무추정시간 데이터를 사전 계산된 통계에서 조회
    // daily_analysis_results가 있는 월만 데이터가 있음 (NULL이 아닌 경우만)
    const actualQuery = `
      SELECT
        center_name as centerName,
        grade_level as grade,
        CAST(substr(month, 6, 2) AS INTEGER) as month,
        weekly_adjusted_hours as avgWeeklyActualHours
      FROM monthly_grade_stats
      WHERE substr(month, 1, 4) = ?
        AND weekly_adjusted_hours IS NOT NULL
      ORDER BY center_name, grade_level, month
    `;

    const allActualResults = db.prepare(actualQuery).all(year.toString()) as any[];

    // 센터와 등급 목록 추출
    const centersSet = new Set<string>();
    const gradesSet = new Set<string>();

    allClaimedResults.forEach(row => {
      centersSet.add(row.center_name);
      gradesSet.add(row.grade_level);
    });

    const centers = Array.from(centersSet).sort();
    const grades = Array.from(gradesSet).sort();

    // 월별로 데이터 구성
    const monthlyResults = [];
    for (let month = startMonth; month <= endMonth; month++) {
      // 해당 월의 근태시간 데이터 필터링
      const monthClaimedResults = allClaimedResults.filter(row => row.month === month);
      const claimedMatrix: Record<string, Record<string, number>> = {};
      monthClaimedResults.forEach(row => {
        if (!claimedMatrix[row.grade_level]) {
          claimedMatrix[row.grade_level] = {};
        }
        claimedMatrix[row.grade_level][row.center_name] = row.avg_weekly_hours;
      });

      // 해당 월의 근무추정시간 데이터 필터링
      const monthActualResults = allActualResults.filter(row => row.month === month);
      const actualMatrix: Record<string, Record<string, number>> = {};
      monthActualResults.forEach(row => {
        if (!actualMatrix[row.grade]) {
          actualMatrix[row.grade] = {};
        }
        actualMatrix[row.grade][row.centerName] = row.avgWeeklyActualHours;
      });

      monthlyResults.push({
        month,
        claimedData: {
          grades,
          centers,
          matrix: claimedMatrix
        },
        actualData: {
          grades,
          centers,
          matrix: actualMatrix
        }
      });
    }

    // 데이터베이스에서 센터 목록 가져오기 (경영진 관련 제외)
    const excludedCenters = ['경영진단팀', '대표이사', '이사회', '자문역/고문'];
    const centersFromDB = db.prepare(`
      SELECT
        org_code as code,
        org_name as name
      FROM organization_master
      WHERE org_level = 'center'
        AND is_active = 1
        AND org_name NOT IN (${excludedCenters.map(() => '?').join(',')})
      ORDER BY display_order, org_name
    `).all(...excludedCenters) as { code: string; name: string }[];

    const availableCenters = centersFromDB.map(c => ({
      id: c.code,
      name: c.name
    }));

    // 현재 선택된 센터 이름 찾기
    const selectedCenter = center ? centersFromDB.find(c => c.code === center) : null;
    const centerName = selectedCenter ? selectedCenter.name : availableCenters[0]?.name || '전체';

    // 레벨 정의
    const levels = ['Lv.4', 'Lv.3', 'Lv.2', 'Lv.1'];

    // 전사평균 계산용 데이터
    const companyAverageData = levels.map(level => {
      const monthlyData = monthlyResults.map(({ month, claimedData, actualData }) => {
        // 근태시간 - 모든 센터의 평균
        const allClaimedData = claimedData.matrix[level] ?
          Object.values(claimedData.matrix[level]).filter((v): v is number => typeof v === 'number' && v > 0) : [];
        const avgClaimed = allClaimedData.length > 0 ?
          allClaimedData.reduce((sum, val) => sum + val, 0) / allClaimedData.length : 0;

        // 근무추정시간 - 모든 센터의 평균
        const allActualData = actualData.matrix[level] ?
          Object.values(actualData.matrix[level]).filter((v): v is number => typeof v === 'number' && v > 0) : [];
        const avgActual = allActualData.length > 0 ?
          allActualData.reduce((sum, val) => sum + val, 0) / allActualData.length : null;

        return {
          month,
          weeklyClaimedHours: isNaN(avgClaimed) ? 0 : avgClaimed,
          weeklyAdjustedHours: avgActual !== null && !isNaN(avgActual) ? avgActual : null,
          employeeCount: 0
        };
      });

      // 평균 계산
      const validData = monthlyData.filter(d => d.weeklyAdjustedHours > 0);
      const avgClaimed = validData.length > 0 ?
        validData.reduce((sum, d) => sum + d.weeklyClaimedHours, 0) / validData.length : 0;
      const avgAdjusted = validData.length > 0 ?
        validData.reduce((sum, d) => sum + d.weeklyAdjustedHours, 0) / validData.length : 0;

      return {
        level,
        monthlyData,
        average: {
          weeklyClaimedHours: isNaN(avgClaimed) ? 0 : Math.round(avgClaimed * 10) / 10,
          weeklyAdjustedHours: isNaN(avgAdjusted) ? 0 : Math.round(avgAdjusted * 10) / 10
        }
      };
    });

    // 레벨별 월별 데이터 정리 (선택된 센터)
    const levelData = levels.map(level => {
      const monthlyData = monthlyResults.map(({ month, claimedData, actualData }) => {
        // 근태시간 - 선택된 센터의 데이터
        const centerClaimedData = centerName && claimedData.matrix[level] ?
          claimedData.matrix[level][centerName] : 0;

        // 근무추정시간 - 선택된 센터의 데이터
        const centerActualData = centerName && actualData.matrix[level] ?
          actualData.matrix[level][centerName] : 0;

        // 전체 센터 평균 계산 (선택된 센터가 없을 경우)
        const allClaimedData = claimedData.matrix[level] ?
          Object.values(claimedData.matrix[level]).filter((v): v is number => typeof v === 'number' && v > 0) : [];
        const avgClaimed = allClaimedData.length > 0 ?
          allClaimedData.reduce((sum, val) => sum + val, 0) / allClaimedData.length : 0;

        const allActualData = actualData.matrix[level] ?
          Object.values(actualData.matrix[level]).filter((v): v is number => typeof v === 'number' && v > 0) : [];
        const avgActual = allActualData.length > 0 ?
          allActualData.reduce((sum, val) => sum + val, 0) / allActualData.length : null;

        const claimedValue = centerName !== '전체' ? centerClaimedData : avgClaimed;
        const actualValue = centerName !== '전체' ? centerActualData : avgActual;

        return {
          month,
          weeklyClaimedHours: isNaN(claimedValue) ? 0 : claimedValue, // 근태시간
          weeklyAdjustedHours: actualValue !== null && !isNaN(actualValue) ? actualValue : null, // 근무추정시간
          employeeCount: 0
        };
      });

      // 평균 계산
      const validData = monthlyData.filter(d => d.weeklyAdjustedHours > 0);
      const avgClaimed = validData.length > 0 ?
        validData.reduce((sum, d) => sum + d.weeklyClaimedHours, 0) / validData.length : 0;
      const avgAdjusted = validData.length > 0 ?
        validData.reduce((sum, d) => sum + d.weeklyAdjustedHours, 0) / validData.length : 0;

      return {
        level,
        monthlyData,
        average: {
          weeklyClaimedHours: isNaN(avgClaimed) ? 0 : Math.round(avgClaimed * 10) / 10,
          weeklyAdjustedHours: isNaN(avgAdjusted) ? 0 : Math.round(avgAdjusted * 10) / 10
        }
      };
    });

    // 전체 요약 통계
    const totalEmployees = 5000; // 추후 실제 데이터로 변경
    const avgWeeklyClaimedHours = 42.3;
    const avgWeeklyAdjustedHours = 42.5;
    const efficiency = 100.5;

    const response = {
      centerName,
      period: {
        year,
        startMonth,
        endMonth
      },
      levelData,
      companyAverageData,  // 전사평균 데이터 추가
      summary: {
        totalEmployees,
        avgWeeklyClaimedHours,
        avgWeeklyAdjustedHours,
        efficiency
      },
      availableCenters
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch trend data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch trend data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}