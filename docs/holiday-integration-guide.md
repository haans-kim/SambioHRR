# 휴일 반영 시스템 구현 가이드

## 🎯 목적
한국 법정공휴일을 근무시간으로 인정하여 주 40시간 기준을 충족시키기 위한 시스템 구현

## 📋 구현 단계

### Step 1: holidays 테이블 생성 및 데이터 입력
```bash
# 휴일 테이블 생성 및 2025년 법정공휴일 입력
sqlite3 sambio_human.db < scripts/create-holidays-table.sql
```

### Step 2: 구현 파일 교체
```bash
# 기존 파일 백업
cp lib/db/queries/claim-analytics.ts lib/db/queries/claim-analytics.backup.ts

# 새 구현으로 교체
cp lib/db/queries/claim-analytics-with-holidays.ts lib/db/queries/claim-analytics.ts
```

### Step 3: 검증
```bash
# 수정 전후 비교 검증
npx tsx scripts/verify-holiday-integration.ts
```

### Step 4: 서버 재시작
```bash
# 개발 서버 재시작
npm run dev
```

## 🔍 검증 체크리스트

### 데이터 검증
- [ ] holidays 테이블이 생성되었는가?
- [ ] 2025년 1-6월 법정공휴일 9개가 입력되었는가?
- [ ] 주간 평균 근태시간이 증가했는가?
- [ ] 전체 직원수가 변화하지 않았는가?

### 기능 검증
- [ ] 대시보드 페이지가 정상 표시되는가?
- [ ] 트렌드 분석 페이지가 정상 작동하는가?
- [ ] 센터별, 레벨별 통계가 올바른가?
- [ ] 평균값이 40시간에 근접했는가?

## 📊 예상 결과

### Before (휴일 미반영)
- 전체 평균 주간 근태시간: ~38-39h
- 일부 직원 통계 누락 가능성
- 주 40시간 기준 미달

### After (휴일 반영)
- 전체 평균 주간 근태시간: ~40-41h
- 모든 직원 포함
- 주 40시간 기준 충족

## ⚠️ 주의사항

1. **데이터 백업**: 변경 전 claim_data 테이블 백업 권장
2. **캐시 정리**: 브라우저 캐시 정리 필요할 수 있음
3. **모니터링**: 첫 배포 후 24시간 모니터링 권장

## 🔄 롤백 방법

문제 발생 시:
```bash
# 원본 파일로 복구
cp lib/db/queries/claim-analytics.backup.ts lib/db/queries/claim-analytics.ts

# holidays 테이블 제거 (선택사항)
sqlite3 sambio_human.db "DROP TABLE IF EXISTS holidays;"

# 서버 재시작
npm run dev
```

## 📅 향후 유지보수

### 매년 휴일 업데이트
```sql
-- 2026년 휴일 추가 예시
INSERT INTO holidays (holiday_date, holiday_name, standard_hours) VALUES
  ('2026-01-01', '신정', 8.0),
  -- ... 추가 휴일
ON CONFLICT DO NOTHING;
```

### 특별 근무일 처리
```sql
-- 대체공휴일이 평일인 경우
UPDATE holidays
SET is_workday = TRUE
WHERE holiday_date = '2025-XX-XX';
```

## 📝 문서

- 설계 문서: `/docs/holiday-integration-design.md`
- 구현 가이드: `/docs/holiday-integration-guide.md`
- SQL 스크립트: `/scripts/create-holidays-table.sql`
- 검증 스크립트: `/scripts/verify-holiday-integration.ts`

## 💡 FAQ

### Q: 휴일에 실제 근무한 직원은 어떻게 처리되나요?
A: 실제근무시간이 0이 아닌 경우는 원래 근무시간을 그대로 사용합니다.

### Q: 탄력근무제 직원의 공휴일은?
A: 근태코드 'IR' (공휴일휴무(탄력))이 있는 경우만 8시간으로 인정됩니다.

### Q: 반차나 연차와 중복되면?
A: claim_data의 기존 데이터를 우선시합니다. holidays는 보조 참조용입니다.

## 🚀 적용 권장 시점

- **개발환경**: 즉시 적용 가능
- **운영환경**: 월요일 오전 또는 금요일 저녁 권장
- **백업**: 적용 전 전체 DB 백업 필수