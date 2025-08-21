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
        -- X축: 장비 사용 (건/인)
        ROUND(o_tag_count * 1.0 / NULLIF(employee_count, 0), 1) as equipment_per_person,
        -- Y축: 이동성 지수
        ROUND(t1_count * 1.0 / NULLIF(employee_count, 0), 1) as movement_per_person,
        -- 색상: 클러스터 타입
        cluster_type,
        -- 추가 정보 (툴팁용)
        ROUND(knox_total_count * 1.0 / NULLIF(employee_count, 0), 1) as knox_per_person,
        ROUND(g3_count * 1.0 / NULLIF(employee_count, 0), 1) as meeting_per_person,
        reliability_score,
        correction_factor,
        correction_type
      FROM dept_pattern_analysis_new
      WHERE is_analysis_target = 1  -- 분석 대상 팀만 (직원 5명 이상)
      ORDER BY cluster_type, team
    `).all();

    // 클러스터별 통계
    const clusterStats = db.prepare(`
      SELECT 
        cluster_type as cluster_name,
        COUNT(*) as team_count,
        SUM(employee_count) as total_employees,
        ROUND(AVG(knox_total_count * 1.0 / NULLIF(employee_count, 0)), 1) as avg_knox_per_person,
        ROUND(AVG(o_tag_count * 1.0 / NULLIF(employee_count, 0)), 1) as avg_equipment_per_person,
        ROUND(AVG(t1_count * 1.0 / NULLIF(employee_count, 0)), 1) as avg_movement_per_person,
        ROUND(AVG(g3_count * 1.0 / NULLIF(employee_count, 0)), 1) as avg_meeting_per_person,
        ROUND(AVG(reliability_score), 2) as avg_reliability,
        ROUND(AVG(correction_factor), 2) as avg_correction_factor
      FROM dept_pattern_analysis_new
      WHERE is_analysis_target = 1  -- 분석 대상 팀만
      GROUP BY cluster_type
      ORDER BY cluster_type
    `).all();

    // 센터별 클러스터 분포
    const centerDistribution = db.prepare(`
      SELECT 
        center,
        cluster_type,
        COUNT(*) as count,
        SUM(employee_count) as employees
      FROM dept_pattern_analysis_new
      WHERE is_analysis_target = 1
      GROUP BY center, cluster_type
      ORDER BY center, cluster_type
    `).all();

    return NextResponse.json({
      patterns,
      clusterStats,
      centerDistribution,
      summary: {
        totalTeams: patterns.length,
        totalEmployees: patterns.reduce((sum: number, p: any) => sum + p.employee_count, 0),
        clusterTypes: [...new Set(patterns.map((p: any) => p.cluster_type))]
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