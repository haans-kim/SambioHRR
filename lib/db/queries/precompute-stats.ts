import db from '../client';

/**
 * 특정 월의 통계를 미리 계산하여 저장
 */
export function precomputeMonthlyStats(month: string) {
  const startDate = `${month}-01`;
  const endDate = `${month}-31`; // SQLite will handle month-end correctly

  // 트랜잭션 시작
  const deleteOldStats = db.prepare('DELETE FROM monthly_center_stats WHERE month = ?');
  const deleteOldGradeStats = db.prepare('DELETE FROM monthly_grade_stats WHERE month = ?');
  const deleteOldOverallStats = db.prepare('DELETE FROM monthly_overall_stats WHERE month = ?');

  // 센터별 통계 계산 및 저장
  const insertCenterStats = db.prepare(`
    INSERT INTO monthly_center_stats (month, center_name, total_employees, weekly_claimed_hours, weekly_adjusted_hours, efficiency, data_reliability)
    WITH claimed AS (
      SELECT
        e.center_name,
        COUNT(DISTINCT c.사번) as total_employees,
        SUM(
          CASE
            -- 휴일이면서 근무시간이 0인 경우: 표준 근무시간(8시간) 적용
            WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
            THEN COALESCE(h.standard_hours, 8.0)
            -- 그 외: 실제근무시간 사용 (이미 data_transformers.py에서 휴가 반영됨)
            ELSE c.실제근무시간
          END
        ) as total_claimed
      FROM claim_data c
      LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND c.사번 NOT IN ('20190287', '20200207', '20120150')
      GROUP BY e.center_name
    ),
    adjusted AS (
      SELECT
        e.center_name,
        CASE
          -- 해당 월에 daily_analysis_results 데이터가 있는 경우만 계산
          WHEN EXISTS (
            SELECT 1 FROM daily_analysis_results dar2
            WHERE dar2.analysis_date BETWEEN ? AND ?
            LIMIT 1
          ) THEN
            SUM(
              CASE
                -- 휴일이면서 근무시간이 0인 경우: 표준 근무시간(8시간) 적용
                WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
                THEN COALESCE(h.standard_hours, 8.0)
                -- 그 외: 실제근무시간 - 이동시간 보정 (실제근무시간에 이미 휴가 반영됨)
                ELSE c.실제근무시간 - COALESCE(dar.movement_minutes / 60.0 * 0.5, 0)
              END
            )
          ELSE NULL
        END as total_adjusted
      FROM claim_data c
      LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
      LEFT JOIN daily_analysis_results dar
        ON dar.employee_id = CAST(c.사번 AS TEXT)
        AND DATE(dar.analysis_date) = DATE(c.근무일)
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND c.사번 NOT IN ('20190287', '20200207', '20120150')
      GROUP BY e.center_name
    ),
    reliability AS (
      SELECT
        e.center_name,
        ROUND(AVG(dar.confidence_score), 1) as avg_reliability
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      WHERE dar.analysis_date BETWEEN ? AND ?
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND dar.employee_id NOT IN ('20190287', '20200207', '20120150')
      GROUP BY e.center_name
    )
    SELECT
      ?,
      c.center_name,
      c.total_employees,
      ROUND(c.total_claimed / c.total_employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1),
      ROUND(a.total_adjusted / c.total_employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1),
      ROUND(MIN(a.total_adjusted / NULLIF(c.total_claimed, 0), 0.98) * 100, 1),
      r.avg_reliability
    FROM claimed c
    LEFT JOIN adjusted a ON c.center_name = a.center_name
    LEFT JOIN reliability r ON c.center_name = r.center_name
  `);

  // 등급별 통계 계산 및 저장
  const insertGradeStats = db.prepare(`
    INSERT INTO monthly_grade_stats (month, center_name, grade_level, total_employees, weekly_claimed_hours, weekly_adjusted_hours, efficiency)
    WITH claimed AS (
      SELECT
        e.center_name,
        c.employee_level as grade_level,
        COUNT(DISTINCT c.사번) as total_employees,
        SUM(
          CASE
            -- 휴일이면서 근무시간이 0인 경우: 표준 근무시간(8시간) 적용
            WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
            THEN COALESCE(h.standard_hours, 8.0)
            -- 그 외: 실제근무시간 사용 (이미 data_transformers.py에서 휴가 반영됨)
            ELSE c.실제근무시간
          END
        ) as total_claimed
      FROM claim_data c
      LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND c.사번 NOT IN ('20190287', '20200207', '20120150')
        AND c.employee_level IS NOT NULL
      GROUP BY e.center_name, c.employee_level
    ),
    adjusted AS (
      SELECT
        e.center_name,
        c.employee_level as grade_level,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM daily_analysis_results dar2
            WHERE dar2.analysis_date BETWEEN ? AND ?
            LIMIT 1
          ) THEN
            SUM(
              CASE
                -- 휴일이면서 근무시간이 0인 경우: 표준 근무시간(8시간) 적용
                WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
                THEN COALESCE(h.standard_hours, 8.0)
                -- 그 외: 실제근무시간 - 이동시간 보정 (실제근무시간에 이미 휴가 반영됨)
                ELSE c.실제근무시간 - COALESCE(dar.movement_minutes / 60.0 * 0.5, 0)
              END
            )
          ELSE NULL
        END as total_adjusted
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
      GROUP BY e.center_name, c.employee_level
    )
    SELECT
      ?,
      c.center_name,
      c.grade_level,
      c.total_employees,
      ROUND(c.total_claimed / c.total_employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1),
      ROUND(a.total_adjusted / c.total_employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1),
      ROUND(MIN(a.total_adjusted / NULLIF(c.total_claimed, 0), 0.98) * 100, 1)
    FROM claimed c
    LEFT JOIN adjusted a ON c.center_name = a.center_name AND c.grade_level = a.grade_level
  `);

  // 전체 통계 계산 및 저장
  const insertOverallStats = db.prepare(`
    INSERT INTO monthly_overall_stats (month, total_employees, avg_weekly_claimed_hours, avg_weekly_adjusted_hours, avg_efficiency, avg_data_reliability)
    WITH claimed AS (
      SELECT
        COUNT(DISTINCT c.사번) as total_employees,
        SUM(
          CASE
            -- 휴일이면서 근무시간이 0인 경우: 표준 근무시간(8시간) 적용
            WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
            THEN COALESCE(h.standard_hours, 8.0)
            -- 그 외: 실제근무시간 사용 (이미 data_transformers.py에서 휴가 반영됨)
            ELSE c.실제근무시간
          END
        ) as total_claimed
      FROM claim_data c
      LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND c.사번 NOT IN ('20190287', '20200207', '20120150')
    ),
    adjusted AS (
      SELECT
        CASE
          WHEN EXISTS (
            SELECT 1 FROM daily_analysis_results dar2
            WHERE dar2.analysis_date BETWEEN ? AND ?
            LIMIT 1
          ) THEN
            SUM(
              CASE
                -- 휴일이면서 근무시간이 0인 경우: 표준 근무시간(8시간) 적용
                WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
                THEN COALESCE(h.standard_hours, 8.0)
                -- 그 외: 실제근무시간 - 이동시간 보정 (실제근무시간에 이미 휴가 반영됨)
                ELSE c.실제근무시간 - COALESCE(dar.movement_minutes / 60.0 * 0.5, 0)
              END
            )
          ELSE NULL
        END as total_adjusted
      FROM claim_data c
      LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
      LEFT JOIN daily_analysis_results dar
        ON dar.employee_id = CAST(c.사번 AS TEXT)
        AND DATE(dar.analysis_date) = DATE(c.근무일)
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND c.사번 NOT IN ('20190287', '20200207', '20120150')
    ),
    reliability AS (
      SELECT
        ROUND(AVG(dar.confidence_score), 1) as avg_reliability
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      WHERE dar.analysis_date BETWEEN ? AND ?
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND dar.employee_id NOT IN ('20190287', '20200207', '20120150')
    )
    SELECT
      ?,
      c.total_employees,
      ROUND(c.total_claimed / c.total_employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1),
      ROUND(a.total_adjusted / c.total_employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1),
      ROUND(MIN(a.total_adjusted / NULLIF(c.total_claimed, 0), 0.98) * 100, 1),
      r.avg_reliability
    FROM claimed c, adjusted a, reliability r
  `);

  const transaction = db.transaction(() => {
    // 기존 데이터 삭제
    deleteOldStats.run(month);
    deleteOldGradeStats.run(month);
    deleteOldOverallStats.run(month);

    // 새 데이터 삽입
    insertCenterStats.run(
      startDate, endDate, // claimed
      startDate, endDate, // adjusted (EXISTS check)
      startDate, endDate, // adjusted (WHERE clause)
      startDate, endDate, // reliability
      month,
      endDate, startDate, // JULIANDAY for weekly_claimed
      endDate, startDate  // JULIANDAY for weekly_adjusted
    );

    insertGradeStats.run(
      startDate, endDate, // claimed
      startDate, endDate, // adjusted (EXISTS check)
      startDate, endDate, // adjusted (WHERE clause)
      month,
      endDate, startDate, // JULIANDAY for weekly_claimed
      endDate, startDate  // JULIANDAY for weekly_adjusted
    );

    insertOverallStats.run(
      startDate, endDate, // claimed
      startDate, endDate, // adjusted (EXISTS check)
      startDate, endDate, // adjusted (WHERE clause)
      startDate, endDate, // reliability
      month,
      endDate, startDate, // JULIANDAY for weekly_claimed
      endDate, startDate  // JULIANDAY for weekly_adjusted
    );
  });

  transaction();
}

/**
 * 그룹별 통계를 미리 계산하여 저장
 */
export function precomputeGroupStats(month: string) {
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;

  // 그룹 통계 테이블 생성 (없으면)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS monthly_group_stats (
      month TEXT,
      group_name TEXT,
      center_name TEXT,
      team_name TEXT,
      total_employees INTEGER,
      total_records INTEGER,
      weekly_claimed_hours REAL,
      weekly_work_hours REAL,
      efficiency REAL,
      confidence_score REAL,
      work_minutes REAL,
      meeting_minutes REAL,
      meal_minutes REAL,
      movement_minutes REAL,
      rest_minutes REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (month, group_name, center_name, team_name)
    )
  `).run();

  // 기존 데이터 삭제
  const deleteOldGroupStats = db.prepare('DELETE FROM monthly_group_stats WHERE month = ?');

  // 그룹별 통계 계산 및 저장
  const insertGroupStats = db.prepare(`
    INSERT INTO monthly_group_stats (
      month, group_name, center_name, team_name,
      total_employees, total_records,
      weekly_claimed_hours, weekly_work_hours,
      efficiency, confidence_score,
      work_minutes, meeting_minutes, meal_minutes,
      movement_minutes, rest_minutes
    )
    WITH claimed_stats AS (
      -- claim_data 기반 공휴일/연차 고려한 시간 계산
      SELECT
        e.group_name,
        e.center_name,
        e.team_name,
        COUNT(DISTINCT c.사번) as total_employees,
        COUNT(*) as total_records,
        SUM(
          CASE
            -- 휴일이면서 근무시간이 0인 경우: 표준 근무시간(8시간) 적용
            WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
            THEN COALESCE(h.standard_hours, 8.0)
            -- 그 외: 실제근무시간 사용 (이미 data_transformers.py에서 휴가 반영됨)
            ELSE c.실제근무시간
          END
        ) as total_claimed_hours,
        CASE
          -- 해당 월에 daily_analysis_results 데이터가 있는 경우만 계산
          WHEN EXISTS (
            SELECT 1 FROM daily_analysis_results dar2
            WHERE dar2.analysis_date BETWEEN ? AND ?
            LIMIT 1
          ) THEN
            SUM(
              CASE
                -- 휴일이면서 근무시간이 0인 경우: 표준 근무시간(8시간) 적용
                WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
                THEN COALESCE(h.standard_hours, 8.0)
                -- 그 외: 실제근무시간 - 이동시간 보정 (실제근무시간에 이미 휴가 반영됨)
                ELSE c.실제근무시간 - COALESCE(dar.movement_minutes / 60.0 * 0.5, 0)
              END
            )
          ELSE NULL
        END as total_adjusted_hours
      FROM claim_data c
      LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
      LEFT JOIN daily_analysis_results dar
        ON dar.employee_id = CAST(c.사번 AS TEXT)
        AND DATE(dar.analysis_date) = DATE(c.근무일)
      JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
      WHERE c.근무일 BETWEEN ? AND ?
        AND e.group_name IS NOT NULL
        AND e.group_name != ''
        AND c.사번 NOT IN ('20190287', '20200207', '20120150')
      GROUP BY e.group_name, e.center_name, e.team_name
    ),
    dar_stats AS (
      -- daily_analysis_results 기반 추가 통계
      SELECT
        e.group_name,
        ROUND(AVG(dar.confidence_score), 1) as avg_confidence,
        ROUND(AVG(dar.work_minutes), 1) as avg_work_minutes,
        ROUND(AVG(dar.meeting_minutes), 1) as avg_meeting_minutes,
        ROUND(AVG(dar.meal_minutes), 1) as avg_meal_minutes,
        ROUND(AVG(dar.movement_minutes), 1) as avg_movement_minutes,
        ROUND(AVG(dar.rest_minutes), 1) as avg_rest_minutes
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      WHERE dar.analysis_date BETWEEN ? AND ?
        AND e.group_name IS NOT NULL
        AND dar.employee_id NOT IN ('20190287', '20200207', '20120150')
      GROUP BY e.group_name
    )
    SELECT
      ?,
      cs.group_name,
      cs.center_name,
      cs.team_name,
      cs.total_employees,
      cs.total_records,
      ROUND(cs.total_claimed_hours / cs.total_employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1),
      ROUND(cs.total_adjusted_hours / cs.total_employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1),
      ROUND(MIN(cs.total_adjusted_hours / NULLIF(cs.total_claimed_hours, 0), 0.98) * 100, 1),
      ds.avg_confidence,
      ds.avg_work_minutes,
      ds.avg_meeting_minutes,
      ds.avg_meal_minutes,
      ds.avg_movement_minutes,
      ds.avg_rest_minutes
    FROM claimed_stats cs
    LEFT JOIN dar_stats ds ON cs.group_name = ds.group_name
  `);

  const transaction = db.transaction(() => {
    deleteOldGroupStats.run(month);
    insertGroupStats.run(
      startDate, endDate,  // claimed_stats (EXISTS check)
      startDate, endDate,  // claimed_stats (WHERE clause)
      startDate, endDate,  // dar_stats (WHERE clause)
      month,               // month parameter
      endDate, startDate,  // JULIANDAY for weekly_claimed_hours
      endDate, startDate   // JULIANDAY for weekly_work_hours
    );
  });

  transaction();
}

/**
 * 모든 월의 통계를 미리 계산
 */
export function precomputeAllMonthlyStats() {
  const months = [
    '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'
  ];

  months.forEach(month => {
    console.log(`Computing stats for ${month}...`);
    precomputeMonthlyStats(month);
    precomputeGroupStats(month);
  });
}

interface OverallStats {
  total_employees: number;
  avg_weekly_claimed_hours: number;
  avg_weekly_adjusted_hours: number;
  avg_efficiency: number;
  avg_data_reliability: number;
  created_at?: string;
}

interface CenterStats {
  center_name: string;
  org_code?: string;
  total_employees: number;
  weekly_claimed_hours: number;
  weekly_adjusted_hours: number;
  efficiency: number;
  data_reliability: number;
  children_count: number;
}

interface GradeStats {
  center_name: string;
  grade_level: string;
  total_employees: number;
  weekly_claimed_hours: number;
  weekly_adjusted_hours: number;
  efficiency: number;
}

/**
 * 사전 계산된 통계 가져오기
 */
export function getPrecomputedStats(month: string): {
  overall: OverallStats | undefined;
  centers: CenterStats[];
  grades: GradeStats[];
  isPrecomputed: boolean;
} {
  const overall = db.prepare('SELECT * FROM monthly_overall_stats WHERE month = ?').get(month) as OverallStats | undefined;
  const centers = db.prepare(`
    SELECT DISTINCT
      mcs.*,
      om.org_code,
      (SELECT COUNT(*) FROM organization_master WHERE parent_org_code = om.org_code) as children_count
    FROM monthly_center_stats mcs
    LEFT JOIN organization_master om ON om.org_name = mcs.center_name
      AND om.org_level = 'center'
      AND om.is_active = 1
    WHERE mcs.month = ?
    ORDER BY
      CASE
        WHEN mcs.center_name = '영업센터' THEN 1
        WHEN mcs.center_name = '오퍼레이션센터' THEN 2
        WHEN mcs.center_name = 'EPCV센터' THEN 3
        WHEN mcs.center_name = '품질운영센터' THEN 4
        WHEN mcs.center_name = 'CDO개발센터' THEN 5
        WHEN mcs.center_name = '바이오연구소' THEN 6
        WHEN mcs.center_name = '경영지원센터' THEN 7
        WHEN mcs.center_name = 'People센터' THEN 8
        WHEN mcs.center_name = '상생협력센터' THEN 9
        ELSE 99
      END,
      mcs.center_name
  `).all(month) as CenterStats[];
  const grades = db.prepare('SELECT * FROM monthly_grade_stats WHERE month = ?').all(month) as GradeStats[];

  return {
    overall,
    centers,
    grades,
    isPrecomputed: !!overall
  };
}

/**
 * 사전 계산된 그룹 통계 가져오기
 */
export function getPrecomputedGroupStats(month: string, groupName: string) {
  const groupStats = db.prepare(`
    SELECT * FROM monthly_group_stats
    WHERE month = ? AND group_name = ?
  `).get(month, groupName);

  return groupStats;
}