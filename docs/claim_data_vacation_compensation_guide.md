# Claim Data 휴가/연차/출장 보정 가이드

## 개요

claim_data 테이블에서 휴가, 연차, 출장, 교육 등의 근태 항목에 대해 실제근무시간을 보정하는 작업 가이드입니다.

## 보정 원칙

### 기본 규칙
1. **휴가/연차**: 실제근무시간이 NULL 또는 0인 경우 → 휴가_연차 시간을 실제근무시간에 반영
2. **출장**:
   - 실제근무시간이 0인 경우 → 8시간 추가
   - 실제근무시간이 기록되어 있으면 → 그대로 사용
3. **사외교육**: 실제근무시간이 NULL 또는 0인 경우 → 8시간 추가
4. **기타 휴가**: 실제근무시간이 NULL 또는 0이고 휴가_연차가 8.0인 경우 → 8시간 추가

### 제외 대상
- 미주지사 직원: `20190287`, `20200207`, `20120150`, `20200459`
- 제외 센터: `경영진단팀`, `대표이사`, `이사회`, `자문역/고문`

## 데이터 확인

### 1. 보정 전 데이터 확인

```sql
-- 월별 년차 데이터 확인
SELECT
  strftime('%Y-%m', 근무일) as month,
  COUNT(*) as total_records,
  COUNT(CASE WHEN 실제근무시간 IS NULL THEN 1 END) as null_hours,
  COUNT(CASE WHEN 실제근무시간 = 0 THEN 1 END) as zero_hours,
  COUNT(CASE WHEN 실제근무시간 = 8.0 THEN 1 END) as compensated_8h,
  ROUND(COUNT(CASE WHEN 실제근무시간 = 8.0 THEN 1 END) * 100.0 / COUNT(*), 1) as compensation_rate
FROM claim_data
WHERE 근태명 = '년차'
  AND 근무일 BETWEEN '2025-07-01' AND '2025-10-31'
GROUP BY strftime('%Y-%m', 근무일)
ORDER BY month;
```

### 2. 근태명별 현황 확인

```sql
-- 근태명별 보정 대상 확인
SELECT
  근태명,
  COUNT(*) as total,
  COUNT(CASE WHEN 실제근무시간 IS NULL OR 실제근무시간 = 0 THEN 1 END) as needs_compensation,
  AVG(휴가_연차) as avg_vacation_hours
FROM claim_data
WHERE 근무일 BETWEEN '2025-07-01' AND '2025-10-31'
  AND (근태명 LIKE '%년차%' OR 근태명 LIKE '%출장%' OR 근태명 LIKE '%교육%'
       OR 근태명 LIKE '%휴가%')
GROUP BY 근태명
ORDER BY needs_compensation DESC;
```

## 보정 실행

### Step 1: 년차 보정

```sql
-- 년차 근무시간 보정
UPDATE claim_data
SET 실제근무시간 = 휴가_연차
WHERE 근무일 BETWEEN '2025-07-01' AND '2025-10-31'
  AND 근태명 = '년차'
  AND (실제근무시간 IS NULL OR 실제근무시간 = 0)
  AND 휴가_연차 > 0
  AND 사번 NOT IN ('20190287', '20200207', '20120150', '20200459');

-- 결과 확인
SELECT changes() as updated_records;
```

**예상 결과**: 16,000~17,000건 업데이트 (월 평균 4,000건)

### Step 2: 출장 보정

```sql
-- 출장 근무시간 보정 (0시간인 경우 8시간 추가)
UPDATE claim_data
SET 실제근무시간 = 8.0
WHERE 근무일 BETWEEN '2025-07-01' AND '2025-10-31'
  AND (근태명 LIKE '%출장%' OR 근태명 LIKE '%파견%')
  AND (실제근무시간 IS NULL OR 실제근무시간 = 0)
  AND 사번 NOT IN ('20190287', '20200207', '20120150', '20200459');

-- 결과 확인
SELECT changes() as updated_records;
```

**예상 결과**: 600~700건 업데이트

### Step 3: 사외교육 보정

```sql
-- 사외교육 근무시간 보정
UPDATE claim_data
SET 실제근무시간 = 8.0
WHERE 근무일 BETWEEN '2025-07-01' AND '2025-10-31'
  AND 근태명 = '사외교육'
  AND (실제근무시간 IS NULL OR 실제근무시간 = 0)
  AND 사번 NOT IN ('20190287', '20200207', '20120150', '20200459');

-- 결과 확인
SELECT changes() as updated_records;
```

**예상 결과**: 400~500건 업데이트

### Step 4: 기타 휴가 보정

```sql
-- 기타 휴가 근무시간 보정
UPDATE claim_data
SET 실제근무시간 = 8.0
WHERE 근무일 BETWEEN '2025-07-01' AND '2025-10-31'
  AND (근태명 LIKE '%출산%휴가%' OR 근태명 LIKE '%경조휴가%' OR
       근태명 LIKE '%장기근속휴가%' OR 근태명 LIKE '%배우자%' OR
       근태명 = '가족돌봄휴가' OR 근태명 LIKE '%공휴일%' OR
       근태명 LIKE '%종합검진%' OR 근태명 = '본인결혼')
  AND (실제근무시간 IS NULL OR 실제근무시간 = 0)
  AND 휴가_연차 = 8.0
  AND 사번 NOT IN ('20190287', '20200207', '20120150', '20200459');

-- 결과 확인
SELECT changes() as updated_records;
```

**예상 결과**: 4,000~4,500건 업데이트

## 통계 재계산

### 1. TypeScript 스크립트 작성

파일: `scripts/recompute-stats-YYYYMM.ts`

```typescript
import { precomputeMonthlyStats, precomputeGroupStats } from '@/lib/db/queries/precompute-stats';

const months = ['2025-07', '2025-08', '2025-09', '2025-10'];

months.forEach(month => {
  console.log(`\n=== Computing stats for ${month} ===`);
  try {
    precomputeMonthlyStats(month);
    precomputeGroupStats(month);
    console.log(`✅ Successfully computed stats for ${month}`);
  } catch (error: any) {
    console.error(`❌ Error computing stats for ${month}:`, error.message);
  }
});

console.log('\n=== All statistics recomputed ===');
console.log('Please restart the server or clear the cache.');
```

### 2. 스크립트 실행

```bash
npx tsx scripts/recompute-stats-YYYYMM.ts
```

### 3. 통계 테이블 확인

```sql
-- 센터별 통계 확인
SELECT
  month,
  center_name,
  total_employees,
  weekly_claimed_hours,
  weekly_adjusted_hours,
  efficiency
FROM monthly_center_stats
WHERE month = '2025-10'
ORDER BY center_name;

-- 등급별 통계 확인
SELECT
  month,
  center_name,
  grade_level,
  total_employees,
  weekly_claimed_hours,
  weekly_adjusted_hours,
  efficiency
FROM monthly_grade_stats
WHERE month = '2025-10'
  AND center_name = '영업센터'
ORDER BY grade_level;
```

## 검증

### 1. 보정 완료 확인

```sql
-- 월별 보정률 확인
SELECT
  strftime('%Y-%m', 근무일) as month,
  COUNT(*) as total_annual_leave,
  COUNT(CASE WHEN 실제근무시간 IS NOT NULL AND 실제근무시간 > 0 THEN 1 END) as compensated,
  ROUND(COUNT(CASE WHEN 실제근무시간 IS NOT NULL AND 실제근무시간 > 0 THEN 1 END) * 100.0 / COUNT(*), 1) as compensation_rate
FROM claim_data
WHERE 근태명 = '년차'
  AND 근무일 BETWEEN '2025-07-01' AND '2025-10-31'
GROUP BY strftime('%Y-%m', 근무일)
ORDER BY month;
```

**기대값**: 보정률 99% 이상

### 2. 센터별 영향 확인

```sql
-- 보정 전후 센터별 평균 근무시간 비교
SELECT
  e.center_name,
  COUNT(DISTINCT c.사번) as employees,
  ROUND(SUM(c.실제근무시간) / COUNT(DISTINCT c.사번) / 30 * 7, 1) as avg_weekly_hours
FROM claim_data c
JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
WHERE c.근무일 BETWEEN '2025-10-01' AND '2025-10-31'
  AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
  AND c.사번 NOT IN ('20190287', '20200207', '20120150', '20200459')
GROUP BY e.center_name
ORDER BY e.center_name;
```

### 3. 특정 직원 상세 확인

```sql
-- 개별 직원의 10월 근무 내역
SELECT
  근무일,
  근태명,
  실제근무시간,
  휴가_연차,
  CASE
    WHEN 근태명 = '년차' AND 실제근무시간 = 휴가_연차 THEN '✓ 보정됨'
    WHEN 근태명 LIKE '%출장%' AND 실제근무시간 = 8.0 THEN '✓ 보정됨'
    ELSE ''
  END as status
FROM claim_data
WHERE 사번 = '20190598'
  AND 근무일 BETWEEN '2025-10-01' AND '2025-10-31'
ORDER BY 근무일;
```

## 서버 재시작

### 1. 기존 서버 종료

```bash
lsof -i :3003 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### 2. 서버 재시작

```bash
npm run dev
```

### 3. 브라우저 캐시 클리어

- **Chrome/Edge**: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
- **Safari**: Cmd+Option+R

## 주의사항

1. **백업 필수**: 보정 작업 전 반드시 데이터베이스 백업
   ```bash
   cp sambio_human.db sambio_human.db.backup_$(date +%Y%m%d_%H%M%S)
   ```

2. **트랜잭션 사용**: 대량 업데이트 시 트랜잭션으로 묶어서 실행
   ```sql
   BEGIN TRANSACTION;
   -- UPDATE 문들 실행
   COMMIT;
   ```

3. **단계별 확인**: 각 Step마다 결과 확인 후 다음 단계 진행

4. **미주지사 직원 관리**:
   - 제외 목록: `lib/db/queries/precompute-stats.ts` Line 36, 68, 79, 117, 150, 186, 215, 224, 363, 380
   - 추가/삭제 시 모든 위치 일괄 수정 필요

5. **공휴일 보정**:
   - `holidays` 테이블에 공휴일이 등록되어 있으면 자동 보정
   - 추석 대체공휴일 등도 포함되어야 함

## 트러블슈팅

### 문제: 보정 후에도 통계가 변경되지 않음

**원인**: 사전 계산된 통계 테이블이 업데이트되지 않음

**해결**:
```bash
npx tsx scripts/recompute-stats-YYYYMM.ts
# 서버 재시작
# 브라우저 하드 리프레시
```

### 문제: 특정 직원의 근무시간이 비정상적으로 낮음

**확인사항**:
1. 해당 직원이 미주지사 제외 목록에 있는지 확인
2. 근무일수 확인 (월중 입/퇴사, 장기 휴직 등)
3. 개별 근태 내역 상세 조회

### 문제: 1-6월과 7-10월 통계 차이

**원인**:
- 1-6월: 업로드 시 보정 적용됨
- 7-10월: 업로드 시 보정 미적용

**해결**: 본 가이드대로 7-10월 데이터 보정 실행

## 참고

- 공휴일 보정 로직: `lib/db/queries/precompute-stats.ts` Line 24-29
- 통계 계산 쿼리: `lib/db/queries/precompute-stats.ts`
- API 캐시: `lib/cache.ts` - TTL 5분

## 변경 이력

- 2025-11-11: 초기 작성 (7-10월 보정 작업 기준)
- 미주지사 제외 직원: 20190287, 20200207, 20120150, 20200459
- 총 보정 레코드: 21,524건
