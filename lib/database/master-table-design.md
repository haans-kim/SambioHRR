# Master Table Database Architecture Design

## 추천 아키텍처: 이중 SQLite 구조

```
SambioHRR/
├── sambio_human.db         # 운영 DB (기존)
├── sambio_analytics.db     # 분석 전용 DB (신규)
└── lib/
    ├── db.ts               # 운영 DB 연결
    └── analytics-db.ts     # 분석 DB 연결
```

## 구현 전략

### 1. 분석 전용 DB 생성
```typescript
// lib/analytics-db.ts
import Database from 'better-sqlite3';

export class AnalyticsDB {
  private db: Database.Database;
  private operationalDb: Database.Database;
  
  constructor() {
    // 분석 전용 DB
    this.db = new Database('./sambio_analytics.db', {
      readonly: false,
      fileMustExist: false
    });
    
    // 운영 DB 읽기 전용 연결
    this.operationalDb = new Database('./sambio_human.db', {
      readonly: true  // 읽기만!
    });
    
    this.initializeSchema();
    this.setupAttach();
  }
  
  private setupAttach() {
    // 운영 DB를 읽기 전용으로 ATTACH
    this.db.exec(`
      ATTACH DATABASE './sambio_human.db' AS operational;
    `);
  }
  
  private initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS master_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        employee_name TEXT,
        department_id INTEGER,
        department_name TEXT,
        team_id INTEGER,
        team_name TEXT,
        timestamp DATETIME NOT NULL,
        date DATE NOT NULL,
        hour INTEGER,
        tag_code TEXT NOT NULL,
        tag_name TEXT,
        tag_type TEXT,
        duration INTEGER,
        state TEXT,
        judgment TEXT,
        confidence REAL,
        
        -- 집단 지성 컬럼
        dept_same_tag_ratio REAL,
        team_same_tag_ratio REAL,
        historical_pattern_match REAL,
        anomaly_score REAL,
        
        -- 메타데이터
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      -- 최적화된 인덱스들
      CREATE INDEX IF NOT EXISTS idx_emp_date ON master_table(employee_id, date);
      CREATE INDEX IF NOT EXISTS idx_dept_time ON master_table(department_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_tag_time ON master_table(tag_code, timestamp);
      CREATE INDEX IF NOT EXISTS idx_date_hour ON master_table(date, hour);
      
      -- 분석 전용 집계 테이블
      CREATE TABLE IF NOT EXISTS hourly_patterns (
        hour INTEGER,
        department_id INTEGER,
        tag_code TEXT,
        avg_confidence REAL,
        event_count INTEGER,
        PRIMARY KEY (hour, department_id, tag_code)
      );
    `);
  }
}
```

### 2. 데이터 동기화 전략

```typescript
// lib/sync/master-table-sync.ts
export class MasterTableSync {
  private analyticsDb: AnalyticsDB;
  
  async syncDaily() {
    // 매일 자정에 실행
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // 트랜잭션으로 안전하게 동기화
    this.analyticsDb.transaction(() => {
      // 1. 운영 DB에서 데이터 추출
      const newData = this.extractFromOperational(yesterday);
      
      // 2. Master Table에 삽입
      this.insertToMasterTable(newData);
      
      // 3. 집단 패턴 계산
      this.calculateGroupPatterns(yesterday);
      
      // 4. 이상치 점수 계산
      this.calculateAnomalyScores(yesterday);
    })();
  }
  
  async syncRealtime(employeeId: number, date: string) {
    // 실시간 개별 동기화 (필요시)
    const data = await this.extractSingleEmployee(employeeId, date);
    await this.updateMasterTable(data);
  }
}
```

### 3. 쿼리 성능 비교

```sql
-- 분리된 분석 DB에서 (빠름)
SELECT 
  department_id,
  tag_code,
  AVG(confidence) as avg_conf,
  COUNT(*) as cnt
FROM master_table
WHERE date = '2024-01-15'
GROUP BY department_id, tag_code;
-- 실행시간: ~50ms

-- vs 운영 DB JOIN (느림)
SELECT ... 
FROM daily_work_data d
JOIN shift_work_data s ON ...
JOIN organization_master o ON ...
-- 실행시간: ~2000ms
```

### 4. 장점 정리

1. **데이터 안정성**: 운영 DB 무영향
2. **성능 최적화**: 분석 전용 인덱스
3. **점진적 마이그레이션**: 필요시 MySQL 전환 가능
4. **백업 용이**: 두 DB 독립적 백업
5. **개발 편의**: 기존 better-sqlite3 활용

### 5. 단계별 구현 계획

**Phase 1 (1주차)**
- 분석 DB 생성
- Master Table 스키마 구성
- 기본 인덱스 설정

**Phase 2 (2주차)**
- 일일 동기화 스크립트
- 집단 패턴 계산 로직
- 이상치 탐지 구현

**Phase 3 (3주차)**
- API 엔드포인트 수정
- 기존 Timeline 연동
- 성능 테스트

**Phase 4 (4주차)**
- 실시간 동기화 옵션
- 대시보드 연동
- 모니터링 설정

### 6. 용량 예측

```
운영 DB (sambio_human.db): ~500MB
분석 DB (sambio_analytics.db): 
  - 초기: ~1GB
  - 6개월: ~3GB
  - 1년: ~6GB
  
총 디스크 사용량: ~7GB (관리 가능)
```

### 7. 백업 전략

```bash
#!/bin/bash
# backup.sh

# 운영 DB 백업 (매일)
sqlite3 sambio_human.db ".backup backup/human_$(date +%Y%m%d).db"

# 분석 DB 백업 (주 1회)
sqlite3 sambio_analytics.db ".backup backup/analytics_$(date +%Y%m%d).db"

# 30일 이상 백업 삭제
find backup/ -name "*.db" -mtime +30 -delete
```