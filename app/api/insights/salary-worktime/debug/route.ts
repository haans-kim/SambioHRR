import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { DB_PATH } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let db: Database.Database | null = null;

  try {
    db = new Database(DB_PATH, { readonly: true });
    
    // 센터별 직급별 인원수 확인
    const centerGradeQuery = `
      SELECT 
        e.center_name,
        e.job_grade,
        COUNT(DISTINCT e.employee_id) as employee_count
      FROM employees e
      WHERE e.center_name IS NOT NULL
        AND e.job_grade IS NOT NULL
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
      GROUP BY e.center_name, e.job_grade
      ORDER BY e.center_name, e.job_grade;
    `;
    
    // daily_analysis_results에 있는 센터별 직급별 데이터 확인
    const analysisQuery = `
      WITH date_range AS (
        SELECT 
          MIN(analysis_date) as start_date,
          MAX(analysis_date) as end_date
        FROM daily_analysis_results
        WHERE analysis_date IS NOT NULL
      )
      SELECT 
        e.center_name,
        e.job_grade,
        COUNT(DISTINCT dar.employee_id) as employee_count,
        AVG(dar.actual_work_hours) as avg_daily_hours,
        AVG(dar.confidence_score) as avg_confidence
      FROM daily_analysis_results dar
      JOIN employees e ON e.employee_id = dar.employee_id
      CROSS JOIN date_range dr
      WHERE dar.analysis_date BETWEEN dr.start_date AND dr.end_date
        AND e.job_grade IS NOT NULL
        AND e.center_name IS NOT NULL
        AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
        AND dar.actual_work_hours IS NOT NULL
        AND dar.confidence_score IS NOT NULL
      GROUP BY e.center_name, e.job_grade
      ORDER BY e.center_name, e.job_grade;
    `;
    
    const employeeData = db.prepare(centerGradeQuery).all();
    const analysisData = db.prepare(analysisQuery).all();
    
    return NextResponse.json({
      employeeTableData: employeeData,
      analysisTableData: analysisData,
      employeeCount: employeeData.length,
      analysisCount: analysisData.length
    });
    
  } catch (error) {
    console.error('Debug query failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debug data' },
      { status: 500 }
    );
  } finally {
    if (db) {
      db.close();
    }
  }
}