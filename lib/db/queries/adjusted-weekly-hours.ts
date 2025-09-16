import db from '../client';

/**
 * 주간근무추정시간 계산 (Claim - GR 비업무이동 방식)
 * - Claim 시간에서 Ground Rules 비업무 이동시간(100%)을 제외
 * - 출장, 연차 등 DAR에 없는 근태도 모두 포함
 */

export interface AdjustedWeeklyHoursResult {
  employeeId: string;
  avgClaimHours: number;
  avgMovementHours: number;
  avgAdjustedHours: number;
  weeklyAdjustedHours: number;
  includesOfficeTrip: boolean;
  includesVacation: boolean;
}

/**
 * 개인별 주간근무추정시간 계산
 */
export function getEmployeeAdjustedWeeklyHours(
  employeeId: string,
  startDate: string,
  endDate: string
): AdjustedWeeklyHoursResult | null {
  const query = `
    WITH combined_data AS (
      -- Claim 데이터 (출장, 연차 포함)
      SELECT
        c.사번 as employee_id,
        DATE(c.근무일) as work_date,
        c.실제근무시간 as claim_hours,
        c.근태유형 as attendance_type,
        -- DAR 데이터와 매칭
        dar.movement_minutes,
        dar.ground_rules_work_hours,
        CASE
          WHEN dar.analysis_date IS NULL AND c.실제근무시간 > 0
          THEN 1 ELSE 0
        END as is_offsite  -- DAR에 없지만 Claim에 있는 경우 (출장 등)
      FROM claim_data c
      LEFT JOIN daily_analysis_results dar
        ON dar.employee_id = CAST(c.사번 AS TEXT)
        AND DATE(dar.analysis_date) = DATE(c.근무일)
      WHERE c.사번 = ?
        AND c.근무일 BETWEEN ? AND ?
    )
    SELECT
      employee_id,
      -- Claim 일평균 (출장, 연차 포함)
      ROUND(AVG(claim_hours), 2) as avg_claim_hours,
      -- GR 이동시간 일평균 (사무실 근무일만)
      ROUND(AVG(CASE
        WHEN movement_minutes IS NOT NULL
        THEN movement_minutes / 60.0
        ELSE 0
      END), 2) as avg_movement_hours,
      -- 조정된 일평균 (Claim - GR이동100%)
      ROUND(AVG(
        claim_hours -
        COALESCE(movement_minutes / 60.0, 0)
      ), 2) as avg_adjusted_hours,
      -- 주간 환산
      ROUND(AVG(
        claim_hours -
        COALESCE(movement_minutes / 60.0, 0)
      ) * 5, 1) as weekly_adjusted_hours,
      -- 출장/외근 포함 여부
      MAX(is_offsite) as includes_office_trip,
      -- 연차 포함 여부
      MAX(CASE
        WHEN attendance_type LIKE '%연차%' THEN 1
        ELSE 0
      END) as includes_vacation
    FROM combined_data
    GROUP BY employee_id
  `;

  const stmt = db.prepare(query);
  return stmt.get(employeeId, startDate, endDate) as AdjustedWeeklyHoursResult | null;
}

/**
 * 조직별 주간근무추정시간 계산
 */
export function getOrganizationAdjustedWeeklyHours(
  orgName: string,
  startDate: string,
  endDate: string
) {
  const query = `
    WITH combined_data AS (
      SELECT
        e.employee_id,
        e.center_name,
        e.job_grade,
        -- Claim 데이터
        c.실제근무시간 as claim_hours,
        c.근태유형 as attendance_type,
        -- DAR 데이터
        dar.movement_minutes,
        dar.ground_rules_work_hours,
        -- 공휴일 보정
        CASE
          WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
          THEN COALESCE(h.standard_hours, 8.0)
          ELSE c.실제근무시간
        END as adjusted_claim_hours
      FROM employees e
      JOIN claim_data c ON c.사번 = e.employee_id
      LEFT JOIN daily_analysis_results dar
        ON dar.employee_id = e.employee_id
        AND DATE(dar.analysis_date) = DATE(c.근무일)
      LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
      WHERE e.center_name = ?
        AND c.근무일 BETWEEN ? AND ?
    )
    SELECT
      center_name,
      COUNT(DISTINCT employee_id) as total_employees,
      -- Claim 평균 (공휴일 보정 포함)
      ROUND(AVG(adjusted_claim_hours), 2) as avg_claim_hours,
      -- GR 이동시간 평균
      ROUND(AVG(COALESCE(movement_minutes / 60.0, 0)), 2) as avg_movement_hours,
      -- 조정된 시간 (Claim - GR이동100%)
      ROUND(AVG(
        adjusted_claim_hours -
        COALESCE(movement_minutes / 60.0, 0)
      ), 2) as avg_adjusted_daily,
      -- 주간 환산
      ROUND(AVG(
        adjusted_claim_hours -
        COALESCE(movement_minutes / 60.0, 0)
      ) * 5, 1) as weekly_adjusted_hours,
      -- 출장/외근 인원 비율
      ROUND(
        SUM(CASE
          WHEN dar.analysis_date IS NULL AND adjusted_claim_hours > 0
          THEN 1 ELSE 0
        END) * 100.0 / COUNT(*),
        1
      ) as offsite_ratio
    FROM combined_data
    GROUP BY center_name
  `;

  const stmt = db.prepare(query);
  return stmt.get(orgName, startDate, endDate);
}

/**
 * 레벨별 매트릭스용 주간근무추정시간
 */
export function getGradeAdjustedWeeklyHoursMatrix(
  startDate: string,
  endDate: string
) {
  const query = `
    WITH combined_data AS (
      SELECT
        e.center_name,
        e.job_grade,
        c.사번,
        -- Claim with holiday adjustment
        CASE
          WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
          THEN COALESCE(h.standard_hours, 8.0)
          ELSE c.실제근무시간
        END as claim_hours,
        -- Movement from DAR (null if offsite)
        dar.movement_minutes
      FROM claim_data c
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      LEFT JOIN daily_analysis_results dar
        ON dar.employee_id = e.employee_id
        AND DATE(dar.analysis_date) = DATE(c.근무일)
      LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.job_grade IS NOT NULL
        AND e.center_name IS NOT NULL
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
    ),
    grade_stats AS (
      SELECT
        center_name,
        'Lv.' || job_grade as grade_level,
        COUNT(DISTINCT 사번) as employees,
        -- 주간근무추정시간 = (Claim일평균 - GR이동) × 5
        ROUND(
          AVG(claim_hours - COALESCE(movement_minutes / 60.0, 0)) * 5,
          1
        ) as weekly_adjusted_hours
      FROM combined_data
      GROUP BY center_name, job_grade
    )
    SELECT
      grade_level,
      center_name,
      weekly_adjusted_hours
    FROM grade_stats
    ORDER BY grade_level DESC, center_name
  `;

  const stmt = db.prepare(query);
  const results = stmt.all(startDate, endDate, startDate, endDate) as any[];

  // Transform to matrix format
  const matrix: Record<string, Record<string, number>> = {};
  const centers: Set<string> = new Set();
  const grades: Set<string> = new Set();

  results.forEach(row => {
    if (!matrix[row.grade_level]) {
      matrix[row.grade_level] = {};
    }
    matrix[row.grade_level][row.center_name] = row.weekly_adjusted_hours;
    centers.add(row.center_name);
    grades.add(row.grade_level);
  });

  return {
    matrix,
    centers: Array.from(centers).sort(),
    grades: Array.from(grades).sort((a, b) => {
      const aNum = parseInt(a.replace('Lv.', ''));
      const bNum = parseInt(b.replace('Lv.', ''));
      return bNum - aNum; // 4, 3, 2, 1 순서
    })
  };
}

/**
 * 이전 방식과 비교
 */
export function compareCalculationMethods(
  startDate: string,
  endDate: string
) {
  const query = `
    WITH comparison AS (
      SELECT
        -- 현재 GR 방식
        ROUND(AVG(dar.ground_rules_work_hours) * 5, 1) as current_gr_method,
        -- 새 방식: Claim - GR이동100%
        ROUND(AVG(c.실제근무시간 - COALESCE(dar.movement_minutes / 60.0, 0)) * 5, 1) as new_claim_movement_method,
        -- 순수 Claim
        ROUND(AVG(c.실제근무시간) * 5, 1) as pure_claim,
        COUNT(DISTINCT c.사번) as total_employees
      FROM claim_data c
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      LEFT JOIN daily_analysis_results dar
        ON dar.employee_id = e.employee_id
        AND DATE(dar.analysis_date) = DATE(c.근무일)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
    )
    SELECT
      current_gr_method as 'GR방식(현재)',
      new_claim_movement_method as '새방식(Claim-이동)',
      pure_claim as 'Claim(순수)',
      ROUND(new_claim_movement_method - current_gr_method, 1) as '차이(시간)',
      ROUND((new_claim_movement_method - current_gr_method) / current_gr_method * 100, 1) as '차이(%)'
    FROM comparison
  `;

  const stmt = db.prepare(query);
  return stmt.get(startDate, endDate);
}