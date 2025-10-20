import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'

/**
 * tag_data의 최신 데이터 월 조회
 * 예: 2025-07 데이터가 있으면 '2025-07' 반환
 */
export async function GET() {
  const db = new Database('sambio_human.db', { readonly: true })

  try {
    // ENTE_DT 컬럼에서 최신 날짜 조회
    const result = db.prepare(`
      SELECT MAX(ENTE_DT) as maxDate
      FROM tag_data
    `).get() as { maxDate: number | null }

    if (!result.maxDate) {
      // 데이터가 없으면 현재 월 반환
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      return NextResponse.json({
        latestMonth: currentMonth,
        hasData: false
      })
    }

    // YYYYMMDD → YYYY-MM 변환
    const dateStr = result.maxDate.toString()
    const year = dateStr.substring(0, 4)
    const month = dateStr.substring(4, 6)
    const latestMonth = `${year}-${month}`

    return NextResponse.json({
      latestMonth,
      hasData: true
    })

  } catch (error) {
    console.error('최신 데이터 월 조회 오류:', error)

    // 오류 시 현재 월 반환
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    return NextResponse.json({
      latestMonth: currentMonth,
      hasData: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })

  } finally {
    db.close()
  }
}
