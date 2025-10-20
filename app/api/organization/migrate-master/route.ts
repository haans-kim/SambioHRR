import { NextResponse } from 'next/server'
import { CompleteMasterMigrator } from '@/lib/migration/CompleteMasterMigrator'

interface MigrateRequest {
  startMonth: string  // 'YYYY-MM'
  endMonth: string    // 'YYYY-MM'
}

interface MonthResult {
  month: string
  success: boolean
  eventsProcessed: number
  uniqueEmployees: number
  duration: number
  error?: string
}

/**
 * 월별로 순차 마이그레이션 실행
 * 예: 2025-07 ~ 2025-09 → 7월, 8월, 9월 순차 처리
 */
export async function POST(request: Request) {
  try {
    const body: MigrateRequest = await request.json()
    const { startMonth, endMonth } = body

    console.log(`📊 마이그레이션 시작: ${startMonth} ~ ${endMonth}`)

    // 월 목록 생성
    const months = getMonthRange(startMonth, endMonth)
    console.log(`  처리할 월: ${months.join(', ')}`)

    const results: MonthResult[] = []
    let totalEvents = 0
    let totalEmployees = new Set<number>()

    for (const month of months) {
      console.log(`\n🗓️  ${month} 마이그레이션 시작...`)

      const [year, monthNum] = month.split('-')
      const startDate = `${year}${monthNum}01`
      const endDate = getLastDayOfMonth(parseInt(year), parseInt(monthNum))

      const monthStartTime = Date.now()

      try {
        // 마이그레이션 실행
        const migrator = new CompleteMasterMigrator(startDate, endDate)
        const result = await migrator.run()

        const monthDuration = Date.now() - monthStartTime

        if (result.success) {
          totalEvents += result.totalEvents

          results.push({
            month,
            success: true,
            eventsProcessed: result.totalEvents,
            uniqueEmployees: result.uniqueEmployees,
            duration: monthDuration
          })

          console.log(`✅ ${month} 완료: ${result.totalEvents.toLocaleString()}개 이벤트, ${(monthDuration / 1000).toFixed(1)}초`)
        } else {
          results.push({
            month,
            success: false,
            eventsProcessed: 0,
            uniqueEmployees: 0,
            duration: monthDuration,
            error: result.error
          })
          console.error(`❌ ${month} 실패: ${result.error}`)
        }

      } catch (error) {
        const monthDuration = Date.now() - monthStartTime
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'

        results.push({
          month,
          success: false,
          eventsProcessed: 0,
          uniqueEmployees: 0,
          duration: monthDuration,
          error: errorMessage
        })

        console.error(`❌ ${month} 오류:`, error)
      }
    }

    // 전체 결과 요약
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

    console.log(`\n📊 전체 마이그레이션 완료:`)
    console.log(`  • 성공: ${successCount}개월`)
    console.log(`  • 실패: ${failCount}개월`)
    console.log(`  • 총 이벤트: ${totalEvents.toLocaleString()}개`)
    console.log(`  • 총 소요시간: ${(totalDuration / 1000).toFixed(1)}초`)

    return NextResponse.json({
      success: failCount === 0,
      summary: {
        totalMonths: months.length,
        successMonths: successCount,
        failMonths: failCount,
        totalEvents,
        totalDuration
      },
      results
    })

  } catch (error) {
    console.error('❌ 마이그레이션 API 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    )
  }
}

/**
 * 시작월~종료월 사이의 모든 월 생성
 * 예: ('2025-07', '2025-09') → ['2025-07', '2025-08', '2025-09']
 */
function getMonthRange(startMonth: string, endMonth: string): string[] {
  const months: string[] = []

  const [startYear, startMon] = startMonth.split('-').map(Number)
  const [endYear, endMon] = endMonth.split('-').map(Number)

  let currentYear = startYear
  let currentMonth = startMon

  while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMon)) {
    const monthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`
    months.push(monthStr)

    currentMonth++
    if (currentMonth > 12) {
      currentMonth = 1
      currentYear++
    }
  }

  return months
}

/**
 * 해당 월의 마지막 날짜 계산
 * 예: (2025, 2) → '20250228', (2025, 7) → '20250731'
 */
function getLastDayOfMonth(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}${month.toString().padStart(2, '0')}${lastDay.toString().padStart(2, '0')}`
}
