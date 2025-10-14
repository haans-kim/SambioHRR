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

    // 클러스터별 통계 (시간 정보 포함)
    const clusterStats = db.prepare(`
      SELECT
        p.cluster_type as cluster_name,
        COUNT(DISTINCT p.team) as team_count,
        SUM(p.employee_count) as total_employees,
        ROUND(AVG(p.knox_total_count * 1.0 / NULLIF(p.employee_count, 0)), 1) as avg_knox_per_person,
        ROUND(AVG(p.o_tag_count * 1.0 / NULLIF(p.employee_count, 0)), 1) as avg_equipment_per_person,
        ROUND(AVG(p.t1_count * 1.0 / NULLIF(p.employee_count, 0)), 1) as avg_movement_per_person,
        ROUND(AVG(p.g3_count * 1.0 / NULLIF(p.employee_count, 0)), 1) as avg_meeting_per_person,
        ROUND(AVG(p.reliability_score), 2) as avg_reliability,
        ROUND(AVG(p.correction_factor), 2) as avg_correction_factor,
        ROUND(AVG(s.avg_actual_work_hours), 1) as avg_actual_work_hours,
        ROUND(AVG(s.avg_meeting_hours), 1) as avg_meeting_hours
      FROM dept_pattern_analysis_new p
      LEFT JOIN (
        SELECT
          org_code,
          AVG(avg_actual_work_hours) as avg_actual_work_hours,
          AVG(avg_meeting_hours) as avg_meeting_hours
        FROM organization_daily_stats
        WHERE work_date >= date('now', '-30 days')
        GROUP BY org_code
      ) s ON p.team = s.org_code
      WHERE p.is_analysis_target = 1  -- 분석 대상 팀만
      GROUP BY p.cluster_type
      ORDER BY p.cluster_type
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

    // 태그 개수 요약 통계
    const tagSummary = db.prepare(`
      SELECT 
        SUM(o_tag_count) as total_o_tags,
        SUM(knox_total_count) as total_knox,
        SUM(t1_count) as total_t1,
        SUM(g3_count) as total_g3,
        COUNT(DISTINCT team) as total_teams,
        SUM(employee_count) as total_employees,
        ROUND(AVG(o_tag_count * 1.0 / NULLIF(employee_count, 0)), 1) as avg_o_per_person,
        ROUND(AVG(knox_total_count * 1.0 / NULLIF(employee_count, 0)), 1) as avg_knox_per_person,
        ROUND(AVG(t1_count * 1.0 / NULLIF(employee_count, 0)), 1) as avg_t1_per_person,
        ROUND(AVG(g3_count * 1.0 / NULLIF(employee_count, 0)), 1) as avg_g3_per_person
      FROM dept_pattern_analysis_new
      WHERE is_analysis_target = 1
    `).get();

    return NextResponse.json({
      patterns,
      clusterStats,
      centerDistribution,
      tagSummary,
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