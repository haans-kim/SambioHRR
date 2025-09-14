# 레벨 분류 시스템 수정 완료 보고서

## 요약
claim_data 기반 정확한 주간 근태시간 계산 및 직급 레벨 분류 시스템을 전면 개선했습니다.

## 주요 문제점 해결

### 1. 직급 레벨 오분류 문제
**문제**: 임원(상무, 부사장, 대표사장)이 Lv.1로 잘못 분류됨
**해결**: grade_level_mapping 테이블 생성하여 31개 직급을 정확히 매핑

### 2. 중복 직급 코드 문제
**문제**: S2가 Senior Scientist와 Senior Specialist 모두에 사용됨
**해결**: 전체 직급명을 기준으로 매핑하여 구분

### 3. 주간 근태시간 계산 부정확
**문제**:
- 보고서: 44.38시간
- 시스템: 38.9시간
- 오퍼레이션센터 Lv.4: 46.9시간 (실제 40.6시간)

**해결**: claim_data를 직접 사용하여 정확한 계산

## 구현 내역

### 1. 데이터베이스 구조 개선
```sql
-- grade_level_mapping 테이블 생성
CREATE TABLE grade_level_mapping (
  grade_name VARCHAR(100) PRIMARY KEY,
  level VARCHAR(10) NOT NULL,
  level_numeric INTEGER NOT NULL,
  category VARCHAR(50),
  subcategory VARCHAR(50)
);

-- claim_data에 employee_level 컬럼 추가
ALTER TABLE claim_data ADD COLUMN employee_level VARCHAR(10);
```

### 2. 레벨 매핑 규칙
- **Lv.4 (Principal/Executive)**: 대표사장, 부사장, 상무, E4/S4/G4 Principal 직급
- **Lv.3 (Lead/Senior Management)**: E3/S3/G3 Lead 직급, 선임변호사, A7
- **Lv.2 (Senior/Experienced)**: E2/S2/G2 Senior 직급, A6
- **Lv.1 (Entry/Junior)**: E1/S1/G1 직급, C1 계약직, 간호사, 상담사, A5
- **Special**: 고문, 비상근고문, 자문역

### 3. 코드 개선
- `/lib/db/queries/claim-analytics.ts`: employee_level 컬럼 직접 사용
- `/lib/db/queries/organization-claim.ts`: claim_data 기반 센터별 통계
- `/app/api/dashboard/route.ts`: claim_data 기반 계산 통합

### 4. 데이터베이스 뷰 생성
- `v_monthly_level_weekly_hours`: 월별 레벨별 주간 근태시간
- `v_center_level_weekly_hours`: 센터별 레벨별 주간 근태시간
- `v_grade_level_summary`: 직급-레벨 매핑 요약

## 검증 결과

### 2025년 6월 데이터
```
레벨별 평균 주간 근태시간:
- Lv.1: 35.5시간 (2,830명)
- Lv.2: 36.1시간 (1,652명)
- Lv.3: 38.9시간 (558명)
- Lv.4: 28.8시간 (132명) - 임원진 포함

오퍼레이션센터:
- Lv.1: 35.1시간 (1,947명)
- Lv.2: 35.7시간 (644명)
- Lv.3: 40.6시간 (124명)
- Lv.4: 40.6시간 (20명) ✅ (기존 46.9시간에서 수정됨)
```

## 영향 범위
- 전체 5,179명 직원 데이터 재분류
- 149,692개 claim_data 레코드 업데이트
- 대시보드 전체 레벨별 분석 정확도 개선

## 추가 개선 가능 사항
1. grade_level_mapping 테이블 관리 UI 추가
2. 신규 직급 자동 감지 및 알림 기능
3. 레벨 변경 이력 추적 기능