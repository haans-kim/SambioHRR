import { NextRequest, NextResponse } from 'next/server'
import DatabaseManager from '@/lib/database/connection'

interface ClaimRecord {
  employeeId: string;
  workDate: string;
  claimedHours: number;
}

interface EmployeeNameRecord {
  employeeId: string;
  employeeName: string;
}

/**
 * 전체 Claim 데이터에서 모든 직원 정보 추출
 * Ground Rules 전체 분석용
 */
export async function POST(request: NextRequest) {
  try {
    const humanDb = DatabaseManager.getInstance().getDb()

    console.log('🔍 Extracting ALL employees from Claim data...')

    // Claim 데이터에서 근무시간이 0이 아닌 모든 레코드 추출 (직원+날짜 조합)
    const stmt = humanDb.prepare(`
      SELECT
        사번 as employeeId,
        DATE(근무일) as workDate,
        실제근무시간 as claimedHours
      FROM claim_data
      WHERE 실제근무시간 > 0
      ORDER BY 사번, 근무일
    `)

    const allRecords = stmt.all() as ClaimRecord[]
    console.log(`✅ Found ${allRecords.length} records with actual work hours > 0`)
    
    // 직원별로 그룹화하여 분석용 형태로 변환
    const employeeMap = new Map()
    
    allRecords.forEach(record => {
      if (!employeeMap.has(record.employeeId)) {
        employeeMap.set(record.employeeId, {
          employeeId: record.employeeId,
          employeeName: `직원${record.employeeId}`, // 기본값
          dates: []
        })
      }
      employeeMap.get(record.employeeId).dates.push(record.workDate)
    })
    
    const employees = Array.from(employeeMap.values())
    console.log(`✅ Grouped into ${employees.length} employees`)
    
    // 직원명 매핑 - organization_data에서 실제 이름 가져오기
    if (employees.length > 0) {
      const employeeIds = employees.map(emp => emp.employeeId)
      const placeholders = employeeIds.map(() => '?').join(',')
      
      const nameStmt = humanDb.prepare(`
        SELECT
          사번 as employeeId,
          성명 as employeeName
        FROM organization_data
        WHERE 사번 IN (${placeholders})
      `)

      const nameData = nameStmt.all(...employeeIds) as EmployeeNameRecord[]
      const nameMap = new Map(nameData.map(item => [item.employeeId, item.employeeName]))
      
      // 이름 업데이트
      employees.forEach(emp => {
        emp.employeeName = nameMap.get(emp.employeeId) || `직원${emp.employeeId}`
      })
      
      console.log(`✅ Updated names for ${nameData.length} employees`)
    }

    return NextResponse.json({
      success: true,
      employees,
      summary: {
        totalEmployees: employees.length,
        totalRecords: allRecords.length,
        dataSource: 'claim_data (실제근무시간 > 0)',
        extractionTime: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('❌ Extract all employees error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to extract all employees',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}