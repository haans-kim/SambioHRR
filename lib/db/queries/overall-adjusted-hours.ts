import db from '../client';

/**
 * 전체 조직의 주간근무추정시간 평균
 * claim_data - GR이동시간
 */
export function getOverallAdjustedWeeklyHours(startDate: string, endDate: string) {
  const query = `
    WITH monthly_totals AS (
      SELECT
        c.사번,
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
      COUNT(DISTINCT 사번) as totalEmployees,
      ROUND(
        SUM(month_adjusted_hours) / COUNT(DISTINCT 사번) /
        (JULIANDAY(?) - JULIANDAY(?) + 1) * 7,
        1
      ) as avgWeeklyAdjustedHours
    FROM monthly_totals
  `;

  const stmt = db.prepare(query);
  return stmt.get(startDate, endDate, endDate, startDate) as {
    totalEmployees: number;
    avgWeeklyAdjustedHours: number;
  };
}