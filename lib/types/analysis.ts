/**
 * 분석 관련 타입 정의
 */

// 태그 이벤트 인터페이스
export interface TagEvent {
  timestamp: string;
  tagType: 'TagLog' | 'Equipment' | 'Knox' | 'Meal';
  tagName: string;
  tagCode: string;
  duration?: number;
  state?: string;
  judgment?: string;
  probability?: number;
}

// 집중 근무 세션
export interface FocusSession {
  startTime: string;
  endTime: string;
  duration: number; // 밀리초
  oTagCount: number;
  oTagDensity: number; // 시간당 O 태그 수
  isFocusTime: boolean;
}

// 집중 근무 메트릭
export interface FocusMetrics {
  totalFocusTime: number; // 총 집중 근무 시간 (밀리초)
  totalWorkTime: number; // 총 근무 시간 (밀리초)
  focusRatio: number; // 집중 근무 비율 (0-1)
  focusSessionCount: number; // 집중 근무 세션 수
  averageSessionDuration: number; // 평균 세션 지속 시간
  longestSession: number; // 최장 집중 근무 시간
  sessions: FocusSession[];
}

// 직원별 집중도 분석
export interface EmployeeFocusAnalysis {
  employeeId: string;
  employeeName: string;
  date: string;
  metrics: FocusMetrics;
  hourlyPattern: Map<number, number>;
}

// 조직별 집중도 통계
export interface OrganizationFocusStats {
  orgLevel: 'center' | 'division' | 'team' | 'group';
  orgName: string;
  avgFocusTime: number;
  avgFocusRatio: number;
  topPerformers: EmployeeFocusAnalysis[];
}