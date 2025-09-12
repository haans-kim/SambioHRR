import db from '../client';
import type { Organization, OrganizationWithStats, OrgLevel } from '@/lib/types/organization';
import { calculateAdjustedWorkHours, FLEXIBLE_WORK_ADJUSTMENT_FACTOR } from '@/lib/utils';

// Helper function to get 30-day date range
function get30DayDateRange(): { startDate: string; endDate: string } {
  const result = db.prepare(`
    SELECT 
      date(MAX(analysis_date), '-30 days') as startDate, 
      MAX(analysis_date) as endDate 
    FROM daily_analysis_results
  `).get() as any;
  
  return {
    startDate: result?.startDate || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0],
    endDate: result?.endDate || new Date().toISOString().split('T')[0]
  };
}

// 통합된 30일 기반 조직별 통계 함수
export function getOrganizationsWithStats(level: OrgLevel): OrganizationWithStats[] {
  const { startDate, endDate } = get30DayDateRange();
  
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
  
  // 2. 30일 기반 통계 계산 (레벨별 처리)
  const statsMap = new Map<string, any>();
  
  if (level === 'center') {
    const centerStats = db.prepare(`
      SELECT 
        e.center_name as orgName,
        COUNT(DISTINCT dar.employee_id) as totalEmployees,
        COUNT(*) as manDays,
        ROUND(
          SUM(
            dar.actual_work_hours * 
            (0.92 + (1.0 / (1.0 + EXP(-12.0 * (dar.confidence_score / 100.0 - 0.65))) * 0.08))
          ) / SUM(dar.claimed_work_hours) * 100, 
          1
        ) as avgWorkEfficiency,
        -- 원본 일간 근무시간 (자연 평균화)
        ROUND(
          SUM(dar.actual_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 1.4, 1
        ) as avgActualWorkHours,
        ROUND(
          SUM(dar.claimed_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 1.4, 1
        ) as avgAttendanceHours,
        -- Ground Rules 보정 일간 근무시간
        ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgGroundRulesWorkHours,
        -- 자연 평균화 주간 근무시간: analytics.ts와 정확히 동일한 공식
        ROUND(
          SUM(dar.actual_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyWorkHours,
        ROUND(
          SUM(dar.claimed_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyClaimedHours,
        -- Ground Rules 보정 주간 근무시간
        ROUND((SUM(dar.actual_work_hours) / COUNT(*)) * 5, 1) as avgWeeklyGroundRulesWorkHours,
        -- 자연 평균화 일간 근무시간 (Adjusted): 자연 평균화 적용
        ROUND(
          SUM(dar.actual_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 1.4, 1
        ) as avgActualWorkHoursAdjusted,
        ROUND(
          SUM(dar.claimed_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 1.4, 1
        ) as avgAttendanceHoursAdjusted,
        -- 자연 평균화 주간 근무시간 (Adjusted): analytics.ts와 정확히 동일한 공식
        ROUND(
          SUM(dar.actual_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyWorkHoursAdjusted,
        ROUND(
          SUM(dar.claimed_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyClaimedHoursAdjusted,
        ROUND(AVG(CASE WHEN dar.focused_work_minutes >= 30 THEN dar.focused_work_minutes / 60.0 ELSE NULL END), 1) as avgFocusedWorkHours,
        ROUND(AVG(dar.confidence_score), 1) as avgDataReliability
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      WHERE dar.analysis_date BETWEEN ? AND ?
        AND e.center_name IS NOT NULL
        AND e.job_grade IS NOT NULL
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
      GROUP BY e.center_name
    `).all(endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, startDate, endDate) as any[];
    console.log('DEBUG: centerStats result:', centerStats.slice(0, 2));
    
    centerStats.forEach(stat => {
      statsMap.set(stat.orgName, stat);
    });
  } else if (level === 'division') {
    // Division은 하위 팀들의 데이터를 집계하거나 직접 속한 직원 데이터를 집계
    organizations.forEach(div => {
      const divStats = db.prepare(`
        SELECT 
          MIN(e.center_name) as centerName,
          COUNT(DISTINCT dar.employee_id) as totalEmployees,
          COUNT(*) as manDays,
          ROUND(
            SUM(
              dar.actual_work_hours * 
              (0.92 + (1.0 / (1.0 + EXP(-12.0 * (dar.confidence_score / 100.0 - 0.65))) * 0.08))
            ) / SUM(dar.claimed_work_hours) * 100, 
            1
          ) as avgWorkEfficiency,
          -- 원본 값
          ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgActualWorkHours,
          ROUND(SUM(dar.claimed_work_hours) / COUNT(*), 1) as avgAttendanceHours,
          -- Ground Rules 보정 값
          ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgGroundRulesWorkHours,
          ROUND((SUM(dar.actual_work_hours) / COUNT(*)) * 5, 1) as avgWeeklyWorkHours,
          ROUND((SUM(dar.claimed_work_hours) / COUNT(*)) * 5, 1) as avgWeeklyClaimedHours,
          -- Ground Rules 보정 주간 근무시간
          ROUND((SUM(dar.actual_work_hours) / COUNT(*)) * 5, 1) as avgWeeklyGroundRulesWorkHours,
          -- 자연 평균화 보정 값: analytics.ts와 정확히 동일한 공식
          ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgActualWorkHoursAdjusted,
          ROUND(SUM(dar.claimed_work_hours) / COUNT(*), 1) as avgAttendanceHoursAdjusted,
          ROUND(
            SUM(dar.actual_work_hours) / COUNT(DISTINCT dar.employee_id) / 
            (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
          ) as avgWeeklyWorkHoursAdjusted,
          ROUND(
            SUM(dar.claimed_work_hours) / COUNT(DISTINCT dar.employee_id) / 
            (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
          ) as avgWeeklyClaimedHoursAdjusted,
          ROUND(AVG(CASE WHEN dar.focused_work_minutes >= 30 THEN dar.focused_work_minutes / 60.0 ELSE NULL END), 1) as avgFocusedWorkHours,
          ROUND(AVG(dar.confidence_score), 1) as avgDataReliability
        FROM daily_analysis_results dar
        JOIN employees e ON e.employee_id = dar.employee_id
        WHERE dar.analysis_date BETWEEN ? AND ?
          AND (
            e.team_name IN (
              SELECT org_name FROM organization_master
              WHERE parent_org_code = ? AND org_level = 'team'
            )
            OR e.team_name = ?
          )
      `).get(endDate, startDate, endDate, startDate, startDate, endDate, div.orgCode, div.orgName) as any;
      
      if (divStats) {
        statsMap.set(div.orgName, divStats);
      }
    });
  } else if (level === 'team') {
    const teamStats = db.prepare(`
      SELECT 
        e.team_name as orgName,
        e.center_name as centerName,
        COUNT(DISTINCT dar.employee_id) as totalEmployees,
        COUNT(*) as manDays,
        ROUND(
          SUM(
            dar.actual_work_hours * 
            (0.92 + (1.0 / (1.0 + EXP(-12.0 * (dar.confidence_score / 100.0 - 0.65))) * 0.08))
          ) / SUM(dar.claimed_work_hours) * 100, 
          1
        ) as avgWorkEfficiency,
        -- 원본 일간 근무시간
        ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgActualWorkHours,
        ROUND(SUM(dar.claimed_work_hours) / COUNT(*), 1) as avgAttendanceHours,
        -- Ground Rules 보정 일간 근무시간
        ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgGroundRulesWorkHours,
        -- 자연 평균화 주간 근무시간: analytics.ts와 정확히 동일한 공식
        ROUND(
          SUM(dar.actual_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyWorkHours,
        ROUND(
          SUM(dar.claimed_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyClaimedHours,
        -- Ground Rules 보정 주간 근무시간
        ROUND((SUM(dar.actual_work_hours) / COUNT(*)) * 5, 1) as avgWeeklyGroundRulesWorkHours,
        -- 자연 평균화 일간 근무시간 (Adjusted): 단순한 자연 평균화 사용
        ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgActualWorkHoursAdjusted,
        ROUND(SUM(dar.claimed_work_hours) / COUNT(*), 1) as avgAttendanceHoursAdjusted,
        -- 자연 평균화 주간 근무시간 (Adjusted): analytics.ts와 정확히 동일한 공식
        ROUND(
          SUM(dar.actual_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyWorkHoursAdjusted,
        ROUND(
          SUM(dar.claimed_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyClaimedHoursAdjusted,
        ROUND(AVG(CASE WHEN dar.focused_work_minutes >= 30 THEN dar.focused_work_minutes / 60.0 ELSE NULL END), 1) as avgFocusedWorkHours,
        ROUND(AVG(dar.confidence_score), 1) as avgDataReliability
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      WHERE dar.analysis_date BETWEEN ? AND ?
        AND e.team_name IS NOT NULL
      GROUP BY e.team_name, e.center_name
    `).all(endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, startDate, endDate) as any[];
    
    teamStats.forEach(stat => {
      statsMap.set(stat.orgName, stat);
    });
  } else if (level === 'group') {
    const groupStats = db.prepare(`
      SELECT 
        e.group_name as orgName,
        e.center_name as centerName,
        COUNT(DISTINCT dar.employee_id) as totalEmployees,
        COUNT(*) as manDays,
        ROUND(
          SUM(
            dar.actual_work_hours * 
            (0.92 + (1.0 / (1.0 + EXP(-12.0 * (dar.confidence_score / 100.0 - 0.65))) * 0.08))
          ) / SUM(dar.claimed_work_hours) * 100, 
          1
        ) as avgWorkEfficiency,
        -- 원본 일간 근무시간
        ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgActualWorkHours,
        ROUND(SUM(dar.claimed_work_hours) / COUNT(*), 1) as avgAttendanceHours,
        -- Ground Rules 보정 일간 근무시간
        ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgGroundRulesWorkHours,
        -- 자연 평균화 주간 근무시간: analytics.ts와 정확히 동일한 공식
        ROUND(
          SUM(dar.actual_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyWorkHours,
        ROUND(
          SUM(dar.claimed_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyClaimedHours,
        -- Ground Rules 보정 주간 근무시간
        ROUND((SUM(dar.actual_work_hours) / COUNT(*)) * 5, 1) as avgWeeklyGroundRulesWorkHours,
        -- 자연 평균화 일간 근무시간 (Adjusted): 단순한 자연 평균화 사용
        ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgActualWorkHoursAdjusted,
        ROUND(SUM(dar.claimed_work_hours) / COUNT(*), 1) as avgAttendanceHoursAdjusted,
        -- 자연 평균화 주간 근무시간 (Adjusted): analytics.ts와 정확히 동일한 공식
        ROUND(
          SUM(dar.actual_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyWorkHoursAdjusted,
        ROUND(
          SUM(dar.claimed_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyClaimedHoursAdjusted,
        ROUND(AVG(CASE WHEN dar.focused_work_minutes >= 30 THEN dar.focused_work_minutes / 60.0 ELSE NULL END), 1) as avgFocusedWorkHours,
        ROUND(AVG(dar.confidence_score), 1) as avgDataReliability
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      WHERE dar.analysis_date BETWEEN ? AND ?
        AND e.group_name IS NOT NULL
      GROUP BY e.group_name, e.center_name
    `).all(endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, startDate, endDate) as any[];
    
    groupStats.forEach(stat => {
      statsMap.set(stat.orgName, stat);
    });
  }
  
  // 3. 조직 마스터와 통계 데이터 결합
  return organizations.map(org => {
    const stats = statsMap.get(org.orgName) || {};
    
    return {
      orgCode: org.orgCode,
      orgName: org.orgName,
      orgLevel: org.orgLevel,
      parentOrgCode: org.parentOrgCode,
      displayOrder: org.displayOrder,
      isActive: Boolean(org.isActive),
      childrenCount: org.childrenCount || 0,
      stats: {
        id: 0,
        orgCode: org.orgCode,
        workDate: new Date(endDate),
        avgWorkEfficiency: stats.avgWorkEfficiency || 0,
        avgActualWorkHours: stats.avgActualWorkHours || 0,
        avgAttendanceHours: stats.avgAttendanceHours || 0,
        // 탄력근무제 보정 적용된 값들
        avgActualWorkHoursAdjusted: stats.avgActualWorkHoursAdjusted || stats.avgActualWorkHours || 0,
        avgAttendanceHoursAdjusted: stats.avgAttendanceHoursAdjusted || stats.avgAttendanceHours || 0,
        avgWeeklyWorkHoursAdjusted: stats.avgWeeklyWorkHoursAdjusted || stats.avgWeeklyWorkHours || 0,
        avgWeeklyClaimedHoursAdjusted: stats.avgWeeklyClaimedHoursAdjusted || stats.avgWeeklyClaimedHours || 0,
        totalEmployees: stats.totalEmployees || 0,
        flexibleWorkCount: stats.flexibleWorkCount || 0, // 이제 실제 값 사용
        elasticWorkCount: 0, // 추후 구현 필요 시 계산
        avgMeetingHours: 0, // 추후 구현 필요 시 계산
        avgMealHours: 0, // 추후 구현 필요 시 계산
        avgMovementHours: 0, // 추후 구현 필요 시 계산
        avgRestHours: 0, // 추후 구현 필요 시 계산
        avgDataConfidence: stats.avgDataReliability || 0, // 실제 데이터 사용
        stdActualWorkHours: 0, // 추후 구현 필요 시 계산
        stdWorkEfficiency: 0, // 추후 구현 필요 시 계산
        minWorkEfficiency: 0, // 추후 구현 필요 시 계산
        maxWorkEfficiency: 0, // 추후 구현 필요 시 계산
        avgWeeklyWorkHours: stats.avgWeeklyWorkHours || 0,
        avgWeeklyClaimedHours: stats.avgWeeklyClaimedHours || 0,
        avgFocusedWorkHours: stats.avgFocusedWorkHours || 0,
        avgDataReliability: stats.avgDataReliability || 0,
        centerName: stats.centerName || null,
        avgAdjustedWeeklyWorkHours: stats.avgWeeklyWorkHoursAdjusted || 
          (stats.avgDataReliability 
            ? calculateAdjustedWorkHours(
                stats.avgWeeklyWorkHoursAdjusted || stats.avgWeeklyWorkHours || 0, 
                stats.avgDataReliability
              )
            : 0)
      }
    };
  });
}

// 단일 조직 조회
export function getOrganizationById(orgCode: string): Organization | null {
  const stmt = db.prepare(`
    SELECT 
      org_code as orgCode,
      org_name as orgName,
      org_level as orgLevel,
      parent_org_code as parentOrgCode,
      display_order as displayOrder,
      is_active as isActive
    FROM organization_master
    WHERE org_code = ? AND is_active = 1
  `);
  
  return stmt.get(orgCode) as Organization | null;
}

// 하위 조직 조회
export function getChildOrganizations(parentOrgCode: string): Organization[] {
  const stmt = db.prepare(`
    SELECT 
      org_code as orgCode,
      org_name as orgName,
      org_level as orgLevel,
      parent_org_code as parentOrgCode,
      display_order as displayOrder,
      is_active as isActive
    FROM organization_master
    WHERE parent_org_code = ? AND is_active = 1
    ORDER BY display_order, org_name
  `);
  
  return stmt.all(parentOrgCode) as Organization[];
}

// 조직 레벨별 조회 (통계 없이)
export function getOrganizationsByLevel(level: OrgLevel): Organization[] {
  const stmt = db.prepare(`
    SELECT 
      org_code as orgCode,
      org_name as orgName,
      org_level as orgLevel,
      parent_org_code as parentOrgCode,
      display_order as displayOrder,
      is_active as isActive
    FROM organization_master
    WHERE org_level = ? AND is_active = 1
      AND org_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
    ORDER BY display_order, org_name
  `);
  
  return stmt.all(level) as Organization[];
}

// 전체 직원 수 조회 (30일 기준)
export function getTotalEmployees(): number {
  const { startDate, endDate } = get30DayDateRange();
  
  const stmt = db.prepare(`
    SELECT COUNT(DISTINCT employee_id) as total 
    FROM daily_analysis_results 
    WHERE analysis_date BETWEEN ? AND ?
  `);
  
  const result = stmt.get(startDate, endDate) as { total: number } | undefined;
  return result?.total || 0;
}

// Helper function to resolve organization name to org code
export function getOrganizationByName(orgName: string, orgLevel?: string): Organization | null {
  let query = `
    SELECT 
      org_code as orgCode,
      org_name as orgName,
      org_level as orgLevel,
      parent_org_code as parentOrgCode,
      display_order as displayOrder,
      is_active as isActive
    FROM organization_master
    WHERE org_name = ? AND is_active = 1
  `;
  
  const params: any[] = [orgName];
  
  if (orgLevel) {
    query += ' AND org_level = ?';
    params.push(orgLevel);
  }
  
  const stmt = db.prepare(query);
  const result = stmt.get(...params) as any;
  
  return result ? {
    orgCode: result.orgCode,
    orgName: result.orgName,
    orgLevel: result.orgLevel as any,
    parentOrgCode: result.parentOrgCode,
    displayOrder: result.displayOrder,
    isActive: Boolean(result.isActive)
  } : null;
}

// Period-based version of getOrganizationsWithStats
export function getOrganizationsWithStatsForPeriod(level: OrgLevel, startDate: string, endDate: string): OrganizationWithStats[] {
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
  
  // 2. Period-based 통계 계산 (레벨별 처리)
  const statsMap = new Map<string, any>();
  
  if (level === 'center') {
    const centerStats = db.prepare(`
      SELECT 
        e.center_name as orgName,
        COUNT(DISTINCT dar.employee_id) as totalEmployees,
        COUNT(*) as manDays,
        ROUND(
          SUM(
            dar.actual_work_hours *
            (0.92 + (1.0 / (1.0 + EXP(-12.0 * (dar.confidence_score / 100.0 - 0.65))) * 0.08))
          ) / SUM(dar.claimed_work_hours) * 100, 
          1
        ) as avgWorkEfficiency,
        -- 원본 값
        ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgActualWorkHours,
        ROUND(SUM(dar.claimed_work_hours) / COUNT(*), 1) as avgAttendanceHours,
        -- Ground Rules 보정 값 (있는 경우 사용)
        ROUND(
          CASE 
            WHEN SUM(CASE WHEN dar.ground_rules_work_hours > 0 THEN dar.ground_rules_work_hours ELSE 0 END) > 0
            THEN SUM(CASE WHEN dar.ground_rules_work_hours > 0 THEN dar.ground_rules_work_hours ELSE dar.actual_work_hours END) / COUNT(*)
            ELSE SUM(dar.actual_work_hours) / COUNT(*)
          END, 1
        ) as avgGroundRulesWorkHours,
        ROUND((SUM(dar.actual_work_hours) / COUNT(*)) * 5, 1) as avgWeeklyWorkHours,
        ROUND((SUM(dar.claimed_work_hours) / COUNT(*)) * 5, 1) as avgWeeklyClaimedHours,
        -- Ground Rules 보정 주간 근무시간
        ROUND(
          (CASE 
            WHEN SUM(CASE WHEN dar.ground_rules_work_hours > 0 THEN dar.ground_rules_work_hours ELSE 0 END) > 0
            THEN SUM(CASE WHEN dar.ground_rules_work_hours > 0 THEN dar.ground_rules_work_hours ELSE dar.actual_work_hours END) / COUNT(*)
            ELSE SUM(dar.actual_work_hours) / COUNT(*)
          END) * 5, 1
        ) as avgWeeklyGroundRulesWorkHours,
        -- 자연 평균화 보정 값
        ROUND(SUM(dar.actual_work_hours) / COUNT(*), 1) as avgActualWorkHoursAdjusted,
        ROUND(SUM(dar.claimed_work_hours) / COUNT(*), 1) as avgAttendanceHoursAdjusted,
        ROUND(
          SUM(dar.actual_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyWorkHoursAdjusted,
        ROUND(
          SUM(dar.claimed_work_hours) / COUNT(DISTINCT dar.employee_id) / 
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1
        ) as avgWeeklyClaimedHoursAdjusted,
        ROUND(AVG(CASE WHEN dar.focused_work_minutes >= 30 THEN dar.focused_work_minutes / 60.0 ELSE NULL END), 1) as avgFocusedWorkHours,
        ROUND(AVG(dar.confidence_score), 1) as avgDataReliability
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      WHERE dar.analysis_date BETWEEN ? AND ?
        AND e.center_name IS NOT NULL
        AND e.job_grade IS NOT NULL
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
      GROUP BY e.center_name
    `).all(endDate, startDate, endDate, startDate, startDate, endDate) as any[];
    
    
    centerStats.forEach(stat => {
      statsMap.set(stat.orgName, stat);
    });
  }
  
  // 3. 조직과 통계 매핑 (기존 함수와 동일한 형식으로)
  return organizations.map(org => {
    const stats = statsMap.get(org.orgName);
    return {
      ...org,
      stats: stats ? {
        ...stats,
        // avgAdjustedWeeklyWorkHours 필드 추가 (기존 함수와 호환성 위해)
        avgAdjustedWeeklyWorkHours: stats.avgWeeklyWorkHoursAdjusted || 
          (stats.avgDataReliability 
            ? calculateAdjustedWorkHours(
                stats.avgWeeklyWorkHoursAdjusted || stats.avgWeeklyWorkHours || 0, 
                stats.avgDataReliability
              )
            : 0)
      } : null
    };
  });
}