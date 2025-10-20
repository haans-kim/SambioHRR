/**
 * 마이그레이션 진행상황 추적기
 * 메모리에 현재 진행상황을 저장하고 조회할 수 있게 함
 */

export interface MigrationProgress {
  jobId: string
  status: 'running' | 'completed' | 'error'
  currentMonth?: string
  currentDate?: string
  processedEmployees: number
  totalEvents: number
  completedMonths: string[]
  totalMonths: number
  error?: string
  startTime: number
}

class ProgressTrackerClass {
  private progress: Map<string, MigrationProgress> = new Map()

  create(jobId: string, totalMonths: number): void {
    this.progress.set(jobId, {
      jobId,
      status: 'running',
      processedEmployees: 0,
      totalEvents: 0,
      completedMonths: [],
      totalMonths,
      startTime: Date.now()
    })
  }

  update(jobId: string, update: Partial<MigrationProgress>): void {
    const current = this.progress.get(jobId)
    if (current) {
      this.progress.set(jobId, { ...current, ...update })
    }
  }

  get(jobId: string): MigrationProgress | undefined {
    return this.progress.get(jobId)
  }

  complete(jobId: string): void {
    const current = this.progress.get(jobId)
    if (current) {
      this.progress.set(jobId, { ...current, status: 'completed' })
    }
  }

  error(jobId: string, error: string): void {
    const current = this.progress.get(jobId)
    if (current) {
      this.progress.set(jobId, { ...current, status: 'error', error })
    }
  }

  delete(jobId: string): void {
    this.progress.delete(jobId)
  }

  cleanup(): void {
    // 1시간 이상 된 작업 삭제
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    for (const [jobId, progress] of this.progress.entries()) {
      if (progress.startTime < oneHourAgo) {
        this.progress.delete(jobId)
      }
    }
  }
}

export const ProgressTracker = new ProgressTrackerClass()

// 주기적으로 오래된 작업 정리
setInterval(() => {
  ProgressTracker.cleanup()
}, 10 * 60 * 1000) // 10분마다
