import { NextRequest, NextResponse } from 'next/server';
import { getCenters } from '@/lib/database/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const center = searchParams.get('center');
    const year = parseInt(searchParams.get('year') || '2025');
    const startMonth = parseInt(searchParams.get('startMonth') || '1');
    const endMonth = parseInt(searchParams.get('endMonth') || '6');

    // 샘플 데이터 생성 (1월~12월)
    const sampleData = {
      'Lv.4': [46.04, 50.53, 49.01, 50.57, 48.13, 47.18, 48.92, 49.35, 47.88, 48.45, 49.12, 48.76], // 1월~12월
      'Lv.3': [42.40, 45.17, 44.38, 45.40, 43.01, 43.33, 44.15, 43.87, 44.22, 43.95, 44.30, 43.68],
      'Lv.2': [41.44, 43.31, 42.30, 42.41, 42.02, 42.18, 42.55, 42.78, 42.33, 42.60, 42.45, 42.25],
      'Lv.1': [41.25, 42.55, 42.59, 43.17, 42.13, 42.44, 42.85, 42.92, 42.67, 42.35, 42.75, 42.50]
    };

    // 레벨별 데이터 생성
    const levelData = Object.entries(sampleData).map(([level, monthlyValues]) => {
      const monthlyData = monthlyValues.map((value, index) => ({
        month: index + 1,
        weeklyClaimedHours: value - (Math.random() * 2 - 1), // 근태시간 (약간 낮게)
        weeklyAdjustedHours: value, // 근무추정시간
        employeeCount: Math.floor(1000 + Math.random() * 500) // 랜덤 인원수
      }));

      const avgClaimed = monthlyData.reduce((sum, d) => sum + d.weeklyClaimedHours, 0) / monthlyData.length;
      const avgAdjusted = monthlyData.reduce((sum, d) => sum + d.weeklyAdjustedHours, 0) / monthlyData.length;

      // Return all 12 months of data
      const filteredMonthlyData = monthlyData.slice(startMonth - 1, endMonth);

      return {
        level,
        monthlyData: filteredMonthlyData,
        average: {
          weeklyClaimedHours: Math.round(avgClaimed * 10) / 10,
          weeklyAdjustedHours: Math.round(avgAdjusted * 10) / 10
        }
      };
    });

    // 전체 요약 통계
    const totalEmployees = 5000;
    const avgWeeklyClaimedHours = 42.3;
    const avgWeeklyAdjustedHours = 42.5;
    const efficiency = 100.5;

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
    const centerName = selectedCenter ? selectedCenter.name : '전체';

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
      { error: 'Failed to fetch trend data' },
      { status: 500 }
    );
  }
}