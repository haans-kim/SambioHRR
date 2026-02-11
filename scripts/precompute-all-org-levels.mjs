/**
 * 모든 조직 레벨(센터, 담당, 팀, 그룹)의 월간 통계를 사전 계산 (ES Module 버전)
 *
 * 이 스크립트는 monthly_center_stats, monthly_division_stats,
 * monthly_team_stats, monthly_grade_stats, monthly_overall_stats 테이블에
 * 1~10월 데이터를 계산하여 저장합니다.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'sambio_human.db');
const db = new Database(dbPath);

const months = [
  '2025-01', '2025-02', '2025-03', '2025-04', '2025-05',
  '2025-06', '2025-07', '2025-08', '2025-09', '2025-10'
];

console.log('================================================================================');
console.log('📊 모든 조직 레벨 월간 통계 사전 계산 시작 (1~10월)');
console.log('================================================================================\n');

const startTime = Date.now();

for (const month of months) {
  console.log(`\n[${months.indexOf(month) + 1}/${months.length}] Computing all stats for ${month}...`);

  const monthStartTime = Date.now();
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;

  try {
    // 기존 데이터 삭제
    db.prepare('DELETE FROM monthly_center_stats WHERE month = ?').run(month);
    db.prepare('DELETE FROM monthly_team_stats WHERE month = ?').run(month);
    db.prepare('DELETE FROM monthly_grade_stats WHERE month = ?').run(month);
    db.prepare('DELETE FROM monthly_overall_stats WHERE month = ?').run(month);

    console.log('  1. Computing center stats...');
    const insertCenterStats = db.prepare(`
      INSERT INTO monthly_center_stats (month, center_name, total_employees, weekly_claimed_hours, weekly_adjusted_hours, efficiency, data_reliability)
      WITH claimed AS (
        SELECT
          e.center_name,
          COUNT(DISTINCT c.사번) as total_employees,
          SUM(
            CASE
              WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
              THEN COALESCE(h.standard_hours, 8.0)
              ELSE c.실제근무시간
            END
          ) as total_claimed
        FROM claim_data c
        LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
        JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
        WHERE c.근무일 BETWEEN ? AND ?
          AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
          AND c.사번 NOT IN ('20190287', '20200207', '20120150', '20200459')
        GROUP BY e.center_name
      ),
      adjusted AS (
        SELECT
          e.center_name,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM daily_analysis_results dar2
              WHERE dar2.analysis_date BETWEEN ? AND ?
              LIMIT 1
            ) THEN
              SUM(
                CASE
                  WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
                  THEN COALESCE(h.standard_hours, 8.0)
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
          AND c.사번 NOT IN ('20190287', '20200207', '20120150', '20200459')
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
          AND dar.employee_id NOT IN ('20190287', '20200207', '20120150', '20200459')
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

    insertCenterStats.run(
      startDate, endDate, // claimed
      startDate, endDate, // adjusted (EXISTS check)
      startDate, endDate, // adjusted (WHERE clause)
      startDate, endDate, // reliability
      month,
      endDate, startDate, // JULIANDAY for weekly_claimed
      endDate, startDate  // JULIANDAY for weekly_adjusted
    );

    console.log('  2. Computing team stats...');
    const insertTeamStats = db.prepare(`
      INSERT INTO monthly_team_stats (month, team_name, center_name, total_employees, weekly_claimed_hours, weekly_adjusted_hours, efficiency, data_reliability)
      WITH claimed AS (
        SELECT
          e.center_name,
          e.team_name,
          COUNT(DISTINCT c.사번) as total_employees,
          SUM(
            CASE
              WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
              THEN COALESCE(h.standard_hours, 8.0)
              ELSE c.실제근무시간
            END
          ) as total_claimed
        FROM claim_data c
        LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
        JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
        WHERE c.근무일 BETWEEN ? AND ?
          AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
          AND c.사번 NOT IN ('20190287', '20200207', '20120150', '20200459')
          AND e.team_name IS NOT NULL
        GROUP BY e.center_name, e.team_name
      ),
      adjusted AS (
        SELECT
          e.center_name,
          e.team_name,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM daily_analysis_results dar2
              WHERE dar2.analysis_date BETWEEN ? AND ?
              LIMIT 1
            ) THEN
              SUM(
                CASE
                  WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
                  THEN COALESCE(h.standard_hours, 8.0)
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
          AND c.사번 NOT IN ('20190287', '20200207', '20120150', '20200459')
          AND e.team_name IS NOT NULL
        GROUP BY e.center_name, e.team_name
      ),
      reliability AS (
        SELECT
          e.center_name,
          e.team_name,
          ROUND(AVG(dar.confidence_score), 1) as avg_reliability
        FROM daily_analysis_results dar
        JOIN employees e ON e.employee_id = dar.employee_id
        WHERE dar.analysis_date BETWEEN ? AND ?
          AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
          AND dar.employee_id NOT IN ('20190287', '20200207', '20120150', '20200459')
          AND e.team_name IS NOT NULL
        GROUP BY e.center_name, e.team_name
      )
      SELECT
        ?,
        c.team_name,
        c.center_name,
        c.total_employees,
        ROUND(c.total_claimed / c.total_employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1),
        ROUND(a.total_adjusted / c.total_employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1),
        ROUND(MIN(a.total_adjusted / NULLIF(c.total_claimed, 0), 0.98) * 100, 1),
        r.avg_reliability
      FROM claimed c
      LEFT JOIN adjusted a ON c.center_name = a.center_name AND c.team_name = a.team_name
      LEFT JOIN reliability r ON c.center_name = r.center_name AND c.team_name = r.team_name
    `);

    insertTeamStats.run(
      startDate, endDate, // claimed
      startDate, endDate, // adjusted (EXISTS check)
      startDate, endDate, // adjusted (WHERE clause)
      startDate, endDate, // reliability
      month,
      endDate, startDate, // JULIANDAY for weekly_claimed
      endDate, startDate  // JULIANDAY for weekly_adjusted
    );

    console.log('  3. Computing grade stats...');
    const insertGradeStats = db.prepare(`
      INSERT INTO monthly_grade_stats (month, center_name, grade_level, total_employees, weekly_claimed_hours, weekly_adjusted_hours, efficiency)
      WITH valid_employees AS (
        SELECT DISTINCT c.사번
        FROM claim_data c
        WHERE c.근무일 BETWEEN ? AND ?
          AND c.사번 NOT IN ('20190287', '20200207', '20120150', '20200459')
        GROUP BY c.사번
        HAVING SUM(COALESCE(c.실제근무시간, 0)) >= 100
      ),
      claimed AS (
        SELECT
          e.center_name,
          c.employee_level as grade_level,
          COUNT(DISTINCT c.사번) as total_employees,
          SUM(
            CASE
              WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
              THEN COALESCE(h.standard_hours, 8.0)
              ELSE c.실제근무시간
            END
          ) as total_claimed
        FROM claim_data c
        LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
        JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
        INNER JOIN valid_employees ve ON c.사번 = ve.사번
        WHERE c.근무일 BETWEEN ? AND ?
          AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
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
                  WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
                  THEN COALESCE(h.standard_hours, 8.0)
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
        INNER JOIN valid_employees ve ON c.사번 = ve.사번
        WHERE c.근무일 BETWEEN ? AND ?
          AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
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

    insertGradeStats.run(
      startDate, endDate, // valid_employees
      startDate, endDate, // claimed
      startDate, endDate, // adjusted (EXISTS check)
      startDate, endDate, // adjusted (WHERE clause)
      month,
      endDate, startDate, // JULIANDAY for weekly_claimed
      endDate, startDate  // JULIANDAY for weekly_adjusted
    );

    console.log('  4. Computing overall stats...');
    const insertOverallStats = db.prepare(`
      INSERT INTO monthly_overall_stats (month, total_employees, avg_weekly_claimed_hours, avg_weekly_adjusted_hours, avg_efficiency, avg_data_reliability)
      WITH claimed AS (
        SELECT
          COUNT(DISTINCT c.사번) as total_employees,
          SUM(
            CASE
              WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
              THEN COALESCE(h.standard_hours, 8.0)
              ELSE c.실제근무시간
            END
          ) as total_claimed
        FROM claim_data c
        LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
        JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
        WHERE c.근무일 BETWEEN ? AND ?
          AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
          AND c.사번 NOT IN ('20190287', '20200207', '20120150', '20200459')
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
                  WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
                  THEN COALESCE(h.standard_hours, 8.0)
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
          AND c.사번 NOT IN ('20190287', '20200207', '20120150', '20200459')
      ),
      reliability AS (
        SELECT
          ROUND(AVG(dar.confidence_score), 1) as avg_reliability
        FROM daily_analysis_results dar
        JOIN employees e ON e.employee_id = dar.employee_id
        WHERE dar.analysis_date BETWEEN ? AND ?
          AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
          AND dar.employee_id NOT IN ('20190287', '20200207', '20120150', '20200459')
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

    insertOverallStats.run(
      startDate, endDate, // claimed
      startDate, endDate, // adjusted (EXISTS check)
      startDate, endDate, // adjusted (WHERE clause)
      startDate, endDate, // reliability
      month,
      endDate, startDate, // JULIANDAY for weekly_claimed
      endDate, startDate  // JULIANDAY for weekly_adjusted
    );

    const elapsed = ((Date.now() - monthStartTime) / 1000).toFixed(1);
    console.log(`✅ ${month} 완료 (${elapsed}초)`);

    // 결과 확인
    const centerCount = db.prepare("SELECT COUNT(*) FROM monthly_center_stats WHERE month = ?").pluck().get(month);
    const teamCount = db.prepare("SELECT COUNT(*) FROM monthly_team_stats WHERE month = ?").pluck().get(month);
    const gradeCount = db.prepare("SELECT COUNT(*) FROM monthly_grade_stats WHERE month = ?").pluck().get(month);
    console.log(`   센터: ${centerCount}개, 팀: ${teamCount}개, 등급: ${gradeCount}개`);
  } catch (error) {
    console.error(`❌ ${month} 실패:`, error.message);
    console.error(error.stack);
  }
}

const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log('\n================================================================================');
console.log(`✅ 모든 월 및 조직 레벨 계산 완료! (총 소요시간: ${totalElapsed}초)`);
console.log('================================================================================');

console.log('\n다음 명령으로 확인:');
console.log('  sqlite3 sambio_human.db "SELECT month, center_name, weekly_claimed_hours FROM monthly_center_stats WHERE month >= \'2025-07\' ORDER BY month, center_name LIMIT 10;"');
console.log('  sqlite3 sambio_human.db "SELECT month, team_name, weekly_claimed_hours FROM monthly_team_stats WHERE month >= \'2025-07\' ORDER BY month, team_name LIMIT 10;"');

db.close();
