# SQLite 병렬 처리 방식 비교

## 1. 쿼리 병렬화 (현재 제안한 방식)
```javascript
// 같은 connection에서 여러 쿼리 "동시" 실행
const [tagData, mealData, knoxData] = await Promise.all([
  getTagData(employeeId),
  getMealData(employeeId),
  getKnoxData(employeeId)
])
```

**문제점**:
- Better-SQLite3는 동기식이므로 실제로는 순차 실행됨
- 같은 DB connection 공유로 lock contention 발생
- SQLite 내부적으로 순차 처리
- 실제 성능 향상 없음

## 2. Worker Thread 병렬 처리 (권장)
```javascript
// 여러 worker가 각각 다른 직원 데이터를 독립적으로 처리
Worker1: 직원 A의 모든 데이터 순차 처리
Worker2: 직원 B의 모든 데이터 순차 처리  
Worker3: 직원 C의 모든 데이터 순차 처리
...
```

**장점**:
- 각 Worker가 독립적인 DB connection 사용
- 진정한 병렬 처리 (CPU 코어 활용)
- SQLite의 multiple readers 지원 활용
- Lock contention 최소화

## 성능 비교

### 1,000명 직원 처리 시나리오

**쿼리 병렬화 (비효과적)**:
```
직원1: [tag|meal|knox|...] → 230ms
직원2: [tag|meal|knox|...] → 230ms  
...
총 시간: 230ms × 1000 = 230초
```

**Worker 병렬 처리 (효과적)**:
```
Worker1: 직원1→직원11→직원21... (100명)
Worker2: 직원2→직원12→직원22... (100명)
...
Worker10: 직원10→직원20→직원30... (100명)

각 Worker: 230ms × 100 = 23초
총 시간: 23초 (10배 향상)
```

## 최적 구현 방식

### Worker Pool 구조
- CPU 코어 수 기반 Worker 수 결정 (보통 코어 수 - 1)
- 각 Worker에 독립적인 SQLite connection
- Queue 기반 작업 분배
- 결과 집계는 메인 스레드에서

### 추가 최적화
- WAL 모드 활성화: `PRAGMA journal_mode=WAL`
- 읽기 전용 connection: `readonly: true` 옵션
- Connection 캐싱: Worker별 connection 재사용
- Prepared statement 캐싱