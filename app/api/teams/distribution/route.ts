import { NextRequest, NextResponse } from 'next/server';
import { getCenterTeamDistribution } from '@/lib/queries/statistics';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const centerId = searchParams.get('centerId') || undefined;
    
    const teams = getCenterTeamDistribution(centerId);
    
    // 데이터 변환 및 필터링
    const formattedTeams = teams
      .filter((team: any) => {
        // 유효한 데이터만 필터링
        return team.headcount > 0 && 
               team.avg_work_hours > 0 && 
               team.efficiency_rate > 0 &&
               team.efficiency_rate <= 100; // 100% 초과 데이터 제외
      })
      .map((team: any) => ({
        team_id: team.team_id,
        team_name: team.team_name,
        center_name: team.center_name,
        headcount: team.headcount,
        avg_work_hours: Math.min(team.avg_work_hours, 12), // 최대 12시간으로 제한
        efficiency_rate: Math.min(team.efficiency_rate, 100), // 최대 100%로 제한
        std_dev_hours: team.std_dev_hours,
        cv_percentage: team.cv_percentage,
        balance_status: team.balance_status
      }));
    
    return NextResponse.json({ 
      teams: formattedTeams,
      summary: {
        total_teams: formattedTeams.length,
        avg_efficiency: formattedTeams.length > 0 
          ? formattedTeams.reduce((sum: number, t: any) => sum + t.efficiency_rate, 0) / formattedTeams.length
          : 0,
        avg_work_hours: formattedTeams.length > 0
          ? formattedTeams.reduce((sum: number, t: any) => sum + t.avg_work_hours, 0) / formattedTeams.length
          : 0
      }
    });
  } catch (error) {
    console.error('Failed to fetch team distribution:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team distribution' },
      { status: 500 }
    );
  }
}