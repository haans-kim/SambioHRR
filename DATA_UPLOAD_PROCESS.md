# 신규 데이터 업로드 프로세스

**작성일**: 2025-10-14
**목적**: 7월 이후 신규 월별 데이터 업로드 절차 가이드

---

## 📋 개요

현재 시스템은 **2단계 데이터 파이프라인**으로 구성되어 있습니다:

1. **Stage 1**: Excel → `sambio_human.db` (Python Data Uploader)
2. **Stage 2**: `sambio_human.db` → `sambio_analytics.db` Master Table (TypeScript Migration)

---

## 🔄 전체 프로세스

```
Excel 파일 (7월 데이터)
    ↓
[Python Data Uploader - SambioHR5]
    ↓
sambio_human.db (운영 DB)
    - tag_data
    - meal_data
    - knox_* tables
    - claim_data
    ↓
[TypeScript Migration Script]
    ↓
sambio_analytics.db (분석 DB)
    - master_events_table
```

---

## 📝 Stage 1: Excel → sambio_human.db

### 1.1 준비 사항

**필요한 Excel 파일** (7월분):
- `tag_data_202507.xlsx` - 출입 태그 데이터
- `meal_data_202507.xlsx` - 식당 데이터 (선택)
- `claim_data_202507.xlsx` - 근태 신고 데이터 (선택)
- `knox_*.xlsx` - Knox 시스템 데이터 (선택)

**시스템 위치**:
```bash
cd /Users/hanskim/Projects/SambioHR5/Data_Uploader
```

### 1.2 Data Uploader 실행

```bash
# 1. 가상환경 활성화 (필요시)
source ../.venv/bin/activate

# 2. Streamlit 앱 실행
streamlit run app.py
```

### 1.3 웹 인터페이스 작업

**접속**: http://localhost:8501

**업로드 절차**:
1. **파일 업로드**
   - "파일 선택" → 7월 Excel 파일들 선택
   - "파일 추가" 버튼으로 등록 목록에 추가

2. **로드 옵션 설정**
   - ✅ **Pickle 파일 저장**: 빠른 재로딩을 위해 활성화 권장
   - ⚠️ **기존 데이터 교체**:
     - 7월 데이터가 이미 있으면 체크 (갱신)
     - 새로운 월 데이터면 체크 해제 (추가)

3. **데이터 로드 실행**
   - "데이터 로드" 버튼 클릭
   - 진행률 모니터링 (150만건+ 처리 시 5-10분 소요)

4. **결과 확인**
   - "DB 상태 조회" → 전체 데이터 건수 확인
   - "TagData 보기" → 7월 데이터 샘플 확인

### 1.4 명령행 옵션 (선택)

```bash
# 현재 DB 상태 확인
cd /Users/hanskim/Projects/SambioHR5/Data_Uploader
python core/data_loader.py --status

# Excel에서 직접 로드
python core/data_loader.py --load-excel "raw/tag_data_202507.xlsx"

# 기존 데이터 교체하며 로드
python core/data_loader.py --load-excel "raw/tag_data_202507.xlsx" --replace
```

### 1.5 데이터 검증

```bash
# sambio_human.db 검증
cd /Users/hanskim/Projects/SambioHRR
sqlite3 sambio_human.db "SELECT COUNT(*) as jul_count FROM tag_data WHERE ENTE_DT >= 20250701 AND ENTE_DT < 20250801"
```

**예상 결과**: 7월 데이터가 100만건+ 있어야 정상

---

## 📝 Stage 2: sambio_human.db → sambio_analytics.db

### 2.1 준비 사항

**시스템 위치**:
```bash
cd /Users/hanskim/Projects/SambioHRR
```

**확인 사항**:
- `sambio_human.db`에 7월 데이터 존재 확인
- `sambio_analytics.db` 백업 (선택적)

### 2.2 Master Table Migration 실행

**스크립트**: `scripts/migrate-complete-master.ts`

```bash
# 7월 전체 데이터 마이그레이션
npx tsx scripts/migrate-complete-master.ts 20250701 20250731

# 특정 날짜만 마이그레이션 (테스트)
npx tsx scripts/migrate-complete-master.ts 20250701 20250703
```

### 2.3 Migration 과정

**처리 단계**:
1. **기존 데이터 제거**: 해당 날짜 범위의 기존 데이터 삭제 (선택적)
2. **Timeline 구성**:
   - Tag 이벤트 (tag_data)
   - Knox 이벤트 (knox_approval, knox_mail, knox_pims)
   - Meal 이벤트 (meal_data)
   - Equipment 이벤트 (eam_data, mes_data, equis_data, lams_data, mdm_data)
3. **Tag Code 매핑**: 장소명 → TagCode 변환
4. **조직 정보 연결**: employee_id → 센터/팀/그룹 정보
5. **Master Table 삽입**: `master_events_table`에 저장

**소요 시간**:
- 1일 데이터: ~30초
- 1달 데이터 (31일): ~15-20분

### 2.4 Migration 검증

```bash
# 7월 데이터 확인
sqlite3 sambio_analytics.db "SELECT COUNT(*) as jul_events FROM master_events_table WHERE date >= '2025-07-01' AND date < '2025-08-01'"

# 7월 일별 이벤트 수 확인
sqlite3 sambio_analytics.db "SELECT date, COUNT(*) as events FROM master_events_table WHERE date >= '2025-07-01' AND date < '2025-08-01' GROUP BY date ORDER BY date"

# 태그 코드 분포 확인
sqlite3 sambio_analytics.db "SELECT tag_code, COUNT(*) as cnt FROM master_events_table WHERE date >= '2025-07-01' AND date < '2025-08-01' GROUP BY tag_code ORDER BY cnt DESC"
```

**예상 결과**:
- 총 이벤트: ~50만건/일 × 31일 = ~1,550만건
- Tag Code 분포:
  - G1 (주업무 공간): ~35-40%
  - T1 (통로/계단): ~30-35%
  - T2/T3 (출입): 각 ~7%
  - O (실제 업무): ~5% (Knox 데이터 포함된 경우)

---

## 🔍 문제 해결

### 문제 1: Excel 파일 로드 실패

**증상**: Data Uploader에서 Excel 로드 중 오류

**해결책**:
```bash
# 1. 파일 형식 확인
file raw/tag_data_202507.xlsx  # 응답: "Microsoft Excel 2007+"

# 2. 파일 권한 확인
ls -l raw/tag_data_202507.xlsx  # 읽기 권한 있어야 함

# 3. 메모리 확보
# 대용량 파일의 경우 8GB+ RAM 권장

# 4. 파일 무결성 확인
# Excel에서 직접 열어보기
```

### 문제 2: Migration 중 조직 정보 누락

**증상**: `team_code`, `center_code`가 NULL 또는 0

**원인**: `employee_info` 또는 `organization_master` 테이블 정보 부족

**해결책**:
```bash
# 1. employee_info 확인
sqlite3 sambio_human.db "SELECT COUNT(*) FROM employee_info WHERE center IS NOT NULL"

# 2. organization_master 확인
sqlite3 sambio_human.db "SELECT COUNT(*) FROM organization_master WHERE org_level = 'team'"

# 3. 누락된 경우 조직 정보 Excel 재업로드 필요
```

### 문제 3: O 태그 데이터 누락

**증상**: 7월 데이터에 O 태그가 없거나 매우 적음

**원인**: Knox 시스템 데이터 미통합

**해결책**:
```bash
# 1. Knox 데이터 확인
sqlite3 sambio_human.db "SELECT COUNT(*) FROM knox_approval_data WHERE DATE(approval_time) >= '2025-07-01'"

# 2. Knox 데이터 없으면 별도 업로드 필요
# knox_approval_202507.xlsx
# knox_mail_202507.xlsx
# knox_pims_202507.xlsx

# 3. Migration 재실행
npx tsx scripts/migrate-complete-master.ts 20250701 20250731
```

---

## 📊 데이터 현황 (2025년 10월 14일 기준)

### sambio_human.db
- **크기**: 4.6GB
- **기간**: 2025-01-01 ~ 2025-06-30 (6개월)
- **주요 테이블**:
  - `tag_data`: 출입 태그 (1~6월 전체)
  - `meal_data`: 식당 데이터 (6월만)
  - `knox_*`: Knox 데이터 (6월만)

### sambio_analytics.db
- **크기**: 6.5GB
- **이벤트 수**: 15,478,409건
- **기간**: 2025-01-01 ~ 2025-06-30
- **직원 수**: 5,459명
- **태그 분포**:
  - G1: 38% (주업무 공간)
  - T1: 35.5% (통로)
  - T2/T3: 각 7.2% (출입)
  - O: 5.3% (실제 업무, 6월만)
  - M1/M2: 1.3% (식사, 6월만)

---

## 🎯 7월 데이터 업로드 체크리스트

### 준비 단계
- [ ] Excel 파일 확보 (tag_data, meal_data, knox_*, claim_data)
- [ ] 파일 형식 검증 (.xlsx)
- [ ] 디스크 공간 확인 (최소 5GB 여유)

### Stage 1: Excel → sambio_human.db
- [ ] Data Uploader 실행 (`cd SambioHR5/Data_Uploader && streamlit run app.py`)
- [ ] tag_data 업로드 및 검증
- [ ] meal_data 업로드 (선택)
- [ ] knox_* 데이터 업로드 (선택)
- [ ] claim_data 업로드 (선택)
- [ ] sambio_human.db 데이터 확인

### Stage 2: sambio_human.db → sambio_analytics.db
- [ ] Migration 스크립트 실행 (`npx tsx scripts/migrate-complete-master.ts 20250701 20250731`)
- [ ] 진행률 모니터링 (15-20분 소요)
- [ ] 에러 로그 확인
- [ ] master_events_table 데이터 검증
- [ ] 일별 이벤트 수 확인
- [ ] 태그 코드 분포 확인

### 최종 검증
- [ ] 웹 대시보드에서 7월 데이터 표시 확인 (http://localhost:3003)
- [ ] 팀별 분석 페이지 동작 확인
- [ ] 개인 분석 페이지에서 7월 데이터 조회 가능 확인

---

## 📞 참고 자료

### 관련 문서
- [PROJECT_HANDOVER_COMPREHENSIVE.md](./PROJECT_HANDOVER_COMPREHENSIVE.md) - 전체 시스템 구조
- [ANALYSIS_METHODOLOGY_DETAILED.md](./ANALYSIS_METHODOLOGY_DETAILED.md) - 분석 로직 상세
- [SambioHR5/Data_Uploader/README.md](../SambioHR5/Data_Uploader/README.md) - Data Uploader 사용법

### 주요 스크립트
- `../SambioHR5/Data_Uploader/app.py` - Streamlit 데이터 업로더
- `../SambioHR5/Data_Uploader/core/data_loader.py` - Excel 로딩 엔진
- `scripts/migrate-complete-master.ts` - Master Table 마이그레이션

### 데이터베이스 파일
- `sambio_human.db` - 운영 데이터베이스 (4.6GB)
- `sambio_analytics.db` - 분석 데이터베이스 (6.5GB)
