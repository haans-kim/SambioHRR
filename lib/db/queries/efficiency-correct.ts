import db from '../client';

/**
 * 올바른 효율성 매트릭스 계산
 * 효율성 = 주간근무추정시간 / 주간근태시간
 */
export function getGradeEfficiencyMatrixCorrect(startDate: string, endDate: string) {
  const query = `
    WITH claimed_hours AS (
      -- 주간근태시간: claim_data 기반 (공휴일 포함)
      SELECT
        c.employee_level as grade_level,
        e.center_name,
        COUNT(DISTINCT c.사번) as employees,
        SUM(
          CASE
            WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
            THEN COALESCE(h.standard_hours, 8.0)
            ELSE c.실제근무시간
          END
        ) as total_claimed_hours
      FROM claim_data c
      LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND c.사번 NOT IN ('20190287', '20200207', '20120150')
        AND c.employee_level IS NOT NULL
      GROUP BY c.employee_level, e.center_name
      HAVING SUM(
        CASE
          WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
          THEN COALESCE(h.standard_hours, 8.0)
          ELSE c.실제근무시간
        END
      ) > 0
    ),
    adjusted_hours AS (
      -- 주간근무추정시간: claim_data - (GR이동시간 * 0.5)
      SELECT
        c.employee_level as grade_level,
        e.center_name,
        SUM(
          CASE
            WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
            THEN COALESCE(h.standard_hours, 8.0)
            ELSE c.실제근무시간
          END - COALESCE(dar.movement_minutes / 60.0 * 0.5, 0)
        ) as total_adjusted_hours
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
      GROUP BY c.employee_level, e.center_name
    )
    SELECT
      ch.grade_level,
      ch.center_name,
      ch.employees,
      ROUND(ch.total_claimed_hours / ch.employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1) as weekly_claimed,
      ROUND(ah.total_adjusted_hours / ch.employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1) as weekly_adjusted,
      ROUND(MIN(ah.total_adjusted_hours / NULLIF(ch.total_claimed_hours, 0), 0.98) * 100, 1) as efficiency
    FROM claimed_hours ch
    LEFT JOIN adjusted_hours ah
      ON ch.grade_level = ah.grade_level
      AND ch.center_name = ah.center_name
    ORDER BY ch.grade_level, ch.center_name
  `;

  const stmt = db.prepare(query);
  const rows = stmt.all(
    startDate, endDate, // claimed_hours WHERE
    startDate, endDate, // adjusted_hours WHERE
    endDate, startDate, // JULIANDAY for weekly_claimed
    endDate, startDate  // JULIANDAY for weekly_adjusted
  ) as Array<{
    grade_level: string;
    center_name: string;
    employees: number;
    weekly_claimed: number;
    weekly_adjusted: number;
    efficiency: number;
  }>;

  // Transform to matrix format
  const grades = ['Special', 'Lv.4', 'Lv.3', 'Lv.2', 'Lv.1'];
  const centers = [...new Set(rows.map(r => r.center_name))].sort();
  const matrix: Record<string, Record<string, number>> = {};

  grades.forEach(grade => {
    matrix[grade] = {};
    centers.forEach(center => {
      const row = rows.find(r => r.grade_level === grade && r.center_name === center);
      matrix[grade][center] = row?.efficiency || 0;
    });
  });

  return {
    grades,
    centers,
    matrix,
    rawData: rows // 디버깅용 원시 데이터
  };
}

/**
 * 센터별 올바른 효율성 계산
 * 효율성 = 주간근무추정시간 / 주간근태시간
 */
export function getCenterEfficiencyCorrect(centerName: string, startDate: string, endDate: string) {
  const query = `
    WITH claimed_hours AS (
      -- 주간근태시간
      SELECT
        SUM(
          CASE
            WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
            THEN COALESCE(h.standard_hours, 8.0)
            ELSE c.실제근무시간
          END
        ) as total_claimed,
        COUNT(DISTINCT c.사번) as employees
      FROM claim_data c
      LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name = ?
        AND c.사번 NOT IN ('20190287', '20200207', '20120150')
      HAVING total_claimed > 0
    ),
    adjusted_hours AS (
      -- 주간근무추정시간: claim_data - (GR이동시간 * 0.5)
      SELECT
        SUM(
          CASE
            WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
            THEN COALESCE(h.standard_hours, 8.0)
            ELSE c.실제근무시간
          END - COALESCE(dar.movement_minutes / 60.0 * 0.5, 0)
        ) as total_adjusted
      FROM claim_data c
      LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
      LEFT JOIN daily_analysis_results dar
        ON dar.employee_id = CAST(c.사번 AS TEXT)
        AND DATE(dar.analysis_date) = DATE(c.근무일)
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name = ?
        AND c.사번 NOT IN ('20190287', '20200207', '20120150')
    )
    SELECT
      ch.employees,
      ROUND(ch.total_claimed / ch.employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1) as weekly_claimed,
      ROUND(ah.total_adjusted / ch.employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1) as weekly_adjusted,
      ROUND(MIN(ah.total_adjusted / NULLIF(ch.total_claimed, 0), 0.98) * 100, 1) as efficiency
    FROM claimed_hours ch
    CROSS JOIN adjusted_hours ah
  `;

  const stmt = db.prepare(query);
  const result = stmt.get(
    startDate, endDate, centerName, // claimed_hours
    startDate, endDate, centerName, // adjusted_hours
    endDate, startDate, // JULIANDAY for weekly_claimed
    endDate, startDate  // JULIANDAY for weekly_adjusted
  ) as {
    employees: number;
    weekly_claimed: number;
    weekly_adjusted: number;
    efficiency: number;
  } | undefined;

  return result;
}