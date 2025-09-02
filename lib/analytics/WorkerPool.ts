import { Worker } from 'worker_threads'
import os from 'os'

interface WorkerTask {
  employeeId: number
  date: string
  shift: 'day' | 'night'
}

interface WorkerResult {
  employeeId: number
  metrics: any
  performance: {
    totalTimeMs: number
    eventsProcessed: number
  }
}

export class AnalyticsWorkerPool {
  private workers: Worker[] = []
  private taskQueue: WorkerTask[] = []
  private results: WorkerResult[] = []
  private activeWorkers = 0
  private workerCount: number
  
  constructor(workerCount?: number) {
    // 기본값: CPU 코어 수 - 1 (메인 스레드용 1개 제외)
    this.workerCount = workerCount || Math.max(1, os.cpus().length - 1)
    console.log(`Initializing Worker Pool with ${this.workerCount} workers`)
  }
  
  async processEmployees(
    employeeIds: number[], 
    date: string, 
    shift: 'day' | 'night' = 'day'
  ): Promise<WorkerResult[]> {
    const startTime = performance.now()
    
    // 작업 큐 초기화
    this.taskQueue = employeeIds.map(id => ({
      employeeId: id,
      date,
      shift
    }))
    
    this.results = []
    
    // Worker 생성 및 시작
    const workerPromises: Promise<void>[] = []
    
    for (let i = 0; i < this.workerCount; i++) {
      workerPromises.push(this.createAndRunWorker(i))
    }
    
    // 모든 Worker 완료 대기
    await Promise.all(workerPromises)
    
    const totalTime = performance.now() - startTime
    
    console.log('\n=== Worker Pool Performance ===')
    console.log(`Total Employees: ${employeeIds.length}`)
    console.log(`Workers Used: ${this.workerCount}`)
    console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`)
    console.log(`Average per Employee: ${(totalTime / employeeIds.length).toFixed(2)}ms`)
    console.log(`Throughput: ${(employeeIds.length / (totalTime / 1000)).toFixed(1)} employees/sec`)
    console.log('================================\n')
    
    return this.results
  }
  
  private async createAndRunWorker(workerId: number): Promise<void> {
    return new Promise((resolve) => {
      const worker = new Worker('./lib/analytics/worker.js', {
        workerData: { workerId }
      })
      
      worker.on('message', (result: WorkerResult) => {
        this.results.push(result)
        
        // 다음 작업 할당
        const nextTask = this.taskQueue.shift()
        if (nextTask) {
          worker.postMessage(nextTask)
        } else {
          // 더 이상 작업이 없으면 Worker 종료
          worker.postMessage({ command: 'exit' })
        }
      })
      
      worker.on('error', (error) => {
        console.error(`Worker ${workerId} error:`, error)
      })
      
      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Worker ${workerId} stopped with exit code ${code}`)
        }
        resolve()
      })
      
      // 첫 작업 할당
      const firstTask = this.taskQueue.shift()
      if (firstTask) {
        worker.postMessage(firstTask)
      } else {
        worker.postMessage({ command: 'exit' })
      }
      
      this.workers.push(worker)
    })
  }
  
  async shutdown() {
    for (const worker of this.workers) {
      await worker.terminate()
    }
    this.workers = []
  }
}

// 사용 예시
export async function analyzeEmployeesBatch(
  employeeIds: number[],
  date: string,
  shift: 'day' | 'night' = 'day'
) {
  const pool = new AnalyticsWorkerPool()
  
  try {
    const results = await pool.processEmployees(employeeIds, date, shift)
    return results
  } finally {
    await pool.shutdown()
  }
}