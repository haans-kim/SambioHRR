/**
 * Precompute team statistics for all months
 * Creates monthly_team_stats table with precomputed data
 * Division stats are derived from team stats at query time (no separate table needed)
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'sambio_human.db');

console.log(`Opening database: ${dbPath}`);
const db = new Database(dbPath);

// Enable optimizations
db.pragma('journal_mode = DELETE');
db.pragma('busy_timeout = 10000');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 10000');
db.pragma('temp_store = MEMORY');

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS monthly_team_stats (
    month TEXT,
    team_name TEXT,
    center_name TEXT,
    total_employees INTEGER,
    weekly_claimed_hours REAL,
    weekly_adjusted_hours REAL,
    efficiency REAL,
    data_reliability REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (month, team_name, center_name)
  );

  CREATE INDEX IF NOT EXISTS idx_monthly_team_stats_month ON monthly_team_stats(month);
  CREATE INDEX IF NOT EXISTS idx_monthly_team_stats_center ON monthly_team_stats(center_name);
`);

const months = [
  '2025-01', '2025-02', '2025-03', '2025-04', '2025-05',
  '2025-06', '2025-07', '2025-08', '2025-09', '2025-10'
];

const excludedCenters = "('경영진단팀', '대표이사', '이사회', '자문역/고문')";
const excludedEmployees = "('20190287', '20200207', '20120150', '20200459')";

// Prepare team stats insert
const insertTeamStats = db.prepare(`
  INSERT INTO monthly_team_stats (
    month, team_name, center_name, total_employees,
    weekly_claimed_hours, weekly_adjusted_hours, efficiency, data_reliability
  )
  WITH claimed AS (
    SELECT
      e.team_name,
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
      AND e.team_name IS NOT NULL
      AND e.team_name != ''
      AND e.center_name NOT IN ${excludedCenters}
      AND c.사번 NOT IN ${excludedEmployees}
    GROUP BY e.team_name, e.center_name
  ),
  adjusted AS (
    SELECT
      e.team_name,
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
      AND e.team_name IS NOT NULL
      AND e.team_name != ''
      AND e.center_name NOT IN ${excludedCenters}
      AND c.사번 NOT IN ${excludedEmployees}
    GROUP BY e.team_name, e.center_name
  ),
  reliability AS (
    SELECT
      e.team_name,
      ROUND(AVG(dar.confidence_score), 1) as avg_reliability
    FROM daily_analysis_results dar
    JOIN employees e ON e.employee_id = dar.employee_id
    WHERE dar.analysis_date BETWEEN ? AND ?
      AND e.team_name IS NOT NULL
      AND e.center_name NOT IN ${excludedCenters}
      AND dar.employee_id NOT IN ${excludedEmployees}
    GROUP BY e.team_name
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
  LEFT JOIN adjusted a ON c.team_name = a.team_name AND c.center_name = a.center_name
  LEFT JOIN reliability r ON c.team_name = r.team_name
`);

const deleteTeamStats = db.prepare('DELETE FROM monthly_team_stats WHERE month = ?');

const totalStart = Date.now();

for (const month of months) {
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;

  console.log(`\nProcessing ${month}...`);
  const monthStart = Date.now();

  try {
    const transaction = db.transaction(() => {
      deleteTeamStats.run(month);
      insertTeamStats.run(
        startDate, endDate,  // claimed
        startDate, endDate,  // adjusted (EXISTS check)
        startDate, endDate,  // adjusted (WHERE clause)
        startDate, endDate,  // reliability
        month,
        endDate, startDate,  // JULIANDAY for weekly_claimed
        endDate, startDate   // JULIANDAY for weekly_adjusted
      );
    });

    transaction();

    const teamCount = db.prepare('SELECT COUNT(*) as count FROM monthly_team_stats WHERE month = ?').get(month).count;
    const elapsed = ((Date.now() - monthStart) / 1000).toFixed(1);

    console.log(`  ✓ Teams: ${teamCount} (${elapsed}s)`);
  } catch (error) {
    console.error(`  ✗ Error processing ${month}:`, error.message);
  }
}

const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
console.log(`\n=== Complete! Total time: ${totalElapsed}s ===`);

// Summary
const teamTotal = db.prepare('SELECT COUNT(*) as count FROM monthly_team_stats').get().count;
console.log(`Total team records: ${teamTotal}`);

// Show sample data
console.log('\nSample data (2025-10):');
const sample = db.prepare(`
  SELECT team_name, center_name, total_employees, weekly_claimed_hours, weekly_adjusted_hours, efficiency
  FROM monthly_team_stats
  WHERE month = '2025-10'
  ORDER BY center_name, team_name
  LIMIT 10
`).all();
console.table(sample);

db.close();
