import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';

export const dynamic = 'force-dynamic';

interface CenterLevelData {
  center_name: string;
  job_grade: string;
  employee_count: number;
  avg_weekly_work_hours: number;
}

interface CenterSummary {
  center_name: string;
  levels: {
    level: number;
    grades: {
      grade: string;
      avg_weekly_work_hours: number;
      total_members: number;
      level_salary: number;
    }[];
    total_salary: number;
    avg_members: number;
  }[];
  center_total_salary: number;
}

export async function GET() {
  let db: Database.Database | null = null;
  
  try {
    db = new Database('./sambio_human.db', { readonly: true });
    
    // 전체개요와 동일한 쿼리로 센터별/직급별 AI보정 주간근무시간 가져오기
    const query = `
      WITH date_range AS (
        SELECT 
          MIN(analysis_date) as start_date,
          MAX(analysis_date) as end_date
        FROM daily_analysis_results
        WHERE analysis_date IS NOT NULL
      )
      SELECT 
        e.center_name,
        'Lv.' || e.job_grade as grade,
        COUNT(DISTINCT dar.employee_id) as employee_count,
        -- AI 보정 적용된 주간 근무시간
        ROUND(
          (SUM(dar.actual_work_hours) / COUNT(*)) * 5 * 
          (0.92 + (1.0 / (1.0 + EXP(-12.0 * (AVG(dar.confidence_score) / 100.0 - 0.65))) * 0.08)), 
          1
        ) as avg_weekly_work_hours
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
      ORDER BY e.center_name, e.job_grade DESC;
    `;
    
    const results = db.prepare(query).all() as CenterLevelData[];
    
    // 레벨별 인건비 매핑 (이미지 기준 - 총연봉평균)
    const levelSalaryMap = {
      1: 97497544,   // Lv.1
      2: 125223661,  // Lv.2
      3: 166719755,  // Lv.3
      4: 214033208   // Lv.4
    };
    
    // 센터별로 그룹화하고 모든 레벨(1~4) 포함
    const centerMap = new Map<string, CenterSummary>();
    
    // 먼저 결과에서 모든 센터 추출
    const centerNames = new Set<string>();
    results.forEach(row => {
      centerNames.add(row.center_name);
    });
    
    // 각 센터에 대해 모든 레벨 초기화
    centerNames.forEach(centerName => {
      const center: CenterSummary = {
        center_name: centerName,
        levels: [],
        center_total_salary: 0
      };
      
      // 모든 레벨(1~4) 초기화
      for (let level = 1; level <= 4; level++) {
        center.levels.push({
          level: level,
          grades: [],
          total_salary: levelSalaryMap[level as keyof typeof levelSalaryMap],
          avg_members: 0
        });
      }
      
      centerMap.set(centerName, center);
    });
    
    // 실제 데이터 채우기
    results.forEach(row => {
      const center = centerMap.get(row.center_name)!;
      
      // 근무시간 기준 레벨 결정
      let level = 4;
      if (row.avg_weekly_work_hours < 36) level = 1;
      else if (row.avg_weekly_work_hours < 38) level = 2;
      else if (row.avg_weekly_work_hours < 40) level = 3;
      
      // 해당 레벨 찾기
      const levelData = center.levels.find(l => l.level === level)!;
      
      // 직급 데이터 추가
      levelData.grades.push({
        grade: row.grade,
        avg_weekly_work_hours: row.avg_weekly_work_hours,
        total_members: row.employee_count,
        level_salary: levelSalaryMap[level as keyof typeof levelSalaryMap]
      });
    });
    
    // 센터별 집계 계산
    centerMap.forEach(center => {
      let totalSalary = 0;
      
      center.levels.forEach(level => {
        // 레벨별 평균 인원 계산
        if (level.grades.length > 0) {
          const totalMembers = level.grades.reduce((sum, g) => sum + g.total_members, 0);
          level.avg_members = Math.round(totalMembers / level.grades.length);
          
          // 센터 총 인건비에 추가 (레벨 인건비 × 해당 레벨 총 인원)
          totalSalary += level.total_salary * totalMembers;
        } else {
          level.avg_members = 0;
        }
      });
      
      center.center_total_salary = totalSalary;
    });
    
    const finalResults = Array.from(centerMap.values());
    
    return NextResponse.json(finalResults);
    
  } catch (error) {
    console.error('Failed to fetch salary-worktime data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  } finally {
    if (db) {
      db.close();
    }
  }
}