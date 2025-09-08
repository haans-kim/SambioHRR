import type { Employee } from '@/types/database'

export type JobGroup = 'PRODUCTION' | 'RESEARCH' | 'OFFICE' | 'MANAGEMENT'

export class JobGroupClassifier {
  classifyEmployee(employee: Employee): JobGroup {
    const dept = (employee.department || '').toLowerCase()
    const position = (employee.position || '').toLowerCase()
    
    // Check position first for management
    if (position.includes('팀장') || 
        position.includes('부장') || 
        position.includes('이사') ||
        position.includes('임원') ||
        position.includes('대표')) {
      return 'MANAGEMENT'
    }
    
    // Check department for production
    if (dept.includes('생산') || 
        dept.includes('제조') ||
        dept.includes('공정') ||
        dept.includes('설비') ||
        dept.includes('유틸리티') ||
        dept.includes('엔지니어링')) {
      return 'PRODUCTION'
    }
    
    // Check for research/QC
    if (dept.includes('연구') || 
        dept.includes('개발') ||
        dept.includes('r&d') ||
        dept.includes('qc') ||
        dept.includes('품질') ||
        dept.includes('분석') ||
        dept.includes('실험')) {
      return 'RESEARCH'
    }
    
    // Check shift type as additional indicator
    if (employee.shift_type === '2교대') {
      return 'PRODUCTION'
    }
    
    // Default to office
    return 'OFFICE'
  }
  
  getJobGroupProbability(jobGroup: JobGroup): number {
    switch (jobGroup) {
      case 'PRODUCTION':
        return 0.95
      case 'RESEARCH':
        return 0.85
      case 'OFFICE':
        return 0.80
      case 'MANAGEMENT':
        return 0.75
      default:
        return 0.80
    }
  }
  
  getJobGroupName(jobGroup: JobGroup): string {
    switch (jobGroup) {
      case 'PRODUCTION':
        return '생산직'
      case 'RESEARCH':
        return '연구직'
      case 'OFFICE':
        return '사무직'
      case 'MANAGEMENT':
        return '관리직'
      default:
        return '기타'
    }
  }
}