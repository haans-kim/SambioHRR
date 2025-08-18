export type OrgLevel = 'center' | 'division' | 'team' | 'group';

export interface Organization {
  orgCode: string;
  orgName: string;
  orgLevel: OrgLevel;
  parentOrgCode?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface OrganizationDailyStats {
  id: number;
  orgCode: string;
  workDate: Date;
  totalEmployees: number;
  flexibleWorkCount: number;
  elasticWorkCount: number;
  avgAttendanceHours: number;
  avgActualWorkHours: number;
  avgWorkEfficiency: number;
  avgMeetingHours: number;
  avgMealHours: number;
  avgMovementHours: number;
  avgRestHours: number;
  avgDataConfidence: number;
  stdActualWorkHours: number;
  stdWorkEfficiency: number;
  minWorkEfficiency: number;
  maxWorkEfficiency: number;
  avgWeeklyWorkHours?: number;
  avgWeeklyClaimedHours?: number;
  avgFocusedWorkHours?: number;
  avgDataReliability?: number;
  centerName?: string;
  avgAdjustedWeeklyWorkHours?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrganizationWithStats extends Organization {
  stats?: OrganizationDailyStats;
  childrenCount?: number;
}