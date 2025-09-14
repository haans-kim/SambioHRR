import db from '../client';
import type { OrganizationWithStats } from '@/lib/types/organization';
import { getCenterWeeklyClaimedHoursFromClaim } from './claim-analytics';

/**
 * claim_data 기반 센터별 통계를 가져오는 함수
 * 정확한 주간 근태시간을 계산
 */
export function getOrganizationsWithClaimStats(level: string, startDate: string, endDate: string): OrganizationWithStats[] {
  // 1. 조직 마스터 데이터 가져오기
  const organizations = db.prepare(`
    SELECT
      org_code as orgCode,
      org_name as orgName,
      org_level as orgLevel,
      parent_org_code as parentOrgCode,
      display_order as displayOrder,
      is_active as isActive,
      (SELECT COUNT(*) FROM organization_master WHERE parent_org_code = o.org_code) as childrenCount
    FROM organization_master o
    WHERE o.org_level = ? AND o.is_active = 1
      AND o.org_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
    ORDER BY o.display_order, o.org_name
  `).all(level) as any[];

  // 2. 각 센터별 claim_data 기반 통계 계산
  const orgsWithStats = organizations.map(org => {
    // claim_data 기반 주간 근태시간 계산
    const claimStats = getCenterWeeklyClaimedHoursFromClaim(org.orgName, startDate, endDate);

    // daily_analysis_results 기반 기타 통계 (효율성, 신뢰도 등)
    const darStats = db.prepare(`
      SELECT
        COUNT(DISTINCT dar.employee_id) as totalEmployees,
        ROUND(
          SUM(
            dar.actual_work_hours *
            (0.95 + (1.0 / (1.0 + EXP(-12.0 * (dar.confidence_score / 100.0 - 0.65))) * 0.05))
          ) / NULLIF(SUM(dar.claimed_work_hours), 0) * 100,
          1
        ) as avgWorkEfficiency,
        ROUND(AVG(dar.confidence_score), 1) as avgDataReliability,
        ROUND(AVG(CASE WHEN dar.focused_work_minutes >= 30 THEN dar.focused_work_minutes / 60.0 ELSE NULL END), 1) as avgFocusedWorkHours,
        -- 주간 근무시간
        ROUND(
          SUM(dar.actual_work_hours) / COUNT(DISTINCT dar.employee_id) /
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyWorkHours,
        -- AI 보정된 주간 근무시간 (시그모이드 함수 사용)
        ROUND(
          (SUM(dar.actual_work_hours) / COUNT(DISTINCT dar.employee_id) /
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7) *
          (0.95 + (1.0 / (1.0 + EXP(-12.0 * (AVG(dar.confidence_score) / 100.0 - 0.65))) * 0.05)),
          1
        ) as avgAdjustedWeeklyWorkHours
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      WHERE dar.analysis_date BETWEEN ? AND ?
        AND e.center_name = ?
    `).get(endDate, startDate, endDate, startDate, startDate, endDate, org.orgName) as any;

    return {
      ...org,
      stats: {
        totalEmployees: claimStats?.totalEmployees || darStats?.totalEmployees || 0,
        avgWorkEfficiency: darStats?.avgWorkEfficiency || 0,
        avgDataReliability: darStats?.avgDataReliability || 0,
        avgFocusedWorkHours: darStats?.avgFocusedWorkHours || 0,
        // claim_data 기반 정확한 주간 근태시간
        avgWeeklyClaimedHours: claimStats?.avgWeeklyClaimedHours || 0,
        avgWeeklyClaimedHoursAdjusted: claimStats?.avgWeeklyClaimedHours || 0,
        // daily_analysis_results 기반 주간 근무시간
        avgWeeklyWorkHours: darStats?.avgWeeklyWorkHours || 0,
        avgWeeklyWorkHoursAdjusted: darStats?.avgWeeklyWorkHours || 0,
        // AI 보정된 주간 근무시간
        avgAdjustedWeeklyWorkHours: darStats?.avgAdjustedWeeklyWorkHours || 0,
        // 기타 필드들은 필요시 추가
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

  return orgsWithStats;
}