# 트렌드 분석 기능 상세 설계서

## 1. 개요
트렌드 분석 기능은 조직의 레벨별 월별 근무 시간 추이를 보여주는 대시보드입니다.
기존 전체 개요 페이지의 UI/UX를 따르며, 센터별로 데이터를 필터링하여 볼 수 있습니다.

## 2. 기능 요구사항

### 2.1 핵심 기능
- 레벨별(Lv.1~Lv.4) 월별 근무 통계 표시
- 주간 근태시간 및 주간 근무추정시간 메트릭 표시
- 센터별 탭 네비게이션
- 월별 트렌드 라인 차트
- 레벨별 비교 분석

### 2.2 데이터 범위
- 2025년 1월 ~ 6월 데이터
- 영업센터, 센터 평균 포함
- 레벨별 구분: Lv.1, Lv.2, Lv.3, Lv.4

## 3. 시스템 아키텍처

### 3.1 페이지 라우팅
```
/trends - 트렌드 분석 메인 페이지
```

### 3.2 컴포넌트 구조
```
/app/trends/page.tsx                     # 메인 페이지
/components/trends/
  ├── TrendDashboard.tsx                 # 대시보드 컨테이너
  ├── CenterTabs.tsx                     # 센터별 탭 네비게이션
  ├── LevelTrendTable.tsx                # 레벨별 월별 통계 테이블
  ├── TrendChart.tsx                     # 트렌드 라인 차트
  └── TrendMetricCards.tsx               # 요약 메트릭 카드
```

### 3.3 재사용 컴포넌트
- `DashboardLayout` - 기존 대시보드 레이아웃
- `MetricCard` - 상단 요약 카드
- 차트 스타일 및 색상 테마

## 4. API 설계

### 4.1 API 엔드포인트
```
GET /api/trends
```

#### Query Parameters
- `center?: string` - 센터 ID (선택사항, 기본값: 전체)
- `year?: number` - 연도 (기본값: 2025)
- `startMonth?: number` - 시작 월 (기본값: 1)
- `endMonth?: number` - 종료 월 (기본값: 6)

#### Response Schema
```typescript
interface TrendResponse {
  centerName: string;
  period: {
    year: number;
    startMonth: number;
    endMonth: number;
  };
  levelData: {
    level: string;  // 'Lv.1' | 'Lv.2' | 'Lv.3' | 'Lv.4'
    monthlyData: {
      month: number;
      weeklyClaimedHours: number;      // 주간 근태시간
      weeklyAdjustedHours: number;     // 주간 근무추정시간
      employeeCount: number;
    }[];
    average: {
      weeklyClaimedHours: number;
      weeklyAdjustedHours: number;
    };
  }[];
  summary: {
    totalEmployees: number;
    avgWeeklyClaimedHours: number;
    avgWeeklyAdjustedHours: number;
    efficiency: number;
  };
}
```

### 4.2 데이터베이스 쿼리
```sql
-- 레벨별 월별 통계 조회
SELECT
  om.level,
  oms.month,
  AVG(oms.avg_attendance_hours * 5 / working_days * 7) as weekly_claimed_hours,
  AVG(oms.avg_actual_work_hours * 5 / working_days * 7) as weekly_adjusted_hours,
  COUNT(DISTINCT oms.org_code) as org_count
FROM organization_monthly_stats oms
JOIN organization_master om ON oms.org_code = om.org_code
WHERE oms.year = 2025
  AND oms.month BETWEEN 1 AND 6
  AND om.center_name = ? -- 센터 필터
GROUP BY om.level, oms.month
ORDER BY om.level, oms.month;
```

## 5. UI/UX 설계

### 5.1 페이지 레이아웃
```
┌─────────────────────────────────────────┐
│  센터 탭 네비게이션                        │
│  [영업센터] [센터 평균] [기타센터...]      │
├─────────────────────────────────────────┤
│  요약 메트릭 카드 (3개)                    │
│  - 전체 인원                             │
│  - 평균 주간 근태시간                     │
│  - 평균 주간 근무추정시간                  │
├─────────────────────────────────────────┤
│  레벨별 월별 통계 테이블                   │
│  구분 | 1월 | 2월 | ... | 6월 | 평균     │
│  Lv.4 | ... | ... | ... | ... | ...     │
│  Lv.3 | ... | ... | ... | ... | ...     │
│  Lv.2 | ... | ... | ... | ... | ...     │
│  Lv.1 | ... | ... | ... | ... | ...     │
├─────────────────────────────────────────┤
│  트렌드 라인 차트                         │
│  - 월별 추이 시각화                       │
│  - 레벨별 비교                           │
└─────────────────────────────────────────┘
```

### 5.2 색상 테마
- 레벨별 색상 구분 (기존 테마 활용)
  - Lv.4: 빨간색 계열
  - Lv.3: 주황색 계열
  - Lv.2: 노란색 계열
  - Lv.1: 초록색 계열

### 5.3 인터랙션
- 센터 탭 클릭 시 해당 센터 데이터로 필터링
- 테이블 셀 호버 시 툴팁 표시
- 차트 데이터 포인트 호버 시 상세 정보 표시

## 6. 구현 계획

### 6.1 Phase 1: 기본 구조 구현 (2시간)
1. 네비게이션에 "트렌드 분석" 메뉴 추가
2. 트렌드 분석 페이지 및 라우팅 설정
3. 기본 레이아웃 구성

### 6.2 Phase 2: API 개발 (2시간)
1. API 엔드포인트 구현
2. 데이터베이스 쿼리 최적화
3. 응답 데이터 포맷팅

### 6.3 Phase 3: UI 컴포넌트 개발 (3시간)
1. CenterTabs 컴포넌트 구현
2. LevelTrendTable 컴포넌트 구현
3. TrendChart 컴포넌트 구현
4. TrendMetricCards 컴포넌트 구현

### 6.4 Phase 4: 통합 및 테스트 (1시간)
1. 컴포넌트 통합
2. 데이터 연동 테스트
3. UI/UX 미세 조정

## 7. 기술 스택
- Frontend: Next.js 15, TypeScript, React
- UI Components: shadcn/ui, Tailwind CSS
- Charts: Recharts
- Backend: Next.js API Routes
- Database: SQLite with better-sqlite3

## 8. 예상 일정
- 총 소요 시간: 8시간
- 우선순위: High
- 완료 예정일: 2025-09-16

## 9. 참고사항
- 기존 전체 개요 페이지의 디자인 패턴 준수
- 모바일 반응형 디자인 고려
- 성능 최적화: 데이터 캐싱 및 lazy loading 적용
- 접근성 고려: ARIA 레이블 및 키보드 네비게이션 지원