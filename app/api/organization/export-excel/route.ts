import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function POST(request: Request) {
  try {
    const { results } = await request.json()
    
    if (!results || results.length === 0) {
      return NextResponse.json({ error: 'No data to export' }, { status: 400 })
    }
    
    // Prepare data for Excel
    const excelData = results.map((result: any) => ({
      '날짜': result.date,
      '사번': result.employeeId,
      '성명': result.employeeName,
      '총 체류시간(분)': Math.round(result.metrics.totalTime),
      '총 체류시간(시간)': (result.metrics.totalTime / 60).toFixed(2),
      '실제 작업시간(분)': Math.round(result.metrics.workTime),
      '실제 작업시간(시간)': (result.metrics.workTime / 60).toFixed(2),
      '신고 근무시간': result.claimedHours || '',
      '추정작업시간(분)': Math.round(result.metrics.estimatedWorkTime),
      '작업추정률(%)': result.metrics.workRatio.toFixed(1),
      '집중작업시간(분)': Math.round(result.metrics.focusTime),
      '회의시간(분)': Math.round(result.metrics.meetingTime),
      '식사시간(분)': Math.round(result.metrics.mealTime),
      '이동시간(분)': Math.round(result.metrics.transitTime),
      '비업무시간(분)': Math.round(result.metrics.restTime),
      '데이터 신뢰도(%)': result.metrics.reliabilityScore.toFixed(1)
    }))
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)
    
    // Set column widths
    const columnWidths = [
      { wch: 12 }, // 날짜
      { wch: 10 }, // 사번
      { wch: 10 }, // 성명
      { wch: 15 }, // 총 체류시간(분)
      { wch: 15 }, // 총 체류시간(시간)
      { wch: 15 }, // 실제 작업시간(분)
      { wch: 15 }, // 실제 작업시간(시간)
      { wch: 15 }, // 신고 근무시간
      { wch: 15 }, // 추정작업시간(분)
      { wch: 15 }, // 작업추정률(%)
      { wch: 15 }, // 집중작업시간(분)
      { wch: 12 }, // 회의시간(분)
      { wch: 12 }, // 식사시간(분)
      { wch: 12 }, // 이동시간(분)
      { wch: 15 }, // 비업무시간(분)
      { wch: 15 }  // 데이터 신뢰도(%)
    ]
    ws['!cols'] = columnWidths
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, '조직분석결과')
    
    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
    
    // Return file as response
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="organization_analysis_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
    
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}