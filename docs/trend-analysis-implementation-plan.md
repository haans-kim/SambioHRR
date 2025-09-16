# 트렌드 분석 기능 실행 계획

## 실행 순서 및 체크리스트

### Phase 1: 기본 구조 설정 (30분)

#### 1.1 네비게이션 메뉴 추가
- [ ] `/components/navigation/Sidebar.tsx`에 "트렌드 분석" 메뉴 항목 추가
  ```typescript
  {
    name: "트렌드 분석",
    href: "/trends",
    description: "레벨별 월별 추이"
  }
  ```

#### 1.2 페이지 라우팅 설정
- [ ] `/app/trends/page.tsx` 생성
- [ ] 기본 페이지 컴포넌트 구조 작성
- [ ] 로딩 및 에러 상태 처리

### Phase 2: API 엔드포인트 구현 (45분)

#### 2.1 API 라우트 생성
- [ ] `/app/api/trends/route.ts` 생성
- [ ] Query parameter 파싱 로직
- [ ] 센터별 필터링 로직

#### 2.2 데이터베이스 쿼리 구현
- [ ] 레벨별 월별 통계 쿼리 작성
- [ ] 데이터 집계 및 포맷팅
- [ ] 응답 데이터 구조화

### Phase 3: UI 컴포넌트 개발 (1시간 30분)

#### 3.1 CenterTabs 컴포넌트
- [ ] `/components/trends/CenterTabs.tsx` 생성
- [ ] 센터 목록 표시 (영업센터, 센터 평균 등)
- [ ] 탭 선택 시 이벤트 처리
- [ ] 활성 탭 스타일링

#### 3.2 LevelTrendTable 컴포넌트
- [ ] `/components/trends/LevelTrendTable.tsx` 생성
- [ ] 테이블 구조 (레벨 x 월)
- [ ] 데이터 렌더링
- [ ] 평균 계산 및 표시
- [ ] 레벨별 색상 적용

#### 3.3 TrendChart 컴포넌트
- [ ] `/components/trends/TrendChart.tsx` 생성
- [ ] Recharts 라인 차트 구현
- [ ] 레벨별 라인 표시
- [ ] 툴팁 및 레전드
- [ ] 반응형 디자인

#### 3.4 TrendMetricCards 컴포넌트
- [ ] `/components/trends/TrendMetricCards.tsx` 생성
- [ ] 요약 메트릭 계산
- [ ] 카드 레이아웃
- [ ] 아이콘 및 스타일링

### Phase 4: 통합 및 최적화 (30분)

#### 4.1 컴포넌트 통합
- [ ] TrendDashboard 컨테이너 컴포넌트 생성
- [ ] 상태 관리 (선택된 센터, 로딩 상태 등)
- [ ] 데이터 페칭 및 분배

#### 4.2 스타일링 및 반응형
- [ ] Tailwind CSS 클래스 적용
- [ ] 모바일 반응형 레이아웃
- [ ] 다크모드 지원 (선택사항)

#### 4.3 성능 최적화
- [ ] 데이터 캐싱 구현
- [ ] 컴포넌트 메모이제이션
- [ ] 로딩 상태 최적화

### Phase 5: 테스트 및 검증 (15분)

#### 5.1 기능 테스트
- [ ] 센터별 데이터 필터링 확인
- [ ] 월별 데이터 정확성 검증
- [ ] 차트 렌더링 확인

#### 5.2 UI/UX 검증
- [ ] 디자인 일관성 확인
- [ ] 반응형 동작 테스트
- [ ] 접근성 검증

## 파일 구조

```
/app/
  trends/
    page.tsx                    # 메인 페이지
/app/api/
  trends/
    route.ts                    # API 엔드포인트
/components/
  trends/
    TrendDashboard.tsx         # 대시보드 컨테이너
    CenterTabs.tsx             # 센터 탭 네비게이션
    LevelTrendTable.tsx        # 레벨별 월별 테이블
    TrendChart.tsx             # 트렌드 차트
    TrendMetricCards.tsx       # 요약 카드
/lib/
  queries/
    trends.ts                  # 트렌드 관련 DB 쿼리
```

## 예상 코드 스니펫

### API 응답 타입 정의
```typescript
// types/trends.ts
export interface TrendData {
  level: 'Lv.1' | 'Lv.2' | 'Lv.3' | 'Lv.4';
  monthlyData: {
    month: number;
    weeklyClaimedHours: number;
    weeklyAdjustedHours: number;
    employeeCount: number;
  }[];
  average: {
    weeklyClaimedHours: number;
    weeklyAdjustedHours: number;
  };
}
```

### 센터 목록
```typescript
const CENTERS = [
  { id: 'all', name: '전체', isDefault: true },
  { id: 'sales', name: '영업센터' },
  { id: 'avg', name: '센터 평균' },
  // 추가 센터들...
];
```

### 레벨별 색상 매핑
```typescript
const LEVEL_COLORS = {
  'Lv.4': { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700' },
  'Lv.3': { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700' },
  'Lv.2': { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700' },
  'Lv.1': { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700' },
};
```

## 주의사항

1. **기존 디자인 일관성 유지**
   - 전체 개요 페이지의 스타일과 톤앤매너 준수
   - 동일한 색상 팔레트 사용
   - 카드 및 테이블 스타일 재사용

2. **성능 고려사항**
   - 6개월 x 4레벨 = 24개 데이터 포인트로 경량
   - 불필요한 리렌더링 방지
   - 데이터 캐싱 활용

3. **접근성**
   - ARIA 레이블 추가
   - 키보드 네비게이션 지원
   - 색상 대비 확보

4. **확장성**
   - 향후 더 많은 월 데이터 추가 가능
   - 다른 메트릭 추가 가능한 구조
   - 센터 추가/삭제 용이한 설계

## 완료 기준

- [ ] 네비게이션에서 트렌드 분석 페이지 접근 가능
- [ ] 센터별 탭 전환 정상 동작
- [ ] 레벨별 월별 데이터 정확히 표시
- [ ] 차트에서 트렌드 시각화 확인
- [ ] 전체 개요와 동일한 디자인 톤앤매너
- [ ] 반응형 디자인 적용 완료