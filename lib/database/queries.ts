import DatabaseManager from './connection'
import type { Employee, TagData, MealData, KnoxPimsData } from '@/types/database'

const db = DatabaseManager.getInstance()

// Employee queries
export const getEmployees = () => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT 
        사번 as employee_id,
        성명 as name,
        부서명 as department,
        직급명 as position,
        입사년도 as hire_date,
        성별 as gender,
        '일반' as shift_type
      FROM organization_data
      WHERE 재직상태 = '재직'
      ORDER BY 부서명, 성명
    `)
    return stmt.all() as Employee[]
  } catch (error) {
    console.error('Error fetching employees:', error)
    return []
  }
}

export const getEmployeeById = (employeeId: number) => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT 
        e.employee_id,
        e.employee_name as name,
        e.group_name as department,
        COALESCE(o.직급명, 'G' || e.job_grade || '(Senior Specialist)') as position,
        COALESCE(o.입사년도, '2021년') as hire_date,
        COALESCE(o.성별, '남') as gender,
        '일반' as shift_type,
        e.team_name,
        e.group_name
      FROM employees e
      LEFT JOIN organization_data o ON e.employee_id = CAST(o.사번 AS TEXT)
      WHERE e.employee_id = ?
    `)
    return stmt.get(employeeId.toString()) as Employee | undefined
  } catch (error) {
    console.error('Error fetching employee:', error)
    return undefined
  }
}

// Organization hierarchy queries using organization_master
export const getCenters = () => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT 
        org_code as code,
        org_name as name,
        display_order
      FROM organization_master
      WHERE org_level = 'center' 
        AND is_active = 1
      ORDER BY display_order, org_name
    `)
    return stmt.all() as { code: string; name: string; display_order: number }[]
  } catch (error) {
    console.error('Error fetching centers:', error)
    return []
  }
}

// Get divisions (담당) by center
export const getDivisionsByCenter = (centerCode: string) => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT 
        org_code as code,
        org_name as name,
        display_order
      FROM organization_master
      WHERE parent_org_code = ? 
        AND org_level = 'division'
        AND is_active = 1
      ORDER BY display_order, org_name
    `)
    return stmt.all(centerCode) as { code: string; name: string; display_order: number }[]
  } catch (error) {
    console.error('Error fetching divisions by center:', error)
    return []
  }
}

// Get teams by division or center (for cases where teams are directly under center)
export const getTeamsByDivision = (divisionCode: string) => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT 
        org_code as code,
        org_name as name,
        display_order
      FROM organization_master
      WHERE parent_org_code = ? 
        AND org_level = 'team'
        AND is_active = 1
      ORDER BY display_order, org_name
    `)
    return stmt.all(divisionCode) as { code: string; name: string; display_order: number }[]
  } catch (error) {
    console.error('Error fetching teams by division:', error)
    return []
  }
}

// Get teams directly under center (without division)
export const getTeamsByCenter = (centerCode: string) => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT 
        org_code as code,
        org_name as name,
        display_order
      FROM organization_master
      WHERE parent_org_code = ? 
        AND org_level = 'team'
        AND is_active = 1
      ORDER BY display_order, org_name
    `)
    return stmt.all(centerCode) as { code: string; name: string; display_order: number }[]
  } catch (error) {
    console.error('Error fetching teams by center:', error)
    return []
  }
}

export const getGroupsByTeam = (teamCode: string) => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT 
        org_code as code,
        org_name as name,
        display_order
      FROM organization_master
      WHERE parent_org_code = ? 
        AND org_level = 'group'
        AND is_active = 1
      ORDER BY display_order, org_name
    `)
    return stmt.all(teamCode) as { code: string; name: string; display_order: number }[]
  } catch (error) {
    console.error('Error fetching groups by team:', error)
    return []
  }
}

export const getEmployeesByOrganization = (orgCode: string) => {
  try {
    // First get org_name from organization_master
    const orgStmt = db.getDb().prepare(`
      SELECT org_name, org_level 
      FROM organization_master 
      WHERE org_code = ?
    `)
    const org = orgStmt.get(orgCode) as { org_name: string; org_level: string } | undefined
    
    if (!org) return []
    
    // Then get employees based on the organization level
    let query = ''
    if (org.org_level === 'center') {
      query = `
        SELECT DISTINCT
          od.사번 as employee_id,
          od.성명 as name,
          od.부서명 as department,
          od.직급명 as position
        FROM organization_data od
        WHERE od.센터 = ? AND od.재직상태 = '재직'
        ORDER BY od.성명
      `
    } else if (org.org_level === 'division') {
      // For division level, we need to get all employees from child teams
      // This includes direct teams under the division and the division's own direct employees
      query = `
        SELECT DISTINCT
          od.사번 as employee_id,
          od.성명 as name,
          od.부서명 as department,
          od.직급명 as position
        FROM organization_data od
        WHERE od.팀 IN (
          SELECT org_name 
          FROM organization_master 
          WHERE parent_org_code = (
            SELECT org_code 
            FROM organization_master 
            WHERE org_code = ?
          )
        ) AND od.재직상태 = '재직'
        ORDER BY od.성명
      `
    } else if (org.org_level === 'team') {
      query = `
        SELECT DISTINCT
          od.사번 as employee_id,
          od.성명 as name,
          od.부서명 as department,
          od.직급명 as position
        FROM organization_data od
        WHERE od.팀 = ? AND od.재직상태 = '재직'
        ORDER BY od.성명
      `
    } else if (org.org_level === 'group') {
      query = `
        SELECT DISTINCT
          od.사번 as employee_id,
          od.성명 as name,
          od.부서명 as department,
          od.직급명 as position
        FROM organization_data od
        WHERE od.그룹 = ? AND od.재직상태 = '재직'
        ORDER BY od.성명
      `
    } else {
      return []
    }
    
    const stmt = db.getDb().prepare(query)
    // For division level, pass org_code instead of org_name
    if (org.org_level === 'division') {
      return stmt.all(orgCode) as Employee[]
    } else {
      return stmt.all(org.org_name) as Employee[]
    }
  } catch (error) {
    console.error('Error fetching employees by organization:', error)
    return []
  }
}

// Save analysis results to daily_analysis_results table
export const saveDailyAnalysisResult = (data: {
  employeeId: number
  analysisDate: string
  // 조직 정보 추가
  centerId?: string
  centerName?: string
  teamId?: string
  teamName?: string
  groupId?: string
  groupName?: string
  totalHours: number
  actualWorkHours: number
  claimedWorkHours: number | null
  efficiencyRatio: number
  focusedWorkMinutes: number
  meetingMinutes: number
  mealMinutes: number
  movementMinutes: number
  restMinutes: number
  confidenceScore: number
  // Ground Rules 메트릭 (선택적)
  groundRulesWorkHours?: number
  groundRulesConfidence?: number
  workMovementMinutes?: number
  nonWorkMovementMinutes?: number
  anomalyScore?: number
  // 휴가/연차 정보 추가
  leaveHours?: number
  businessTripHours?: number
  leaveType?: string | null
}) => {
  try {
    const stmt = db.getDb().prepare(`
      INSERT OR REPLACE INTO daily_analysis_results (
        employee_id,
        analysis_date,
        center_id,
        center_name,
        team_id,
        team_name,
        group_id,
        group_name,
        total_hours,
        actual_work_hours,
        claimed_work_hours,
        efficiency_ratio,
        focused_work_minutes,
        meeting_minutes,
        meal_minutes,
        movement_minutes,
        rest_minutes,
        confidence_score,
        work_minutes,
        ground_rules_work_hours,
        ground_rules_confidence,
        work_movement_minutes,
        non_work_movement_minutes,
        anomaly_score,
        leave_hours,
        business_trip_hours,
        leave_type,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    
    // Calculate work_minutes (actual_work_hours * 60)
    const workMinutes = Math.round(data.actualWorkHours * 60)
    
    return stmt.run(
      data.employeeId.toString().split('.')[0],  // Remove decimal part if present
      data.analysisDate,
      data.centerId || null,
      data.centerName || null,
      data.teamId || null,
      data.teamName || null,
      data.groupId || null,
      data.groupName || null,
      data.totalHours,
      data.actualWorkHours,
      data.claimedWorkHours,
      data.efficiencyRatio,
      data.focusedWorkMinutes,
      data.meetingMinutes,
      data.mealMinutes,
      data.movementMinutes,
      data.restMinutes,
      data.confidenceScore,
      workMinutes,
      data.groundRulesWorkHours || 0,
      data.groundRulesConfidence || 0,
      data.workMovementMinutes || 0,
      data.nonWorkMovementMinutes || 0,
      data.anomalyScore || 0,
      data.leaveHours || 0,
      data.businessTripHours || 0,
      data.leaveType || null
    )
  } catch (error) {
    console.error('Error saving daily analysis result:', error)
    throw error
  }
}

// Get daily analysis results with Ground Rules metrics
export const getDailyAnalysisResultsWithGroundRules = (employeeId: number | null, startDate: string, endDate: string) => {
  try {
    let query = `
      SELECT 
        employee_id,
        analysis_date,
        total_hours,
        actual_work_hours,
        claimed_work_hours,
        efficiency_ratio,
        focused_work_minutes,
        meeting_minutes,
        meal_minutes,
        movement_minutes,
        rest_minutes,
        confidence_score,
        work_minutes,
        ground_rules_work_hours,
        ground_rules_confidence,
        work_movement_minutes,
        non_work_movement_minutes,
        anomaly_score,
        created_at,
        updated_at
      FROM daily_analysis_results
      WHERE analysis_date BETWEEN ? AND ?`
    
    let params: any[] = [startDate, endDate]
    
    if (employeeId) {
      query += ` AND employee_id = ?`
      params.push(employeeId)
    }
    
    query += ` ORDER BY analysis_date DESC`
    
    const stmt = db.getDb().prepare(query)
    return stmt.all(...params)
  } catch (error) {
    console.error('Error fetching daily analysis results with Ground Rules:', error)
    return []
  }
}

// Get organization statistics with Ground Rules metrics
export const getOrganizationStatsWithGroundRules = (organizationType: 'center' | 'division' | 'team' | 'group', organizationName: string, startDate: string, endDate: string) => {
  try {
    let joinCondition = ''
    switch (organizationType) {
      case 'center':
        joinCondition = 'om.center_name = ?'
        break
      case 'division': 
        joinCondition = 'om.division_name = ?'
        break
      case 'team':
        joinCondition = 'om.team_name = ?'
        break
      case 'group':
        joinCondition = 'om.group_name = ?'
        break
    }

    const stmt = db.getDb().prepare(`
      SELECT 
        COUNT(*) as total_records,
        AVG(dar.actual_work_hours) as avg_work_hours,
        AVG(dar.efficiency_ratio) as avg_efficiency,
        AVG(dar.confidence_score) as avg_confidence,
        AVG(dar.ground_rules_work_hours) as avg_ground_rules_work_hours,
        AVG(dar.ground_rules_confidence) as avg_ground_rules_confidence,
        AVG(dar.work_movement_minutes) as avg_work_movement,
        AVG(dar.non_work_movement_minutes) as avg_non_work_movement,
        AVG(dar.anomaly_score) as avg_anomaly_score,
        SUM(CASE WHEN dar.anomaly_score > 0 THEN 1 ELSE 0 END) as anomaly_count
      FROM daily_analysis_results dar
      JOIN organization_monthly_stats om ON dar.employee_id = om.employee_id
      WHERE ${joinCondition} AND dar.analysis_date BETWEEN ? AND ?
    `)
    
    return stmt.get(organizationName, startDate, endDate)
  } catch (error) {
    console.error('Error fetching organization stats with Ground Rules:', error)
    return null
  }
}

// Legacy department queries (kept for compatibility)
export const getDepartments = () => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT DISTINCT 부서명 as department
      FROM organization_data
      WHERE 재직상태 = '재직' AND 부서명 IS NOT NULL
      ORDER BY 부서명
    `)
    return stmt.all() as { department: string }[]
  } catch (error) {
    console.error('Error fetching departments:', error)
    return []
  }
}

export const getEmployeesByDepartment = (department: string) => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT 
        사번 as employee_id,
        성명 as name,
        부서명 as department,
        직급명 as position
      FROM organization_data
      WHERE 부서명 = ? AND 재직상태 = '재직'
      ORDER BY 성명
    `)
    return stmt.all(department) as Employee[]
  } catch (error) {
    console.error('Error fetching employees by department:', error)
    return []
  }
}

// Tag data queries
export const getTagData = (employeeId: number, date: string) => {
  try {
    // Convert date format from YYYY-MM-DD to YYYYMMDD
    const dateInt = parseInt(date.replace(/-/g, ''))
    
    const stmt = db.getDb().prepare(`
      SELECT
        SUBSTR(td.ENTE_DT, 1, 4) || '-' ||
        SUBSTR(td.ENTE_DT, 5, 2) || '-' ||
        SUBSTR(td.ENTE_DT, 7, 2) || ' ' ||
        CASE
          WHEN td.출입시각 LIKE '%-%' THEN SUBSTR(td.출입시각, 11, 8)
          ELSE SUBSTR('000000' || td.출입시각, -6, 2) || ':' ||
               SUBSTR('000000' || td.출입시각, -4, 2) || ':' ||
               SUBSTR('000000' || td.출입시각, -2, 2)
        END as ENTE_DT,
        td.사번,
        td.NAME,
        td.DR_NM as Location,
        COALESCE(tlm.Tag_Code, 
          CASE 
            WHEN td.DR_NM LIKE '%식당%' THEN 'M1'
            WHEN td.DR_NM LIKE '%정문%' AND td.INOUT_GB = '입문' THEN 'T2'
            WHEN td.DR_NM LIKE '%정문%' AND td.INOUT_GB = '출문' THEN 'T3'
            WHEN td.DR_NM LIKE '%휴게%' THEN 'N1'
            WHEN td.DR_NM LIKE '%회의%' THEN 'G3'
            ELSE 'G1'
          END
        ) as Tag_Code
      FROM tag_data td
      LEFT JOIN tag_location_master tlm 
        ON td.DR_NM = tlm.게이트명
      WHERE td.사번 = ? 
        AND td.ENTE_DT = ?
      ORDER BY td.출입시각
    `)
    return stmt.all(employeeId, dateInt) as TagData[]
  } catch (error) {
    console.error('Error fetching tag data:', error)
    return []
  }
}

// Night shift special handling
export const getNightShiftTagData = (employeeId: number, date: string) => {
  try {
    // For night shift: previous day 17:00 to current day 12:00
    const prevDate = new Date(date)
    prevDate.setDate(prevDate.getDate() - 1)
    const prevDateStr = prevDate.toISOString().split('T')[0]
    
    const prevDateInt = parseInt(prevDateStr.replace(/-/g, ''))
    const currDateInt = parseInt(date.replace(/-/g, ''))
    
    const stmt = db.getDb().prepare(`
      SELECT
        SUBSTR(td.ENTE_DT, 1, 4) || '-' ||
        SUBSTR(td.ENTE_DT, 5, 2) || '-' ||
        SUBSTR(td.ENTE_DT, 7, 2) || ' ' ||
        CASE
          WHEN td.출입시각 LIKE '%-%' THEN SUBSTR(td.출입시각, 11, 8)
          ELSE SUBSTR('000000' || td.출입시각, -6, 2) || ':' ||
               SUBSTR('000000' || td.출입시각, -4, 2) || ':' ||
               SUBSTR('000000' || td.출입시각, -2, 2)
        END as ENTE_DT,
        td.사번,
        td.NAME,
        td.DR_NM as Location,
        COALESCE(tlm.Tag_Code, 
          CASE 
            WHEN td.DR_NM LIKE '%식당%' THEN 'M1'
            WHEN td.DR_NM LIKE '%정문%' AND td.INOUT_GB = '입문' THEN 'T2'
            WHEN td.DR_NM LIKE '%정문%' AND td.INOUT_GB = '출문' THEN 'T3'
            WHEN td.DR_NM LIKE '%휴게%' THEN 'N1'
            WHEN td.DR_NM LIKE '%회의%' THEN 'G3'
            ELSE 'G1'
          END
        ) as Tag_Code
      FROM tag_data td
      LEFT JOIN tag_location_master tlm 
        ON td.DR_NM = tlm.게이트명
      WHERE td.사번 = ? 
        AND ((td.ENTE_DT = ? AND td.출입시각 >= 180000) 
          OR (td.ENTE_DT = ? AND td.출입시각 <= 120000))
      ORDER BY td.ENTE_DT, td.출입시각
    `)
    return stmt.all(employeeId, prevDateInt, currDateInt) as TagData[]
  } catch (error) {
    console.error('Error fetching night shift tag data:', error)
    return []
  }
}

// Meal data queries - M1(구내식당 30분), M2(테이크아웃 10분)
export const getMealData = (employeeId: number, date: string) => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT
        취식일시 as timestamp,
        사번 as employee_id,
        성명 as name,
        식당명 as cafeteria,
        식사구분명 as meal_type,
        테이크아웃 as takeout,
        배식구 as serving_point
      FROM meal_data
      WHERE CAST(사번 AS INTEGER) = ?
        AND DATE(취식일시) = ?
      ORDER BY 취식일시
    `)
    const results = stmt.all(employeeId, date)
    
    // Convert to MealData format with tag codes
    return results.map((row: any) => {
      // Check if it's takeout - either by flag or by serving point name
      const isTakeout = row.takeout === 'Y' || 
                       (row.serving_point && row.serving_point.includes('테이크아웃'))
      
      return {
        timestamp: new Date(row.timestamp),
        employee_id: parseInt(row.employee_id),
        name: row.name,
        cafeteria: row.cafeteria,
        meal_type: row.meal_type,
        takeout: isTakeout ? 1 : 0,
        tag_code: isTakeout ? 'M2' : 'M1',
        duration: isTakeout ? 10 : 30  // M1: 30분, M2: 10분
      }
    })
  } catch (error) {
    console.error('Error fetching meal data:', error)
    return []
  }
}

// Knox PIMS data queries
export const getKnoxPimsData = (employeeId: number, date: string) => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT 
        id,
        employee_id,
        meeting_id,
        meeting_type,
        start_time,
        end_time,
        created_at
      FROM knox_pims_data
      WHERE employee_id = ? 
        AND DATE(start_time) = ?
      ORDER BY start_time
    `)
    return stmt.all(employeeId, date) as KnoxPimsData[]
  } catch (error) {
    console.error('Error fetching Knox PIMS data:', error)
    return []
  }
}

// Equipment data queries (convert to O tags)
export const getEquipmentData = (employeeId: number, date: string) => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT 
        Timestamp,
        "USERNO( ID->사번매칭 )" as USERNO,
        'O' as Tag_Code,
        'EQUIS' as Source
      FROM equis_data
      WHERE "USERNO( ID->사번매칭 )" = ? 
        AND DATE(Timestamp) = ?
      
      UNION ALL
      
      SELECT 
        ATTEMPTDATE as Timestamp,
        USERNO,
        'O' as Tag_Code,
        'EAM' as Source
      FROM eam_data
      WHERE USERNO = ? 
        AND DATE(ATTEMPTDATE) = ?
      
      UNION ALL
      
      SELECT 
        login_time as Timestamp,
        USERNo as USERNO,
        'O' as Tag_Code,
        'MES' as Source
      FROM mes_data
      WHERE USERNo = ? 
        AND DATE(login_time) = ?
      
      UNION ALL
      
      SELECT 
        Timestap as Timestamp,
        UserNo as USERNO,
        'O' as Tag_Code,
        'MDM' as Source
      FROM mdm_data
      WHERE UserNo = ? 
        AND DATE(Timestap) = ?
      
      UNION ALL
      
      SELECT 
        DATE as Timestamp,
        User_No as USERNO,
        'O' as Tag_Code,
        'LAMS' as Source
      FROM lams_data
      WHERE User_No = ?
        AND DATE LIKE ?
      
      ORDER BY Timestamp
    `)
    
    // Use string for employeeId and date pattern for LAMS
    const results = stmt.all(
      String(employeeId), date,     // EQUIS
      String(employeeId), date,     // EAM  
      employeeId, date,             // MES
      employeeId, date,             // MDM
      employeeId, `${date}%`        // LAMS
    )
    
    // Filter out null timestamps and return
    return results.filter((row: any) => row.Timestamp != null)
  } catch (error) {
    console.error('Error fetching equipment data:', error)
    return []
  }
}

// Claim data (for comparison)
export const getClaimData = (employeeId: number, date: string) => {
  try {
    // First check if database connection is healthy
    const database = db.getDb()
    
    // Check if table exists
    const tableCheck = database.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='claim_data'
    `).get()
    
    if (!tableCheck) {
      console.error('claim_data table not found')
      return null
    }
    
    const stmt = database.prepare(`
      SELECT 
        근무일,
        사번,
        성명,
        부서,
        직급,
        WORKSCHDTYPNM as 근무제도,
        근무시간,
        시작,
        종료,
        제외시간,
        근태명,
        실제근무시간
      FROM claim_data
      WHERE 사번 = ? 
        AND DATE(근무일) = ?
    `)
    const result = stmt.get(employeeId, date)
    
    // Try with TEXT comparison if DATE comparison fails
    if (!result) {
      const stmt2 = database.prepare(`
        SELECT 
          근무일,
          사번,
          성명,
          부서,
          직급,
          WORKSCHDTYPNM as 근무제도,
          근무시간,
          시작,
          종료,
          제외시간,
          근태명,
          실제근무시간
        FROM claim_data
        WHERE 사번 = ? 
          AND 근무일 LIKE ?
      `)
      return stmt2.get(employeeId, `${date}%`)
    }
    
    return result
  } catch (error: any) {
    console.error('Error fetching claim data:', error)
    
    // Check for corruption specifically
    if (error.code === 'SQLITE_CORRUPT') {
      console.error('Database corruption detected! Please restore from backup.')
      throw new Error('Database corruption detected. The database needs to be restored.')
    }
    
    return null
  }
}

// Get non-work time data
export const getNonWorkTimeData = (employeeId: number, date: string) => {
  try {
    // Remove hyphens from date for comparison
    const dateStr = date.replace(/-/g, '')
    
    const stmt = db.getDb().prepare(`
      SELECT 
        "Unnamed: 0" as 사번,
        "Unnamed: 1" as 근무일자,
        "Unnamed: 2" as 제외시간코드,
        "Unnamed: 3" as 제외시간구분,
        "Unnamed: 4" as 시작,
        "Unnamed: 5" as 종료,
        "Unnamed: 6" as 제외시간,
        "Unnamed: 7" as 입력구분,
        "Unnamed: 8" as 반영여부,
        "Unnamed: 9" as 테이블구분
      FROM non_work_time
      WHERE "Unnamed: 0" = ? 
        AND "Unnamed: 1" = ?
        AND "Unnamed: 8" = '자동반영'
      ORDER BY "Unnamed: 4"
    `)
    return stmt.all(String(employeeId), dateStr)
  } catch (error) {
    console.error('Error fetching non-work time data:', error)
    return []
  }
}

// Get job group for employee
export const getEmployeeJobGroup = async (employeeId: number): Promise<string> => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT DISTINCT 직급명 
      FROM organization_data 
      WHERE 사번 = ?
    `)
    
    const result = stmt.get(employeeId) as any
    
    // Map job titles to job groups
    if (!result) return 'OFFICE'
    
    const title = result.직급명
    if (title?.includes('책임') || title?.includes('수석')) return 'MANAGEMENT'
    if (title?.includes('연구')) return 'RESEARCH'
    if (title?.includes('생산') || title?.includes('제조')) return 'PRODUCTION'
    
    return 'OFFICE'
  } catch (error) {
    console.error('Error fetching employee job group:', error)
    return 'OFFICE'
  }
}

// Knox Mail data queries (convert to O tags)
export const getKnoxMailData = (employeeId: number, date: string) => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT 
        발신일시_GMT9 as timestamp,
        CAST(발신인사번_text AS INTEGER) as employee_id,
        메일key as mail_id,
        'Knox Mail' as event_type
      FROM knox_mail_data
      WHERE CAST(발신인사번_text AS INTEGER) = ? 
        AND DATE(발신일시_GMT9) = ?
      ORDER BY 발신일시_GMT9
    `)
    return stmt.all(employeeId, date)
  } catch (error) {
    console.error('Error fetching Knox mail data:', error)
    return []
  }
}

// Knox Approval data queries (convert to O tags)
export const getKnoxApprovalData = (employeeId: number, date: string) => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT 
        Timestamp as timestamp,
        UserNo as employee_id,
        APID as approval_id,
        Task as task,
        'Knox Approval' as event_type
      FROM knox_approval_data
      WHERE UserNo = ? 
        AND DATE(Timestamp) = ?
      ORDER BY Timestamp
    `)
    return stmt.all(employeeId, date)
  } catch (error) {
    console.error('Error fetching Knox approval data:', error)
    return []
  }
}

// Get employee info
export const getEmployeeInfo = (employeeId: number) => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT 
        사번 as EMP_NO,
        성명 as EMP_NAME,
        부서명,
        COALESCE(팀, 부서명) as 조직,
        직급명
      FROM organization_data 
      WHERE 사번 = ?
      LIMIT 1
    `)
    
    return stmt.get(employeeId)
  } catch (error) {
    console.error('Error fetching employee info:', error)
    return null
  }
}