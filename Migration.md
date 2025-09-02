# 📊 SambioHR 프로젝트 통합 마이그레이션 계획

## 1. 프로젝트 현황

### 현재 구조 (3개 독립 프로젝트)
| 프로젝트 | 기술 스택 | 주요 기능 | 문제점 |
|---------|----------|----------|--------|
| **SambioHR5** | Python + Streamlit | • Excel → SQLite 변환<br>• HMM 활동 분석<br>• 병렬처리 (12 workers) | Backend/Frontend 분리 부담 |
| **NewAnalysis** | TypeScript + Next.js | • 개인별/조직별 분석<br>• 태그 기반 분류 | SQLite 병목 (월 3시간 소요) |
| **HR_Dashboard** | TypeScript + Next.js | • 대시보드 시각화<br>• 조직 계층 뷰 | 분석 기능 부재 |

### 핵심 문제
- **성능 병목**: SQLite 단일 쓰레드로 인한 조직 분석 3시간 소요
- **코드 중복**: 각 프로젝트가 독립적인 DB 복사본 사용
- **유지보수**: 3개 프로젝트 개별 관리의 비효율

## 2. 통합 아키텍처 설계

### 목표 아키텍처
```
HR_Integrated (Next.js + TypeScript)
├── 대시보드 (HR_Dashboard 기반)
├── 개인/조직 분석 (NewAnalysis 통합)
├── Excel 업로드 (Python 스크립트 활용)
└── MySQL 데이터베이스 (공통)
```

### 기술 스택 결정
- **Frontend**: Next.js + TypeScript (유지)
- **Database**: SQLite → **MySQL** 마이그레이션
- **배치 처리**: Python 스크립트 (Excel 처리용)
- **병렬 처리**: MySQL Connection Pool (20 connections)

## 3. 데이터베이스 마이그레이션 전략

### SQLite vs MySQL vs PostgreSQL 비교
| 항목 | SQLite (현재) | MySQL (선택) | PostgreSQL |
|------|--------------|--------------|------------|
| **병렬 쓰기** | ❌ 불가능 | ✅ 가능 (InnoDB) | ✅ 가능 (MVCC) |
| **성능 예상** | 3시간 | **10-15분** | 10-15분 |
| **인프라** | 파일 기반 | 이미 설치됨 | 신규 설치 필요 |
| **마이그레이션** | - | 중간 난이도 | 중간 난이도 |

### MySQL 선택 이유
1. **이미 설치/운영 중** - 추가 인프라 불필요
2. **충분한 성능** - 3시간 → 15분 단축 가능
3. **운영 노하우** - 기존 DBA 지원 가능
4. **TypeScript 호환성** - mysql2 라이브러리 안정적

## 4. 작업 계획

### Phase 1: 프로젝트 통합 (1주)
```bash
# 1. HR_Dashboard 복사하여 통합 프로젝트 생성
cp -r HR_Dashboard HR_Integrated
cd HR_Integrated

# 2. NewAnalysis 핵심 기능 이식
- lib/classifier/* (태그 분류 엔진)
- lib/analytics/* (분석 계산기)
- app/api/organization/* (조직 분석 API)
- app/api/employees/[id]/* (개인 분석 API)

# 3. 의존성 추가
npm install xlsx use-immer zustand
```

### Phase 2: MySQL 마이그레이션 (1주)

#### 2.1 스키마 변환
```sql
-- SQLite → MySQL 자동 변환
CREATE DATABASE sambio_human CHARACTER SET utf8mb4;

-- 테이블 생성 (자동 변환 스크립트)
sqlite3 sambio_human.db .dump | 
sed 's/AUTOINCREMENT/AUTO_INCREMENT/g' |
mysql -u root -p sambio_human
```

#### 2.2 Connection Pool 설정
```typescript
// lib/database/mysql-connection.ts
const pool = mysql.createPool({
  host: 'localhost',
  database: 'sambio_human',
  waitForConnections: true,
  connectionLimit: 20,  // 병렬 처리용
  queueLimit: 0
});
```

### Phase 3: 병렬 처리 구현 (3-4일)

#### 배치 분석 병렬화
```typescript
// 20개씩 병렬 처리
const chunks = chunk(employees, 20);
for (const chunk of chunks) {
  const promises = chunk.map(emp => 
    pool.execute('CALL analyze_employee(?, ?, ?)', 
      [emp.id, startDate, endDate])
  );
  await Promise.all(promises);
}
```

### Phase 4: Excel 업로드 구현 (2-3일)

#### 대용량 Excel 처리 (170만행, 2시트)
```python
# scripts/import_excel.py
import pandas as pd
import mysql.connector

def import_excel(file_path):
    # 모든 시트 읽기
    excel = pd.ExcelFile(file_path, engine='openpyxl')
    
    for sheet in excel.sheet_names:
        # 청크 단위 처리 (메모리 절약)
        for chunk in pd.read_excel(excel, sheet_name=sheet, chunksize=10000):
            # MySQL 배치 INSERT
            cursor.executemany(
                "INSERT INTO tag_data VALUES (%s, %s, %s, %s)",
                chunk.values.tolist()
            )
```

#### Next.js API Route
```typescript
// app/api/excel/upload/route.ts
export async function POST(request: Request) {
  const file = await request.formData();
  // 파일 저장 후 Python 스크립트 실행
  const { stdout } = await exec(
    `python3 scripts/import_excel.py ${filePath}`
  );
  return Response.json({ success: true });
}
```

## 5. 성능 개선 예상

| 작업 | 현재 (SQLite) | 개선 후 (MySQL) | 개선율 |
|------|--------------|----------------|--------|
| **조직 분석 (월별)** | 3시간 | 10-15분 | 12-18배 |
| **Excel 임포트 (170만행)** | 20분 | 2-3분 | 7-10배 |
| **동시 사용자** | 1명 | 20명+ | 20배+ |

## 6. 실행 일정

| 주차 | 작업 내용 | 산출물 |
|------|----------|--------|
| **1주차** | • 프로젝트 통합<br>• NewAnalysis 기능 이식 | 통합 프로젝트 구조 |
| **2주차** | • MySQL 마이그레이션<br>• 스키마 변환 | MySQL DB 구축 |
| **3주차** | • 병렬 처리 구현<br>• Excel 업로드 구현 | 성능 최적화 완료 |
| **4주차** | • 테스트 및 안정화<br>• 배포 준비 | 운영 준비 완료 |

## 7. 리스크 및 대응

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|-----------|
| MySQL 마이그레이션 실패 | 높음 | • 단계별 검증<br>• 롤백 계획 수립 |
| TypeScript 타입 호환성 | 중간 | • 점진적 마이그레이션<br>• 타입 정의 우선 |
| 대용량 Excel 처리 실패 | 중간 | • Python 스크립트 분리<br>• 청크 단위 처리 |

## 8. 기대 효과

### 정량적 효과
- **처리 시간**: 3시간 → 15분 (12배 단축)
- **동시 처리**: 1명 → 20명+ (20배 증가)
- **코드 중복**: 3개 프로젝트 → 1개 (67% 감소)

### 정성적 효과
- 통합 관리로 유지보수 효율성 증대
- 실시간 분석 가능
- 확장성 확보 (향후 기능 추가 용이)

## 9. 주요 결정 사항

### ✅ 확정 사항
1. **MySQL 데이터베이스 사용** (이미 설치/운영 중)
2. **TypeScript 코드베이스 유지** (Python 이식 리스크 회피)
3. **HR_Dashboard 기반 통합** (가장 최신 UI)
4. **Python 스크립트로 Excel 처리** (성능 최적)

### ❌ 배제 사항
1. **SQLite Worker Threads 최적화** (근본 해결 불가)
2. **Python 전체 이식** (유지보수 부담)
3. **별도 Backend 서버** (복잡도 증가)
4. **PostgreSQL 도입** (추가 인프라 부담)

## 10. 다음 단계

1. **즉시 시작**: HR_Integrated 프로젝트 생성
2. **1주차 목표**: NewAnalysis 기능 통합 완료
3. **2주차 목표**: MySQL 마이그레이션 완료
4. **3주차 목표**: 성능 테스트 및 검증

---

*작성일: 2025-09-02*  
*작성자: SambioHR 개발팀*