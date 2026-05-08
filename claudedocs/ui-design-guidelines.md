# SambioHRR UI 디자인 가이드라인

실제 프로젝트 코드 분석 기반의 디자인 가이드라인입니다.
새로운 UI를 제작할 때 이 문서를 기준으로 일관된 스타일을 유지하세요.

---

## 1. 컴포넌트 라이브러리

### 기본 (shadcn/ui)
- `Card`, `CardContent`, `CardHeader`, `CardTitle`
- `Badge`, `Alert`, `AlertTitle`, `AlertDescription`
- `Progress`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
- `Button`, `Select`, `Input`, `Popover`, `Calendar`

### 확장 (Magic UI)
| 컴포넌트 | 용도 |
|---------|------|
| `MagicCard` | 조직/센터 카드 (BentoGrid 내부) |
| `NeonGradientCard` | AlertCard 외곽 래퍼 |
| `NumberTicker` | 주요 수치 애니메이션 표시 |
| `AnimatedCircularProgressBar` | 효율성 원형 게이지 |
| `BentoGrid` | 센터/조직 그리드 레이아웃 |

### 차트 (Recharts)
- `ScatterChart`, `BarChart`, `XAxis`, `YAxis`
- `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `Legend`

---

## 2. 색상 시스템

### 상태 표현 (3분류 필수)

| 상태 | 의미 | Border | Background | Text | 진한색(Hex) |
|------|------|--------|------------|------|------------|
| **▲ 상위** | 번아웃 위험 | `border-red-500` | `from-red-50 to-white` | `text-red-500` / `text-red-600` | `#ef4444` |
| **● 중위** | 정상 범위 | `border-green-500` | `from-green-50 to-white` | `text-green-500` / `text-green-600` | `#10b981` |
| **▼ 하위** | 여유 상태 | `border-blue-500` | `from-blue-50 to-white` | `text-blue-500` / `text-blue-600` | `#3b82f6` |
| **경고** | 주의 필요 | — | — | `text-amber-500` | `#f59e0b` |

### 기본 텍스트 색상

```
제목/강조:     text-gray-900
일반 레이블:   text-gray-500, text-neutral-600
부가 설명:     text-neutral-400, text-muted-foreground
```

### 좌측 강조 border 패턴 (SummaryCard)

```tsx
// 좌측 컬러 border로 카드 유형 구분
className="border-2 border-gray-300 border-l-4 border-l-red-500"   // 상위
className="border-2 border-gray-300 border-l-4 border-l-green-500" // 중위
className="border-2 border-gray-300 border-l-4 border-l-blue-500"  // 하위
```

---

## 3. 아이콘 규칙

### 이모티콘 사용 금지

이모티콘(emoji) 대신 아래 두 가지만 사용합니다.

### Lucide React 아이콘 (기능 표현)

```tsx
import {
  AlertTriangle, TrendingUp, TrendingDown,
  Users, Clock, BarChart3, Activity,
  Building2, ChevronDown, ChevronUp
} from "lucide-react";

// 크기 규칙
<Icon className="w-4 h-4" />  // 인라인 (레이블 옆)
<Icon className="w-5 h-5" />  // 카드 헤더
```

### 유니코드 심볼 (상태 표현)

```
▲   상위 (상단 화살표)  — text-red-500/600
●   중위 (원)           — text-green-500/600
▼   하위 (하단 화살표)  — text-blue-500/600
```

---

## 4. 카드 컴포넌트 패턴

### PlantCard (팀 분석 카드) — 고정 높이

```tsx
// 기본 구조
<div className={cn(
  "p-4 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer h-[140px]",
  "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white"  // 상태에 따라 변경
)}>
  <h3 className="text-sm font-semibold text-gray-900 mb-2 truncate">{name}</h3>
  <div className="flex items-center justify-between flex-1">
    {/* 수치 표시 */}
  </div>
</div>
```

### MagicCard (센터/조직 카드) — 애니메이션 포함

```tsx
<MagicCard
  className={cn(
    "cursor-pointer transition-all hover:scale-[1.02]",
    getEfficiencyColor(efficiency),
    "p-4" // or p-6, p-8
  )}
  onClick={onClick}
  gradientColor={efficiency >= 75 ? "#10b981" : "#ef4444"}
  gradientOpacity={0.3}
>
```

### SummaryCard (범례/요약 카드) — 그라디언트 배경

```tsx
<div className={cn(
  "rounded-lg p-6 h-full bg-gradient-to-br from-red-50 to-white",
  "border-2 border-gray-300 border-l-4 border-l-red-500 shadow-sm"
)}>
  <div className="flex items-start space-x-3">
    <div className="text-red-500 text-xl">▲</div>
    <div className="flex-1">
      <h3 className="font-semibold text-gray-900 mb-2">상위</h3>
      <p className="text-sm text-gray-500">상위 20%</p>
    </div>
  </div>
</div>
```

### AlertCard (경고/알림 카드) — NeonGradientCard 래퍼

```tsx
<NeonGradientCard
  borderColor="rgb(245, 158, 11)"     // amber: 경고
  glowColor="rgba(245, 158, 11, 0.3)"
>
  <div className="flex items-center gap-3">
    <AlertTriangle className="w-5 h-5 text-amber-500" />
    <div>
      <p className="text-sm font-medium text-neutral-600">{title}</p>
      <NumberTicker value={value} suffix="%" className="text-2xl font-bold" />
    </div>
  </div>
</NeonGradientCard>
```

### 데이터 규모 카드 (간단한 shadcn Card)

```tsx
<Card className="p-4">
  <div className="text-sm text-muted-foreground mb-1">전체 태그 데이터</div>
  <div className="text-2xl font-bold">20.1M</div>
  <div className="text-xs text-muted-foreground mt-1">20,080,148 건</div>
</Card>
```

---

## 5. 레이아웃

### 그리드 패턴

```tsx
// 2열 (기본)
"grid grid-cols-1 md:grid-cols-2 gap-4"

// 3열 (SummaryCards)
"grid grid-cols-1 md:grid-cols-3 gap-6"

// 4열 (데이터 메트릭)
"grid grid-cols-2 md:grid-cols-4 gap-4"
```

### BentoGrid (조직 카드 그리드)

```tsx
<BentoGrid className="max-w-7xl mx-auto">
  {organizations.map((org) => (
    <MetricCard key={org.orgCode} ... />
  ))}
</BentoGrid>
```

### 페이지 최대 너비

```tsx
max-w-7xl mx-auto   // 전체 페이지 컨텐츠
```

---

## 6. 타이포그래피

| 용도 | 클래스 | 예시 |
|------|--------|------|
| 페이지/섹션 제목 | `text-xl font-semibold` | "전체 데이터 규모" |
| 카드 제목 (대) | `text-lg font-bold` | "EPCV 센터" |
| 카드 제목 (소) | `text-sm font-semibold text-gray-900` | "팀명" |
| 수치 (대) | `text-2xl font-bold` | 88.3% |
| 수치 (중) | `text-lg font-bold` | 40.5h |
| 레이블 | `text-sm text-neutral-600` | "효율성" |
| 부가 설명 | `text-xs text-muted-foreground` | "건/인" |
| 서브텍스트 | `text-sm text-gray-500` | "중간 60%" |

### 폰트

```css
/* globals.css */
font-family: Arial, Helvetica, sans-serif;   /* 기본 fallback */
var(--font-geist-sans)                        /* Geist Sans (Next.js 기본) */
```

---

## 7. 수치 표현 규칙

```tsx
// 애니메이션 숫자 — 주요 지표에 사용
<NumberTicker value={88.3} suffix="%" className="font-bold text-lg" />

// 정적 숫자 포맷
{value.toFixed(1)}%           // 효율성
{value.toFixed(1)}h           // 근무시간
{value.toLocaleString()} 건   // 일반 건수
{(value / 1000000).toFixed(1)}M  // 백만 단위 (1M+)
{(value / 1000).toFixed(0)}K     // 천 단위 (10K~999K)

// 단위 명시 규칙
%   효율성, 데이터 신뢰도
h   근무시간 (시간)
명  인원
건  데이터 레코드 수
```

---

## 8. 인터랙션 패턴

```tsx
// 클릭 가능한 카드
"cursor-pointer transition-all hover:shadow-md"           // PlantCard
"cursor-pointer transition-all hover:scale-[1.02]"        // MagicCard

// 비활성 요소
"cursor-default"
```

---

## 9. 비즈니스 스타일 원칙

1. **이모티콘 없음** — Lucide 아이콘과 유니코드 심볼(▲●▼)만 사용
2. **수치 중심** — 직관적인 숫자와 단위 명시 (%, h, 명, 건)
3. **상태 색상 일관성** — 빨강(상위)/녹색(중위)/파랑(하위) 3분류를 모든 컴포넌트에 동일 적용
4. **그라디언트 배경** — `bg-gradient-to-br from-[color]-50 to-white` (연한 색 → 흰색)
5. **간결한 레이블** — 효율성, 인원, 평균 근무, 데이터 신뢰도 등 명확한 한국어
6. **그림자 계층** — `shadow-sm` (기본) → `shadow-md` (hover)
7. **transition-all** — 모든 상태 변화에 부드러운 전환

---

## 10. 클러스터 색상 (근무 패턴 차트 전용)

```typescript
const CLUSTER_COLORS: { [key: string]: string } = {
  '시스템운영집중형': '#1f77b4',  // 파란색
  '현장이동활발형':   '#ff7f0e',  // 주황색
  '디지털협업중심형': '#2ca02c',  // 녹색
  '저활동형':         '#8c564b',  // 갈색
  '균형업무형':       '#d62728',  // 빨간색
};
```

---

## 빠른 참조 — 새 컴포넌트 체크리스트

- [ ] 이모티콘 사용하지 않았는가?
- [ ] 상태 표현에 ▲●▼ 또는 Lucide 아이콘을 사용했는가?
- [ ] 상위/중위/하위 색상(빨강/녹색/파랑)이 일관되게 적용되었는가?
- [ ] 수치에 단위(%, h, 명, 건)가 명시되었는가?
- [ ] `transition-all`과 hover 효과가 적용되었는가?
- [ ] 배경에 `from-[color]-50 to-white` 그라디언트를 사용했는가?
- [ ] 텍스트 계층(제목/레이블/부가)이 적절하게 구분되었는가?

---

**문서 버전**: 1.0
**최종 업데이트**: 2026-02-26
**적용 버전**: SambioHRR Next.js
