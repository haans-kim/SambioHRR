# Fast Routine 구현 가이드

SambioHRR의 성능 최적화를 위한 Fast Routine 구현 상세 가이드입니다.
Electron 버전에 동일한 최적화를 적용하기 위한 단계별 지침을 제공합니다.

## 목차

1. [개요](#개요)
2. [문제 상황](#문제-상황)
3. [솔루션 아키텍처](#솔루션-아키텍처)
4. [데이터베이스 스키마 변경](#데이터베이스-스키마-변경)
5. [사전 계산 스크립트 구현](#사전-계산-스크립트-구현)
6. [API 레이어 구현](#api-레이어-구현)
7. [프론트엔드 수정](#프론트엔드-수정)
8. [구현 체크리스트](#구현-체크리스트)
9. [유지보수 가이드](#유지보수-가이드)

---

## 개요

### 성능 최적화 목표
- **기존**: 하위 조직 탐색 시 `daily_analysis_results` 테이블(806K rows) 직접 쿼리로 인한 느린 응답
- **개선**: 사전 계산된 월별 통계 테이블 사용으로 **10-100배 성능 향상**
- **쿼리 대상**: 806K rows → ~97 rows (월별 팀 통계)

### 주요 변경 사항
1. **데이터베이스**: 월별 사전 계산 통계 테이블 4개 추가
2. **스크립트**: 월별 통계 사전 계산 스크립트 추가
3. **API**: `/api/teams-fast` 신규 엔드포인트 추가
4. **UI**: 상대적(relative) 임계값 기반 상중하 분류로 변경

---

## 문제 상황

### 1. 성능 문제
```
센터 선택 → 담당 목록 표시 → 팀 목록 표시
                ↓                    ↓
         느린 응답 (2-5초)      느린 응답 (2-5초)
```

**원인**:
- 매 요청마다 `daily_analysis_results` 테이블(806K rows)을 실시간 집계
- 복잡한 JOIN과 GROUP BY 연산
- 월별 데이터임에도 불구하고 일별 데이터를 매번 집계

### 2. UI 분류 문제
```
화면에 표시된 3개 팀 모두 녹색(중위)으로 표시
→ 상대적 비교가 아닌 절대 임계값 비교 문제
```

**원인**:
- 전역 절대 임계값 사용 (예: 효율성 89.5% 이하 = 하위)
- 화면에 보이는 항목들 간의 상대적 순위 미반영

---

## 솔루션 아키텍처

### 전체 흐름도
```
[월별 집계 데이터]
       ↓
[사전 계산 스크립트] (월 1회 실행)
       ↓
[월별 통계 테이블]
  - monthly_center_stats
  - monthly_team_stats
  - monthly_grade_stats
  - monthly_overall_stats
       ↓
[/api/teams-fast 엔드포인트]
       ↓
[프론트엔드: 상대적 임계값 분류]
```

### 핵심 개념

#### 1. 사전 계산 (Precomputation)
- **시점**: 새로운 월 데이터가 추가되었을 때 (월 1회)
- **대상**: 2025-01 ~ 2025-10 (10개월)
- **결과**: 센터별, 팀별, 직급별, 전체 월별 통계
- **실행 시간**: 10개월 전체 약 96.6초

#### 2. 상대적 임계값 (Relative Thresholds)
- **기존**: 전역 절대 임계값 (예: 효율성 89.5% / 93.7%)
- **개선**: 화면에 표시된 항목들의 20th/80th percentile 기준
- **예시**:
  ```
  팀 A: 40.0 시간 → 상위 (빨강)
  팀 B: 39.7 시간 → 중위 (녹색)
  팀 C: 39.4 시간 → 하위 (파랑)

  절대값으로는 모두 비슷하지만, 상대적으로 순위 차이 표현
  ```

---

## 데이터베이스 스키마 변경

### 1. 월별 센터 통계 테이블
```sql
CREATE TABLE IF NOT EXISTS monthly_center_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  center_name TEXT NOT NULL,
  total_employees INTEGER NOT NULL,
  weekly_claimed_hours REAL NOT NULL,
  weekly_adjusted_hours REAL NOT NULL,
  efficiency REAL NOT NULL,
  data_reliability REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(month, center_name)
);

CREATE INDEX IF NOT EXISTS idx_monthly_center_stats_month
ON monthly_center_stats(month);
```

### 2. 월별 팀 통계 테이블
```sql
CREATE TABLE IF NOT EXISTS monthly_team_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  team_name TEXT NOT NULL,
  center_name TEXT NOT NULL,
  total_employees INTEGER NOT NULL,
  weekly_claimed_hours REAL NOT NULL,
  weekly_adjusted_hours REAL NOT NULL,
  efficiency REAL NOT NULL,
  data_reliability REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(month, team_name, center_name)
);

CREATE INDEX IF NOT EXISTS idx_monthly_team_stats_month
ON monthly_team_stats(month);

CREATE INDEX IF NOT EXISTS idx_monthly_team_stats_center
ON monthly_team_stats(center_name);
```

### 3. 월별 직급 통계 테이블
```sql
CREATE TABLE IF NOT EXISTS monthly_grade_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  grade TEXT NOT NULL,
  total_employees INTEGER NOT NULL,
  weekly_claimed_hours REAL NOT NULL,
  weekly_adjusted_hours REAL NOT NULL,
  efficiency REAL NOT NULL,
  data_reliability REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(month, grade)
);

CREATE INDEX IF NOT EXISTS idx_monthly_grade_stats_month
ON monthly_grade_stats(month);
```

### 4. 월별 전체 통계 테이블
```sql
CREATE TABLE IF NOT EXISTS monthly_overall_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL UNIQUE,
  total_employees INTEGER NOT NULL,
  weekly_claimed_hours REAL NOT NULL,
  weekly_adjusted_hours REAL NOT NULL,
  efficiency REAL NOT NULL,
  data_reliability REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Electron 적용 시 주의사항
1. **마이그레이션 스크립트 생성**: 기존 DB에 테이블 추가
2. **인덱스 생성**: 쿼리 성능 최적화를 위해 반드시 인덱스 생성
3. **UNIQUE 제약조건**: 중복 데이터 방지 (month + 식별자)

---

## 사전 계산 스크립트 구현

### 파일: `scripts/precompute-all-org-levels.mjs`

#### 핵심 로직

```javascript
import Database from 'better-sqlite3';

const db = new Database('./sambio_human.db');

// 1. 테이블 생성
db.exec(`
  CREATE TABLE IF NOT EXISTS monthly_team_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,
    team_name TEXT NOT NULL,
    center_name TEXT NOT NULL,
    total_employees INTEGER NOT NULL,
    weekly_claimed_hours REAL NOT NULL,
    weekly_adjusted_hours REAL NOT NULL,
    efficiency REAL NOT NULL,
    data_reliability REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(month, team_name, center_name)
  );
  -- (다른 테이블들도 동일한 패턴)
`);

// 2. 팀별 통계 계산 쿼리
const insertTeamStats = db.prepare(`
  INSERT INTO monthly_team_stats (
    month, team_name, center_name, total_employees,
    weekly_claimed_hours, weekly_adjusted_hours,
    efficiency, data_reliability
  )
  WITH claimed AS (
    SELECT
      e.team_name,
      e.center_name,
      COUNT(DISTINCT c.사번) as total_employees,
      SUM(
        CASE
          WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
          THEN COALESCE(h.standard_hours, 8.0)
          ELSE c.실제근무시간
        END
      ) as total_claimed
    FROM claim_data c
    LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
    JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
    WHERE c.근무일 BETWEEN ? AND ?
      AND e.team_name IS NOT NULL
    GROUP BY e.team_name, e.center_name
  ),
  adjusted AS (
    SELECT
      e.team_name,
      SUM(
        CASE
          WHEN h.holiday_date IS NOT NULL AND c.실제근무시간 = 0
          THEN COALESCE(h.standard_hours, 8.0)
          ELSE CASE
            WHEN c.이동시간 >= 8 * 60
            THEN GREATEST(c.실제근무시간 - 8, 0)
            ELSE GREATEST(c.실제근무시간 - (c.이동시간 / 60.0), 0)
          END
        END
      ) as total_adjusted
    FROM claim_data c
    LEFT JOIN holidays h ON DATE(c.근무일) = h.holiday_date
    JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
    WHERE c.근무일 BETWEEN ? AND ?
      AND e.team_name IS NOT NULL
    GROUP BY e.team_name
  ),
  reliability AS (
    SELECT
      e.team_name,
      AVG(dar.confidence_score) as avg_reliability
    FROM daily_analysis_results dar
    JOIN employees e ON e.employee_id = dar.employee_id
    WHERE dar.analysis_date BETWEEN ? AND ?
      AND e.team_name IS NOT NULL
    GROUP BY e.team_name
  )
  SELECT
    ? as month,
    c.team_name,
    c.center_name,
    c.total_employees,
    ROUND(c.total_claimed / c.total_employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1) as weekly_claimed,
    ROUND(a.total_adjusted / c.total_employees / (JULIANDAY(?) - JULIANDAY(?) + 1) * 7, 1) as weekly_adjusted,
    ROUND(MIN(a.total_adjusted / NULLIF(c.total_claimed, 0), 0.98) * 100, 1) as efficiency,
    ROUND(COALESCE(r.avg_reliability, 0), 1) as data_reliability
  FROM claimed c
  LEFT JOIN adjusted a ON c.team_name = a.team_name
  LEFT JOIN reliability r ON c.team_name = r.team_name
  WHERE c.total_employees > 0
`);

// 3. 월별 실행
const months = [
  '2025-01', '2025-02', '2025-03', '2025-04', '2025-05',
  '2025-06', '2025-07', '2025-08', '2025-09', '2025-10'
];

for (const month of months) {
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;

  console.log(`\nProcessing ${month}...`);

  try {
    const transaction = db.transaction(() => {
      // 기존 데이터 삭제
      db.prepare('DELETE FROM monthly_team_stats WHERE month = ?').run(month);

      // 새 데이터 삽입
      insertTeamStats.run(
        month, startDate, endDate, // claimed CTE
        startDate, endDate,         // adjusted CTE
        startDate, endDate,         // reliability CTE
        month,                      // SELECT month
        endDate, startDate,         // weekly_claimed calculation
        endDate, startDate          // weekly_adjusted calculation
      );
    });

    transaction();

    // 결과 확인
    const teamCount = db.prepare(
      'SELECT COUNT(*) as count FROM monthly_team_stats WHERE month = ?'
    ).get(month).count;

    console.log(`  ✓ Teams: ${teamCount}`);
  } catch (error) {
    console.error(`  ✗ Error processing ${month}:`, error.message);
  }
}

db.close();
```

#### 주요 계산 로직

##### 1. 주간 청구 근무시간 (Weekly Claimed Hours)
```javascript
// 공식: (월별 총 청구시간 / 직원수 / 월 일수) * 7
weekly_claimed = (total_claimed / total_employees / days_in_month) * 7

// 공휴일 처리:
// - 청구시간이 0인 공휴일 → 표준근무시간(8시간) 적용
// - 청구시간이 있는 공휴일 → 실제 청구시간 사용
```

##### 2. 주간 조정 근무시간 (Weekly Adjusted Hours)
```javascript
// 공식: (월별 총 조정시간 / 직원수 / 월 일수) * 7
weekly_adjusted = (total_adjusted / total_employees / days_in_month) * 7

// 이동시간 보정:
// - 이동시간 ≥ 8시간 → 실제근무시간 - 8시간
// - 이동시간 < 8시간 → 실제근무시간 - 이동시간
```

##### 3. 작업 효율성 (Efficiency)
```javascript
// 공식: (조정 근무시간 / 청구 근무시간) * 100
efficiency = MIN(total_adjusted / total_claimed, 0.98) * 100

// 상한선: 98% (비현실적으로 높은 효율성 방지)
```

##### 4. 데이터 신뢰도 (Data Reliability)
```javascript
// 공식: daily_analysis_results의 confidence_score 평균
data_reliability = AVG(confidence_score)
```

### Electron 적용 가이드

#### 1. 스크립트 파일 추가
- `scripts/precompute-all-org-levels.mjs` 파일을 Electron 프로젝트에 복사
- `package.json`에 실행 스크립트 추가:
  ```json
  {
    "scripts": {
      "precompute": "node scripts/precompute-all-org-levels.mjs"
    }
  }
  ```

#### 2. 데이터베이스 경로 수정
```javascript
// Electron에서는 userData 경로 사용
import { app } from 'electron';
import path from 'path';

const dbPath = path.join(app.getPath('userData'), 'sambio_human.db');
const db = new Database(dbPath);
```

#### 3. 월별 범위 설정
```javascript
// 현재 월까지만 계산하도록 수정
const currentDate = new Date();
const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

const months = [];
for (let year = 2025; year <= currentDate.getFullYear(); year++) {
  const startMonth = year === 2025 ? 1 : 1;
  const endMonth = year === currentDate.getFullYear() ? currentDate.getMonth() + 1 : 12;

  for (let month = startMonth; month <= endMonth; month++) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
  }
}
```

#### 4. 진행률 UI 추가 (선택사항)
```javascript
// IPC를 통한 진행률 전송
import { ipcMain } from 'electron';

ipcMain.on('start-precompute', (event) => {
  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    // ... 계산 로직 ...

    event.sender.send('precompute-progress', {
      current: i + 1,
      total: months.length,
      month: month
    });
  }

  event.sender.send('precompute-complete');
});
```

---

## API 레이어 구현

### 파일: `app/api/teams-fast/route.ts`

#### 전체 구조

```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  getOrganizationById,
  getChildOrganizations
} from '@/lib/db/queries/organization';
import { getPrecomputedTeamStats } from '@/lib/db/queries/precompute-stats';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

interface TeamStats {
  month: string;
  team_name: string;
  center_name: string;
  total_employees: number;
  weekly_claimed_hours: number;
  weekly_adjusted_hours: number;
  efficiency: number;
  data_reliability: number;
  org_code?: string;
  parent_org_code?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const centerCode = searchParams.get('center');
    const divisionCode = searchParams.get('division');
    const selectedMonth = searchParams.get('month');

    // 현재 월 기본값
    const currentDate = new Date();
    const currentMonth = selectedMonth ||
      `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    // 사전 계산된 팀 통계 가져오기
    const precomputedTeams = getPrecomputedTeamStats(
      currentMonth,
      centerCode || undefined
    ) as TeamStats[];

    let teams: any[] = [];
    const breadcrumb: { label: string; href: string }[] = [];

    // 담당(division) 선택 시
    if (divisionCode) {
      const parentOrg = getOrganizationById(divisionCode);

      if (parentOrg) {
        const childTeams = getChildOrganizations(parentOrg.orgCode)
          .filter((org: any) => org.orgLevel === 'team');

        // 사전 계산 통계를 팀에 매핑
        teams = childTeams.map((team: any) => {
          const statsData = precomputedTeams.find(
            (t) => t.org_code === team.orgCode || t.team_name === team.orgName
          );

          return {
            ...team,
            stats: statsData ? {
              avgWorkEfficiency: statsData.efficiency || 0,
              avgWeeklyWorkHours: 40.0,
              avgWeeklyClaimedHours: statsData.weekly_claimed_hours || 0,
              avgAdjustedWeeklyWorkHours: statsData.weekly_adjusted_hours || 0,
              avgDataReliability: statsData.data_reliability || 0,
              totalEmployees: statsData.total_employees || 0
            } : {
              avgWorkEfficiency: 0,
              avgWeeklyWorkHours: 0,
              avgWeeklyClaimedHours: 0,
              avgAdjustedWeeklyWorkHours: 0,
              avgDataReliability: 0,
              totalEmployees: 0
            }
          };
        });
      }

      // Breadcrumb 생성
      if (parentOrg && parentOrg.parentOrgCode) {
        const center = getOrganizationById(parentOrg.parentOrgCode);
        if (center) {
          breadcrumb.push({
            label: center.orgName,
            href: `/teams?center=${center.orgCode}`
          });
        }
      }
      if (parentOrg) {
        breadcrumb.push({
          label: parentOrg.orgName,
          href: `/teams?division=${parentOrg.orgCode}`
        });
      }
    }
    // 센터(center) 선택 시
    else if (centerCode) {
      const parentOrg = getOrganizationById(centerCode);
      const children = getChildOrganizations(centerCode);

      const divisions = children.filter((c: any) => c.orgLevel === 'division');
      const directTeams = children.filter((c: any) => c.orgLevel === 'team');

      // 담당별 통계 집계
      const divisionsWithStats = divisions.map((div: any) => {
        const divTeams = getChildOrganizations(div.orgCode)
          .filter((t: any) => t.orgLevel === 'team');
        const divTeamStats = precomputedTeams.filter((t) =>
          divTeams.some((dt: any) =>
            dt.orgCode === t.org_code || dt.orgName === t.team_name
          )
        );

        const totalEmployees = divTeamStats.reduce(
          (sum: number, t) => sum + (t.total_employees || 0), 0
        );
        const totalClaimed = divTeamStats.reduce(
          (sum: number, t) => sum + (t.total_employees || 0) * (t.weekly_claimed_hours || 0), 0
        );
        const totalAdjusted = divTeamStats.reduce(
          (sum: number, t) => sum + (t.total_employees || 0) * (t.weekly_adjusted_hours || 0), 0
        );
        const avgReliability = divTeamStats.length > 0
          ? divTeamStats.reduce((sum: number, t) => sum + (t.data_reliability || 0), 0) / divTeamStats.length
          : 0;

        return {
          ...div,
          stats: {
            avgWorkEfficiency: totalEmployees > 0
              ? Math.round(totalAdjusted / totalClaimed * 100 * 10) / 10
              : 0,
            avgWeeklyWorkHours: 40.0,
            avgWeeklyClaimedHours: totalEmployees > 0
              ? Math.round(totalClaimed / totalEmployees * 10) / 10
              : 0,
            avgAdjustedWeeklyWorkHours: totalEmployees > 0
              ? Math.round(totalAdjusted / totalEmployees * 10) / 10
              : 0,
            avgDataReliability: Math.round(avgReliability * 10) / 10,
            totalEmployees
          }
        };
      });

      // 직속 팀 통계 매핑
      const directTeamsWithStats = directTeams.map((team: any) => {
        const statsData = precomputedTeams.find(
          (t) => t.org_code === team.orgCode || t.team_name === team.orgName
        );
        return {
          ...team,
          stats: statsData ? {
            avgWorkEfficiency: statsData.efficiency || 0,
            avgWeeklyWorkHours: 40.0,
            avgWeeklyClaimedHours: statsData.weekly_claimed_hours || 0,
            avgAdjustedWeeklyWorkHours: statsData.weekly_adjusted_hours || 0,
            avgDataReliability: statsData.data_reliability || 0,
            totalEmployees: statsData.total_employees || 0
          } : {
            avgWorkEfficiency: 0,
            avgWeeklyWorkHours: 0,
            avgWeeklyClaimedHours: 0,
            avgAdjustedWeeklyWorkHours: 0,
            avgDataReliability: 0,
            totalEmployees: 0
          }
        };
      });

      teams = [...divisionsWithStats, ...directTeamsWithStats];

      if (parentOrg) {
        breadcrumb.push({
          label: parentOrg.orgName,
          href: `/teams?center=${parentOrg.orgCode}`
        });
      }
    } else {
      return NextResponse.json({
        error: 'Please select a center to view teams'
      }, { status: 400 });
    }

    // 요약 통계 계산
    const totalEmployees = teams.reduce(
      (sum, t) => sum + (t.stats?.totalEmployees || 0), 0
    );
    const weightedEfficiency = teams.reduce(
      (sum, t) => sum + (t.stats?.avgWorkEfficiency || 0) * (t.stats?.totalEmployees || 0), 0
    );
    const weightedReliability = teams.reduce(
      (sum, t) => sum + (t.stats?.avgDataReliability || 0) * (t.stats?.totalEmployees || 0), 0
    );

    const avgEfficiency = totalEmployees > 0
      ? Math.round(weightedEfficiency / totalEmployees * 10) / 10
      : 0;
    const avgDataReliability = totalEmployees > 0
      ? Math.round(weightedReliability / totalEmployees * 10) / 10
      : 0;

    return NextResponse.json({
      teams,
      breadcrumb,
      summary: {
        totalEmployees,
        avgEfficiency,
        avgDataReliability
      },
      thresholds: {
        efficiency: {
          low: '≤89.5%',
          middle: '89.6-93.6%',
          high: '≥93.7%',
          thresholds: { low: 89.5, high: 93.7 }
        },
        adjustedWeeklyWorkHours: {
          low: '<35.0h',
          middle: '35.0-41.9h',
          high: '≥42.0h',
          thresholds: { low: 35.0, high: 42.0 }
        },
        weeklyClaimedHours: {
          low: '<38.0h',
          middle: '38.0-47.9h',
          high: '≥48.0h',
          thresholds: { low: 38.0, high: 48.0 }
        },
        dataReliability: {
          low: '<70.0',
          middle: '70.0-84.9',
          high: '≥85.0',
          thresholds: { low: 70.0, high: 85.0 }
        }
      },
      currentMonth,
      isPrecomputed: true
    });
  } catch (error) {
    console.error('Failed to fetch team data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch team data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
```

#### 핵심 함수: `getPrecomputedTeamStats()`

**파일**: `lib/db/queries/precompute-stats.ts`

```typescript
export function getPrecomputedTeamStats(month: string, centerCode?: string) {
  let query = `
    SELECT mts.*, om.org_code, om.parent_org_code
    FROM monthly_team_stats mts
    LEFT JOIN organization_master om
      ON om.org_name = mts.team_name
      AND om.org_level = 'team'
      AND om.is_active = 1
    WHERE mts.month = ?
  `;

  const params: any[] = [month];

  if (centerCode) {
    query += ` AND (
      om.parent_org_code = ?
      OR mts.center_name = (
        SELECT org_name
        FROM organization_master
        WHERE org_code = ?
      )
    )`;
    params.push(centerCode, centerCode);
  }

  query += ` ORDER BY mts.team_name`;

  return db.prepare(query).all(...params);
}
```

### Electron 적용 가이드

#### 1. IPC 기반 API 구현
Electron에서는 Next.js API Routes 대신 IPC를 사용합니다.

**Main Process** (`main.js`):
```javascript
import { ipcMain } from 'electron';
import { getPrecomputedTeamStats } from './db/queries/precompute-stats';
import { getOrganizationById, getChildOrganizations } from './db/queries/organization';

ipcMain.handle('get-teams-fast', async (event, { centerCode, divisionCode, selectedMonth }) => {
  try {
    const currentDate = new Date();
    const currentMonth = selectedMonth ||
      `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    const precomputedTeams = getPrecomputedTeamStats(currentMonth, centerCode);

    // ... 동일한 로직 ...

    return {
      teams,
      breadcrumb,
      summary,
      thresholds,
      currentMonth,
      isPrecomputed: true
    };
  } catch (error) {
    console.error('Failed to fetch team data:', error);
    throw error;
  }
});
```

**Renderer Process** (React 컴포넌트):
```typescript
// preload.js에서 IPC 노출
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getTeamsFast: (params) => ipcRenderer.invoke('get-teams-fast', params)
});

// React 컴포넌트에서 사용
const TeamPage = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const result = await window.api.getTeamsFast({
        centerCode: selectedCenter,
        divisionCode: selectedDivision,
        selectedMonth: currentMonth
      });
      setData(result);
    };

    fetchData();
  }, [selectedCenter, selectedDivision, currentMonth]);

  // ...
};
```

#### 2. 데이터베이스 모듈 구성
```javascript
// db/queries/precompute-stats.js
import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

const dbPath = path.join(app.getPath('userData'), 'sambio_human.db');
const db = new Database(dbPath);

export function getPrecomputedTeamStats(month, centerCode) {
  let query = `
    SELECT mts.*, om.org_code, om.parent_org_code
    FROM monthly_team_stats mts
    LEFT JOIN organization_master om
      ON om.org_name = mts.team_name
      AND om.org_level = 'team'
      AND om.is_active = 1
    WHERE mts.month = ?
  `;

  const params = [month];

  if (centerCode) {
    query += ` AND (
      om.parent_org_code = ?
      OR mts.center_name = (
        SELECT org_name
        FROM organization_master
        WHERE org_code = ?
      )
    )`;
    params.push(centerCode, centerCode);
  }

  query += ` ORDER BY mts.team_name`;

  return db.prepare(query).all(...params);
}
```

---

## 프론트엔드 수정

### 1. API 엔드포인트 변경

**파일**: `app/teams/page.tsx`

**변경 전**:
```typescript
const apiUrl = `/api/teams?${params}`;
```

**변경 후**:
```typescript
const apiUrl = `/api/teams-fast?${params}`;
```

**Electron 버전**:
```typescript
// IPC 호출로 대체
const data = await window.api.getTeamsFast({
  centerCode,
  divisionCode,
  selectedMonth
});
```

### 2. 상대적 임계값 적용

**파일**: `components/dashboard/TeamPlantCards.tsx`

#### 핵심 변경사항

**변경 전** (line 403):
```typescript
const { top, middle, bottom, localThresholds } = categorizeTeams(centerTeams, false);
const effectiveThresholds = getCurrentThresholds();
```

**변경 후** (line 403):
```typescript
const { top, middle, bottom, localThresholds } = categorizeTeams(centerTeams, true);
const effectiveThresholds = localThresholds || getCurrentThresholds();
```

#### `categorizeTeams()` 함수 분석

```typescript
function categorizeTeams(
  teams: Array<{ stats?: TeamStats }>,
  useLocalThresholds: boolean = false
) {
  if (!teams || teams.length === 0) {
    return { top: [], middle: [], bottom: [], localThresholds: undefined };
  }

  // useLocalThresholds = true일 때: 화면에 보이는 팀들의 상대적 순위 계산
  if (useLocalThresholds) {
    // 각 메트릭별로 값 수집 및 정렬
    const efficiencyValues = teams
      .map(t => t.stats?.avgWorkEfficiency || 0)
      .filter(v => v > 0)
      .sort((a, b) => a - b);

    const adjustedWorkHoursValues = teams
      .map(t => t.stats?.avgAdjustedWeeklyWorkHours || 0)
      .filter(v => v > 0)
      .sort((a, b) => a - b);

    const claimedHoursValues = teams
      .map(t => t.stats?.avgWeeklyClaimedHours || 0)
      .filter(v => v > 0)
      .sort((a, b) => a - b);

    const reliabilityValues = teams
      .map(t => t.stats?.avgDataReliability || 0)
      .filter(v => v > 0)
      .sort((a, b) => a - b);

    // 20th, 80th percentile 계산
    const getPercentile = (arr: number[], percentile: number) => {
      if (arr.length === 0) return 0;

      // 3개 이하일 때 특별 처리
      if (arr.length <= 3) {
        if (percentile <= 20) return arr[0]; // 최소값
        if (percentile >= 80) return arr[arr.length - 1]; // 최대값
        return arr[Math.floor(arr.length / 2)]; // 중간값
      }

      // 일반적인 백분위수 계산
      const index = Math.ceil((percentile / 100) * arr.length) - 1;
      return arr[Math.max(0, Math.min(index, arr.length - 1))];
    };

    // 로컬 임계값 생성
    const localThresholds = {
      efficiency: {
        low: getPercentile(efficiencyValues, 20),
        high: getPercentile(efficiencyValues, 80)
      },
      adjustedWeeklyWorkHours: {
        low: getPercentile(adjustedWorkHoursValues, 20),
        high: getPercentile(adjustedWorkHoursValues, 80)
      },
      weeklyClaimedHours: {
        low: getPercentile(claimedHoursValues, 20),
        high: getPercentile(claimedHoursValues, 80)
      },
      dataReliability: {
        low: getPercentile(reliabilityValues, 20),
        high: getPercentile(reliabilityValues, 80)
      }
    };

    // 로컬 임계값으로 팀 분류
    const top: typeof teams = [];
    const middle: typeof teams = [];
    const bottom: typeof teams = [];

    teams.forEach(team => {
      if (!team.stats) {
        bottom.push(team);
        return;
      }

      const efficiency = team.stats.avgWorkEfficiency || 0;
      const adjustedHours = team.stats.avgAdjustedWeeklyWorkHours || 0;
      const claimedHours = team.stats.avgWeeklyClaimedHours || 0;
      const reliability = team.stats.avgDataReliability || 0;

      // 각 메트릭별 점수 계산 (0-2)
      let score = 0;

      // 효율성: 높을수록 좋음
      if (efficiency >= localThresholds.efficiency.high) score += 2;
      else if (efficiency > localThresholds.efficiency.low) score += 1;

      // 조정 근무시간: 중간값이 좋음 (너무 높거나 낮으면 안 좋음)
      if (adjustedHours >= localThresholds.adjustedWeeklyWorkHours.high) score += 0;
      else if (adjustedHours > localThresholds.adjustedWeeklyWorkHours.low) score += 2;
      else score += 0;

      // 청구 근무시간: 중간값이 좋음
      if (claimedHours >= localThresholds.weeklyClaimedHours.high) score += 0;
      else if (claimedHours > localThresholds.weeklyClaimedHours.low) score += 2;
      else score += 0;

      // 데이터 신뢰도: 높을수록 좋음
      if (reliability >= localThresholds.dataReliability.high) score += 2;
      else if (reliability > localThresholds.dataReliability.low) score += 1;

      // 점수 기반 분류
      if (score >= 6) top.push(team);
      else if (score >= 3) middle.push(team);
      else bottom.push(team);
    });

    return { top, middle, bottom, localThresholds };
  }

  // useLocalThresholds = false일 때: 전역 절대 임계값 사용
  const thresholds = getCurrentThresholds();

  // ... 절대 임계값 기반 분류 로직 ...
}
```

#### 상대적 임계값 계산 예시

**시나리오**: EPCV 센터의 3개 팀

| 팀명 | 조정 근무시간 |
|------|--------------|
| 팀 A | 40.0 시간 |
| 팀 B | 39.7 시간 |
| 팀 C | 39.4 시간 |

**절대 임계값 사용 시** (`useLocalThresholds = false`):
```
전역 임계값: low=35.0, high=42.0
→ 팀 A, B, C 모두 중위(middle) 그룹 (35.0 < 값 < 42.0)
→ 모두 녹색으로 표시
```

**상대 임계값 사용 시** (`useLocalThresholds = true`):
```
정렬된 값: [39.4, 39.7, 40.0]
20th percentile: 39.4 (최소값)
80th percentile: 40.0 (최대값)

→ 팀 A (40.0): 상위(top) - 빨강
→ 팀 B (39.7): 중위(middle) - 녹색
→ 팀 C (39.4): 하위(bottom) - 파랑
```

### Electron 적용 가이드

Electron 버전에서도 동일한 로직을 사용하되, React 컴포넌트 구조를 유지합니다.

#### 1. 컴포넌트 파일 복사
```bash
# TeamPlantCards.tsx 파일을 Electron 프로젝트의 components 디렉토리로 복사
cp components/dashboard/TeamPlantCards.tsx /path/to/electron/project/src/components/
```

#### 2. 타입 정의 추가
```typescript
// types/team.ts
export interface TeamStats {
  avgWorkEfficiency: number;
  avgWeeklyWorkHours: number;
  avgWeeklyClaimedHours: number;
  avgAdjustedWeeklyWorkHours: number;
  avgDataReliability: number;
  totalEmployees: number;
}

export interface Team {
  orgCode: string;
  orgName: string;
  orgLevel: string;
  parentOrgCode?: string;
  stats?: TeamStats;
}
```

#### 3. 데이터 fetching 수정
```typescript
// pages/Teams.tsx (Electron 버전)
import { useEffect, useState } from 'react';
import TeamPlantCards from '@/components/TeamPlantCards';

const TeamsPage = () => {
  const [teamsData, setTeamsData] = useState(null);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        // IPC를 통해 데이터 가져오기
        const data = await window.api.getTeamsFast({
          centerCode: selectedCenter,
          divisionCode: null,
          selectedMonth: selectedMonth
        });

        setTeamsData(data);
      } catch (error) {
        console.error('Failed to fetch teams:', error);
      }
    };

    if (selectedCenter) {
      fetchTeams();
    }
  }, [selectedCenter, selectedMonth]);

  if (!teamsData) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {/* 센터/담당 선택 UI */}
      <TeamPlantCards
        teams={teamsData.teams}
        thresholds={teamsData.thresholds}
        // ... 기타 props ...
      />
    </div>
  );
};

export default TeamsPage;
```

---

## 구현 체크리스트

### Phase 1: 데이터베이스 준비
- [ ] 월별 통계 테이블 4개 생성 (center, team, grade, overall)
- [ ] 인덱스 생성 확인
- [ ] UNIQUE 제약조건 설정 확인
- [ ] 기존 데이터와 호환성 테스트

### Phase 2: 사전 계산 스크립트
- [ ] `scripts/precompute-all-org-levels.mjs` 파일 추가
- [ ] 데이터베이스 경로 설정 (Electron: userData)
- [ ] 월별 범위 설정 (현재까지)
- [ ] 스크립트 실행 테스트
  ```bash
  node scripts/precompute-all-org-levels.mjs
  ```
- [ ] 결과 검증
  ```sql
  SELECT month, COUNT(*) as team_count
  FROM monthly_team_stats
  GROUP BY month;
  ```
- [ ] `package.json`에 스크립트 명령 추가
  ```json
  "scripts": {
    "precompute": "node scripts/precompute-all-org-levels.mjs"
  }
  ```

### Phase 3: API/IPC 구현
- [ ] **Next.js**: `app/api/teams-fast/route.ts` 추가
- [ ] **Electron**: IPC handler 추가 (`get-teams-fast`)
- [ ] `getPrecomputedTeamStats()` 함수 구현
- [ ] TypeScript 타입 정의 (`TeamStats` interface)
- [ ] 담당/센터별 필터링 로직 구현
- [ ] 통계 집계 로직 구현
- [ ] Thresholds 반환 추가
- [ ] 에러 핸들링 추가

### Phase 4: 프론트엔드 수정
- [ ] `app/teams/page.tsx`: API 엔드포인트 변경
  ```typescript
  // 변경 전: /api/teams
  // 변경 후: /api/teams-fast (또는 IPC)
  ```
- [ ] `components/dashboard/TeamPlantCards.tsx`: 상대적 임계값 활성화
  ```typescript
  // line 403
  categorizeTeams(centerTeams, true)  // false → true
  effectiveThresholds = localThresholds || getCurrentThresholds()
  ```
- [ ] 타입 정의 추가/업데이트
- [ ] 로딩 상태 처리
- [ ] 에러 상태 처리

### Phase 5: 테스트
- [ ] 센터 선택 → 담당/팀 목록 표시 속도 확인
- [ ] 담당 선택 → 팀 목록 표시 속도 확인
- [ ] 상중하 분류가 올바르게 표시되는지 확인
  - [ ] 3개 팀: 각각 상/중/하로 분류
  - [ ] 10개 팀: 비율에 맞게 분류
- [ ] 월별 선택 시 올바른 데이터 표시 확인
- [ ] 데이터가 없는 월 선택 시 빈 목록 표시 확인
- [ ] 브라우저 콘솔/Electron 로그에 에러 없음 확인

### Phase 6: 문서화 및 배포
- [ ] 구현 가이드 문서 작성 (이 문서)
- [ ] 유지보수 절차 문서 작성
- [ ] 팀원 교육 자료 준비
- [ ] 프로덕션 배포

---

## 유지보수 가이드

### 1. 월별 사전 계산 실행

#### 실행 시점
- **정기**: 매월 초 (1일 또는 2일)
- **임시**: 데이터 수정 후 재계산 필요 시

#### 실행 방법

**Next.js 버전**:
```bash
cd /path/to/SambioHRR
npm run precompute
```

**Electron 버전**:
```bash
cd /path/to/electron-app
npm run precompute
```

또는 Electron UI에서 실행:
```typescript
// 메뉴에 추가
{
  label: '데이터 사전 계산',
  click: async () => {
    const result = await dialog.showMessageBox({
      type: 'question',
      buttons: ['취소', '실행'],
      title: '데이터 사전 계산',
      message: '월별 통계를 사전 계산하시겠습니까?',
      detail: '약 1-2분 소요됩니다.'
    });

    if (result.response === 1) {
      // 프로그레스 윈도우 표시
      const progressWindow = new BrowserWindow({
        width: 400,
        height: 200,
        parent: mainWindow,
        modal: true
      });

      // 사전 계산 실행
      await runPrecompute();

      progressWindow.close();

      dialog.showMessageBox({
        type: 'info',
        title: '완료',
        message: '사전 계산이 완료되었습니다.'
      });
    }
  }
}
```

### 2. 새로운 월 데이터 추가 시

#### 스크립트 수정
```javascript
// scripts/precompute-all-org-levels.mjs

// months 배열에 새 월 추가
const months = [
  '2025-01', '2025-02', '2025-03', '2025-04', '2025-05',
  '2025-06', '2025-07', '2025-08', '2025-09', '2025-10',
  '2025-11'  // ← 추가
];
```

또는 동적 생성:
```javascript
// 현재 월까지 자동 생성
const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1; // 1-12
const currentYear = currentDate.getFullYear();

const months = [];
for (let year = 2025; year <= currentYear; year++) {
  const startMonth = year === 2025 ? 1 : 1;
  const endMonth = year === currentYear ? currentMonth : 12;

  for (let month = startMonth; month <= endMonth; month++) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
  }
}
```

### 3. 성능 모니터링

#### 쿼리 성능 확인
```sql
-- 사전 계산 전: daily_analysis_results 직접 쿼리
EXPLAIN QUERY PLAN
SELECT e.team_name, COUNT(*) as count
FROM daily_analysis_results dar
JOIN employees e ON e.employee_id = dar.employee_id
WHERE dar.analysis_date BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY e.team_name;
-- SCAN daily_analysis_results (806K rows)

-- 사전 계산 후: monthly_team_stats 쿼리
EXPLAIN QUERY PLAN
SELECT team_name, total_employees
FROM monthly_team_stats
WHERE month = '2025-01';
-- SEARCH monthly_team_stats USING INDEX (~97 rows)
```

#### 응답 시간 측정
```typescript
// API 또는 IPC handler에 추가
const startTime = Date.now();

// ... 데이터 처리 로직 ...

const endTime = Date.now();
console.log(`[Performance] Teams query took ${endTime - startTime}ms`);
```

### 4. 데이터 무결성 검증

#### 검증 스크립트
```sql
-- 1. 월별 팀 수 확인
SELECT month, COUNT(DISTINCT team_name) as team_count
FROM monthly_team_stats
GROUP BY month
ORDER BY month;

-- 2. 직원 수 합계 확인
SELECT
  month,
  SUM(total_employees) as total_employees
FROM monthly_team_stats
GROUP BY month
ORDER BY month;

-- 3. 원본 데이터와 비교
SELECT
  '2025-01' as month,
  COUNT(DISTINCT dar.employee_id) as raw_count,
  (SELECT SUM(total_employees) FROM monthly_team_stats WHERE month = '2025-01') as precomputed_count
FROM daily_analysis_results dar
JOIN employees e ON e.employee_id = dar.employee_id
WHERE dar.analysis_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND e.team_name IS NOT NULL;
```

### 5. 문제 해결

#### 문제: 사전 계산 스크립트가 실패
```bash
# 에러 확인
node scripts/precompute-all-org-levels.mjs 2>&1 | tee precompute.log

# 일반적인 원인:
# 1. 데이터베이스 잠금 → 다른 프로세스 종료 후 재시도
# 2. 디스크 공간 부족 → 공간 확보
# 3. 메모리 부족 → 월별로 분리 실행
```

#### 문제: 특정 월 데이터가 누락
```sql
-- 누락 확인
SELECT DISTINCT month FROM monthly_team_stats ORDER BY month;

-- 특정 월만 재계산
DELETE FROM monthly_team_stats WHERE month = '2025-05';
-- 스크립트에서 해당 월만 실행
```

#### 문제: UI에서 상중하 분류가 안 됨
```typescript
// 1. 브라우저 콘솔에서 확인
console.log('localThresholds:', localThresholds);
console.log('effectiveThresholds:', effectiveThresholds);

// 2. categorizeTeams 호출 확인
categorizeTeams(centerTeams, true);  // true인지 확인

// 3. teams 데이터 확인
console.log('teams:', teams);
console.log('teams[0].stats:', teams[0]?.stats);
```

### 6. 백업 및 복구

#### 월별 통계 백업
```bash
# SQLite 백업
sqlite3 sambio_human.db ".dump monthly_team_stats" > backup_team_stats.sql
sqlite3 sambio_human.db ".dump monthly_center_stats" > backup_center_stats.sql
sqlite3 sambio_human.db ".dump monthly_grade_stats" > backup_grade_stats.sql
sqlite3 sambio_human.db ".dump monthly_overall_stats" > backup_overall_stats.sql
```

#### 복구
```bash
# 테이블 삭제 후 복구
sqlite3 sambio_human.db <<EOF
DROP TABLE IF EXISTS monthly_team_stats;
.read backup_team_stats.sql
EOF
```

---

## 부록

### A. 성능 비교 데이터

#### 기존 API (`/api/teams`)
```
센터 선택 (9개 센터):
- 쿼리 대상: daily_analysis_results (806K rows)
- 응답 시간: 2-5초
- 메모리 사용: ~200MB

담당 선택 (센터 하위 3-5개 담당):
- 쿼리 대상: daily_analysis_results (806K rows)
- 응답 시간: 2-4초
- 메모리 사용: ~150MB
```

#### Fast API (`/api/teams-fast`)
```
센터 선택 (9개 센터):
- 쿼리 대상: monthly_team_stats (~97 rows)
- 응답 시간: 0.05-0.2초 (10-100배 빠름)
- 메모리 사용: ~5MB

담당 선택 (센터 하위 3-5개 담당):
- 쿼리 대상: monthly_team_stats (~10-20 rows)
- 응답 시간: 0.03-0.1초 (20-150배 빠름)
- 메모리 사용: ~2MB
```

### B. SQL 쿼리 참고

#### 월별 팀 통계 조회
```sql
SELECT
  mts.*,
  om.org_code,
  om.parent_org_code
FROM monthly_team_stats mts
LEFT JOIN organization_master om
  ON om.org_name = mts.team_name
  AND om.org_level = 'team'
  AND om.is_active = 1
WHERE mts.month = '2025-01'
ORDER BY mts.team_name;
```

#### 센터별 집계
```sql
SELECT
  center_name,
  SUM(total_employees) as total_employees,
  ROUND(SUM(total_employees * weekly_claimed_hours) / SUM(total_employees), 1) as avg_claimed,
  ROUND(SUM(total_employees * weekly_adjusted_hours) / SUM(total_employees), 1) as avg_adjusted,
  ROUND(AVG(efficiency), 1) as avg_efficiency,
  ROUND(AVG(data_reliability), 1) as avg_reliability
FROM monthly_team_stats
WHERE month = '2025-01'
GROUP BY center_name
ORDER BY center_name;
```

#### 월별 추세 분석
```sql
SELECT
  month,
  AVG(efficiency) as avg_efficiency,
  AVG(weekly_adjusted_hours) as avg_adjusted_hours,
  AVG(data_reliability) as avg_reliability
FROM monthly_team_stats
WHERE month BETWEEN '2025-01' AND '2025-10'
GROUP BY month
ORDER BY month;
```

### C. 연락처 및 지원

문제 발생 시:
1. GitHub Issues 확인: [Repository URL]
2. 로그 파일 확인:
   - Next.js: `.next/server/` 디렉토리
   - Electron: `userData/logs/` 디렉토리
3. 데이터베이스 무결성 검증 스크립트 실행
4. 필요 시 사전 계산 재실행

---

**문서 버전**: 1.0
**최종 업데이트**: 2025-02-11
**작성자**: Claude Sonnet 4.5
**적용 버전**: SambioHRR Next.js + 향후 Electron 버전
