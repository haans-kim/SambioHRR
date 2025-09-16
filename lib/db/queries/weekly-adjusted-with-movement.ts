import db from '../client';

/**
 * 주간 근태시간과 동일한 로직으로 GR 비업무이동만 제외한 주간근무추정시간
 * 공식: (총 Claim 시간 - 총 GR 이동시간) / 인원수 / 기간일수 × 7
 */

export function getWeeklyAdjustedHoursWithMovement(startDate: string, endDate: string) {
  const query = `
    WITH monthly_totals AS (
      SELECT
        c.사번,
        -- Claim 시간 (공휴일 보정 포함)
        SUM(
          CASE
            WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
            THEN COALESCE(h.standard_hours, 8.0)
            ELSE c.실제근무시간
          END
        ) as month_claim_hours,
        -- GR 이동시간 합계
        SUM(
          COALESCE(dar.movement_minutes / 60.0, 0)
        ) as month_movement_hours,
        -- 조정된 시간 (Claim - GR이동)
        SUM(
          CASE
            WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
            THEN COALESCE(h.standard_hours, 8.0)
            ELSE c.실제근무시간
          END - COALESCE(dar.movement_minutes / 60.0, 0)
        ) as month_adjusted_hours
      FROM claim_data c
      LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
      LEFT JOIN daily_analysis_results dar
        ON dar.employee_id = CAST(c.사번 AS TEXT)
        AND DATE(dar.analysis_date) = DATE(c.근무일)
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND c.사번 NOT IN ('20190287', '20200207', '20120150')
      GROUP BY c.사번
      HAVING SUM(
        CASE
          WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
          THEN COALESCE(h.standard_hours, 8.0)
          ELSE c.실제근무시간
        END
      ) > 0
    )
    SELECT
      COUNT(DISTINCT mt.사번) as totalEmployees,
      ROUND(SUM(month_claim_hours), 1) as totalClaimHours,
      ROUND(SUM(month_movement_hours), 1) as totalMovementHours,
      ROUND(SUM(month_adjusted_hours), 1) as totalAdjustedHours,
      -- 주간 근태시간 (기존 방식)
      ROUND(
        SUM(month_claim_hours) / COUNT(DISTINCT mt.사번) /
        (JULIANDAY(?) - JULIANDAY(?) + 1) * 7,
        1
      ) as weeklyClaimedHours,
      -- 주간 근무추정시간 (GR이동 제외)
      ROUND(
        SUM(month_adjusted_hours) / COUNT(DISTINCT mt.사번) /
        (JULIANDAY(?) - JULIANDAY(?) + 1) * 7,
        1
      ) as weeklyAdjustedHours,
      -- 차이
      ROUND(
        (SUM(month_claim_hours) - SUM(month_adjusted_hours)) / COUNT(DISTINCT mt.사번) /
        (JULIANDAY(?) - JULIANDAY(?) + 1) * 7,
        1
      ) as weeklyDifference
    FROM monthly_totals mt
  `;

  const stmt = db.prepare(query);
  return stmt.get(
    startDate, endDate,  // monthly_totals WHERE
    endDate, startDate,  // weeklyClaimedHours 계산
    endDate, startDate,  // weeklyAdjustedHours 계산
    endDate, startDate   // weeklyDifference 계산
  );
}

/**
 * 센터별 주간 근무추정시간 (GR이동 제외)
 */
export function getCenterWeeklyAdjustedHours(centerName: string, startDate: string, endDate: string) {
  const query = `
    WITH monthly_totals AS (
      SELECT
        c.사번,
        SUM(
          CASE
            WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
            THEN COALESCE(h.standard_hours, 8.0)
            ELSE c.실제근무시간
          END
        ) as month_claim_hours,
        SUM(
          COALESCE(dar.movement_minutes / 60.0, 0)
        ) as month_movement_hours,
        SUM(
          CASE
            WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
            THEN COALESCE(h.standard_hours, 8.0)
            ELSE c.실제근무시간
          END - COALESCE(dar.movement_minutes / 60.0, 0)
        ) as month_adjusted_hours
      FROM claim_data c
      LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
      LEFT JOIN daily_analysis_results dar
        ON dar.employee_id = CAST(c.사번 AS TEXT)
        AND DATE(dar.analysis_date) = DATE(c.근무일)
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name = ?
      GROUP BY c.사번
      HAVING SUM(
        CASE
          WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
          THEN COALESCE(h.standard_hours, 8.0)
          ELSE c.실제근무시간
        END
      ) > 0
    )
    SELECT
      ? as center_name,
      COUNT(DISTINCT mt.사번) as totalEmployees,
      ROUND(
        SUM(month_claim_hours) / COUNT(DISTINCT mt.사번) /
        (JULIANDAY(?) - JULIANDAY(?) + 1) * 7,
        1
      ) as weeklyClaimedHours,
      ROUND(
        SUM(month_adjusted_hours) / COUNT(DISTINCT mt.사번) /
        (JULIANDAY(?) - JULIANDAY(?) + 1) * 7,
        1
      ) as weeklyAdjustedHours
    FROM monthly_totals mt
  `;

  const stmt = db.prepare(query);
  return stmt.get(
    startDate, endDate, centerName,  // monthly_totals WHERE
    centerName,  // SELECT center_name
    endDate, startDate,  // weeklyClaimedHours 계산
    endDate, startDate   // weeklyAdjustedHours 계산
  );
}

/**
 * 레벨별 매트릭스용 (주간 근태시간과 동일한 로직)
 */
export function getGradeWeeklyAdjustedHoursMatrix(startDate: string, endDate: string) {
  const query = `
    WITH monthly_totals AS (
      SELECT
        c.사번,
        c.employee_level,
        e.center_name,
        SUM(
          CASE
            WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
            THEN COALESCE(h.standard_hours, 8.0)
            ELSE c.실제근무시간
          END - COALESCE(dar.movement_minutes / 60.0, 0)
        ) as month_adjusted_hours
      FROM claim_data c
      LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
      LEFT JOIN daily_analysis_results dar
        ON dar.employee_id = CAST(c.사번 AS TEXT)
        AND DATE(dar.analysis_date) = DATE(c.근무일)
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND c.사번 NOT IN ('20190287', '20200207', '20120150')
        AND c.employee_level IS NOT NULL
      GROUP BY c.사번, c.employee_level, e.center_name
      HAVING SUM(
        CASE
          WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
          THEN COALESCE(h.standard_hours, 8.0)
          ELSE c.실제근무시간
        END
      ) > 0
    ),
    grade_hours AS (
      SELECT
        mt.employee_level as grade_level,
        mt.center_name,
        COUNT(DISTINCT mt.사번) as employees,
        SUM(mt.month_adjusted_hours) as total_hours,
        ROUND(
          SUM(mt.month_adjusted_hours) / COUNT(DISTINCT mt.사번) /
          (JULIANDAY(?) - JULIANDAY(?) + 1) * 7,
          1
        ) as avg_weekly_hours
      FROM monthly_totals mt
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
  const rows = stmt.all(startDate, endDate, endDate, startDate) as Array<{
    grade_level: string;
    center_name: string;
    avg_weekly_hours: number;
  }>;

  // Transform to matrix format
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