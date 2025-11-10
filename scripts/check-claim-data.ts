#!/usr/bin/env tsx
import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(process.cwd(), 'sambio_human.db'), { readonly: true })

console.log('=== 1-6월 claim_data 근무시간 패턴 확인 ===\n')

// 1. 1월 1-10일 샘플 데이터
console.log('1. 1월 초순 데이터 샘플 (특정 직원):')
const janSample = db.prepare(`
  SELECT 근무일, 사번, 성명, 근무시간, 근태명
  FROM claim_data
  WHERE 근무일 >= '2025-01-01' AND 근무일 <= '2025-01-10'
  AND 사번 = (SELECT 사번 FROM claim_data LIMIT 1)
  ORDER BY 근무일
`).all() as any[]

janSample.forEach((row: any) => {
  console.log(`${row.근무일}: 근무시간=${row.근무시간}, 근태=${row.근태명}`)
})

// 2. 근무시간 값 분포
console.log('\n2. 근무시간 값 분포 (1-6월):')
const distribution = db.prepare(`
  SELECT
    근무시간,
    COUNT(*) as 건수,
    COUNT(DISTINCT 사번) as 직원수
  FROM claim_data
  WHERE 근무일 >= '2025-01-01' AND 근무일 <= '2025-06-30'
  GROUP BY 근무시간
  ORDER BY 건수 DESC
  LIMIT 15
`).all() as any[]

distribution.forEach((row: any) => {
  console.log(`근무시간=${row.근무시간}: ${row.건수.toLocaleString()}건 (${row.직원수}명)`)
})

// 3. 공휴일 추정 (근무시간=0이 많은 날)
console.log('\n3. 근무시간=0인 직원이 많은 날 (공휴일/주말 추정):')
const holidays = db.prepare(`
  SELECT
    근무일,
    COUNT(*) as 직원수,
    SUM(CASE WHEN CAST(근무시간 AS REAL) = 0 THEN 1 ELSE 0 END) as 근무시간0명
  FROM claim_data
  WHERE 근무일 >= '2025-01-01' AND 근무일 <= '2025-06-30'
  GROUP BY 근무일
  HAVING SUM(CASE WHEN CAST(근무시간 AS REAL) = 0 THEN 1 ELSE 0 END) > 1000
  ORDER BY 근무일
  LIMIT 20
`).all() as any[]

holidays.forEach((row: any) => {
  console.log(`${row.근무일}: 전체 ${row.직원수}명 중 ${row.근무시간0명}명이 근무시간=0`)
})

db.close()
