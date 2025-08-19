import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    // 전체 패턴 분석 데이터 조회
    const patterns = db.prepare(`
      SELECT 
        center,
        bu,
        team,
        employee_count,
        location_fixity,
        movement_complexity,
        data_density,
        external_activity,
        cluster,
        reliability_score,
        correction_factor,
        correction_type
      FROM dept_pattern_analysis_new
      ORDER BY cluster, team
    `).all();

    // 클러스터별 통계
    const clusterStats = db.prepare(`
      SELECT 
        CASE cluster
          WHEN 0 THEN 'Type_A_생산고정형'
          WHEN 1 THEN 'Type_B_생산중심형(외부활동)'
          WHEN 2 THEN 'Type_C_혼합근무형'
          WHEN 3 THEN 'Type_D_사무중심형'
          WHEN 4 THEN 'Type_E_사무전문형'
        END as cluster_name,
        cluster,
        COUNT(*) as team_count,
        SUM(employee_count) as total_employees,
        ROUND(AVG(location_fixity), 2) as avg_location_fixity,
        ROUND(AVG(data_density), 2) as avg_data_density,
        ROUND(AVG(external_activity), 2) as avg_external_activity,
        ROUND(AVG(reliability_score), 2) as avg_reliability,
        ROUND(AVG(correction_factor), 2) as avg_correction_factor
      FROM dept_pattern_analysis_new
      GROUP BY cluster
      ORDER BY cluster
    `).all();

    // 센터별 클러스터 분포
    const centerDistribution = db.prepare(`
      SELECT 
        center,
        cluster,
        COUNT(*) as count,
        SUM(employee_count) as employees
      FROM dept_pattern_analysis_new
      GROUP BY center, cluster
      ORDER BY center, cluster
    `).all();

    return NextResponse.json({
      patterns,
      clusterStats,
      centerDistribution,
      summary: {
        totalTeams: patterns.length,
        totalEmployees: patterns.reduce((sum: number, p: any) => sum + p.employee_count, 0),
        clusterCount: 5
      }
    });
  } catch (error) {
    console.error('Failed to fetch pattern analysis:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pattern analysis' },
      { status: 500 }
    );
  }
}