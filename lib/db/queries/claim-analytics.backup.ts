import db from '../client';

/**
 * claim_data 기반 주간 근태시간 계산
 * 전체 직원의 실제 근무시간을 정확하게 반영
 * 해당 월 전체에 대해 0시간인 직원은 제외
 */
export function getWeeklyClaimedHoursFromClaim(startDate: string, endDate: string) {
  const query = `
    WITH monthly_totals AS (
      SELECT
        c.사번,
        SUM(c.실제근무시간) as month_total_hours
      FROM claim_data c
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
      GROUP BY c.사번
      HAVING SUM(c.실제근무시간) > 0  -- 해당 월 전체에 대해 0시간인 직원 제외
    )
    SELECT
      COUNT(DISTINCT mt.사번) as totalEmployees,
      ROUND(SUM(c.실제근무시간), 1) as totalHours,
      -- 일수 계산 (JULIANDAY 사용)
      ROUND((JULIANDAY(?) - JULIANDAY(?) + 1), 0) as days,
      -- 주간 평균 계산: 총시간 / 인원수 / 일수 * 7
      ROUND(
        SUM(c.실제근무시간) / COUNT(DISTINCT mt.사번) /
        (JULIANDAY(?) - JULIANDAY(?) + 1) * 7,
        1
      ) as avgWeeklyClaimedHours
    FROM monthly_totals mt
    JOIN claim_data c ON c.사번 = mt.사번
    WHERE c.근무일 BETWEEN ? AND ?
  `;

  const stmt = db.prepare(query);
  return stmt.get(startDate, endDate, endDate, startDate, endDate, startDate, startDate, endDate) as {
    totalEmployees: number;
    totalHours: number;
    days: number;
    avgWeeklyClaimedHours: number;
  };
}

/**
 * claim_data 기반 센터별 주간 근태시간
 * 해당 월 전체에 대해 0시간인 직원은 제외
 */
export function getCenterWeeklyClaimedHoursFromClaim(centerName: string, startDate: string, endDate: string) {
  const query = `
    WITH monthly_totals AS (
      SELECT
        c.사번,
        SUM(c.실제근무시간) as month_total_hours
      FROM claim_data c
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name = ?
      GROUP BY c.사번
      HAVING SUM(c.실제근무시간) > 0  -- 해당 월 전체에 대해 0시간인 직원 제외
    )
    SELECT
      ? as center_name,
      COUNT(DISTINCT mt.사번) as totalEmployees,
      ROUND(SUM(c.실제근무시간), 1) as totalHours,
      ROUND(
        SUM(c.실제근무시간) / COUNT(DISTINCT mt.사번) /
        (JULIANDAY(?) - JULIANDAY(?) + 1) * 7,
        1
      ) as avgWeeklyClaimedHours
    FROM monthly_totals mt
    JOIN claim_data c ON c.사번 = mt.사번
    WHERE c.근무일 BETWEEN ? AND ?
  `;

  const stmt = db.prepare(query);
  return stmt.get(startDate, endDate, centerName, centerName, endDate, startDate, startDate, endDate) as {
    center_name: string;
    totalEmployees: number;
    totalHours: number;
    avgWeeklyClaimedHours: number;
  } | undefined;
}

/**
 * claim_data 기반 레벨별 주간 근태시간 매트릭스
 * employee_level 칼럼을 직접 사용하여 정확한 레벨 분류
 * 해당 월 전체에 대해 0시간인 직원은 제외
 */
export function getGradeWeeklyClaimedHoursMatrixFromClaim(startDate: string, endDate: string) {
  const query = `
    WITH monthly_totals AS (
      SELECT
        c.사번,
        c.employee_level,
        e.center_name,
        SUM(c.실제근무시간) as month_total_hours
      FROM claim_data c
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND c.employee_level IS NOT NULL
      GROUP BY c.사번, c.employee_level, e.center_name
      HAVING SUM(c.실제근무시간) > 0  -- 해당 월 전체에 대해 0시간인 직원 제외
    ),
    grade_hours AS (
      SELECT
        mt.employee_level as grade_level,
        mt.center_name,
        COUNT(DISTINCT mt.사번) as employees,
        SUM(c.실제근무시간) as total_hours,
        ROUND(
          SUM(c.실제근무시간) / COUNT(DISTINCT mt.사번) /
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7,
          1
        ) as avg_weekly_hours
      FROM monthly_totals mt
      JOIN claim_data c ON c.사번 = mt.사번
      WHERE c.근무일 BETWEEN ? AND ?
      GROUP BY mt.employee_level, mt.center_name
    )
    SELECT
      grade_level,
      center_name,
      avg_weekly_hours
    FROM grade_hours
    ORDER BY grade_level, center_name
  `;

  const stmt = db.prepare(query);
  const rows = stmt.all(startDate, endDate, endDate, startDate, startDate, endDate) as Array<{
    grade_level: string;
    center_name: string;
    avg_weekly_hours: number;
  }>;

  // Transform to matrix format - Include Special for executives and lawyers
  const grades = ['Special', 'Lv.4', 'Lv.3', 'Lv.2', 'Lv.1'];
  const centers = [...new Set(rows.map(r => r.center_name))].sort();
  const matrix: Record<string, Record<string, number>> = {};

  grades.forEach(grade => {
    matrix[grade] = {};
    centers.forEach(center => {
      const row = rows.find(r => r.grade_level === grade && r.center_name === center);
      matrix[grade][center] = row?.avg_weekly_hours || 0;
    });
  });

  return {
    grades,
    centers,
    matrix
  };
}

/**
 * claim_data 기반 전체 직원 수 (필터 적용)
 * 해당 월 전체에 대해 0시간인 직원은 제외
 */
export function getTotalEmployeesFromClaim(startDate: string, endDate: string) {
  const query = `
    WITH monthly_totals AS (
      SELECT
        c.사번,
        SUM(c.실제근무시간) as month_total_hours
      FROM claim_data c
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
      GROUP BY c.사번
      HAVING SUM(c.실제근무시간) > 0  -- 해당 월 전체에 대해 0시간인 직원 제외
    )
    SELECT COUNT(DISTINCT 사번) as totalEmployees
    FROM monthly_totals
  `;

  const stmt = db.prepare(query);
  const result = stmt.get(startDate, endDate) as { totalEmployees: number };
  return result?.totalEmployees || 0;
}