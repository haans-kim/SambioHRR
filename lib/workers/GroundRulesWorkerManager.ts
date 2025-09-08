import { Worker } from 'worker_threads'
import path from 'path'
import os from 'os'

interface WorkerTask {
  employeeId: number
  employeeName: string
  startDate: string
  endDate: string
  analyticsDbPath: string
  workerId: number
}

interface WorkerResult {
  workerId: number
  employeeId: number
  employeeName: string
  date: string
  metrics: any
  groundRulesAnalysis?: any
  error?: string
}

export class GroundRulesWorkerManager {
  private workers: Worker[] = []
  private workerCount: number
  private taskQueue: WorkerTask[] = []
  private results: WorkerResult[] = []
  private completedTasks: number = 0
  private totalTasks: number = 0
  private onProgress?: (completed: number, total: number) => void
  private onComplete?: (results: WorkerResult[]) => void
  private onError?: (error: string) => void

  constructor(workerCount?: number) {
    // Use CPU count or specified count, max 8 to avoid overwhelming
    this.workerCount = Math.min(workerCount || os.cpus().length, 8)
  }

  async processEmployees(
    employees: Array<{ employeeId: number; employeeName: string }>,
    startDate: string,
    endDate: string,
    callbacks: {
      onProgress?: (completed: number, total: number) => void
      onComplete?: (results: WorkerResult[]) => void
      onError?: (error: string) => void
    }
  ): Promise<WorkerResult[]> {
    this.onProgress = callbacks.onProgress
    this.onComplete = callbacks.onComplete
    this.onError = callbacks.onError

    // Reset state
    this.results = []
    this.completedTasks = 0
    this.totalTasks = employees.length
    this.taskQueue = []

    // Create task queue
    const analyticsDbPath = path.join(process.cwd(), 'sambio_analytics.db')
    
    employees.forEach((emp, index) => {
      this.taskQueue.push({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        startDate,
        endDate,
        analyticsDbPath,
        workerId: index % this.workerCount
      })
    })

    console.log(`🚀 Starting Ground Rules analysis with ${this.workerCount} workers for ${employees.length} employees`)

    return new Promise((resolve, reject) => {
      try {
        this.createWorkers()
        this.distributeTasks()

        // Set up completion handler
        this.onComplete = (results) => {
          this.cleanup()
          resolve(results)
        }

        // Set up error handler
        this.onError = (error) => {
          this.cleanup()
          reject(new Error(error))
        }

      } catch (error) {
        this.cleanup()
        reject(error)
      }
    })
  }

  private createWorkers() {
    const workerPath = path.join(process.cwd(), 'workers', 'ground-rules-worker.ts')
    
    for (let i = 0; i < this.workerCount; i++) {
      const worker = new Worker(workerPath, {
        execArgv: ['--loader', 'ts-node/esm']
      })

      worker.on('message', (message) => {
        this.handleWorkerMessage(message)
      })

      worker.on('error', (error) => {
        console.error(`Worker ${i} error:`, error)
        if (this.onError) {
          this.onError(`Worker ${i} error: ${error.message}`)
        }
      })

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Worker ${i} exited with code ${code}`)
        }
      })

      this.workers.push(worker)
    }
  }

  private distributeTasks() {
    // Group tasks by worker ID
    const workerTasks: { [key: number]: WorkerTask[] } = {}
    
    this.taskQueue.forEach(task => {
      if (!workerTasks[task.workerId]) {
        workerTasks[task.workerId] = []
      }
      workerTasks[task.workerId].push(task)
    })

    // Send tasks to workers
    Object.entries(workerTasks).forEach(([workerIdStr, tasks]) => {
      const workerId = parseInt(workerIdStr)
      if (this.workers[workerId] && tasks.length > 0) {
        console.log(`📤 Sending ${tasks.length} tasks to worker ${workerId}`)
        
        // Send tasks one by one to enable progress tracking
        tasks.forEach(task => {
          this.workers[workerId].postMessage(task)
        })
      }
    })
  }

  private handleWorkerMessage(message: any) {
    if (message.type === 'success') {
      // Add results from worker
      if (message.results && Array.isArray(message.results)) {
        this.results.push(...message.results)
      }
      
      this.completedTasks++
      
      // Report progress
      if (this.onProgress) {
        this.onProgress(this.completedTasks, this.totalTasks)
      }
      
      console.log(`✅ Worker ${message.workerId} completed task (${this.completedTasks}/${this.totalTasks})`)
      
      // Check if all tasks are complete
      if (this.completedTasks >= this.totalTasks) {
        console.log(`🎉 All ${this.totalTasks} tasks completed with ${this.results.length} results`)
        if (this.onComplete) {
          this.onComplete(this.results)
        }
      }
      
    } else if (message.type === 'error') {
      console.error(`❌ Worker ${message.workerId} error:`, message.error)
      this.completedTasks++
      
      // Continue processing even with errors
      if (this.onProgress) {
        this.onProgress(this.completedTasks, this.totalTasks)
      }
      
      if (this.completedTasks >= this.totalTasks) {
        if (this.onComplete) {
          this.onComplete(this.results)
        }
      }
    }
  }

  private cleanup() {
    console.log('🧹 Cleaning up workers...')
    this.workers.forEach((worker, index) => {
      try {
        worker.terminate()
      } catch (error) {
        console.error(`Error terminating worker ${index}:`, error)
      }
    })
    this.workers = []
  }

  getWorkerCount(): number {
    return this.workerCount
  }
}