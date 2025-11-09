// @ts-nocheck
"use client";

import { OrganizationWithStats, Organization } from "@/lib/types/organization";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";
import { MetricType } from "./MetricSelector";
import { useRouter } from "next/navigation";
import { useDevMode } from "@/contexts/DevModeContext";

interface GroupCardsProps {
  groups: OrganizationWithStats[];
  parentOrg?: Organization | null;
  selectedMetric?: MetricType;
  avgEfficiency?: number;
  avgWorkHours?: number;
  avgClaimedHours?: number;
  avgWeeklyWorkHours?: number;
  avgWeeklyClaimedHours?: number;
  avgFocusedWorkHours?: number;
  avgDataReliability?: number;
  avgAdjustedWeeklyWorkHours?: number;
  thresholds?: {
    efficiency: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    workHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    claimedHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyClaimedHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    focusedWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    dataReliability?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    adjustedWeeklyWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
  };
}

interface GroupCardProps {
  org: OrganizationWithStats;
  selectedMetric: MetricType;
  thresholds?: { low: number; high: number };
  onClick?: () => void;
}

function GroupCard({ org, selectedMetric, thresholds, onClick }: GroupCardProps) {
  const { isDevMode } = useDevMode();
  const efficiency = org.stats?.avgWorkEfficiency || 0;
  const workHours = org.stats?.avgActualWorkHours || 0;
  const claimedHours = org.stats?.avgAttendanceHours || 0;
  // 탄력근무제가 적용된 팀은 보정된 주간 근무시간을 사용
  const weeklyWorkHours = org.stats?.avgWeeklyWorkHoursAdjusted || org.stats?.avgWeeklyWorkHours || (workHours * 5);
  const weeklyClaimedHours = org.stats?.avgWeeklyClaimedHoursAdjusted || org.stats?.avgWeeklyClaimedHours || (claimedHours * 5);
  const focusedWorkHours = org.stats?.avgFocusedWorkHours || 0;
  const dataReliability = org.stats?.avgDataReliability || 0;
  const employees = org.stats?.totalEmployees || 0;

  const getValue = () => {
    switch (selectedMetric) {
      case 'efficiency':
        return efficiency;
      case 'workHours':
        return workHours;
      case 'claimedHours':
        return claimedHours;
      case 'weeklyWorkHours':
        // Natural 방식 우선 사용
        return org.stats?.avgWeeklyWorkHoursAdjusted || org.stats?.avgWeeklyWorkHours || 0;
      case 'adjustedWeeklyWorkHours':
        return org.stats?.avgAdjustedWeeklyWorkHours || 0;
      case 'weeklyClaimedHours':
        // Natural 방식 우선 사용
        return org.stats?.avgWeeklyClaimedHoursAdjusted || org.stats?.avgWeeklyClaimedHours || 0;
      case 'focusedWorkHours':
        return focusedWorkHours;
      case 'dataReliability':
        return dataReliability;
      default:
        return efficiency;
    }
  };

  const value = getValue();

  const getStatusIcon = (value: number) => {
    if (!thresholds) {
      // thresholds가 없으면 중간값으로 표시 (fallback 사용하지 않음)
      return "●";
    }

    // Use dynamic thresholds - 상위 20% (high) 이상은 ▲, 하위 20% (low) 이하는 ▼
    if (value >= thresholds.high) return "▲";
    if (value <= thresholds.low) return "▼";
    return "●";
  };

  const getIconColor = (value: number) => {
    if (!thresholds) {
      // thresholds가 없으면 녹색으로 표시 (fallback 사용하지 않음)
      return "text-green-600";
    }

    // Use dynamic thresholds - 상위 20% (high) 이상은 파란색, 하위 20% (low) 이하는 빨간색
    if (value >= thresholds.high) return "text-red-600";
    if (value <= thresholds.low) return "text-blue-600";
    return "text-green-600";
  };

  const getCardStyle = (value: number) => {
    if (!thresholds) {
      // Fallback based on metric type
      if (selectedMetric === 'efficiency') {
        if (value >= 98.1) return "border-red-300 bg-red-50";
        if (value > 97.5) return "border-green-300 bg-green-50";
        return "border-blue-300 bg-blue-50";
      } else if (selectedMetric === 'workHours') {
        if (value >= 8.0) return "border-red-300 bg-red-50";
        if (value >= 6.0) return "border-green-300 bg-green-50";
        return "border-blue-300 bg-blue-50";
      } else if (selectedMetric === 'claimedHours') {
        if (value >= 9.0) return "border-red-300 bg-red-50";
        if (value >= 7.0) return "border-green-300 bg-green-50";
        return "border-blue-300 bg-blue-50";
      } else if (selectedMetric === 'weeklyWorkHours' || selectedMetric === 'adjustedWeeklyWorkHours') {
        if (value >= 45.0) return "border-red-300 bg-red-50";
        if (value >= 35.0) return "border-green-300 bg-green-50";
        return "border-blue-300 bg-blue-50";
      } else if (selectedMetric === 'weeklyClaimedHours') {
        if (value >= 48.0) return "border-red-300 bg-red-50";
        if (value >= 38.0) return "border-green-300 bg-green-50";
        return "border-blue-300 bg-blue-50";
      } else if (selectedMetric === 'focusedWorkHours') {
        if (value >= 5.0) return "border-red-300 bg-red-50";
        if (value >= 2.0) return "border-green-300 bg-green-50";
        return "border-blue-300 bg-blue-50";
      } else {
        // dataReliability
        if (value >= 80.0) return "border-red-300 bg-red-50";
        if (value >= 50.0) return "border-green-300 bg-green-50";
        return "border-blue-300 bg-blue-50";
      }
    }
    
    // Use dynamic thresholds - 상위 20% (high) 이상은 파란색, 하위 20% (low) 이하는 빨간색
    if (value >= thresholds.high) return "border-red-300 bg-red-50";
    if (value <= thresholds.low) return "border-blue-300 bg-blue-50";
    return "border-green-300 bg-green-50";
  };

  const getProgressColor = (value: number) => {
    if (!thresholds) {
      // Fallback - burnout perspective: higher = red, lower = blue
      if (selectedMetric === 'efficiency') {
        if (value >= 98.1) return "#ef4444"; // red - 상위 (번아웃 위험)
        if (value > 97.5) return "#10b981"; // green - 중위
        return "#3b82f6"; // blue - 하위 (양호)
      } else {
        if (value >= 8.0) return "#ef4444"; // red - 상위 (번아웃 위험)
        if (value >= 6.0) return "#10b981"; // green - 중위
        return "#3b82f6"; // blue - 하위 (양호)
      }
    }
    
    // Use dynamic thresholds - burnout perspective
    if (value >= thresholds.high) return "#ef4444"; // red - 상위 (번아웃 위험)
    if (value > thresholds.low) return "#10b981"; // green - 중위
    return "#3b82f6"; // blue - 하위 (양호)
  };

  const formatValue = (value: number, metric: MetricType) => {
    if (metric === 'efficiency' || metric === 'dataReliability') {
      return `${value.toFixed(1)}%`;
    } else {
      return `${value.toFixed(1)}`;
    }
  };

  const getMetricLabel = (metric: MetricType) => {
    switch (metric) {
      case 'efficiency':
        return '평균 효율성';
      case 'workHours':
        return '일간 근무추정시간';
      case 'claimedHours':
        return '일간 근무시간';
      case 'weeklyWorkHours':
        return '주간 추정근태시간';
      case 'adjustedWeeklyWorkHours':
        return '주간 추정근태시간';
      case 'weeklyClaimedHours':
        return '주간 근태시간';
      case 'focusedWorkHours':
        return '집중근무시간';
      case 'dataReliability':
        return '데이터 신뢰도';
      default:
        return '평균 효율성';
    }
  };

  return (
    <div 
      className={cn(
        "p-4 rounded-lg border shadow-sm transition-all h-[140px] hover:shadow-md cursor-pointer",
        getCardStyle(value)
      )}
      onClick={onClick}
    >
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-semibold text-gray-900 mb-2 truncate">{org.orgName}</h3>
        
        <div className="flex items-center justify-between flex-1">
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold">
                {formatValue(value, selectedMetric)}
              </span>
              <span className={cn("text-lg", getIconColor(value))}>
                {getStatusIcon(value)}
              </span>
            </div>
            <div className="text-xs text-gray-600 mt-0.5">{getMetricLabel(selectedMetric)}</div>
          </div>
          
          <div className="text-right">
            <div className="text-xl font-semibold text-gray-700">
              <NumberTicker value={employees} />명
            </div>
            <div className="text-xs text-gray-600">팀원 수</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: selectedMetric === 'efficiency' || selectedMetric === 'dataReliability' 
                  ? `${value}%` 
                  : selectedMetric === 'weeklyWorkHours' || selectedMetric === 'adjustedWeeklyWorkHours' || selectedMetric === 'weeklyClaimedHours'
                  ? `${Math.min((value / 50) * 100, 100)}%`  // Scale weekly hours to 50h max
                  : `${Math.min(value * 10, 100)}%`,
                backgroundColor: getProgressColor(value)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function GroupCards({
  groups,
  parentOrg,
  selectedMetric = 'efficiency',
  avgEfficiency = 88,
  avgWorkHours = 8.2,
  avgClaimedHours = 8.5,
  avgWeeklyWorkHours = 40.0,
  avgWeeklyClaimedHours = 42.5,
  avgAdjustedWeeklyWorkHours = 38.4,
  avgFocusedWorkHours = 4.2,
  avgDataReliability = 65.0,
  thresholds
}: GroupCardsProps) {
  const router = useRouter();
  const { isDevMode } = useDevMode();

  console.log('GroupCards received data:', {
    groupsCount: groups?.length,
    avgEfficiency,
    avgDataReliability,
    firstGroup: groups?.[0]
  });
  
  const getCurrentThresholds = () => {
    return thresholds?.[selectedMetric]?.thresholds;
  };
  
  const handleGroupClick = (groupCode: string, groupName: string) => {
    // Navigate to group statistics page using group code
    router.push(`/group/${encodeURIComponent(groupCode)}`);
  };

  // parentOrg가 있으면 기존 방식대로, 없으면 센터별로 그룹화
  const groupedGroups = groups.reduce((acc, group) => {
    if (parentOrg) {
      // 기존 방식: 전체 그룹을 하나의 그룹으로
      if (!acc['전체']) {
        acc['전체'] = [];
      }
      acc['전체'].push(group);
    } else {
      // 그룹별분석 페이지: 센터별로 그룹화
      const centerName = group.stats?.centerName || '미분류';
      if (!acc[centerName]) {
        acc[centerName] = [];
      }
      acc[centerName].push(group);
    }
    return acc;
  }, {} as Record<string, OrganizationWithStats[]>);

  // 각 센터별 그룹들을 정렬하고 상위/중위/하위로 분류
  const categorizeGroups = (groups: OrganizationWithStats[], useLocalThresholds: boolean = false) => {
    const getValue = (group: OrganizationWithStats) => {
      switch (selectedMetric) {
        case 'efficiency':
          return group.stats?.avgWorkEfficiency || 0;
        case 'workHours':
          return group.stats?.avgActualWorkHours || 0;
        case 'claimedHours':
          return group.stats?.avgAttendanceHours || 0;
        case 'weeklyWorkHours':
          // Natural 방식 우선 사용
          return group.stats?.avgWeeklyWorkHoursAdjusted || group.stats?.avgWeeklyWorkHours || 0;
        case 'adjustedWeeklyWorkHours':
          return group.stats?.avgAdjustedWeeklyWorkHours || 0;
        case 'weeklyClaimedHours':
          // Natural 방식 우선 사용
          return group.stats?.avgWeeklyClaimedHoursAdjusted || group.stats?.avgWeeklyClaimedHours || 0;
        case 'focusedWorkHours':
          return group.stats?.avgFocusedWorkHours || 0;
        case 'dataReliability':
          return group.stats?.avgDataReliability || 0;
        default:
          return group.stats?.avgWorkEfficiency || 0;
      }
    };

    // 현재 메트릭의 threshold 가져오기
    const currentThresholds = getCurrentThresholds();
    
    // threshold 기준으로 그룹들을 분류
    const top: OrganizationWithStats[] = [];
    const middle: OrganizationWithStats[] = [];
    const bottom: OrganizationWithStats[] = [];
    
    groups.forEach(group => {
      const value = getValue(group);
      if (currentThresholds) {
        if (value >= currentThresholds.high) {
          top.push(group);
        } else if (value <= currentThresholds.low) {
          bottom.push(group);
        } else {
          middle.push(group);
        }
      } else {
        // fallback to count-based categorization
        middle.push(group);
      }
    });
    
    // 각 그룹 내에서 정렬
    top.sort((a, b) => getValue(b) - getValue(a));
    middle.sort((a, b) => getValue(b) - getValue(a));
    bottom.sort((a, b) => getValue(b) - getValue(a));
    
    // 로컬 임계값 계산 (팀 내부에서만 비교할 때 사용)
    let localThresholds = null;
    if (useLocalThresholds && groups.length > 0) {
      const values = groups.map(group => getValue(group)).filter(v => v > 0).sort((a, b) => a - b);
      if (values.length > 0) {
        const getPercentile = (arr: number[], percentile: number) => {
          if (arr.length === 0) return 0;
          if (arr.length <= 3) {
            if (percentile <= 20) return arr[0];
            if (percentile >= 80) return arr[arr.length - 1];
            return arr[Math.floor(arr.length / 2)];
          }
          const index = Math.ceil((percentile / 100) * arr.length) - 1;
          return arr[Math.max(0, Math.min(index, arr.length - 1))];
        };
        
        localThresholds = {
          low: getPercentile(values, 20),
          high: getPercentile(values, 80)
        };
      }
    }
    
    return { top, middle, bottom, localThresholds };
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-300 shadow-lg p-6">
      <h2 className="text-lg font-semibold mb-4">
        {parentOrg ? `${parentOrg.orgName} 현황` : '전체 그룹 현황'}
      </h2>
      
      <div className="space-y-6">
        {Object.entries(groupedGroups).map(([center, centerGroups]) => {
          const effectiveThresholds = getCurrentThresholds();
          
          // 값에 따라 정렬 (내림차순)
          const sortedGroups = [...centerGroups].sort((a, b) => {
            const getGroupValue = (group: OrganizationWithStats) => {
              switch (selectedMetric) {
                case 'efficiency':
                  return group.stats?.avgWorkEfficiency || 0;
                case 'workHours':
                  return group.stats?.avgActualWorkHours || 0;
                case 'claimedHours':
                  return group.stats?.avgAttendanceHours || 0;
                case 'weeklyWorkHours':
                  // Natural 방식 우선 사용
                  return group.stats?.avgWeeklyWorkHoursAdjusted || group.stats?.avgWeeklyWorkHours || 0;
                case 'adjustedWeeklyWorkHours':
                  return group.stats?.avgAdjustedWeeklyWorkHours || 0;
                case 'weeklyClaimedHours':
                  // Natural 방식 우선 사용
                  return group.stats?.avgWeeklyClaimedHoursAdjusted || group.stats?.avgWeeklyClaimedHours || 0;
                case 'focusedWorkHours':
                  return group.stats?.avgFocusedWorkHours || 0;
                case 'dataReliability':
                  return group.stats?.avgDataReliability || 0;
                default:
                  return group.stats?.avgWorkEfficiency || 0;
              }
            };
            return getGroupValue(b) - getGroupValue(a);
          });
          
          return (
            <div key={center} className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-base font-semibold mb-3 text-gray-900">{center}</h3>
              
              {/* 모든 그룹을 한 행에 표시 */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {sortedGroups.map((group) => (
                  <GroupCard
                    key={group.orgCode}
                    org={group}
                    selectedMetric={selectedMetric}
                    thresholds={effectiveThresholds}
                    onClick={() => handleGroupClick(group.orgCode, group.orgName)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip for information - Box style formatting */}
      <div className="mt-4 p-3 bg-white border border-gray-200 text-gray-900 rounded-lg text-sm shadow-sm">
        <div className="grid grid-cols-2 gap-0">
          <div className="pr-4">
            <div className="font-semibold text-gray-900">
              {selectedMetric === 'efficiency' && `평균 효율성 : ${avgEfficiency.toFixed(1)}%`}
              {selectedMetric === 'workHours' && `일간 근무추정시간 : ${avgWorkHours.toFixed(1)}h`}
              {selectedMetric === 'claimedHours' && `일간 근무시간 : ${avgClaimedHours.toFixed(1)}h`}
              {selectedMetric === 'weeklyWorkHours' && `주간 근무추정시간 : ${avgWeeklyWorkHours.toFixed(1)}h`}
              {selectedMetric === 'adjustedWeeklyWorkHours' && `주간 추정근태시간 : ${avgAdjustedWeeklyWorkHours?.toFixed(1) || '0.0'}h`}
              {selectedMetric === 'weeklyClaimedHours' && `주간 근태시간 : ${avgWeeklyClaimedHours.toFixed(1)}h`}
              {selectedMetric === 'focusedWorkHours' && `일간 집중근무시간 : ${avgFocusedWorkHours.toFixed(1)}h`}
              {selectedMetric === 'dataReliability' && `데이터 신뢰도 : ${avgDataReliability.toFixed(1)}%`}
            </div>
            <div className="text-xs text-gray-700 mt-1">
              {selectedMetric === 'efficiency' && '실제 근무시간 ÷ 총 근무시간 × 100 | 30일 평균 데이터'}
              {selectedMetric === 'workHours' && '실제 근무시간 평균 | 30일 평균 데이터'}
              {selectedMetric === 'claimedHours' && '신고 근무시간 평균 | 30일 평균 데이터'}
              {selectedMetric === 'weeklyWorkHours' && '주당 실제 근무시간 평균 | 30일 평균 데이터'}
              {selectedMetric === 'adjustedWeeklyWorkHours' && '주당 추정 근무시간 평균 | 30일 평균 데이터'}
              {selectedMetric === 'weeklyClaimedHours' && '주당 신고 근무시간 평균 | 30일 평균 데이터'}
              {selectedMetric === 'focusedWorkHours' && '집중적으로 업무에 몰입한 시간 | 30일 평균 데이터'}
              {selectedMetric === 'dataReliability' && '데이터 신뢰도 점수 | 30일 평균 데이터'}
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 상위({thresholds?.[selectedMetric]?.high}) | ● 중위({thresholds?.[selectedMetric]?.middle}) | ▼ 하위({thresholds?.[selectedMetric]?.low})
            </div>
          </div>
          <div className="pl-4 border-l border-gray-300 grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-medium text-gray-800">포함된 시간</div>
              <div className="text-xs text-gray-600 mt-1">
                ✓ 실제 근무시간 (출퇴근 기록)
              </div>
              <div className="text-xs text-gray-600">
                ✓ 연차·휴가 시간 (8h/일, 4h/반차, 시간연차)
              </div>
              <div className="text-xs text-gray-600">
                ✓ 출장·교육 시간 (8h 기본값)
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-800">제외된 시간</div>
              <div className="text-xs text-gray-600 mt-1">
                ✗ 식사 시간
              </div>
              <div className="text-xs text-gray-600">
                ✗ 휴식 시간
              </div>
              <div className="text-xs text-gray-600">
                ✗ 비업무 이동 시간
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}