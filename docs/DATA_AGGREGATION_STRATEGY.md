# 데이터 집계 전략
## Data Aggregation Strategy for HR Dashboard

### 1. 데이터 흐름 (Data Flow)
```
daily_analysis_results (개인별 원시 데이터)
    ↓
그룹별 집계 (v_group_daily_summary)
    ↓
팀별 집계 (v_team_daily_summary)
    ↓
담당별 집계 (선택적, 향후 구현)
    ↓
센터별 집계 (v_center_daily_summary)
    ↓
전체 조직 집계
```

### 2. 핵심 지표 (Key Metrics)

#### 개인 레벨 (Individual Level)
- **효율성 지표**: efficiency_ratio (실제 근무시간 / 체류시간)
- **시간 분석**: actual_work_hours, meeting_hours, meal_hours, rest_hours
- **활동 패턴**: focused_work_minutes, equipment_minutes, training_minutes
- **근무 유형**: shift_type, work_type

#### 집계 레벨 (Aggregation Level)
- **인원 통계**: 
  - total_employees (전체 인원)
  - analyzed_employees (분석된 인원)
  - coverage_rate (커버리지 비율)
  
- **효율성 통계**:
  - avg_efficiency_ratio (평균 효율성)
  - efficiency_distribution (90+, 80-90, 70-80, <70)
  
- **시간 통계**:
  - avg_actual_work_hours (평균 실제 근무시간)
  - avg_claimed_hours (평균 신고 근무시간)
  - claim_vs_actual_diff (신고 vs 실제 차이)

### 3. 집계 함수 구현 전략

#### 3.1 기본 집계 함수 (TypeScript)
```typescript
// 그룹별 집계
function getGroupSummary(groupId: string, date: string) {
  // v_group_daily_summary 뷰 활용
}

// 팀별 집계
function getTeamSummary(teamId: string, date: string) {
  // v_team_daily_summary 뷰 활용
}

// 센터별 집계
function getCenterSummary(centerId: string, date: string) {
  // v_center_daily_summary 뷰 활용
}

// 전체 조직 집계
function getOrganizationSummary(date: string) {
  // 모든 센터의 집계 데이터 통합
}
```

#### 3.2 직급별 분석
```typescript
function getGradeDistribution(orgLevel: string, orgId: string, date: string) {
  // job_grade별 효율성 분포
  // Lv.1 ~ Lv.4 직급별 평균 지표
}
```

#### 3.3 시계열 분석
```typescript
function getTrendAnalysis(orgLevel: string, orgId: string, startDate: string, endDate: string) {
  // 일별/주별/월별 추세 분석
  // v_organization_weekly_trend 뷰 활용
}
```

### 4. UI 컴포넌트와의 연동

#### 4.1 센터 레벨 뷰 (CenterView)
- **데이터 소스**: v_center_daily_summary
- **표시 정보**: 
  - 센터별 평균 효율성
  - 직급별 효율성 분포 (Lv.1-4)
  - 색상 코딩 (빨강/노랑/초록)

#### 4.2 팀 레벨 뷰 (TeamView)
- **데이터 소스**: v_team_daily_summary
- **표시 정보**:
  - 팀별 인원 및 효율성
  - 그룹 구성 현황
  - 근무 패턴 분석

#### 4.3 그룹 레벨 뷰 (GroupView)
- **데이터 소스**: v_group_daily_summary
- **표시 정보**:
  - 개인별 상세 현황
  - 시간대별 활동 패턴
  - 효율성 히트맵

### 5. 성능 최적화 전략

#### 5.1 인덱스 전략
- 이미 생성된 인덱스 활용:
  - idx_dar_date_efficiency_desc
  - idx_dar_center_date_efficiency
  - idx_dar_team_date_efficiency

#### 5.2 캐싱 전략
- 센터/팀 레벨 집계는 5분 캐싱
- 개인 레벨 데이터는 실시간 조회
- 일별 집계는 날짜 변경 시까지 캐싱

#### 5.3 쿼리 최적화
- 뷰(View) 활용으로 복잡한 집계 쿼리 단순화
- 필요한 컬럼만 SELECT
- 적절한 WHERE 조건으로 스캔 범위 제한

### 6. 데이터 품질 관리

#### 6.1 데이터 검증
- confidence_score 활용 (신뢰도 점수)
- coverage_rate 모니터링 (커버리지 비율)
- 이상치 탐지 (efficiency_ratio > 100% 등)

#### 6.2 결측값 처리
- NULL 값은 집계에서 제외
- 0 값과 NULL 구분 처리
- 최소 데이터 요구사항 설정 (예: 팀당 최소 5명)

### 7. 향후 확장 계획

#### 7.1 담당 레벨 추가
- organization_master에 division 레벨 추가
- 4레벨 계층 구조 완전 지원

#### 7.2 실시간 대시보드
- WebSocket을 통한 실시간 업데이트
- 스트리밍 집계 구현

#### 7.3 예측 분석
- 머신러닝 기반 효율성 예측
- 이상 패턴 자동 감지

### 8. API 엔드포인트 설계

```typescript
// 센터별 집계
GET /api/analytics/centers/:date
GET /api/analytics/center/:centerId/:date

// 팀별 집계
GET /api/analytics/teams/:centerId/:date
GET /api/analytics/team/:teamId/:date

// 그룹별 집계
GET /api/analytics/groups/:teamId/:date
GET /api/analytics/group/:groupId/:date

// 직급별 분석
GET /api/analytics/grades/:orgLevel/:orgId/:date

// 추세 분석
GET /api/analytics/trend/:orgLevel/:orgId/:startDate/:endDate
```