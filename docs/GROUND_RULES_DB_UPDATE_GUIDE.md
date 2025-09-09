# Ground Rules 대시보드 업데이트 가이드

## 개요

이 가이드는 **UI 변경 없이** 기존 대시보드가 Ground Rules 데이터를 표시하도록 DB 업데이트하는 방법을 설명합니다.

## 🎯 목표

**기존 대시보드 지표**를 **Ground Rules 결과**로 교체:

- **주간 근무시간** = Claim 시간 (변경 없음) ✅
- **주간 근무추정시간** = 기존 수치 유지 (변경 없음) ✅  
- **근무추정시간(AI보정)** = **Ground Rules 업무시간**으로 교체 🔄
- **효율성지표** = **Ground Rules / Claim Data**로 교체 🔄
- **데이터 신뢰도** = **Ground Rules 신뢰도**로 교체 🔄

## 📋 전체 프로세스

### 1단계: Ground Rules 분석 실행
```bash
# 워커 분석 수행 (브라우저에서)
# http://localhost:3003/organization
# "Ground Rules 분석 (워커)" 버튼 클릭
# 분석 완료 후 DB에 결과 저장됨
```

### 2단계: 조직 통계 업데이트
```bash
# 터미널에서 실행
npm run update-org-stats
```

### 3단계: 대시보드 확인
```bash
# 브라우저에서 대시보드 확인
# http://localhost:3003/
# "근무추정시간(AI보정)", "효율성 지표", "데이터 신뢰도" 값이 Ground Rules 결과로 변경됨
```

## 🔧 상세 설명

### DB 테이블 매핑

**업데이트 대상**: `organization_monthly_stats` 테이블 (2025년 6월)

| 대시보드 지표 | DB 컬럼 | 기존 값 | 새로운 값 |
|---|---|---|---|
| 근무추정시간(AI보정) | `avg_actual_work_hours` | 시그모이드 함수 계산 | Ground Rules 업무시간 |
| 효율성 지표 | `avg_work_efficiency` | 기존 효율성 계산 | Ground Rules / Claim 비율 |
| 데이터 신뢰도 | `avg_data_confidence` | 기존 신뢰도 점수 | Ground Rules 신뢰도 점수 |

### 데이터 소스

**Ground Rules 분석 결과**: `daily_analysis_results` 테이블
- `ground_rules_work_hours`: Ground Rules 업무시간
- `ground_rules_confidence`: Ground Rules 신뢰도
- `claimed_work_hours`: 신고 근무시간 (효율성 계산용)

## 🚀 실행 결과 예시

```
🚀 조직 통계 업데이트 시작 (Ground Rules 반영)
📊 Ground Rules 데이터 수집: 145건
🏢 조직별 집계: 9개 조직

✅ ORG001: Ground Rules 데이터 업데이트 완료
   - 평균 업무시간: 38.4h
   - 효율성: 95.8%
   - 신뢰도: 82.3%

✅ ORG002: Ground Rules 데이터 업데이트 완료
   - 평균 업무시간: 41.2h
   - 효율성: 92.1%
   - 신뢰도: 75.6%

📊 총 9개 조직의 통계 업데이트 완료
✅ 조직 통계 업데이트 완료
```

## 🔍 검증 방법

### 1. 데이터 변경 확인
```bash
# SQLite로 직접 확인
sqlite3 sambio_human.db
.headers on
.mode table

SELECT 
  org_code,
  avg_actual_work_hours,
  avg_work_efficiency,  
  avg_data_confidence,
  updated_at
FROM organization_monthly_stats 
WHERE year = 2025 AND month = 6;
```

### 2. 대시보드 변경 확인
1. http://localhost:3003/ 접속
2. **"근무추정시간(AI보정)"** 버튼 클릭
3. 이전과 다른 값들 표시 확인
4. **"효율성 지표"**, **"데이터 신뢰도"** 도 확인

## ⚠️ 주의사항

### 백업
```bash
# 실행 전 반드시 DB 백업
cp sambio_human.db sambio_human.db.backup
```

### 복원 (필요시)
```bash
# 이전 상태로 복원
cp sambio_human.db.backup sambio_human.db
```

### 데이터 범위
- **현재**: 2025년 6월 데이터만 업데이트
- **확장**: 다른 월/년도도 업데이트하려면 스크립트 수정 필요

## 🔧 문제 해결

### "업데이트할 레코드가 없음" 오류
```sql
-- organization_monthly_stats에 2025년 6월 데이터가 있는지 확인
SELECT COUNT(*) 
FROM organization_monthly_stats 
WHERE year = 2025 AND month = 6;

-- 없다면 먼저 기본 데이터를 생성해야 함
```

### Ground Rules 데이터 없음
```sql
-- daily_analysis_results에 Ground Rules 데이터가 있는지 확인
SELECT COUNT(*) 
FROM daily_analysis_results 
WHERE analysis_date >= '2025-06-01' 
  AND ground_rules_work_hours IS NOT NULL;

-- 없다면 먼저 Ground Rules 분석을 실행해야 함
```

## 📊 기대 효과

### Before (기존)
- **근무추정시간(AI보정)**: 복잡한 시그모이드 함수 계산
- **효율성 지표**: 기존 방식 계산  
- **데이터 신뢰도**: 기존 신뢰도 점수

### After (Ground Rules 적용)
- **근무추정시간(AI보정)**: 조직 집단지성 기반 현실적 추정
- **효율성 지표**: Ground Rules 업무시간 / 신고시간 (95%~85% 범위)
- **데이터 신뢰도**: Ground Rules 분석 신뢰도 점수

## 📞 지원

문제가 발생하면:
1. 백업 파일로 복원
2. 로그 확인 (`npm run update-org-stats` 출력)
3. DB 상태 점검 (위의 검증 방법 사용)