# HR Dashboard 상세 개발 계획서

## 1. 프로젝트 개요

### 1.1 목표
- 조직별 근무 데이터를 실시간으로 분석하고 시각화하는 대시보드 구축
- 센터 → 담당 → 팀 → 그룹 4단계 계층 구조의 드릴다운 네비게이션 제공
  (담당 레벨은 선택적 - 일부 조직에만 존재)
- 효율성 지표 기반 색상 코딩 시스템으로 직관적인 성과 모니터링

### 1.2 핵심 기능
- 조직 계층별 근무 데이터 집계 및 분석
- 실시간 효율성 지표 계산 (실제작업시간/근태시간)
- 증권 시황판 스타일의 시각적 표현
- 일별/월별 데이터 조회 및 비교 분석

## 2. 기술 스택 및 아키텍처

### 2.1 Frontend
```
Next.js 14 (App Router)
├── React 18
├── TypeScript 5
├── Tailwind CSS
├── shadcn/ui Components
└── Magic UI Components
    ├── bento-grid (조직 계층 레이아웃)
    ├── magic-card (spotlight 효과)
    ├── neon-gradient-card (중요 지표 강조)
    ├── number-ticker (효율성 퍼센트 애니메이션)
    ├── animated-circular-progress-bar (성과 게이지)
    └── grid-pattern (배경 효과)
```

### 2.2 Backend
```
Next.js API Routes
├── better-sqlite3 (Database ORM)
├── Zod (Schema Validation)
└── date-fns (Date Utilities)
```

### 2.3 Database
```
SQLite
├── organization_master (조직 계층)
│   ├── center (센터)
│   ├── division (담당) - 선택적
│   ├── team (팀)
│   └── group (그룹)
├── organization_daily_stats (일별 통계)
├── organization_monthly_stats (월별 통계)
├── daily_work_data (개인 근무 데이터)
└── shift_work_data (근태 데이터)
```

## 3. 프로젝트 구조

```
HR_Dashboard/
├── app/
│   ├── layout.tsx                 # 루트 레이아웃
│   ├── page.tsx                   # 센터 대시보드 (홈)
│   ├── division/
│   │   └── [divisionId]/
│   │       └── page.tsx           # 담당 상세 뷰
│   ├── team/
│   │   └── [teamId]/
│   │       └── page.tsx           # 팀 상세 뷰
│   ├── group/
│   │   └── [groupId]/
│   │       └── page.tsx           # 그룹 상세 뷰
│   └── api/
│       ├── organizations/
│       │   ├── route.ts           # 조직 목록 API
│       │   └── [orgCode]/
│       │       ├── route.ts       # 조직 상세 API
│       │       └── stats/
│       │           ├── daily/
│       │           │   └── route.ts
│       │           └── monthly/
│       │               └── route.ts
│       └── work-data/
│           └── aggregate/
│               └── route.ts       # 데이터 집계 API
├── components/
│   ├── ui/                        # shadcn/ui 컴포넌트
│   ├── layout/
│   │   ├── Header.tsx            # 헤더 + 브레드크럼
│   │   └── Navigation.tsx        # 네비게이션 바
│   ├── dashboard/
│   │   ├── CenterGrid.tsx        # 센터 그리드 뷰 (bento-grid)
│   │   ├── DivisionGrid.tsx      # 담당 그리드 뷰 (bento-grid)
│   │   ├── TeamGrid.tsx          # 팀 그리드 뷰 (bento-grid)
│   │   ├── GroupGrid.tsx         # 그룹 그리드 뷰 (bento-grid)
│   │   ├── MetricCard.tsx        # 지표 카드 (magic-card)
│   │   ├── EfficiencyIndicator.tsx # 효율성 인디케이터 (number-ticker)
│   │   ├── PerformanceGauge.tsx  # 성과 게이지 (animated-circular-progress-bar)
│   │   └── AlertCard.tsx         # 주요 알림 (neon-gradient-card)
│   └── charts/
│       ├── TrendChart.tsx        # 트렌드 차트
│       └── DistributionChart.tsx # 분포 차트
├── lib/
│   ├── db/
│   │   ├── client.ts             # DB 연결
│   │   └── queries/
│   │       ├── organization.ts   # 조직 쿼리
│   │       ├── workData.ts       # 근무 데이터 쿼리
│   │       └── aggregation.ts    # 집계 쿼리
│   ├── utils/
│   │   ├── metrics.ts            # 지표 계산
│   │   ├── colors.ts             # 색상 매핑
│   │   └── formatters.ts         # 데이터 포맷터
│   └── types/
│       ├── organization.ts       # 조직 타입
│       ├── workData.ts           # 근무 데이터 타입
│       └── metrics.ts            # 지표 타입
└── styles/
    └── globals.css               # 전역 스타일
```

## 4. 데이터 모델 및 API 설계

### 4.1 핵심 데이터 모델

#### Organization (조직)
```typescript
interface Organization {
  orgCode: string;
  orgName: string;
  orgLevel: 'center' | 'division' | 'team' | 'group';
  parentOrgCode?: string;
  displayOrder: number;
  isActive: boolean;
  // 담당 레벨 여부를 판단하기 위한 필드
  hasDivision?: boolean; // 센터에만 해당
```

#### OrganizationStats (조직 통계)
```typescript
interface OrganizationDailyStats {
  orgCode: string;
  workDate: Date;
  totalEmployees: number;
  avgAttendanceHours: number;
  avgActualWorkHours: number;
  avgWorkEfficiency: number;
  avgMeetingHours: number;
  avgMealHours: number;
  avgRestHours: number;
  avgDataConfidence: number;
}
```

### 4.2 API 엔드포인트

#### 조직 관련
- `GET /api/organizations?level={center|division|team|group}` - 조직 목록
- `GET /api/organizations/[orgCode]` - 조직 상세
- `GET /api/organizations/[orgCode]/children` - 하위 조직

#### 통계 관련
- `GET /api/organizations/[orgCode]/stats/daily?date={date}` - 일별 통계
- `GET /api/organizations/[orgCode]/stats/monthly?year={year}&month={month}` - 월별 통계
- `GET /api/organizations/[orgCode]/stats/trend?period={7d|30d|3m}` - 트렌드

## 5. UI/UX 컴포넌트 설계

### 5.1 레이아웃 구조
```
┌─────────────────────────────────────┐
│         Header + Breadcrumb         │
├─────────────────────────────────────┤
│  Date Selector │ Metric Selector    │
├─────────────────────────────────────┤
│                                     │
│         Organization Grid           │
│     (Color-coded metric cards)      │
│                                     │
├─────────────────────────────────────┤
│         Summary Statistics          │
└─────────────────────────────────────┘
```

### 5.2 색상 코딩 시스템
```typescript
const efficiencyColors = {
  excellent: '#10b981',  // 90% 이상 - 녹색
  good: '#3b82f6',       // 75-90% - 파란색
  normal: '#f59e0b',     // 60-75% - 주황색
  warning: '#ef4444',    // 60% 미만 - 빨간색
};
```

### 5.3 주요 컴포넌트 (Magic UI 기반)

#### BentoGrid 레이아웃
- 조직 카드를 격자형으로 배치
- 반응형 그리드 시스템
- 계층별 다른 카드 크기 지원

#### MagicCard (지표 카드)
- 마우스 따라가는 spotlight 효과
- 조직명, 효율성 지표, 인원수 표시
- 색상 기반 상태 표시
- 클릭 시 드릴다운 네비게이션

#### NumberTicker (효율성 표시기)
- 숫자 카운팅 애니메이션
- 실시간 데이터 업데이트 시 부드러운 전환
- 퍼센트 및 시간 단위 지원

#### AnimatedCircularProgressBar (성과 게이지)
- 팀별 성과를 원형 게이지로 시각화
- 색상 그라데이션으로 상태 표현
- 애니메이션 트랜지션

#### NeonGradientCard (중요 지표 강조)
- 주요 알림 및 경고 표시
- 네온 그라데이션 효과로 시선 집중
- 효율성 임계값 초과/미달 알림

#### GridPattern (배경 효과)
- Professional한 격자 배경
- 대시보드 전체 분위기 조성
- 다크/라이트 모드 지원

## 6. 개발 단계 및 일정

### Phase 1: 기초 설정 (2일)
- [ ] Next.js 프로젝트 초기화
- [ ] TypeScript, Tailwind CSS 설정
- [ ] shadcn/ui 설치 및 설정
- [ ] SQLite 연결 설정
- [ ] 기본 라우팅 구조 구현

### Phase 2: 데이터 레이어 (3일)
- [ ] Database 연결 모듈 구현
- [ ] 조직 데이터 쿼리 함수
- [ ] 통계 집계 로직 구현
- [ ] API 라우트 구현
- [ ] 데이터 검증 및 에러 처리

### Phase 3: UI 컴포넌트 (4일)
- [ ] 레이아웃 컴포넌트 구현
- [ ] 센터 뷰 그리드 구현
- [ ] 담당/팀/그룹 뷰 구현
- [ ] 지표 카드 컴포넌트
- [ ] 브레드크럼 네비게이션 (4단계 지원)

### Phase 4: 시각화 및 인터랙션 (3일)
- [ ] 색상 코딩 시스템 구현
- [ ] 드릴다운 네비게이션
- [ ] 날짜/지표 선택기
- [ ] 로딩 및 에러 상태
- [ ] 애니메이션 및 트랜지션

### Phase 5: 최적화 및 테스트 (2일)
- [ ] 성능 최적화
- [ ] 반응형 디자인 조정
- [ ] 단위 테스트 작성
- [ ] 통합 테스트
- [ ] 버그 수정

## 7. 성능 목표

### 7.1 로딩 성능
- 초기 로드: < 2초
- 페이지 전환: < 500ms
- API 응답: < 200ms

### 7.2 데이터 처리
- 조직별 집계: SQL 레벨 처리
- 클라이언트 캐싱: SWR 또는 React Query
- 인덱스 최적화: 자주 조회되는 컬럼

## 8. 보안 고려사항

- SQL Injection 방지: Prepared Statements 사용
- XSS 방지: 입력값 검증 및 이스케이프
- 민감 데이터 마스킹: 개인정보 표시 제한
- HTTPS 적용: 프로덕션 환경

## 9. 확장 가능성

### 9.1 향후 기능
- 실시간 데이터 업데이트 (WebSocket)
- 데이터 내보내기 (Excel, PDF)
- 사용자 권한 관리
- 알림 시스템
- 모바일 앱 지원

### 9.2 기술적 확장
- PostgreSQL 마이그레이션 옵션
- Redis 캐싱 레이어
- 마이크로서비스 아키텍처
- Docker 컨테이너화

## 10. 개발 환경 설정

### 10.1 필수 도구
```bash
# Node.js 18+ 설치
# npm 또는 yarn 패키지 매니저
# VSCode + 확장 프로그램
# SQLite 브라우저 (옵션)
```

### 10.2 환경 변수
```env
# .env.local
DATABASE_PATH=./sambio_human.db
NODE_ENV=development
```

### 10.3 개발 시작
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 타입 체크
npm run type-check

# 린트
npm run lint
```

## 11. 품질 보증

### 11.1 코드 품질
- ESLint + Prettier 설정
- TypeScript strict mode
- Git hooks (Husky)
- 코드 리뷰 프로세스

### 11.2 테스트 전략
- 단위 테스트: Jest
- 통합 테스트: Playwright
- 성능 테스트: Lighthouse
- 접근성 테스트: axe-core

## 12. 배포 전략

### 12.1 배포 옵션
- Vercel (권장)
- AWS Amplify
- Self-hosted (Docker)

### 12.2 CI/CD
- GitHub Actions
- 자동 테스트 실행
- 스테이징 환경
- 프로덕션 배포