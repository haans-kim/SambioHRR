import db from '../db';

interface WorkTimeStatistics {
  orgId: string;
  orgName: string;
  orgLevel: string;
  avgWorkTime: number;
  stdDeviation: number;
  varianceCoefficient: number;
  minWorkTime: number;
  maxWorkTime: number;
  q1: number;
  median: number;
  q3: number;
  employeeCount: number;
  outlierCount: number;
  riskLevel: 'safe' | 'warning' | 'danger';
}

interface OrganizationInsight {
  type: 'burnout' | 'underutilized' | 'imbalance' | 'trend' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedCount: number;
  recommendation: string;
  orgId?: string;
  orgName?: string;
}

// 날짜 범위 가져오기
function getDateRange(): { min_date: string; max_date: string } {
  const result = db.prepare(`
    SELECT 
      MIN(analysis_date) as min_date, 
      MAX(analysis_date) as max_date 
    FROM daily_analysis_results
    WHERE analysis_date IS NOT NULL
  `).get() as any;
  
  return {
    min_date: result?.min_date || '2025-06-01',
    max_date: result?.max_date || '2025-06-30'
  };
}

// 조직별 근무시간 표준편차 계산
export function getWorkTimeStatistics(
  orgLevel: 'center' | 'team' | 'group',
  parentId?: string,
  dateRange?: { start: string; end: string }
): WorkTimeStatistics[] {
  const dates = dateRange || getDateRange();
  const startDate = 'start' in dates ? dates.start : dates.min_date;
  const endDate = 'end' in dates ? dates.end : dates.max_date;
  const dateFilter = `AND d.analysis_date BETWEEN '${startDate}' AND '${endDate}'`;

  let orgColumn = '';
  let parentFilter = '';
  
  if (orgLevel === 'center') {
    orgColumn = 'center';
  } else if (orgLevel === 'team') {
    orgColumn = 'team';
    if (parentId) {
      parentFilter = `AND d.center_id = '${parentId}'`;
    }
  } else {
    orgColumn = 'group';
    if (parentId) {
      parentFilter = `AND d.team_id = '${parentId}'`;
    }
  }

  const query = `
    WITH work_stats AS (
      SELECT 
        d.${orgColumn}_id as org_id,
        d.${orgColumn}_name as org_name,
        d.employee_id,
        AVG(d.actual_work_hours * 60) as avg_minutes,
        COUNT(DISTINCT d.analysis_date) as work_days
      FROM daily_analysis_results d
      WHERE 1=1 ${dateFilter} ${parentFilter}
        AND d.actual_work_hours > 0
      GROUP BY d.${orgColumn}_id, d.${orgColumn}_name, d.employee_id
    ),
    org_stats AS (
      SELECT 
        org_id,
        org_name,
        AVG(avg_minutes) as mean_work_time,
        COUNT(DISTINCT employee_id) as employee_count,
        MIN(avg_minutes) as min_time,
        MAX(avg_minutes) as max_time
      FROM work_stats
      GROUP BY org_id, org_name
    ),
    deviations AS (
      SELECT 
        ws.org_id,
        ws.employee_id,
        ws.avg_minutes,
        os.mean_work_time,
        (ws.avg_minutes - os.mean_work_time) * (ws.avg_minutes - os.mean_work_time) as squared_diff
      FROM work_stats ws
      JOIN org_stats os ON ws.org_id = os.org_id
    ),
    std_calc AS (
      SELECT 
        org_id,
        SQRT(AVG(squared_diff)) as std_dev
      FROM deviations
      GROUP BY org_id
    ),
    outlier_calc AS (
      SELECT 
        d.org_id,
        COUNT(*) as outlier_count
      FROM deviations d
      JOIN std_calc sc ON d.org_id = sc.org_id
      WHERE ABS(d.avg_minutes - d.mean_work_time) > 2 * sc.std_dev
      GROUP BY d.org_id
    ),
    percentiles AS (
      SELECT 
        org_id,
        avg_minutes,
        NTILE(4) OVER (PARTITION BY org_id ORDER BY avg_minutes) as quartile
      FROM work_stats
    )
    SELECT 
      os.org_id,
      os.org_name,
      '${orgLevel}' as org_level,
      ROUND(os.mean_work_time, 1) as avg_work_time,
      ROUND(sc.std_dev, 1) as std_deviation,
      ROUND((sc.std_dev / NULLIF(os.mean_work_time, 0)) * 100, 1) as variance_coefficient,
      os.min_time as min_work_time,
      os.max_time as max_work_time,
      MAX(CASE WHEN p.quartile = 1 THEN p.avg_minutes END) as q1,
      MAX(CASE WHEN p.quartile = 2 THEN p.avg_minutes END) as median,
      MAX(CASE WHEN p.quartile = 3 THEN p.avg_minutes END) as q3,
      os.employee_count,
      COALESCE(oc.outlier_count, 0) as outlier_count,
      CASE 
        WHEN (sc.std_dev / NULLIF(os.mean_work_time, 0)) * 100 < 15 THEN 'safe'
        WHEN (sc.std_dev / NULLIF(os.mean_work_time, 0)) * 100 < 25 THEN 'warning'
        ELSE 'danger'
      END as risk_level
    FROM org_stats os
    LEFT JOIN std_calc sc ON os.org_id = sc.org_id
    LEFT JOIN outlier_calc oc ON os.org_id = oc.org_id
    LEFT JOIN percentiles p ON os.org_id = p.org_id
    WHERE os.org_id IS NOT NULL
    GROUP BY os.org_id, os.org_name, os.mean_work_time, sc.std_dev, os.min_time, os.max_time, os.employee_count, oc.outlier_count
    ORDER BY variance_coefficient DESC;
  `;

  return db.prepare(query).all() as WorkTimeStatistics[];
}

// 전사 레벨 인사이트 생성
export function getOrganizationInsights(): OrganizationInsight[] {
  const insights: OrganizationInsight[] = [];
  const dates = getDateRange();
  const maxDate = dates.max_date;

  // 1. 번아웃 위험군 감지 (주 52시간 초과)
  const burnoutQuery = `
    WITH weekly_work AS (
      SELECT 
        e.employee_id,
        e.employee_name,
        e.team_name,
        SUM(d.actual_work_hours) as weekly_hours
      FROM daily_analysis_results d
      JOIN employees e ON d.employee_id = e.employee_id
      WHERE d.analysis_date BETWEEN date('${maxDate}', '-6 days') AND '${maxDate}'
      GROUP BY e.employee_id, e.employee_name, e.team_name
      HAVING weekly_hours > 52
    )
    SELECT 
      COUNT(*) as risk_count,
      GROUP_CONCAT(DISTINCT team_name) as affected_teams
    FROM weekly_work;
  `;
  
  const burnoutResult = db.prepare(burnoutQuery).get() as any;
  if (burnoutResult?.risk_count > 0) {
    insights.push({
      type: 'burnout',
      severity: burnoutResult.risk_count > 50 ? 'critical' : burnoutResult.risk_count > 20 ? 'high' : 'medium',
      title: '번아웃 위험군 감지',
      description: `주 52시간 초과 근무자 ${burnoutResult.risk_count}명 발견`,
      affectedCount: burnoutResult.risk_count,
      recommendation: '업무 재배분 및 인력 지원 검토 필요'
    });
  }

  // 2. 팀별 근무 불균형 감지
  const imbalanceQuery = `
    WITH team_variance AS (
      SELECT 
        d.team_id,
        d.team_name,
        COUNT(DISTINCT d.employee_id) as emp_count,
        AVG(d.actual_work_hours * 60) as avg_minutes,
        MAX(d.actual_work_hours * 60) - MIN(d.actual_work_hours * 60) as work_range
      FROM daily_analysis_results d
      WHERE d.analysis_date = '${maxDate}'
      GROUP BY d.team_id, d.team_name
      HAVING work_range > 180 -- 3시간 이상 차이
    )
    SELECT 
      COUNT(*) as team_count,
      GROUP_CONCAT(team_name, ', ') as teams
    FROM team_variance;
  `;

  const imbalanceResult = db.prepare(imbalanceQuery).get() as any;
  if (imbalanceResult?.team_count > 0) {
    insights.push({
      type: 'imbalance',
      severity: imbalanceResult.team_count > 10 ? 'high' : 'medium',
      title: '팀 내 근무 불균형',
      description: `${imbalanceResult.team_count}개 팀에서 심각한 근무 편차 발생`,
      affectedCount: imbalanceResult.team_count,
      recommendation: '팀 내 근무 분배 현황 점검 필요'
    });
  }

  // 3. 저활용 인력 감지
  const underutilizedQuery = `
    WITH low_work AS (
      SELECT 
        employee_id,
        AVG(actual_work_hours) as avg_hours
      FROM daily_analysis_results
      WHERE analysis_date BETWEEN date('${maxDate}', '-6 days') AND '${maxDate}'
      GROUP BY employee_id
      HAVING avg_hours < 6
    )
    SELECT COUNT(*) as total_low FROM low_work;
  `;

  const underutilizedResult = db.prepare(underutilizedQuery).get() as any;
  if (underutilizedResult?.total_low > 0) {
    insights.push({
      type: 'underutilized',
      severity: underutilizedResult.total_low > 100 ? 'high' : 'low',
      title: '저활용 인력 발견',
      description: `일평균 6시간 미만 근무자 ${underutilizedResult.total_low}명`,
      affectedCount: underutilizedResult.total_low,
      recommendation: '업무 할당 검토 또는 교육 프로그램 고려'
    });
  }

  // 4. 급격한 변화 감지
  const anomalyQuery = `
    WITH daily_avg AS (
      SELECT 
        date(analysis_date) as work_date,
        AVG(actual_work_hours * 60) as daily_avg,
        LAG(AVG(actual_work_hours * 60), 1) OVER (ORDER BY analysis_date) as prev_avg
      FROM daily_analysis_results
      WHERE analysis_date BETWEEN date('${maxDate}', '-13 days') AND '${maxDate}'
      GROUP BY date(analysis_date)
    )
    SELECT 
      work_date,
      daily_avg,
      prev_avg,
      ((daily_avg - prev_avg) / NULLIF(prev_avg, 0)) * 100 as change_rate
    FROM daily_avg
    WHERE ABS(change_rate) > 20
    ORDER BY work_date DESC
    LIMIT 1;
  `;

  const anomalyResult = db.prepare(anomalyQuery).get() as any;
  if (anomalyResult) {
    insights.push({
      type: 'anomaly',
      severity: Math.abs(anomalyResult.change_rate) > 30 ? 'high' : 'medium',
      title: '급격한 근무 패턴 변화',
      description: `전일 대비 ${Math.abs(anomalyResult.change_rate).toFixed(1)}% ${anomalyResult.change_rate > 0 ? '증가' : '감소'}`,
      affectedCount: 0,
      recommendation: '특별 프로젝트 또는 이슈 발생 여부 확인 필요'
    });
  }

  return insights;
}

// 센터별 팀 분포 및 성과 데이터
export function getCenterTeamDistribution(centerId?: string) {
  const dates = getDateRange();
  const centerFilter = centerId ? `AND d.center_id = '${centerId}'` : '';
  
  const query = `
    WITH team_emp_work AS (
      SELECT 
        d.center_id,
        d.center_name,
        d.team_id,
        d.team_name,
        d.employee_id,
        AVG(d.actual_work_hours) as emp_avg_hours,
        AVG(d.efficiency_ratio) as emp_efficiency,
        AVG(d.confidence_score) as emp_reliability
      FROM daily_analysis_results d
      WHERE d.analysis_date BETWEEN '${dates.min_date}' AND '${dates.max_date}'
        AND d.team_name IS NOT NULL
        AND d.actual_work_hours > 0
        ${centerFilter}
      GROUP BY d.center_id, d.center_name, d.team_id, d.team_name, d.employee_id
    ),
    team_stats AS (
      SELECT 
        center_id,
        center_name,
        team_id,
        team_name,
        COUNT(DISTINCT employee_id) as headcount,
        AVG(emp_avg_hours) as avg_work_hours,
        AVG(emp_efficiency) as avg_efficiency,
        AVG(emp_reliability) as avg_reliability
      FROM team_emp_work
      GROUP BY center_id, center_name, team_id, team_name
      HAVING COUNT(DISTINCT employee_id) > 0
    ),
    team_variance AS (
      SELECT 
        t.center_id,
        t.center_name,
        t.team_id,
        t.team_name,
        t.headcount,
        t.avg_work_hours,
        t.avg_efficiency,
        t.avg_reliability,
        SQRT(AVG((e.emp_avg_hours - t.avg_work_hours) * (e.emp_avg_hours - t.avg_work_hours))) as std_dev_hours
      FROM team_stats t
      JOIN team_emp_work e ON t.team_name = e.team_name
      GROUP BY t.center_id, t.center_name, t.team_id, t.team_name, t.headcount, t.avg_work_hours, t.avg_efficiency, t.avg_reliability
    )
    SELECT 
      COALESCE(team_id, team_name) as team_id,
      team_name,
      center_name,
      headcount,
      ROUND(avg_work_hours, 1) as avg_work_hours,
      ROUND(avg_efficiency, 1) as efficiency_rate,
      ROUND(avg_reliability, 1) as data_reliability,
      ROUND(std_dev_hours, 1) as std_dev_hours,
      ROUND((std_dev_hours / NULLIF(avg_work_hours, 0)) * 100, 1) as cv_percentage,
      CASE 
        WHEN (std_dev_hours / NULLIF(avg_work_hours, 0)) * 100 < 15 THEN 'balanced'
        WHEN (std_dev_hours / NULLIF(avg_work_hours, 0)) * 100 < 25 THEN 'moderate'
        ELSE 'imbalanced'
      END as balance_status
    FROM team_variance
    WHERE team_name IS NOT NULL
    ORDER BY cv_percentage DESC;
  `;

  return db.prepare(query).all();
}

// 실시간 모니터링 데이터
export function getRealTimeMetrics() {
  const dates = getDateRange();
  const latestDate = dates.max_date;
  
  const query = `
    WITH current_status AS (
      SELECT 
        COUNT(DISTINCT CASE 
          WHEN d.work_end IS NULL AND d.work_start IS NOT NULL 
          THEN d.employee_id 
        END) as currently_working,
        COUNT(DISTINCT CASE 
          WHEN d.actual_work_hours > 10
          THEN d.employee_id 
        END) as overtime_today,
        AVG(d.confidence_score) as avg_reliability,
        AVG(d.efficiency_ratio) as avg_efficiency
      FROM daily_analysis_results d
      WHERE d.analysis_date = '${latestDate}'
    )
    SELECT 
      currently_working,
      overtime_today,
      ROUND(avg_reliability, 1) as data_reliability,
      ROUND(avg_efficiency, 1) as work_efficiency
    FROM current_status;
  `;

  return db.prepare(query).get();
}