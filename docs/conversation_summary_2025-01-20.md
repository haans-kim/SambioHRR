# HR Dashboard - 근무 패턴 분석 대화 요약
## 2025-01-20

### 프로젝트 현황
- **목적**: HR Dashboard에 근무 패턴 분석 기능 구현
- **주요 기능**: 장비 사용(건/일) vs 이동성 지수 산점도 차트
- **데이터**: dept_pattern_analysis_new 테이블 (73개 팀, 5,063명)

### 구현 완료 사항

#### 1. 데이터 조회 API
- **파일**: `/app/api/insights/pattern-analysis/route.ts`
- **주요 계산**:
  - `o_per_person` (장비 사용): `(EAM + LAMS + MES + EQUIS + MDM) / employee_count`
  - `mobility_index` (이동성 지수): `(t1_per_person / total_activity) × 100`
- **필터**: `employee_count >= 5` (5명 이상 팀만 포함)
- **클러스터**: DB의 cluster 컬럼 직접 사용 (0-4)

#### 2. 시각화 컴포넌트
- **파일**: `/components/dashboard/Insight2View.tsx`
- **차트**: Recharts 산점도
  - X축: 장비 사용 (건/일)
  - Y축: 이동성 지수 (%)
  - 원 크기: 팀 인원수
  - 색상: 5개 패턴 그룹별 구분

#### 3. 5개 패턴 그룹
```typescript
const CLUSTER_COLORS = [
  '#3B82F6', // 0: 장비운영집중형 (파란색)
  '#10B981', // 1: 디지털협업중심형 (초록색)
  '#EF4444', // 2: 현장이동활발형 (빨간색)
  '#F97316', // 3: 균형업무형 (주황색)
  '#06B6D4', // 4: 회의협업중심형 (청록색)
];
```

### 데이터 분포 (73개 팀)
- **장비운영집중형 (0)**: 24개 팀, 1,607명
- **디지털협업중심형 (1)**: 37개 팀, 708명
- **현장이동활발형 (2)**: 7개 팀, 1,857명
- **균형업무형 (3)**: 3개 팀, 877명
- **회의협업중심형 (4)**: 2개 팀, 14명

### 주요 이슈 및 해결

#### 1. 데이터 필터링
- **이슈**: 초기에 `employee_count > 5`로 70개 팀만 포함
- **해결**: `employee_count >= 5`로 수정하여 73개 팀 포함
- **참조**: Python 분석 결과와 일치 (72개 vs 73개는 데이터 시점 차이)

#### 2. 클러스터 분류 방식
- **규칙 기반 vs 머신러닝 클러스터링 비교**
- **결정**: DB의 머신러닝 클러스터링 결과 사용
- **이유**: 
  - 균형잡힌 분포 (모든 패턴 그룹 존재)
  - 다차원 분석 결과
  - Python 분석과 일치

#### 3. 규칙 기반 분류 시 문제점
```python
# Python 규칙 (테스트만 진행, 적용 안함)
if o_per > 100: "장비운영집중형"
elif knox_per > 80: "디지털협업중심형"  
elif t1_per > 50: "현장이동활발형"
elif g3_per > 15: "회의협업중심형"  # 문제: 1개 팀만 해당
else: "균형업무형"
```
- g3_per > 15 조건으로는 회의협업중심형이 거의 없음
- 기존 분류와 크게 달라짐

### 미해결 사항
- 참조 이미지(72개 팀) vs 현재 DB(73개 팀) 1개 차이
- 데이터 업데이트 시점 차이로 추정

### 다음 단계 제안
1. 현재 구현 상태 유지 (머신러닝 클러스터링 사용)
2. 73개 팀 데이터로 진행
3. 필요시 Python 분석 재실행하여 일치시키기

### 관련 파일
- `/components/dashboard/Insight2View.tsx` - 시각화 컴포넌트
- `/app/api/insights/pattern-analysis/route.ts` - API 엔드포인트
- `sambio_human.db` - SQLite 데이터베이스
- `dept_pattern_analysis_new` 테이블 - 패턴 분석 데이터

### 참조 이미지
- `/Users/hanskim/Desktop/Clustering/장비사용 vs 이동성지수.png`
- `/Users/hanskim/Desktop/스크린샷 2025-08-20 오후 6.28.04.png`