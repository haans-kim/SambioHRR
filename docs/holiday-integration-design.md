# 휴일 반영 시스템 설계서

## 1. 현황 분석

### 1.1 문제점
- **불완전한 공휴일 데이터**: 2025년 1-6월 법정공휴일이 일부 직원에게만 적용
- **근무시간 미반영**: 공휴일의 실제근무시간이 0으로 기록되어 주 40시간 기준 미달
- **일관성 부족**: 같은 공휴일에 직원별로 다른 처리 방식

### 1.2 2025년 1-6월 법정공휴일 현황
```
1월: 1일(신정), 27-30일(설날 연휴) - 3일
2월: 없음
3월: 1일(삼일절) - 1일
4월: 없음
5월: 5일(어린이날), 6일(대체휴일) - 2일
6월: 6일(현충일) - 1일
총 7일
```

### 1.3 현재 데이터 처리 방식
- claim_data 테이블의 '공휴일휴무(탄력)' 근태코드 IR 사용
- 실제근무시간 = 0, 휴가_연차 = 0으로 기록
- HAVING SUM(실제근무시간) > 0 조건으로 일부 직원 통계 제외 위험

## 2. 설계 방안

### 방안 1: 휴일 참조 테이블 방식 (추천) ⭐

#### 2.1.1 구조
```sql
-- 휴일 테이블 생성
CREATE TABLE holidays (
  holiday_date DATE PRIMARY KEY,
  holiday_name TEXT NOT NULL,
  is_workday BOOLEAN DEFAULT FALSE,
  standard_hours FLOAT DEFAULT 8.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2025년 법정공휴일 입력
INSERT INTO holidays (holiday_date, holiday_name) VALUES
  ('2025-01-01', '신정'),
  ('2025-01-27', '설날연휴'),
  ('2025-01-28', '설날'),
  ('2025-01-29', '설날연휴'),
  ('2025-01-30', '설날대체'),
  ('2025-03-01', '삼일절'),
  ('2025-05-05', '어린이날'),
  ('2025-05-06', '어린이날대체'),
  ('2025-06-06', '현충일');
```

#### 2.1.2 산출 로직 수정
```sql
-- claim-analytics.ts의 getWeeklyClaimedHoursFromClaim 수정
WITH monthly_totals AS (
  SELECT
    c.사번,
    SUM(
      CASE
        WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
        THEN h.standard_hours  -- 공휴일은 8시간으로 계산
        ELSE c.실제근무시간
      END
    ) as month_total_hours
  FROM claim_data c
  LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
  JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
  WHERE c.근무일 BETWEEN ? AND ?
  GROUP BY c.사번
  HAVING SUM(...) > 0  -- 수정된 계산식 적용
)
```

#### 2.1.3 장점
- ✅ **유지보수성**: 휴일 관리가 독립적이고 명확
- ✅ **투명성**: 어떤 날이 휴일로 처리되는지 명시적
- ✅ **유연성**: 향후 휴일 추가/수정이 용이
- ✅ **안정성**: 기존 데이터 변경 없이 참조만 추가
- ✅ **추적성**: 휴일 반영 이력 관리 가능

#### 2.1.4 단점
- ⚠️ 초기 테이블 생성 및 데이터 입력 필요
- ⚠️ JOIN 연산으로 인한 미미한 성능 영향

### 방안 2: claim_data 직접 수정 방식

#### 2.2.1 구조
```sql
-- 공휴일인 직원의 실제근무시간 업데이트
UPDATE claim_data
SET 실제근무시간 = 8.0
WHERE 근무일 IN ('2025-01-01', '2025-01-27', ...)
  AND 근태명 = '공휴일휴무(탄력)'
  AND 실제근무시간 = 0;

-- 누락된 직원에 대한 공휴일 레코드 삽입
INSERT INTO claim_data (...)
SELECT ...
FROM employees e
WHERE NOT EXISTS (
  SELECT 1 FROM claim_data c
  WHERE c.사번 = e.employee_id
  AND c.근무일 = '2025-01-01'
);
```

#### 2.2.2 장점
- ✅ 구현이 가장 단순
- ✅ 기존 로직 수정 불필요

#### 2.2.3 단점
- ❌ **데이터 무결성 위험**: 원본 데이터 변경
- ❌ **추적 어려움**: 수정 이력 관리 복잡
- ❌ **롤백 어려움**: 원본 복구 방법 필요
- ❌ **일관성 문제**: HAVING 조건 로직 영향 우려

### 방안 3: 가상 칼럼 방식

#### 2.3.1 구조
```sql
-- claim_data에 계산된 칼럼 추가
ALTER TABLE claim_data
ADD COLUMN adjusted_work_hours FLOAT GENERATED ALWAYS AS (
  CASE
    WHEN 근태명 = '공휴일휴무(탄력)' AND 실제근무시간 = 0
    THEN 8.0
    ELSE 실제근무시간
  END
) STORED;
```

#### 2.3.2 장점
- ✅ 원본 데이터 보존
- ✅ 자동 계산

#### 2.3.3 단점
- ❌ 휴일 목록 하드코딩 필요
- ❌ SQLite 버전 제약 (3.31.0+)
- ❌ 스키마 변경 필요

## 3. 추천 구현 계획 (방안 1)

### 3.1 Phase 1: 휴일 테이블 구축 (1일)
1. holidays 테이블 생성
2. 2025년 법정공휴일 데이터 입력
3. 데이터 검증 쿼리 작성

### 3.2 Phase 2: 로직 수정 (2일)
1. claim-analytics.ts 함수들 수정
   - getWeeklyClaimedHoursFromClaim
   - getCenterWeeklyClaimedHoursFromClaim
   - getGradeWeeklyClaimedHoursMatrixFromClaim
2. 테스트 케이스 작성
3. 검증 스크립트 작성

### 3.3 Phase 3: 검증 및 배포 (1일)
1. 수정 전후 데이터 비교
2. 주간 근무시간 40시간 달성 확인
3. 문서화 및 배포

## 4. 위험 관리

### 4.1 데이터 일관성
- 백업: claim_data 전체 백업
- 검증: 수정 전후 통계 비교 리포트
- 롤백: holidays 테이블 DROP으로 즉시 원복

### 4.2 성능 영향
- JOIN 연산 영향도: 미미 (holidays 테이블 소규모)
- 인덱스: holiday_date PRIMARY KEY로 최적화

### 4.3 유지보수성
- 문서화: 휴일 관리 프로세스 문서화
- 모니터링: 휴일 반영 여부 대시보드 추가

## 5. 검증 방법

```sql
-- 수정 전후 비교 쿼리
SELECT
  '수정전' as version,
  COUNT(DISTINCT 사번) as employees,
  AVG(weekly_hours) as avg_weekly_hours
FROM (현재 로직)
UNION ALL
SELECT
  '수정후' as version,
  COUNT(DISTINCT 사번) as employees,
  AVG(weekly_hours) as avg_weekly_hours
FROM (수정된 로직);
```

## 6. 결론

**방안 1 (휴일 참조 테이블)을 추천**합니다.

이유:
1. **데이터 무결성 보장**: 원본 데이터 변경 없음
2. **명확한 관리체계**: 휴일 정보 중앙 관리
3. **유연한 확장성**: 향후 휴일 정책 변경 대응 용이
4. **추적 가능성**: 변경 이력 관리 가능
5. **안전한 롤백**: 위험 발생 시 즉시 원복 가능

예상 효과:
- 주간 평균 근무시간: 약 38-39시간 → 40-41시간
- 통계 정확도 향상: 휴일 근무 인정으로 현실 반영
- 관리 효율성: 매년 휴일 업데이트 용이