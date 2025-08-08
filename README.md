# HR Dashboard

AI를 활용한 조직별 근무 데이터 분석 및 리밸런싱 대시보드

## 개요

개인별 근무 데이터를 취합하여 조직 단위(센터/팀/그룹)로 분석하고 시각화하는 대시보드입니다.

## 주요 기능

- **조직 계층 구조 관리**: 센터 → 팀 → 그룹 3단계 조직 체계
- **근무 데이터 분석**: 근태시간, 실제 작업시간, 효율성 지표 등 다양한 메트릭 분석
- **시각화**: 색상과 마커를 활용한 직관적인 성과 표시
- **드릴다운 네비게이션**: 상위 조직에서 하위 조직으로 상세 조회 가능

## 기술 스택

- **Frontend**: React + Next.js (App Router)
- **UI Framework**: shadcn/ui
- **Database**: SQLite (better-sqlite3)
- **Language**: TypeScript

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

## 데이터베이스 구조

- `daily_work_data`: 개인별 일일 근무 데이터
- `organization_summary`: 조직별 집계 데이터
- `organization_master`: 조직 계층 구조 마스터
- `organization_daily_stats`: 일별 조직 통계
- `organization_monthly_stats`: 월별 조직 통계

## 라이선스

Private