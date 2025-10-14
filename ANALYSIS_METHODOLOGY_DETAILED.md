# SambioHRR 분석 방법론 상세 문서

**작성일**: 2025-10-14
**버전**: 1.0
**목적**: 실제 적용된 분석 방법론의 완전한 이해

---

## 목차

1. [분석 방법론 개요](#1-분석-방법론-개요)
2. [데이터 수집 및 전처리](#2-데이터-수집-및-전처리)
3. [Timeline 구축 방법론](#3-timeline-구축-방법론)
4. [활동 상태 분류 (Activity State Classification)](#4-활동-상태-분류)
5. [근무시간 계산 알고리즘](#5-근무시간-계산-알고리즘)
6. [집중 업무시간 분석](#6-집중-업무시간-분석)
7. [Ground Rules 분석](#7-ground-rules-분석)
8. [신뢰도 점수 계산](#8-신뢰도-점수-계산)
9. [조직 분석 방법론](#9-조직-분석-방법론)
10. [패턴 클러스터링](#10-패턴-클러스터링)

---

## 1. 분석 방법론 개요

### 1.1 분석 철학

SambioHRR의 분석 방법론은 다음 원칙을 기반으로 합니다:

1. **데이터 기반 추정**: 직원의 자기 신고(claim)가 아닌 객관적 데이터(tag, knox 등)를 우선 활용
2. **상태 머신 방식**: 직원의 활동을 시간대별 상태(State)로 모델링
3. **다층적 분석**: 개인 → 그룹 → 팀 → 센터로 계층적 집계
4. **신뢰도 관리**: 모든 분석 결과에 신뢰도 점수 부여

### 1.2 분석 모드

시스템은 두 가지 분석 모드를 지원합니다:

#### Enhanced Mode (기본 모드)
- 모든 데이터 소스 활용 (Tag + Claim + Knox + Meal + Equipment)
- 상태 머신 기반 정밀 분석
- Ground Rules 적용
- 신뢰도: 높음 (70-95점)
- 적용 대상: 데이터가 풍부한 직원 (연구직, 제조직)

#### Legacy Mode (호환 모드)
- Tag와 Claim 데이터만 사용
- 태그 패턴 기반 추정
- 간단한 규칙 적용
- 신뢰도: 중간 (40-70점)
- 적용 대상: 데이터가 부족한 직원 (영업직, 관리직)

**모드 선택 로직**:
```typescript
function selectAnalysisMode(employeeId: string, date: string): AnalysisMode {
  const tagCount = countTags(employeeId, date);
  const knoxEventCount = countKnoxEvents(employeeId, date);

  // O 태그 5개 이상 + Knox 이벤트 3개 이상 → Enhanced
  if (tagCount.O >= 5 && knoxEventCount >= 3) {
    return 'enhanced';
  }

  // 데이터 부족 → Legacy
  return 'legacy';
}
```

### 1.3 분석 프로세스 전체 흐름

```
[1단계] 원시 데이터 수집
   Tag data, Claim data, Knox data, Meal data, Equipment data
   ↓
[2단계] 데이터 정제 및 검증
   중복 제거, 시간순 정렬, 유효성 검증
   ↓
[3단계] Timeline 구축
   모든 이벤트를 시간순으로 통합
   ↓
[4단계] 활동 상태 분류 (State Machine)
   각 시점의 활동을 11개 상태 중 하나로 분류
   ↓
[5단계] 지속 시간 계산
   각 상태의 시작~종료 시간 계산
   ↓
[6단계] 기본 지표 계산
   workTime, meetingTime, mealTime, restTime 등
   ↓
[7단계] 고급 분석
   집중 업무시간, Ground Rules, 추정 근무시간
   ↓
[8단계] 신뢰도 계산
   데이터 품질 기반 신뢰도 점수 (0-100)
   ↓
[9단계] 결과 저장
   daily_analysis_results 테이블에 저장
   ↓
[10단계] 조직 집계
   organization_daily_stats 테이블에 집계
```

---

## 2. 데이터 수집 및 전처리

### 2.1 원시 데이터 구조

#### 2.1.1 Tag Data (출입 태그)
**테이블**: `tag_data`

**주요 컬럼**:
- `사번`: 직원 ID
- `ENTE_DT`: 날짜 (YYYYMMDD 형식, INTEGER)
- `출입시각`: 태그 시각 (HHMMSS 형식, INTEGER)
- `DR_NO`: 문번호 (장소 코드)
- `DR_GB`: 태그 타입 (O, T1, T2, T3, G1, G2, G3, G4, N1, N2, M1, M2 등)
- `INOUT_GB`: 입출 구분 (I=입, O=출)

**태그 타입 분류**:
| 코드 | 명칭 | 의미 | 분석 용도 |
|-----|------|------|----------|
| **O** | 실제 업무 로그 | 장비/설비 사용 + Knox 이벤트 | 업무 활동 판단 (핵심) |
| **T1** | 통로/계단 | 통로/복도 이동 | Ground Rules 분석 (핵심) |
| **T2** | 출입구(입) | 건물 입구 | 출근 시간 판단 |
| **T3** | 출입구(출) | 건물 출구 | 퇴근 시간 판단 |
| **G1** | 주업무 공간 | 일반 업무 공간 | 업무 활동 판단 |
| **G2** | 준비 공간 | 업무 준비 공간 | 준비 시간 판단 |
| **G3** | 회의 공간 | 회의실 | 회의 시간 판단 |
| **G4** | 교육 공간 | 교육/훈련 공간 | 교육 시간 판단 |
| **N1** | 휴게 공간 | 휴게실 | 휴식 시간 판단 |
| **N2** | 복지시설 | 복지 공간 | 휴식 시간 판단 |
| **M1** | 식당 내 식사 | 구내식당 | 식사 시간 30분 |
| **M2** | 테이크아웃 | 포장 식사 | 식사 시간 10분 |

**데이터 예시**:
```
사번      | ENTE_DT  | 출입시각 | DR_NO | DR_GB | INOUT_GB
---------|----------|---------|-------|-------|----------
123456   | 20250615 | 083000  | D001  | T2    | I        (출근)
123456   | 20250615 | 090500  | L101  | O     | I        (장비 사용 시작)
123456   | 20250615 | 101200  | C201  | T1    | I        (복도 이동)
123456   | 20250615 | 120000  | R301  | G3    | I        (회의실 입실)
123456   | 20250615 | 130000  | R301  | G3    | O        (회의실 퇴실)
123456   | 20250615 | 180000  | D001  | T3    | O        (퇴근)
```

#### 2.1.2 Claim Data (근태 신고)
**테이블**: `claim_data`

**주요 컬럼**:
- `사번`: 직원 ID
- `근무일`: 근무 날짜
- `시작시간`, `종료시간`: 신고 근무시간
- `실제근무시간`: 계산된 근무시간 (시간 단위, FLOAT)
- `근태코드`: 연차, 반차, 병가 등
- `employee_level`: 직급 레벨 (Lv.1-4)
- `휴가_연차`: 휴가 시간 (시간 단위)

**데이터 예시**:
```
사번    | 근무일      | 시작시간  | 종료시간  | 실제근무시간 | 근태코드 | 휴가_연차
--------|-----------|---------|---------|------------|--------|--------
123456  | 2025-06-15 | 09:00   | 18:00   | 8.0        | 정상   | 0.0
123456  | 2025-06-16 | 09:00   | 13:00   | 0.0        | 반차   | 4.0
```

#### 2.1.3 Knox Data (전자결재/메일/PIMS)
**테이블**: `knox_approval_data`, `knox_mail_data`, `knox_pims_data`

**Knox Approval** (전자결재):
- `approval_timestamp`: 결재 시각
- `document_type`: 문서 유형 (기안, 품의, 보고 등)
- `approval_action`: 결재 액션 (기안, 승인, 반려 등)

**Knox Mail** (메일):
- `mail_timestamp`: 메일 송수신 시각
- `mail_type`: 송신/수신
- `subject`: 제목

**Knox PIMS** (프로젝트 관리):
- `pims_timestamp`: 작업 시각
- `project_code`: 프로젝트 코드
- `task_type`: 작업 유형

**의미**: Knox 이벤트가 많으면 PC 업무 중이라는 강력한 증거

#### 2.1.4 Meal Data (식사)
**테이블**: `meal_data`

**주요 컬럼**:
- `meal_timestamp`: 식사 시각
- `meal_type`: 식사 구분 (아침, 점심, 저녁)
- `duration_minutes`: 추정 식사 시간 (분)

#### 2.1.5 Equipment Data (장비 사용)
**테이블**: `eam_data`, `equis_data`, `lams_data`, `mes_data` 등

**공통 구조**:
- `timestamp`: 장비 사용 시각
- `equipment_code`: 장비 코드
- `usage_type`: 사용 유형

**의미**: 장비 사용은 실제 업무 수행의 직접적 증거

### 2.2 데이터 정제 프로세스

#### 2.2.1 Tag Data 정제

**문제점**:
1. 중복 태그: 동일 시간대(±30초) 중복 태깅
2. 오류 태그: 시스템 오류로 인한 잘못된 태그
3. 노이즈: 의미 없는 짧은 태그 시퀀스

**정제 알고리즘**:

```typescript
function cleanTagData(rawTags: RawTag[]): CleanTag[] {
  // 1. 시간순 정렬
  const sorted = rawTags.sort((a, b) => a.timestamp - b.timestamp);

  // 2. 중복 제거 (30초 이내)
  const deduped: RawTag[] = [];
  let lastTag: RawTag | null = null;

  for (const tag of sorted) {
    if (!lastTag || (tag.timestamp - lastTag.timestamp) > 30000) {
      deduped.push(tag);
      lastTag = tag;
    }
  }

  // 3. 유효성 검증
  const valid = deduped.filter(tag => {
    // 3.1. 근무시간대 확인 (05:00-24:00)
    const hour = tag.timestamp.getHours();
    if (hour < 5) return false; // 야간 태그는 별도 처리

    // 3.2. 장소 코드 유효성
    if (!isValidLocation(tag.DR_NO)) return false;

    // 3.3. 직원 유효성
    if (!isValidEmployee(tag.사번)) return false;

    return true;
  });

  // 4. 연속성 검증 (큰 시간 간격 표시)
  for (let i = 1; i < valid.length; i++) {
    const gap = (valid[i].timestamp - valid[i-1].timestamp) / 60000; // 분 단위
    if (gap > 60) {
      valid[i].hasLargeGap = true; // 1시간 이상 간격 표시
    }
  }

  return valid;
}
```

#### 2.2.2 Claim Data 정제

**문제점**:
1. 날짜 교차: 야간 근무 시 다음날로 넘어가는 경우
2. 제외시간 오류: 휴게시간 계산 오류
3. 휴가 처리: 연차, 반차 등 다양한 휴가 유형

**정제 알고리즘**:

```typescript
function cleanClaimData(rawClaim: RawClaim): CleanClaim {
  const claim = { ...rawClaim };

  // 1. 날짜 교차 처리
  if (claim.종료시간 < claim.시작시간) {
    claim.cross_day_work = true;
    // 종료시간을 다음날로 조정
    claim.종료시간 = new Date(claim.종료시간);
    claim.종료시간.setDate(claim.종료시간.getDate() + 1);
  }

  // 2. 휴가 시간 처리
  claim.leave_hours = 0;
  claim.leave_type = null;

  if (['연차', '반차', '오전반차', '오후반차'].includes(claim.근태코드)) {
    switch (claim.근태코드) {
      case '연차':
        claim.leave_hours = 8.0;
        claim.leave_type = 'annual';
        break;
      case '반차':
      case '오전반차':
      case '오후반차':
        claim.leave_hours = 4.0;
        claim.leave_type = 'half_day';
        break;
    }
    // 휴가 시 실제 근무시간 = 0
    claim.실제근무시간 = 0;
  }

  // 3. 실제 근무시간 재계산 (제외시간 반영)
  if (claim.leave_hours === 0) {
    const totalMinutes = (claim.종료시간 - claim.시작시간) / 60000;
    const breakMinutes = claim.제외시간 * 60; // 시간 → 분
    claim.실제근무시간 = Math.max(0, (totalMinutes - breakMinutes) / 60); // 분 → 시간
  }

  // 4. 직급 레벨 매핑
  claim.employee_level = mapGradeToLevel(claim.직급);

  return claim;
}
```

---

## 3. Timeline 구축 방법론

### 3.1 Timeline의 개념

Timeline은 한 직원의 하루 동안 발생한 모든 이벤트를 시간순으로 정렬한 시퀀스입니다.

**구조**:
```typescript
interface TimelineEntry {
  timestamp: Date;           // 이벤트 발생 시각
  eventType: EventType;      // TAG, KNOX, MEAL, EQUIPMENT
  eventSubtype?: string;     // 상세 유형
  location?: string;         // 장소 정보
  tagCode?: TagCode;         // 태그 코드 (O, T1, T2, T3, G1-G4, N1-N2, M1-M2 등)
  state: ActivityState;      // 활동 상태 (WORK, MEETING 등)
  duration: number;          // 지속 시간 (분)
  confidence: number;        // 추정 신뢰도 (0-1)
  assumption?: string;       // 추정 근거
  metadata?: any;            // 추가 정보
}
```

### 3.2 Timeline 구축 단계

#### 3.2.1 이벤트 수집

```typescript
async function buildTimeline(employeeId: string, date: string): Promise<TimelineEntry[]> {
  const timeline: TimelineEntry[] = [];

  // 1. Tag 이벤트 수집
  const tags = await db.all(`
    SELECT
      datetime(ENTE_DT || ' ' || printf('%06d', 출입시각)) as timestamp,
      DR_NO as location,
      DR_GB as tag_code,
      INOUT_GB as in_out
    FROM tag_data
    WHERE 사번 = ? AND ENTE_DT = ?
    ORDER BY 출입시각
  `, [employeeId, date.replace(/-/g, '')]);

  for (const tag of tags) {
    timeline.push({
      timestamp: new Date(tag.timestamp),
      eventType: 'TAG',
      eventSubtype: tag.in_out,
      location: tag.location,
      tagCode: tag.tag_code as TagCode,
      state: ActivityState.UNKNOWN, // 나중에 분류
      duration: 0,
      confidence: 0.8
    });
  }

  // 2. Knox 이벤트 수집
  const knoxApprovals = await db.all(`
    SELECT
      approval_timestamp as timestamp,
      document_type,
      approval_action
    FROM knox_approval_data
    WHERE employee_id = ? AND DATE(approval_timestamp) = ?
    ORDER BY approval_timestamp
  `, [employeeId, date]);

  for (const knox of knoxApprovals) {
    timeline.push({
      timestamp: new Date(knox.timestamp),
      eventType: 'KNOX',
      eventSubtype: 'APPROVAL',
      state: ActivityState.WORK, // Knox 이벤트 = 업무 중
      duration: 0,
      confidence: 0.9,
      metadata: { documentType: knox.document_type }
    });
  }

  // 3. Meal 이벤트 수집
  const meals = await db.all(`
    SELECT
      취식일시 as timestamp,
      식사구분 as meal_type,
      테이크아웃 as takeout,
      배식구 as serving_point
    FROM meal_data
    WHERE 사번 = ? AND DATE(취식일시) = ?
    ORDER BY 취식일시
  `, [employeeId, date]);

  for (const meal of meals) {
    // M1(구내식당 30분) vs M2(테이크아웃 10분) 판정
    const isTakeout = meal.takeout === 'Y' ||
                     (meal.serving_point && meal.serving_point.includes('테이크아웃'));

    timeline.push({
      timestamp: new Date(meal.timestamp),
      eventType: 'MEAL',
      tagCode: isTakeout ? TagCode.M2 : TagCode.M1,
      state: ActivityState.MEAL,
      duration: isTakeout ? 10 : 30, // M1: 30분, M2: 10분 (고정)
      confidence: 1.0 // 식사는 확실
    });
  }

  // 4. Equipment 이벤트 수집
  const equipment = await db.all(`
    SELECT timestamp, equipment_code, usage_type
    FROM (
      SELECT timestamp, equipment_code, usage_type FROM eam_data WHERE employee_id = ? AND DATE(timestamp) = ?
      UNION ALL
      SELECT timestamp, equipment_code, usage_type FROM equis_data WHERE employee_id = ? AND DATE(timestamp) = ?
      -- ... 다른 장비 테이블들
    )
    ORDER BY timestamp
  `, [employeeId, date, employeeId, date]);

  for (const equip of equipment) {
    timeline.push({
      timestamp: new Date(equip.timestamp),
      eventType: 'EQUIPMENT',
      eventSubtype: equip.usage_type,
      state: ActivityState.WORK,
      duration: 0,
      confidence: 0.95, // 장비 사용 = 업무 중 (높은 신뢰도)
      metadata: { equipmentCode: equip.equipment_code }
    });
  }

  // 5. 시간순 정렬
  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return timeline;
}
```

#### 3.2.2 활동 상태 초기 분류

```typescript
function classifyInitialStates(timeline: TimelineEntry[]): TimelineEntry[] {
  for (let i = 0; i < timeline.length; i++) {
    const entry = timeline[i];

    // 이미 분류된 경우 스킵
    if (entry.state !== ActivityState.UNKNOWN) continue;

    // Tag 이벤트 분류
    if (entry.eventType === 'TAG') {
      switch (entry.tagCode) {
        case TagCode.O:
          entry.state = ActivityState.WORK; // 장비 사용 = 업무
          break;
        case TagCode.T1:
          entry.state = ActivityState.TRANSIT; // 이동 (통로/계단)
          break;
        case TagCode.T2:
          entry.state = ActivityState.ENTRY; // 출근 (출입구-입)
          break;
        case TagCode.T3:
          entry.state = ActivityState.EXIT; // 퇴근 (출입구-출)
          break;
        case TagCode.G1:
          entry.state = ActivityState.WORK; // 주업무 공간
          break;
        case TagCode.G2:
          entry.state = ActivityState.PREPARATION; // 준비 공간
          break;
        case TagCode.G3:
          entry.state = ActivityState.MEETING; // 회의 공간
          break;
        case TagCode.G4:
          entry.state = ActivityState.EDUCATION; // 교육 공간
          break;
        case TagCode.N1:
        case TagCode.N2:
          entry.state = ActivityState.REST; // 휴게 공간, 복지시설
          break;
        case TagCode.M1:
        case TagCode.M2:
          entry.state = ActivityState.MEAL; // 식사 (이미 Meal 수집에서 처리됨)
          break;
        default:
          entry.state = ActivityState.PREPARATION; // 기타 → 업무 준비
      }
    }
  }

  return timeline;
}
```

#### 3.2.3 상태 간 전이 규칙 적용

상태 머신 방식으로 상태 간 전이를 처리합니다.

```typescript
function applyStateTransitions(timeline: TimelineEntry[]): TimelineEntry[] {
  for (let i = 1; i < timeline.length; i++) {
    const prev = timeline[i - 1];
    const curr = timeline[i];

    // 전이 규칙 1: MEAL 후 T1 → 식사 종료, 업무 복귀
    if (prev.state === ActivityState.MEAL && curr.tagCode === TagCode.T1) {
      curr.state = ActivityState.TRANSIT;
      curr.assumption = 'MEAL_RETURN';
    }

    // 전이 규칙 2: 긴 T1 공백 후 O → 업무 복귀
    const gap = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 60000; // 분
    if (prev.tagCode === TagCode.T1 && curr.tagCode === TagCode.O && gap > 30) {
      curr.assumption = 'T1_WORK_RETURN';
      curr.confidence = Math.min(0.9, 0.5 + (gap / 60) * 0.1); // 간격이 길수록 신뢰도 증가
    }

    // 전이 규칙 3: MEETING 종료 후 T1 → 회의 종료
    if (prev.state === ActivityState.MEETING && curr.tagCode === TagCode.T1) {
      curr.assumption = 'MEETING_END';
    }

    // 전이 규칙 4: 장시간 공백 (>2시간) → NON_WORK
    if (gap > 120) {
      // 이전 이벤트와 현재 이벤트 사이에 가상 NON_WORK 상태 삽입
      const nonWorkEntry: TimelineEntry = {
        timestamp: new Date(prev.timestamp.getTime() + 30 * 60 * 1000), // 30분 후
        eventType: 'INFERRED',
        state: ActivityState.NON_WORK,
        duration: gap - 30,
        confidence: 0.6,
        assumption: 'LONG_GAP'
      };
      timeline.splice(i, 0, nonWorkEntry);
      i++; // 삽입된 항목 스킵
    }
  }

  return timeline;
}
```

#### 3.2.4 지속 시간 계산

```typescript
function calculateDurations(timeline: TimelineEntry[]): TimelineEntry[] {
  for (let i = 0; i < timeline.length - 1; i++) {
    const curr = timeline[i];
    const next = timeline[i + 1];

    // 현재 상태의 지속 시간 = 다음 이벤트까지의 시간
    const durationMs = next.timestamp.getTime() - curr.timestamp.getTime();
    curr.duration = Math.floor(durationMs / 60000); // 분 단위

    // 최대 지속 시간 제한 (2시간)
    if (curr.duration > 120) {
      curr.duration = 120;
    }

    // 특정 상태는 고정 지속 시간
    if (curr.state === ActivityState.MEAL && curr.duration > 90) {
      curr.duration = 60; // 식사는 최대 1시간
    }
  }

  // 마지막 이벤트 처리
  if (timeline.length > 0) {
    const last = timeline[timeline.length - 1];
    if (last.state === ActivityState.EXIT) {
      last.duration = 0; // 퇴근 태그는 지속 시간 없음
    } else {
      last.duration = 30; // 기본 30분
    }
  }

  return timeline;
}
```

### 3.3 Timeline 예시

**원시 데이터**:
```
08:30 - TAG - T2 (출입구-입) - 출근
09:00 - TAG - O (장비) - 업무 시작
10:15 - KNOX - Approval - 결재
12:00 - MEAL - M1 (식당 내) - 점심 30분
13:00 - TAG - T1 (복도) - 이동
14:30 - TAG - O (장비) - 업무
16:00 - TAG - G3 (회의실) - 회의
17:30 - TAG - T1 (복도) - 이동
18:00 - TAG - T3 (출입구-출) - 퇴근
```

**구축된 Timeline**:
```typescript
[
  { timestamp: '08:30', state: ENTRY, duration: 30, confidence: 1.0, tagCode: 'T2' },
  { timestamp: '09:00', state: WORK, duration: 75, confidence: 0.9, tagCode: 'O' },
  { timestamp: '10:15', state: WORK, duration: 105, confidence: 0.95, eventType: 'KNOX' },
  { timestamp: '12:00', state: MEAL, duration: 30, confidence: 1.0, tagCode: 'M1' },
  { timestamp: '12:30', state: TRANSIT, duration: 120, confidence: 0.7, assumption: 'MEAL_RETURN' },
  { timestamp: '14:30', state: WORK, duration: 90, confidence: 0.9, tagCode: 'O' },
  { timestamp: '16:00', state: MEETING, duration: 90, confidence: 0.9, tagCode: 'G3' },
  { timestamp: '17:30', state: TRANSIT, duration: 30, confidence: 0.8, tagCode: 'T1' },
  { timestamp: '18:00', state: EXIT, duration: 0, confidence: 1.0, tagCode: 'T3' }
]
```

---

## 4. 활동 상태 분류

### 4.1 ActivityState 정의

```typescript
enum ActivityState {
  WORK = 'WORK',                    // 일반 업무
  FOCUSED_WORK = 'FOCUSED_WORK',    // 집중 업무 (O 태그 밀집)
  MEETING = 'MEETING',              // 회의 (G3 태그)
  EDUCATION = 'EDUCATION',          // 교육/훈련 (G4 태그)
  MEAL = 'MEAL',                    // 식사
  REST = 'REST',                    // 휴식 (의도적 휴식)
  NON_WORK = 'NON_WORK',           // 비업무 (자리 비움)
  TRANSIT = 'TRANSIT',              // 이동 (T1 태그)
  ENTRY = 'ENTRY',                  // 출근
  EXIT = 'EXIT',                    // 퇴근
  PREPARATION = 'PREPARATION',      // 업무 준비
  UNKNOWN = 'UNKNOWN'               // 미분류 (초기값)
}
```

### 4.2 상태 분류 규칙

#### 4.2.1 WORK (일반 업무)
**조건**:
- O 태그 (장비 사용)
- Knox 이벤트 (결재, 메일)
- Equipment 이벤트 (장비 사용 로그)

**신뢰도**: 0.8-0.95 (데이터 소스에 따라)

**예시**:
- 연구원이 실험 장비 태그
- 엔지니어가 EAM 시스템에서 작업 기록
- 사무직이 Knox에서 결재 수행

#### 4.2.2 FOCUSED_WORK (집중 업무)
**조건**:
- 1시간 내 O 태그 2개 이상 (Enhanced Mode)
- 또는 1시간 내 O 태그 1개 이상 (Legacy Mode)

**신뢰도**: 0.85-0.95

**의미**: 단순 업무가 아닌, 장비를 반복적으로 사용하는 집중도 높은 업무

**예시**:
- 연구원이 실험을 반복 수행
- 제조직이 설비를 지속적으로 조작
- QC 직원이 측정 장비를 반복 사용

#### 4.2.3 MEETING (회의)
**조건**:
- G3 태그 (회의실 출입)
- Knox PIMS에서 회의 이벤트

**신뢰도**: 0.9

**지속 시간**: 보통 60-90분

**예시**:
- 팀 회의
- 프로젝트 리뷰
- 외부 미팅

#### 4.2.4 EDUCATION (교육)
**조건**:
- G4 태그 (교육실 출입)

**신뢰도**: 0.95

**지속 시간**: 보통 120-240분

**예시**:
- 신입사원 교육
- 안전 교육
- 직무 교육

#### 4.2.5 MEAL (식사)
**조건**:
- Meal 데이터
- 또는 시간대 기반 추정 (12:00-13:00, 18:00-19:00)

**신뢰도**:
- Meal 데이터 있음: 1.0
- 시간대 추정: 0.7

**지속 시간**:
- 점심: 60분
- 저녁: 45분
- 아침: 30분

#### 4.2.6 REST (휴식)
**조건**:
- 명시적 휴게 공간 태그
- 또는 짧은 공백 (15-30분) 후 업무 복귀

**신뢰도**: 0.6-0.7 (추정)

**지속 시간**: 15-30분

#### 4.2.7 NON_WORK (비업무)
**조건**:
- 장시간 공백 (>2시간)
- 또는 T1 태그만 지속 (>1시간)

**신뢰도**: 0.5-0.7 (추정)

**의미**: 외출, 개인 업무, 자리 비움 등

#### 4.2.8 TRANSIT (이동)
**조건**:
- T1 태그 (복도, 통로)

**신뢰도**: 0.8

**의미**: 사무실 내 이동 (업무 이동 vs 비업무 이동 구분 필요)

#### 4.2.9 ENTRY / EXIT (출퇴근)
**조건**:
- T2 태그 (출입구-입) - 하루 첫 태그 또는 출근 시간대
- T3 태그 (출입구-출) - 하루 마지막 태그 또는 퇴근 시간대

**신뢰도**: 1.0

**지속 시간**: ENTRY는 15-30분, EXIT는 0분 (시점 이벤트)

#### 4.2.10 PREPARATION (업무 준비)
**조건**:
- 출근 후 ~ 첫 O 태그 사이
- 퇴근 전 정리 시간

**신뢰도**: 0.6

**지속 시간**: 15-30분

### 4.3 상태 전이 다이어그램

```
[출근 ENTRY]
    ↓
[업무 준비 PREPARATION] (15-30분)
    ↓
[일반 업무 WORK] ←→ [집중 업무 FOCUSED_WORK]
    ↓ ↑
[회의 MEETING] ──┤
    ↓ ↑          ├── [이동 TRANSIT]
[교육 EDUCATION] ─┤
    ↓ ↑
[식사 MEAL]
    ↓
[휴식 REST] / [비업무 NON_WORK]
    ↓
[업무 복귀 WORK]
    ↓
[퇴근 준비 PREPARATION]
    ↓
[퇴근 EXIT]
```

---

## 5. 근무시간 계산 알고리즘

### 5.1 기본 지표 계산

```typescript
function calculateBasicMetrics(timeline: TimelineEntry[]): WorkMetrics {
  const metrics: WorkMetrics = {
    totalTime: 0,        // 총 체류시간
    workTime: 0,         // 실제 근무시간
    meetingTime: 0,      // 회의시간
    mealTime: 0,         // 식사시간
    transitTime: 0,      // 이동시간
    restTime: 0,         // 휴식시간
    estimatedWorkTime: 0 // 추정 근무시간
  };

  // 1. 총 체류시간 = 출근 ~ 퇴근
  if (timeline.length >= 2) {
    const firstTime = timeline[0].timestamp.getTime();
    const lastTime = timeline[timeline.length - 1].timestamp.getTime();
    metrics.totalTime = (lastTime - firstTime) / 60000; // 분 단위
  }

  // 2. 활동별 시간 집계
  for (const entry of timeline) {
    const duration = entry.duration || 0;

    switch (entry.state) {
      case ActivityState.WORK:
      case ActivityState.PREPARATION:
        metrics.workTime += duration;
        break;

      case ActivityState.FOCUSED_WORK:
        metrics.workTime += duration;
        // focusTime은 별도 계산
        break;

      case ActivityState.MEETING:
        metrics.meetingTime += duration;
        metrics.workTime += duration; // 회의도 근무에 포함
        break;

      case ActivityState.EDUCATION:
        metrics.workTime += duration; // 교육도 근무에 포함
        break;

      case ActivityState.MEAL:
        metrics.mealTime += duration;
        break;

      case ActivityState.TRANSIT:
        metrics.transitTime += duration;
        // 이동은 근무에 포함하지 않음
        break;

      case ActivityState.REST:
      case ActivityState.NON_WORK:
        metrics.restTime += duration;
        break;
    }

    // 3. 추정 근무시간 (T1 기반)
    if (entry.assumption === 'T1_WORK_RETURN') {
      metrics.estimatedWorkTime += duration * (entry.confidence || 0.5);
    }
  }

  return metrics;
}
```

### 5.2 효율성 비율 계산

```typescript
function calculateEfficiencyRatio(metrics: WorkMetrics): number {
  if (metrics.totalTime === 0) return 0;

  // 효율성 = (실제 근무시간 / 총 체류시간) * 100
  const ratio = (metrics.workTime / metrics.totalTime) * 100;

  // 100%를 초과할 수 없음
  return Math.min(100, Math.round(ratio));
}
```

**해석**:
- **90% 이상**: 매우 효율적 (집중 근무)
- **80-90%**: 효율적 (일반적 근무)
- **70-80%**: 보통 (휴식 시간 적절)
- **70% 미만**: 낮음 (비업무 시간 많음 또는 데이터 부족)

### 5.3 작업추정률 계산

```typescript
function calculateWorkEstimationRate(actualWorkHours: number, claimedWorkHours: number): number {
  if (claimedWorkHours === 0) return 0;

  // 작업추정률 = (실제 근무시간 / 신고 근무시간) * 100
  const rate = (actualWorkHours / claimedWorkHours) * 100;

  return Math.round(rate);
}
```

**해석**:
- **100% 이상**: 신고 이상으로 근무 (초과 근무)
- **90-100%**: 신고와 일치 (정상)
- **80-90%**: 약간 적음 (허용 범위)
- **80% 미만**: 신고 대비 실제 근무 적음 (데이터 부족 또는 비효율)

---

## 6. 집중 업무시간 분석

### 6.1 집중 업무의 정의

**집중 업무 (Focused Work)**는 다음 조건을 만족하는 업무 시간입니다:
- 장비/설비를 반복적으로 사용 (O 태그 밀집)
- 회의 또는 교육 참여 (G3, G4 태그)
- 중단 없이 지속적으로 수행

### 6.2 집중 업무시간 계산 알고리즘 (Enhanced Mode)

```typescript
function calculateFocusTime(timeline: TimelineEntry[]): number {
  let focusTime = 0;
  const hourWindows: Map<number, TimelineEntry[]> = new Map();

  // 1. 이벤트를 1시간 단위 윈도우로 그룹화
  for (const entry of timeline) {
    const hour = Math.floor(entry.timestamp.getTime() / (60 * 60 * 1000));
    if (!hourWindows.has(hour)) {
      hourWindows.set(hour, []);
    }
    hourWindows.get(hour)!.push(entry);
  }

  // 2. 각 시간 윈도우 분석
  for (const [hour, entries] of hourWindows) {
    const oTags = entries.filter(e => e.tagCode === TagCode.O);
    const g3Tags = entries.filter(e => e.tagCode === TagCode.G3);
    const g4Tags = entries.filter(e => e.tagCode === TagCode.G4);

    // 2.1. G3 (회의) 시간은 무조건 집중 업무
    if (g3Tags.length > 0) {
      focusTime += g3Tags.reduce((sum, e) => sum + (e.duration || 0), 0);
    }

    // 2.2. G4 (교육) 시간도 무조건 집중 업무
    if (g4Tags.length > 0) {
      focusTime += g4Tags.reduce((sum, e) => sum + (e.duration || 0), 0);
    }

    // 2.3. O 태그 밀집도 검사 (2개 이상 = 집중 업무)
    if (oTags.length >= 2) {
      // 해당 시간의 WORK 상태 시간을 모두 집중 업무로 간주
      const workEntries = entries.filter(e =>
        e.state === ActivityState.WORK ||
        e.state === ActivityState.PREPARATION
      );
      focusTime += workEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
    }
  }

  return focusTime;
}
```

**임계값 변경 이력**:
- 초기: 1시간당 O 태그 3개 이상
- 현재: 1시간당 O 태그 2개 이상 (더 포괄적)

**근거**: 실제 데이터 분석 결과, 제조/연구직도 시간당 2-3회 태깅이 일반적이므로 임계값을 낮춤

### 6.3 집중 업무시간 계산 알고리즘 (Legacy Mode)

```typescript
function calculateLegacyFocusTime(timeline: TimelineEntry[]): number {
  let focusTime = 0;
  const hourWindows: Map<number, TimelineEntry[]> = new Map();

  // 1. 시간별 그룹화 (동일)
  for (const entry of timeline) {
    const hour = Math.floor(entry.timestamp.getTime() / (60 * 60 * 1000));
    if (!hourWindows.has(hour)) {
      hourWindows.set(hour, []);
    }
    hourWindows.get(hour)!.push(entry);
  }

  // 2. 각 시간 윈도우 분석 (Legacy 모드는 더 관대한 기준)
  for (const [hour, entries] of hourWindows) {
    const oTags = entries.filter(e => e.tagCode === TagCode.O);
    const g3Tags = entries.filter(e => e.tagCode === TagCode.G3);
    const g4Tags = entries.filter(e => e.tagCode === TagCode.G4);

    // 2.1. G3 (회의) - 고정 시간 추정
    if (g3Tags.length > 0) {
      focusTime += g3Tags.length * 45; // 회의당 45분
    }

    // 2.2. G4 (교육) - 고정 시간 추정
    if (g4Tags.length > 0) {
      focusTime += g4Tags.length * 60; // 교육당 60분
    }

    // 2.3. O 태그 - 1개 이상이면 집중 업무 가능성 있음 (Legacy는 더 관대)
    if (oTags.length >= 1) {
      const estimatedMinutes = Math.min(oTags.length * 20, 60); // 최대 1시간
      focusTime += estimatedMinutes;
    }
  }

  return focusTime;
}
```

**Legacy Mode 특징**:
- O 태그 1개만 있어도 집중 업무로 간주 (더 관대)
- G3, G4는 고정 시간 추정 (duration 데이터 없음)
- 최대 제한: 시간당 60분

### 6.4 집중 업무 비율

```typescript
function calculateFocusRatio(focusTime: number, workTime: number): number {
  if (workTime === 0) return 0;

  // 집중 업무 비율 = (집중 업무시간 / 전체 근무시간) * 100
  const ratio = (focusTime / workTime) * 100;

  return Math.min(100, Math.round(ratio));
}
```

**해석**:
- **80% 이상**: 고집중 직무 (연구, 실험, 제조)
- **60-80%**: 중집중 직무 (개발, 설계, 분석)
- **40-60%**: 혼합 직무 (관리, 기획)
- **40% 미만**: 저집중 직무 (영업, 지원)

---

## 7. Ground Rules 분석

### 7.1 Ground Rules의 개념

**Ground Rules**는 T1 태그 (이동 태그) 패턴을 분석하여 근무 중/비근무 중을 추정하는 규칙 기반 시스템입니다.

**핵심 가정**:
1. **업무 중에는 사무실 내 이동이 빈번함** (회의, 협업, 자료 수집 등)
2. **자리를 비우거나 외출 시에는 이동이 없음**
3. **T1 태그 빈도가 근무 여부의 지표**

### 7.2 Ground Rules 알고리즘

#### 7.2.1 T1 밀도 계산

```typescript
function calculateT1Density(timeline: TimelineEntry[]): T1DensityAnalysis {
  const WINDOW_SIZE = 30; // 30분 윈도우
  const windows: T1Window[] = [];

  // 1. 30분 단위 윈도우 생성
  if (timeline.length === 0) return { windows: [], overallDensity: 0 };

  const startTime = timeline[0].timestamp.getTime();
  const endTime = timeline[timeline.length - 1].timestamp.getTime();
  const totalMinutes = (endTime - startTime) / 60000;
  const windowCount = Math.ceil(totalMinutes / WINDOW_SIZE);

  for (let i = 0; i < windowCount; i++) {
    const windowStart = startTime + (i * WINDOW_SIZE * 60 * 1000);
    const windowEnd = windowStart + (WINDOW_SIZE * 60 * 1000);

    // 2. 윈도우 내 T1 태그 개수
    const t1Count = timeline.filter(e =>
      e.tagCode === TagCode.T1 &&
      e.timestamp.getTime() >= windowStart &&
      e.timestamp.getTime() < windowEnd
    ).length;

    windows.push({
      startTime: new Date(windowStart),
      endTime: new Date(windowEnd),
      t1Count: t1Count,
      density: t1Count / WINDOW_SIZE // 분당 T1 개수
    });
  }

  // 3. 전체 밀도
  const totalT1 = windows.reduce((sum, w) => sum + w.t1Count, 0);
  const overallDensity = totalT1 / totalMinutes;

  return { windows, overallDensity };
}
```

#### 7.2.2 근무 구간 판정

```typescript
function determineWorkPeriods(t1Analysis: T1DensityAnalysis): WorkPeriod[] {
  const T1_THRESHOLD = 3; // 30분당 3개 = 근무 중
  const workPeriods: WorkPeriod[] = [];

  let currentPeriod: WorkPeriod | null = null;

  for (const window of t1Analysis.windows) {
    const isWorking = window.t1Count >= T1_THRESHOLD;

    if (isWorking) {
      if (!currentPeriod) {
        // 새로운 근무 구간 시작
        currentPeriod = {
          startTime: window.startTime,
          endTime: window.endTime,
          confidence: 0.7,
          t1Count: window.t1Count
        };
      } else {
        // 기존 근무 구간 연장
        currentPeriod.endTime = window.endTime;
        currentPeriod.t1Count += window.t1Count;
        // 신뢰도 증가 (T1이 많을수록)
        currentPeriod.confidence = Math.min(0.95, 0.7 + (currentPeriod.t1Count / 50));
      }
    } else {
      if (currentPeriod) {
        // 근무 구간 종료
        workPeriods.push(currentPeriod);
        currentPeriod = null;
      }
    }
  }

  // 마지막 구간 처리
  if (currentPeriod) {
    workPeriods.push(currentPeriod);
  }

  return workPeriods;
}
```

#### 7.2.3 Ground Rules 근무시간 계산

```typescript
function applyGroundRules(
  timeline: TimelineEntry[],
  baseMetrics: WorkMetrics
): GroundRulesMetrics {
  // 1. T1 밀도 분석
  const t1Analysis = calculateT1Density(timeline);

  // 2. 근무 구간 판정
  const workPeriods = determineWorkPeriods(t1Analysis);

  // 3. Ground Rules 근무시간 계산
  let groundRulesWorkMinutes = 0;
  let totalConfidence = 0;

  for (const period of workPeriods) {
    const durationMinutes = (period.endTime.getTime() - period.startTime.getTime()) / 60000;
    groundRulesWorkMinutes += durationMinutes;
    totalConfidence += period.confidence * durationMinutes;
  }

  const avgConfidence = groundRulesWorkMinutes > 0
    ? totalConfidence / groundRulesWorkMinutes
    : 0;

  // 4. 기존 workTime과 비교하여 조정
  // Ground Rules는 보정 역할 (기존 값을 완전히 대체하지 않음)
  let adjustedWorkTime = baseMetrics.workTime;

  // 4.1. Ground Rules가 기존보다 훨씬 적으면 → 자리 비움 가능성
  if (groundRulesWorkMinutes < baseMetrics.workTime * 0.7) {
    // 기존 workTime의 70-100% 범위로 조정 (Ground Rules 신뢰도에 따라)
    adjustedWorkTime = baseMetrics.workTime * (0.7 + avgConfidence * 0.3);
  }

  // 4.2. Ground Rules가 기존보다 많으면 → T1 이동도 업무로 간주
  if (groundRulesWorkMinutes > baseMetrics.workTime * 1.2) {
    // T1 이동 시간의 일부를 업무에 추가 (최대 20%)
    const t1Minutes = timeline
      .filter(e => e.tagCode === TagCode.T1)
      .reduce((sum, e) => sum + (e.duration || 0), 0);
    adjustedWorkTime = baseMetrics.workTime + (t1Minutes * 0.2);
  }

  return {
    groundRulesWorkHours: groundRulesWorkMinutes / 60,
    groundRulesConfidence: Math.round(avgConfidence * 100),
    adjustedWorkHours: adjustedWorkTime / 60,
    t1TotalCount: timeline.filter(e => e.tagCode === TagCode.T1).length,
    t1Density: t1Analysis.overallDensity,
    workPeriodCount: workPeriods.length
  };
}
```

### 7.3 Ground Rules 적용 예시

**시나리오 1: 연구원 (데이터 풍부)**
```
Tag 데이터:
- O 태그: 15개 (장비 사용)
- T1 태그: 25개 (복도 이동)
- G3 태그: 2개 (회의)

분석 결과:
- 기본 workTime: 420분 (7시간)
- T1 밀도: 0.05 (분당 0.05개 = 30분당 1.5개)
- Ground Rules workTime: 480분 (8시간) ← T1 빈도 높음
- Ground Rules Confidence: 85점
- 최종 조정: 450분 (7.5시간) ← 기본값 + Ground Rules 보정
```

**시나리오 2: 영업직 (데이터 부족)**
```
Tag 데이터:
- O 태그: 2개 (간헐적)
- T1 태그: 5개 (이동 적음)
- G3 태그: 0개

분석 결과:
- 기본 workTime: 360분 (6시간)
- T1 밀도: 0.01 (분당 0.01개 = 30분당 0.3개)
- Ground Rules workTime: 180분 (3시간) ← T1 빈도 낮음
- Ground Rules Confidence: 45점
- 최종 조정: 300분 (5시간) ← 기본값의 70% 수준으로 감소
→ 해석: 외근이 많아 사무실 체류 시간 짧음
```

### 7.4 Ground Rules 검증

**검증 방법**:
1. **Claim 데이터와 비교**: Ground Rules 추정 vs 신고 근무시간
2. **팀별 패턴 분석**: 동일 팀 내 Ground Rules 일관성
3. **T1 밀도 분포**: 직무별 T1 밀도 벤치마크

**검증 스크립트**: `scripts/validate-ground-rules.ts`

```typescript
async function validateGroundRules() {
  const results = await db.all(`
    SELECT
      employee_id,
      analysis_date,
      actual_work_hours,
      claimed_work_hours,
      ground_rules_work_hours,
      ground_rules_confidence,
      ABS(ground_rules_work_hours - claimed_work_hours) as diff
    FROM daily_analysis_results
    WHERE ground_rules_work_hours IS NOT NULL
      AND claimed_work_hours > 0
    ORDER BY diff DESC
    LIMIT 100
  `);

  const avgDiff = results.reduce((sum, r) => sum + r.diff, 0) / results.length;
  const accuracy = results.filter(r => r.diff < 1.0).length / results.length * 100;

  console.log(`Ground Rules 검증 결과:`);
  console.log(`  평균 오차: ${avgDiff.toFixed(2)}시간`);
  console.log(`  정확도 (±1시간): ${accuracy.toFixed(1)}%`);
}
```

**허용 기준**:
- 평균 오차: ±1.5시간 이내
- 정확도 (±1시간): 70% 이상

---

## 8. 신뢰도 점수 계산

### 8.1 신뢰도 점수의 의미

**신뢰도 점수 (Reliability Score)**는 분석 결과의 데이터 품질과 정확도를 0-100점으로 나타냅니다.

**점수 구간**:
- **90-100점**: 매우 신뢰 (데이터 풍부, 패턴 명확)
- **70-90점**: 신뢰 (데이터 충분, 일부 추정 포함)
- **50-70점**: 보통 (데이터 부족, 추정 많음)
- **50점 미만**: 낮음 (데이터 매우 부족, 결과 참고용)

### 8.2 신뢰도 계산 알고리즘 (Enhanced Mode)

```typescript
function calculateReliability(timeline: TimelineEntry[]): number {
  let score = 50; // 기본 점수

  const oTagCount = timeline.filter(e => e.tagCode === TagCode.O).length;
  const totalEvents = timeline.length;

  if (totalEvents === 0) return 0;

  // 1. O 태그 커버리지 (최대 +30점)
  const oTagRatio = oTagCount / totalEvents;
  score += Math.min(oTagRatio * 100, 30);
  // 해석: O 태그가 많을수록 업무 활동이 명확함

  // 2. 이벤트 빈도 (최대 +20점)
  const timeSpan = timeline[timeline.length - 1].timestamp.getTime() -
                   timeline[0].timestamp.getTime();
  const eventsPerHour = (totalEvents / timeSpan) * 3600000;

  if (eventsPerHour > 5) score += 20;      // 시간당 5개 이상 = 매우 활발
  else if (eventsPerHour > 3) score += 15; // 시간당 3-5개 = 활발
  else if (eventsPerHour > 1) score += 10; // 시간당 1-3개 = 보통
  else score += 5;                         // 시간당 1개 미만 = 부족

  // 3. 불확실 이벤트 페널티 (최대 -20점)
  const uncertainEvents = timeline.filter(e => e.assumption === 'T1_UNCERTAIN').length;
  const uncertainRatio = uncertainEvents / totalEvents;
  score -= uncertainRatio * 20;
  // 해석: 추정 기반 이벤트가 많으면 신뢰도 감소

  // 4. 긴 공백 페널티 (-10점)
  let maxGap = 0;
  for (let i = 1; i < timeline.length; i++) {
    const gap = timeline[i].timestamp.getTime() - timeline[i-1].timestamp.getTime();
    maxGap = Math.max(maxGap, gap);
  }
  if (maxGap > 2 * 60 * 60 * 1000) score -= 10; // 2시간 이상 공백
  // 해석: 긴 공백은 데이터 누락 또는 자리 비움

  // 5. 범위 제한
  return Math.max(0, Math.min(100, Math.round(score)));
}
```

### 8.3 신뢰도 계산 알고리즘 (Legacy Mode)

```typescript
function calculateLegacyReliability(timeline: TimelineEntry[]): number {
  let score = 40; // 낮은 기본 점수 (데이터 제한)

  const oTagCount = timeline.filter(e => e.tagCode === TagCode.O).length;
  const totalEvents = timeline.length;

  if (totalEvents === 0) return 0;

  // 1. O 태그 커버리지 (최대 +25점, 감소됨)
  const oTagRatio = oTagCount / totalEvents;
  score += Math.min(oTagRatio * 80, 25);

  // 2. 이벤트 빈도 (최대 +15점, 감소됨)
  const timeSpan = timeline[timeline.length - 1].timestamp.getTime() -
                   timeline[0].timestamp.getTime();
  const eventsPerHour = (totalEvents / timeSpan) * 3600000;

  if (eventsPerHour > 3) score += 15;      // 완화된 기준
  else if (eventsPerHour > 2) score += 12;
  else if (eventsPerHour > 1) score += 8;
  else score += 3;

  // 3. 보너스: G3, G4 태그 존재 (각 +5점)
  const hasG3 = timeline.some(e => e.tagCode === TagCode.G3);
  const hasG4 = timeline.some(e => e.tagCode === TagCode.G4);
  if (hasG3) score += 5;
  if (hasG4) score += 5;

  // 4. 불확실 이벤트 페널티 (최대 -15점, 완화됨)
  const uncertainEvents = timeline.filter(e => e.assumption === 'T1_UNCERTAIN').length;
  const uncertainRatio = uncertainEvents / totalEvents;
  score -= uncertainRatio * 15;

  // 5. 긴 공백 페널티 (-8점, 완화됨)
  let maxGap = 0;
  for (let i = 1; i < timeline.length; i++) {
    const gap = timeline[i].timestamp.getTime() - timeline[i-1].timestamp.getTime();
    maxGap = Math.max(maxGap, gap);
  }
  if (maxGap > 3 * 60 * 60 * 1000) score -= 8; // 3시간 이상 공백 (완화됨)

  return Math.max(0, Math.min(100, Math.round(score)));
}
```

### 8.4 신뢰도 점수 활용

#### 8.4.1 UI 표시
```typescript
function getReliabilityBadge(score: number): BadgeProps {
  if (score >= 90) return { color: 'green', label: '매우 신뢰' };
  if (score >= 70) return { color: 'blue', label: '신뢰' };
  if (score >= 50) return { color: 'yellow', label: '보통' };
  return { color: 'red', label: '낮음' };
}
```

#### 8.4.2 데이터 필터링
```typescript
// 신뢰도 50점 이상만 집계에 포함
const reliableData = await db.all(`
  SELECT *
  FROM daily_analysis_results
  WHERE confidence_score >= 50
    AND analysis_date BETWEEN ? AND ?
`);
```

#### 8.4.3 경고 표시
```typescript
if (metrics.reliabilityScore < 50) {
  console.warn(`낮은 신뢰도 (${metrics.reliabilityScore}점): ` +
               `데이터 부족으로 결과가 부정확할 수 있습니다.`);
}
```

---

## 9. 조직 분석 방법론

### 9.1 계층적 집계

#### 9.1.1 집계 순서
```
개인 (daily_analysis_results)
    ↓
그룹 (v_group_daily_summary)
    ↓
팀 (v_team_daily_summary)
    ↓
담당 (v_division_daily_summary) - optional
    ↓
센터 (v_center_daily_summary)
    ↓
전사 (overall summary)
```

#### 9.1.2 그룹별 집계 쿼리

```sql
CREATE VIEW v_group_daily_summary AS
SELECT
  g.org_code as group_code,
  g.org_name as group_name,
  d.analysis_date as work_date,

  -- 인원 통계
  COUNT(DISTINCT d.employee_id) as employee_count,

  -- 근무시간 통계
  AVG(d.actual_work_hours) as avg_actual_work_hours,
  AVG(d.claimed_work_hours) as avg_claimed_work_hours,
  AVG(d.efficiency_ratio) as avg_efficiency_ratio,

  -- 활동별 시간
  AVG(d.work_minutes) / 60.0 as avg_work_hours,
  AVG(d.meeting_minutes) / 60.0 as avg_meeting_hours,
  AVG(d.meal_minutes) / 60.0 as avg_meal_hours,
  AVG(d.focused_work_minutes) / 60.0 as avg_focus_hours,

  -- Ground Rules
  AVG(d.ground_rules_work_hours) as avg_ground_rules_work_hours,
  AVG(d.ground_rules_confidence) as avg_ground_rules_confidence,

  -- 신뢰도
  AVG(d.confidence_score) as avg_confidence_score,

  -- 직급별 분포
  SUM(CASE WHEN d.job_grade = 'Lv.1' THEN 1 ELSE 0 END) as lv1_count,
  SUM(CASE WHEN d.job_grade = 'Lv.2' THEN 1 ELSE 0 END) as lv2_count,
  SUM(CASE WHEN d.job_grade = 'Lv.3' THEN 1 ELSE 0 END) as lv3_count,
  SUM(CASE WHEN d.job_grade = 'Lv.4' THEN 1 ELSE 0 END) as lv4_count

FROM daily_analysis_results d
LEFT JOIN organization_master g ON d.group_id = g.org_code
WHERE g.org_level = 'group'
GROUP BY g.org_code, g.org_name, d.analysis_date;
```

#### 9.1.3 팀별 집계 쿼리

팀별 집계는 그룹 데이터를 한 번 더 집계합니다.

```sql
CREATE VIEW v_team_daily_summary AS
SELECT
  t.org_code as team_code,
  t.org_name as team_name,
  d.analysis_date as work_date,

  -- 그룹 수
  COUNT(DISTINCT d.group_id) as group_count,

  -- 인원 통계
  SUM(d.employee_count) as total_employees,

  -- 근무시간 통계 (가중 평균)
  SUM(d.avg_actual_work_hours * d.employee_count) / NULLIF(SUM(d.employee_count), 0) as avg_actual_work_hours,
  SUM(d.avg_efficiency_ratio * d.employee_count) / NULLIF(SUM(d.employee_count), 0) as avg_efficiency_ratio,

  -- 활동별 시간 (가중 평균)
  SUM(d.avg_work_hours * d.employee_count) / NULLIF(SUM(d.employee_count), 0) as avg_work_hours,
  SUM(d.avg_meeting_hours * d.employee_count) / NULLIF(SUM(d.employee_count), 0) as avg_meeting_hours,
  SUM(d.avg_focus_hours * d.employee_count) / NULLIF(SUM(d.employee_count), 0) as avg_focus_hours,

  -- Ground Rules (가중 평균)
  SUM(d.avg_ground_rules_work_hours * d.employee_count) / NULLIF(SUM(d.employee_count), 0) as avg_ground_rules_work_hours,
  SUM(d.avg_ground_rules_confidence * d.employee_count) / NULLIF(SUM(d.employee_count), 0) as avg_ground_rules_confidence,

  -- 신뢰도 (가중 평균)
  SUM(d.avg_confidence_score * d.employee_count) / NULLIF(SUM(d.employee_count), 0) as avg_confidence_score,

  -- 직급별 합계
  SUM(d.lv1_count) as total_lv1,
  SUM(d.lv2_count) as total_lv2,
  SUM(d.lv3_count) as total_lv3,
  SUM(d.lv4_count) as total_lv4

FROM v_group_daily_summary d
LEFT JOIN organization_master t ON d.group_code LIKE t.org_code || '%'
WHERE t.org_level = 'team'
GROUP BY t.org_code, t.org_name, d.work_date;
```

**중요**: 가중 평균 사용 (단순 평균 아님)
- 인원이 많은 그룹의 영향을 더 크게 반영
- 예: 10명 그룹의 80% 효율성 > 2명 그룹의 50% 효율성

### 9.2 배치 분석 (Worker 방식)

#### 9.2.1 배치 분석 구조

```typescript
class OrganizationBatchAnalyzer {
  async analyzeOrganization(
    orgCode: string,
    startDate: string,
    endDate: string
  ): Promise<BatchAnalysisResult> {

    // 1. 대상 직원 목록 조회
    const employees = await this.getEmployeeList(orgCode);

    // 2. 날짜 범위 생성
    const dates = this.generateDateRange(startDate, endDate);

    // 3. 전체 작업 계획
    const totalTasks = employees.length * dates.length;
    console.log(`총 ${totalTasks}개 작업 (직원 ${employees.length}명 × 날짜 ${dates.length}일)`);

    // 4. 배치 처리 (10명씩)
    const BATCH_SIZE = 10;
    let completedTasks = 0;

    for (let i = 0; i < employees.length; i += BATCH_SIZE) {
      const batch = employees.slice(i, i + BATCH_SIZE);

      // 병렬 처리
      const promises = batch.flatMap(emp =>
        dates.map(date => this.analyzeEmployeeDate(emp.employee_id, date))
      );

      const results = await Promise.allSettled(promises);

      // 결과 저장
      for (const result of results) {
        if (result.status === 'fulfilled') {
          await this.saveResult(result.value);
        } else {
          console.error('분석 실패:', result.reason);
        }
      }

      // 진행률 업데이트
      completedTasks += batch.length * dates.length;
      const progress = (completedTasks / totalTasks) * 100;
      await this.updateProgress(orgCode, progress);

      console.log(`진행률: ${progress.toFixed(1)}% (${completedTasks}/${totalTasks})`);
    }

    // 5. 집계
    await this.aggregateResults(orgCode, startDate, endDate);

    return {
      orgCode,
      startDate,
      endDate,
      totalEmployees: employees.length,
      totalDays: dates.length,
      completedTasks,
      failedTasks: totalTasks - completedTasks
    };
  }

  private async analyzeEmployeeDate(
    employeeId: string,
    date: string
  ): Promise<AnalysisResult> {
    // 1. Timeline 구축
    const timeline = await buildTimeline(employeeId, date);

    // 2. 분석 수행
    const calculator = new WorkHourCalculator('enhanced');
    const metrics = calculator.calculateMetrics(timeline);

    // 3. Ground Rules 적용
    const groundRules = applyGroundRules(timeline, metrics);

    return {
      employeeId,
      date,
      metrics,
      groundRules,
      timeline: timeline.length
    };
  }
}
```

#### 9.2.2 체크포인트 시스템

배치 작업이 중단되어도 재개할 수 있도록 체크포인트를 저장합니다.

```typescript
async saveCheckpoint(
  jobId: string,
  processedEmployees: string[],
  lastDate: string
): Promise<void> {
  const checkpoint = {
    jobId,
    processedEmployees,
    lastProcessedDate: lastDate,
    timestamp: new Date().toISOString()
  };

  await db.run(`
    INSERT OR REPLACE INTO batch_job_checkpoints
    (job_id, checkpoint_data, created_at)
    VALUES (?, ?, ?)
  `, [jobId, JSON.stringify(checkpoint), new Date()]);
}

async resumeJob(jobId: string): Promise<void> {
  // 체크포인트 로드
  const checkpoint = await db.get(`
    SELECT checkpoint_data
    FROM batch_job_checkpoints
    WHERE job_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `, [jobId]);

  if (!checkpoint) {
    throw new Error('체크포인트를 찾을 수 없습니다');
  }

  const data = JSON.parse(checkpoint.checkpoint_data);

  // 남은 작업 조회
  const allEmployees = await this.getEmployeeList(data.orgCode);
  const remainingEmployees = allEmployees.filter(
    emp => !data.processedEmployees.includes(emp.employee_id)
  );

  console.log(`체크포인트에서 재개: 남은 직원 ${remainingEmployees.length}명`);

  // 재개
  await this.analyzeEmployeeBatch(
    remainingEmployees,
    data.lastProcessedDate,
    data.endDate
  );
}
```

---

## 10. 패턴 클러스터링

### 10.1 클러스터링 개념

팀별 근무 특성을 분석하여 유사한 패턴을 가진 팀들을 그룹화합니다.

**분석 차원**:
1. **X축: 장비 사용 빈도** (O 태그 개수 / 인원수)
2. **Y축: 이동성 지수** (T1 태그 개수 / 인원수)

### 10.2 클러스터 타입

#### 10.2.1 High Equipment / Low Mobility
**특징**:
- X축 높음 (O 태그 많음)
- Y축 낮음 (T1 태그 적음)

**의미**: 장비 집중형 업무
- 연구 (실험실 근무)
- 제조 (설비 운영)
- 검사 (측정 장비 사용)

**대표 부서**: 바이오연구소, 제조센터, QC팀

#### 10.2.2 High Equipment / High Mobility
**특징**:
- X축 높음 (O 태그 많음)
- Y축 높음 (T1 태그 많음)

**의미**: 다기능 업무 (장비 + 이동)
- 기술 지원 (현장 + 장비)
- 품질 관리 (검사 + 순회)
- 설비 보전 (점검 + 이동)

**대표 부서**: 기술지원팀, 품질보증팀, 설비팀

#### 10.2.3 Low Equipment / High Mobility
**특징**:
- X축 낮음 (O 태그 적음)
- Y축 높음 (T1 태그 많음)

**의미**: 이동 집중형 업무
- 영업 (외근, 방문)
- 관리 (순회, 점검)
- 지원 (현장 대응)

**대표 부서**: 영업센터, 경영지원팀, 안전관리팀

#### 10.2.4 Low Equipment / Low Mobility
**특징**:
- X축 낮음 (O 태그 적음)
- Y축 낮음 (T1 태그 적음)

**의미**: 사무 집중형 업무
- 기획 (문서 작업)
- 경영지원 (사무 업무)
- IT (PC 업무)

**대표 부서**: 기획팀, 인사팀, IT팀

### 10.3 클러스터링 알고리즘

#### 10.3.1 데이터 수집

```sql
-- 팀별 태그 통계 수집 (30일 기준)
CREATE TABLE dept_pattern_analysis_new AS
SELECT
  t.org_code as team,
  c.org_name as center,
  COUNT(DISTINCT d.employee_id) as employee_count,

  -- O 태그 통계
  SUM(CASE WHEN tag.DR_GB = 'O' THEN 1 ELSE 0 END) as o_tag_count,
  ROUND(SUM(CASE WHEN tag.DR_GB = 'O' THEN 1 ELSE 0 END) * 1.0 /
        NULLIF(COUNT(DISTINCT d.employee_id), 0), 1) as o_per_person,

  -- T1 태그 통계
  SUM(CASE WHEN tag.DR_GB = 'T1' THEN 1 ELSE 0 END) as t1_count,
  ROUND(SUM(CASE WHEN tag.DR_GB = 'T1' THEN 1 ELSE 0 END) * 1.0 /
        NULLIF(COUNT(DISTINCT d.employee_id), 0), 1) as t1_per_person,

  -- G3 태그 통계 (회의)
  SUM(CASE WHEN tag.DR_GB = 'G3' THEN 1 ELSE 0 END) as g3_count,

  -- Knox 통계
  COUNT(DISTINCT knox.approval_id) as knox_total_count

FROM daily_analysis_results d
LEFT JOIN organization_master t ON d.team_id = t.org_code
LEFT JOIN organization_master c ON t.parent_org_code = c.org_code
LEFT JOIN tag_data tag ON d.employee_id = tag.사번
  AND d.analysis_date = date(tag.ENTE_DT, 'unixepoch')
LEFT JOIN knox_approval_data knox ON d.employee_id = knox.employee_id
  AND d.analysis_date = date(knox.approval_timestamp)

WHERE d.analysis_date >= date('now', '-30 days')
  AND t.org_level = 'team'

GROUP BY t.org_code, c.org_name
HAVING employee_count >= 5; -- 최소 5명 이상 팀만
```

#### 10.3.2 클러스터 분류

```typescript
function assignCluster(oPerPerson: number, t1PerPerson: number): ClusterType {
  // 임계값 설정
  const O_THRESHOLD = 10;  // 1인당 O 태그 10개
  const T1_THRESHOLD = 15; // 1인당 T1 태그 15개

  const highEquipment = oPerPerson >= O_THRESHOLD;
  const highMobility = t1PerPerson >= T1_THRESHOLD;

  if (highEquipment && !highMobility) {
    return 'HIGH_EQUIPMENT_LOW_MOBILITY'; // 장비 집중형
  } else if (highEquipment && highMobility) {
    return 'HIGH_EQUIPMENT_HIGH_MOBILITY'; // 다기능형
  } else if (!highEquipment && highMobility) {
    return 'LOW_EQUIPMENT_HIGH_MOBILITY'; // 이동 집중형
  } else {
    return 'LOW_EQUIPMENT_LOW_MOBILITY'; // 사무 집중형
  }
}
```

#### 10.3.3 클러스터별 통계

```sql
-- 클러스터별 집계
SELECT
  cluster_type,
  COUNT(DISTINCT team) as team_count,
  SUM(employee_count) as total_employees,
  AVG(o_per_person) as avg_o_per_person,
  AVG(t1_per_person) as avg_t1_per_person,
  AVG(g3_count) as avg_g3_count,
  AVG(knox_total_count) as avg_knox_count
FROM dept_pattern_analysis_new
WHERE is_analysis_target = 1
GROUP BY cluster_type
ORDER BY cluster_type;
```

### 10.4 클러스터링 활용

#### 10.4.1 팀 벤치마킹
동일 클러스터 내 팀들을 비교하여 효율성 벤치마크 제공

```sql
-- 같은 클러스터 내 효율성 순위
SELECT
  t.team_name,
  t.cluster_type,
  AVG(d.efficiency_ratio) as avg_efficiency,
  RANK() OVER (PARTITION BY t.cluster_type ORDER BY AVG(d.efficiency_ratio) DESC) as rank
FROM dept_pattern_analysis_new t
JOIN daily_analysis_results d ON t.team = d.team_id
WHERE d.analysis_date >= date('now', '-30 days')
GROUP BY t.team, t.cluster_type, t.team_name;
```

#### 10.4.2 이상치 탐지
클러스터 평균과 크게 벗어난 팀 탐지

```typescript
function detectOutliers(clusterData: ClusterStats[]): Outlier[] {
  const outliers: Outlier[] = [];

  for (const cluster of clusterData) {
    const avgEfficiency = cluster.teams.reduce((sum, t) => sum + t.efficiency, 0) / cluster.teams.length;
    const stdDev = calculateStdDev(cluster.teams.map(t => t.efficiency));

    for (const team of cluster.teams) {
      const zScore = (team.efficiency - avgEfficiency) / stdDev;

      if (Math.abs(zScore) > 2) { // 2 표준편차 이상
        outliers.push({
          team: team.name,
          cluster: cluster.type,
          efficiency: team.efficiency,
          avgEfficiency,
          deviation: zScore,
          type: zScore > 0 ? 'HIGH' : 'LOW'
        });
      }
    }
  }

  return outliers;
}
```

---

**문서 종료**

이 문서는 SambioHRR의 실제 분석 방법론을 상세하게 설명합니다.
추가 질문이나 명확화가 필요한 부분이 있으면 문의하시기 바랍니다.
