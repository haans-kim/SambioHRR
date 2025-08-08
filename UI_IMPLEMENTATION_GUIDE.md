# UI 구현 가이드 - Magic UI 컴포넌트 활용

## 1. Magic UI 컴포넌트 매핑

### 1.1 레이아웃 구조
```
BentoGrid (메인 그리드 시스템)
├── MagicCard (각 조직 카드)
│   ├── 조직명
│   ├── NumberTicker (효율성 수치)
│   ├── AnimatedCircularProgressBar (성과 게이지)
│   └── 하위 조직 개수
└── GridPattern (배경 효과)
```

### 1.2 계층별 카드 크기
- **센터 레벨**: Large Card (col-span-2, row-span-2)
- **담당 레벨**: Medium Card (col-span-2)
- **팀 레벨**: Standard Card (col-span-1)
- **그룹 레벨**: Small Card (col-span-1, compact)

## 2. 컴포넌트별 구현 방안

### 2.1 센터 뷰 (CenterGrid.tsx)
```tsx
// bento-grid로 센터 카드 배열
<BentoGrid className="grid-cols-3 gap-4">
  {centers.map(center => (
    <MagicCard key={center.orgCode} className="col-span-1">
      <div className="p-6">
        <h3>{center.orgName}</h3>
        <NumberTicker value={center.efficiency} suffix="%" />
        <AnimatedCircularProgressBar 
          value={center.efficiency} 
          max={100}
          className="w-24 h-24"
        />
      </div>
    </MagicCard>
  ))}
</BentoGrid>
```

### 2.2 효율성 표시 (EfficiencyIndicator.tsx)
```tsx
// number-ticker로 실시간 애니메이션
<div className="flex items-center gap-2">
  <NumberTicker 
    value={efficiency} 
    suffix="%" 
    className={getColorClass(efficiency)}
  />
  <span className="text-sm text-muted-foreground">
    실제작업시간/근태시간
  </span>
</div>
```

### 2.3 주요 지표 강조 (AlertCard.tsx)
```tsx
// neon-gradient-card로 중요 알림
<NeonGradientCard className="p-4">
  <div className="flex items-center justify-between">
    <span>효율성 경고</span>
    <NumberTicker value={alertValue} suffix="%" />
  </div>
  <p className="text-sm mt-2">
    목표치 대비 {difference}% 부족
  </p>
</NeonGradientCard>
```

## 3. 색상 시스템 (효율성 기반)

### 3.1 기본 색상 매핑
```typescript
const getEfficiencyColor = (value: number) => {
  if (value >= 90) return 'text-green-500'; // 우수
  if (value >= 75) return 'text-blue-500';  // 양호
  if (value >= 60) return 'text-amber-500'; // 보통
  return 'text-red-500'; // 주의
};
```

### 3.2 MagicCard 테두리 효과
```typescript
const getCardBorderStyle = (efficiency: number) => {
  if (efficiency >= 90) return 'border-green-500/50 shadow-green-500/20';
  if (efficiency >= 75) return 'border-blue-500/50 shadow-blue-500/20';
  if (efficiency >= 60) return 'border-amber-500/50 shadow-amber-500/20';
  return 'border-red-500/50 shadow-red-500/20';
};
```

## 4. 애니메이션 전략

### 4.1 페이지 전환
- `text-animate`로 페이지 타이틀 전환
- `magic-card`의 spotlight 효과로 hover 상태 표현
- 드릴다운 시 fade-in/scale 애니메이션

### 4.2 데이터 업데이트
- `number-ticker`로 숫자 변경 시 카운팅 애니메이션
- `animated-circular-progress-bar`로 게이지 부드러운 전환
- 실시간 데이터 변경 시 색상 트랜지션

## 5. 반응형 디자인

### 5.1 브레이크포인트
```css
/* Desktop (기본) */
.bento-grid { grid-template-columns: repeat(4, 1fr); }

/* Tablet */
@media (max-width: 1024px) {
  .bento-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Mobile */
@media (max-width: 640px) {
  .bento-grid { grid-template-columns: 1fr; }
}
```

### 5.2 카드 크기 조정
- Desktop: 4열 그리드
- Tablet: 2열 그리드
- Mobile: 1열 스택

## 6. 인터랙션 패턴

### 6.1 카드 클릭 (드릴다운)
```typescript
const handleCardClick = (org: Organization) => {
  // 네비게이션 트랜지션
  router.push(`/${org.orgLevel}/${org.orgCode}`);
};
```

### 6.2 호버 효과
- MagicCard spotlight 효과 자동 적용
- 툴팁으로 상세 정보 표시
- 스케일 업 애니메이션 (scale-105)

## 7. 성능 최적화

### 7.1 컴포넌트 메모이제이션
```typescript
const MemoizedMetricCard = React.memo(MetricCard, (prev, next) => {
  return prev.efficiency === next.efficiency;
});
```

### 7.2 가상 스크롤링
- 그룹 레벨에서 100개 이상 카드 표시 시
- react-window 또는 react-virtualized 활용

## 8. 구현 우선순위

### Phase 1 (필수)
1. BentoGrid 레이아웃 설정
2. MagicCard 기본 구현
3. NumberTicker 효율성 표시
4. 색상 시스템 적용

### Phase 2 (향상)
1. AnimatedCircularProgressBar 게이지
2. NeonGradientCard 알림
3. GridPattern 배경
4. 애니메이션 효과

### Phase 3 (최적화)
1. 반응형 디자인 완성
2. 성능 최적화
3. 다크 모드 지원
4. 접근성 개선

## 9. 설치 명령어

```bash
# Magic UI 컴포넌트 설치
npx shadcn@latest add https://magicui.design/r/bento-grid
npx shadcn@latest add https://magicui.design/r/magic-card
npx shadcn@latest add https://magicui.design/r/number-ticker
npx shadcn@latest add https://magicui.design/r/animated-circular-progress-bar
npx shadcn@latest add https://magicui.design/r/neon-gradient-card
npx shadcn@latest add https://magicui.design/r/grid-pattern
npx shadcn@latest add https://magicui.design/r/text-animate
```

## 10. 참고 사항

### 10.1 Magic UI 특징
- 모든 컴포넌트는 Tailwind CSS 기반
- 다크 모드 자동 지원
- 커스터마이징 가능한 props
- 애니메이션 성능 최적화됨

### 10.2 주의사항
- spotlight 효과는 GPU 가속 사용
- 너무 많은 애니메이션 동시 실행 주의
- 모바일에서는 일부 효과 제한 고려