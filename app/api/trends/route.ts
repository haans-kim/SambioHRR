import { NextRequest, NextResponse } from 'next/server';
import { getCenters } from '@/lib/database/queries';
import { getGradeWeeklyClaimedHoursMatrixFromClaim } from '@/lib/db/queries/claim-analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const center = searchParams.get('center');
    const year = parseInt(searchParams.get('year') || '2025');
    const startMonth = parseInt(searchParams.get('startMonth') || '1');
    const endMonth = parseInt(searchParams.get('endMonth') || '12');

    // 각 월별로 데이터 조회
    const monthlyResults = [];
    for (let month = startMonth; month <= endMonth; month++) {
      const monthStr = month.toString().padStart(2, '0');
      const startDate = `${year}-${monthStr}-01`;

      // 해당 월의 마지막 날 계산
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${monthStr}-${lastDay}`;

      const result = getGradeWeeklyClaimedHoursMatrixFromClaim(startDate, endDate);
      monthlyResults.push({
        month,
        data: result
      });
    }

    // 데이터베이스에서 센터 목록 가져오기 (경영진 관련 제외)
    const centersFromDB = getCenters();
    const excludedCenters = ['경영진단팀', '대표이사', '이사회', '자문역/고문'];
    const availableCenters = centersFromDB
      .filter(c => !excludedCenters.includes(c.name))
      .map(c => ({
        id: c.code,
        name: c.name
      }));

    // 현재 선택된 센터 이름 찾기
    const selectedCenter = center ? centersFromDB.find(c => c.code === center) : null;
    const centerName = selectedCenter ? selectedCenter.name : availableCenters[0]?.name || '전체';

    // 레벨별 월별 데이터 정리
    const levels = ['Lv.4', 'Lv.3', 'Lv.2', 'Lv.1'];
    const levelData = levels.map(level => {
      const monthlyData = monthlyResults.map(({ month, data }) => {
        // 선택된 센터의 데이터 가져오기
        const centerData = centerName && data.matrix[level] ?
          data.matrix[level][centerName] : 0;

        // 전체 센터 평균 계산 (선택된 센터가 없을 경우)
        const allCentersData = data.matrix[level] ?
          Object.values(data.matrix[level]).filter(v => v > 0) : [];
        const avgValue = allCentersData.length > 0 ?
          allCentersData.reduce((sum, val) => sum + Number(val), 0) / allCentersData.length : 0;

        const value = centerName !== '전체' ? centerData : avgValue;

        return {
          month,
          weeklyClaimedHours: value, // 실제 근태시간 데이터
          weeklyAdjustedHours: value, // 실제 데이터 값 (현재 동일)
          employeeCount: 0 // 추후 실제 인원수 추가 가능
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
          weeklyClaimedHours: Math.round(avgClaimed * 10) / 10,
          weeklyAdjustedHours: Math.round(avgAdjusted * 10) / 10
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