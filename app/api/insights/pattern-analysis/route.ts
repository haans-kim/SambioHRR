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
        ROUND((eam_count + lams_count + mes_count + equis_count + mdm_count) * 1.0 / NULLIF(employee_count, 0), 1) as data_density,  -- o_per_person: 장비 사용 (건/인)
        ROUND((t1_count * 1.0 / NULLIF(employee_count, 0)) / 
              NULLIF((knox_total_count + (eam_count + lams_count + mes_count + equis_count + mdm_count) + t1_count + g3_count) * 1.0 / NULLIF(employee_count, 0), 0) * 100, 1) as movement_complexity,  -- mobility_index: 이동성 지수 (%)
        ROUND(knox_total_count * 1.0 / NULLIF(employee_count, 0), 1) as knox_per,
        ROUND(g3_count * 1.0 / NULLIF(employee_count, 0), 1) as g3_per,
        cluster,  -- DB에 저장된 cluster 값 사용
        reliability_score,
        correction_factor,
        correction_type
      FROM dept_pattern_analysis_new
      WHERE employee_count >= 5  -- 5명 미만 팀 제외
      ORDER BY cluster, team
    `).all();

    // 클러스터별 통계
    const clusterStats = db.prepare(`
      SELECT 
        CASE cluster
          WHEN 0 THEN '장비운영집중형'
          WHEN 1 THEN '디지털협업중심형'
          WHEN 2 THEN '현장이동활발형'
          WHEN 3 THEN '균형업무형'
          WHEN 4 THEN '회의협업중심형'
        END as cluster_name,
        cluster,
        COUNT(*) as team_count,
        SUM(employee_count) as total_employees,
        ROUND(AVG(knox_total_count * 1.0 / NULLIF(employee_count, 0)), 1) as avg_location_fixity,  -- Knox 평균
        ROUND(AVG((eam_count + lams_count + mes_count + equis_count + mdm_count) * 1.0 / NULLIF(employee_count, 0)), 1) as avg_data_density,  -- 장비 사용 평균 (o_per_person)
        ROUND(AVG((t1_count * 1.0 / NULLIF(employee_count, 0)) / 
              NULLIF((knox_total_count + (eam_count + lams_count + mes_count + equis_count + mdm_count) + t1_count + g3_count) * 1.0 / NULLIF(employee_count, 0), 0) * 100), 1) as avg_external_activity,  -- 이동성 지수 평균 (mobility_index %)
        ROUND(AVG(reliability_score), 2) as avg_reliability,
        ROUND(AVG(correction_factor), 2) as avg_correction_factor
      FROM dept_pattern_analysis_new
      WHERE employee_count >= 5  -- 5명 미만 팀 제외
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