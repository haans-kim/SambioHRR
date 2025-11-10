#!/usr/bin/env tsx
import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(process.cwd(), 'sambio_human.db'), { readonly: true })

console.log('=== 1-6월 claim_data 근무시간 패턴 확인 ===\n')

// 1. 1월 날짜별 통계
console.log('1. 1월 날짜별 근무시간 통계:')
const janStats = db.prepare(`
  SELECT
    근무일자,
    COUNT(*) as 직원수,
    AVG(CAST(근무시간 AS REAL)) as 평균근무시간,
    SUM(CASE WHEN CAST(근무시간 AS REAL) = 0 THEN 1 ELSE 0 END) as 근무시간0명,
    SUM(CASE WHEN CAST(근무시간 AS REAL) = 8 THEN 1 ELSE 0 END) as 근무시간8명
  FROM claim_data
  WHERE 근무일자 >= '2025-01-01' AND 근무일자 <= '2025-01-31'
  GROUP BY 근무일자
  ORDER BY 근무일자
`).all() as any[]

janStats.forEach((row: any) => {
  const avg = Number(row.평균근무시간 || 0).toFixed(1)
  console.log(`${row.근무일자}: ${row.직원수}명, 평균 ${avg}h, 0h=${row.근무시간0명}명, 8h=${row.근무시간8명}명`)
})

// 2. 근무시간 분포
console.log('\n2. 근무시간 값 분포 (1-6월):')
const distribution = db.prepare(`
  SELECT
    근무시간,
    COUNT(*) as 건수,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM claim_data WHERE 근무일자 >= '2025-01-01' AND 근무일자 <= '2025-06-30'), 2) as 비율
  FROM claim_data
  WHERE 근무일자 >= '2025-01-01' AND 근무일자 <= '2025-06-30'
  GROUP BY 근무시간
  ORDER BY CAST(근무시간 AS REAL)
`).all() as any[]

distribution.forEach((row: any) => {
  console.log(`${row.근무시간}: ${row.건수.toLocaleString()}건 (${row.비율}%)`)
})

db.close()
