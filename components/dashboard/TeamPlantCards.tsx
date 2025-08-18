"use client";

import { OrganizationWithStats, Organization } from "@/lib/types/organization";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { MetricType } from "./MetricSelector";

interface TeamPlantCardsProps {
  teams: OrganizationWithStats[];
  parentOrg?: Organization | null;
  selectedMetric?: MetricType;
  avgEfficiency?: number;
  avgWorkHours?: number;
  avgClaimedHours?: number;
  avgWeeklyWorkHours?: number;
  avgWeeklyClaimedHours?: number;
  avgFocusedWorkHours?: number;
  avgDataReliability?: number;
  thresholds?: {
    efficiency: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    workHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    claimedHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyClaimedHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    focusedWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    dataReliability?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
  };
}

interface PlantCardProps {
  org: OrganizationWithStats;
  selectedMetric: MetricType;
  thresholds?: { low: number; high: number };
  onClick?: () => void;
}

function PlantCard({ org, selectedMetric, thresholds, onClick }: PlantCardProps) {
  const efficiency = org.stats?.avgWorkEfficiency || 0;
  const workHours = org.stats?.avgActualWorkHours || 0;
  const claimedHours = org.stats?.avgAttendanceHours || 0;
  const weeklyWorkHours = org.stats?.avgWeeklyWorkHours || (workHours * 5);
  const weeklyClaimedHours = org.stats?.avgWeeklyClaimedHours || (claimedHours * 5);
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
        return weeklyWorkHours;
      case 'weeklyClaimedHours':
        return weeklyClaimedHours;
      case 'focusedWorkHours':
        return focusedWorkHours;
      case 'dataReliability':
        return dataReliability;
      default:
        return efficiency;
    }
  };

  const value = getValue();
  
  // Debug logging
  console.log('Team:', org.orgName, 'Metric:', selectedMetric, 'Value:', value, 'Thresholds:', thresholds);

  const getStatusIcon = (value: number) => {
    if (!thresholds) {
      // Fallback based on metric type
      if (selectedMetric === 'efficiency') {
        if (value >= 88.4) return "▲";
        if (value > 73.2) return "●";
        return "▼";
      } else if (selectedMetric === 'workHours') {
        if (value >= 8.0) return "▲";
        if (value >= 6.0) return "●";
        return "▼";
      } else if (selectedMetric === 'claimedHours') {
        if (value >= 9.0) return "▲";
        if (value >= 7.0) return "●";
        return "▼";
      } else if (selectedMetric === 'weeklyWorkHours') {
        if (value >= 48.0) return "▲";
        if (value > 42.5) return "●";
        return "▼";
      } else if (selectedMetric === 'weeklyClaimedHours') {
        if (value >= 48.0) return "▲";
        if (value >= 38.0) return "●";
        return "▼";
      } else if (selectedMetric === 'focusedWorkHours') {
        if (value >= 5.0) return "▲";
        if (value >= 2.0) return "●";
        return "▼";
      } else {
        // dataReliability
        if (value >= 85.0) return "▲";
        if (value >= 70.0) return "●";
        return "▼";
      }
    }
    
    // Use dynamic thresholds - 상위 20% (high) 이상은 ▲, 하위 20% (low) 이하는 ▼
    // 3개 이하 팀일 때는 정확히 최대/최소값만 구분
    if (value >= thresholds.high) return "▲";
    if (value <= thresholds.low) return "▼";
    return "●";
  };

  const getIconColor = (value: number) => {
    if (!thresholds) {
      // Fallback based on metric type
      if (selectedMetric === 'efficiency') {
        if (value >= 88.4) return "text-blue-600";
        if (value > 73.2) return "text-green-600";
        return "text-red-600";
      } else if (selectedMetric === 'workHours') {
        if (value >= 8.0) return "text-blue-600";
        if (value >= 6.0) return "text-green-600";
        return "text-red-600";
      } else if (selectedMetric === 'claimedHours') {
        if (value >= 9.0) return "text-blue-600";
        if (value >= 7.0) return "text-green-600";
        return "text-red-600";
      } else if (selectedMetric === 'weeklyWorkHours') {
        if (value >= 48.0) return "text-blue-600";
        if (value > 42.5) return "text-green-600";
        return "text-red-600";
      } else if (selectedMetric === 'weeklyClaimedHours') {
        if (value >= 48.0) return "text-blue-600";
        if (value >= 38.0) return "text-green-600";
        return "text-red-600";
      } else if (selectedMetric === 'focusedWorkHours') {
        if (value >= 5.0) return "text-blue-600";
        if (value >= 2.0) return "text-green-600";
        return "text-red-600";
      } else {
        // dataReliability
        if (value >= 85.0) return "text-blue-600";
        if (value >= 70.0) return "text-green-600";
        return "text-red-600";
      }
    }
    
    // Use dynamic thresholds - 상위 20% (high) 이상은 파란색, 하위 20% (low) 이하는 빨간색
    if (value >= thresholds.high) return "text-blue-600";
    if (value <= thresholds.low) return "text-red-600";
    return "text-green-600";
  };

  const getCardStyle = (value: number) => {
    if (!thresholds) {
      // Fallback based on metric type
      if (selectedMetric === 'efficiency') {
        if (value >= 88.4) return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
        if (value > 73.2) return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
        return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
      } else if (selectedMetric === 'workHours') {
        if (value >= 8.0) return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
        if (value >= 6.0) return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
        return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
      } else if (selectedMetric === 'claimedHours') {
        if (value >= 9.0) return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
        if (value >= 7.0) return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
        return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
      } else if (selectedMetric === 'weeklyWorkHours') {
        if (value >= 48.0) return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
        if (value > 42.5) return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
        return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
      } else if (selectedMetric === 'weeklyClaimedHours') {
        if (value >= 48.0) return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
        if (value >= 38.0) return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
        return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
      } else if (selectedMetric === 'focusedWorkHours') {
        if (value >= 5.0) return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
        if (value >= 2.0) return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
        return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
      } else {
        // dataReliability
        if (value >= 85.0) return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
        if (value >= 70.0) return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
        return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
      }
    }
    
    // Use dynamic thresholds - 상위 20% (high) 이상은 파란색, 하위 20% (low) 이하는 빨간색
    if (value >= thresholds.high) return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
    if (value <= thresholds.low) return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
    return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
  };

  const getProgressColor = (value: number) => {
    if (!thresholds) {
      // Fallback
      if (selectedMetric === 'efficiency') {
        if (value >= 88.4) return "#3b82f6"; // blue
        if (value > 73.2) return "#10b981"; // green
        return "#f59e0b"; // amber
      } else {
        if (value >= 8.0) return "#3b82f6";
        if (value >= 6.0) return "#10b981";
        return "#f59e0b";
      }
    }
    
    if (value >= thresholds.high) return "#3b82f6";
    if (value > thresholds.low) return "#10b981";
    return "#f59e0b";
  };

  const formatValue = (value: number, metric: MetricType) => {
    if (metric === 'efficiency') {
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
        return '주간 근무추정시간';
      case 'weeklyClaimedHours':
        return '주간 근무시간';
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
        "p-4 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer h-[140px]",
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
                width: selectedMetric === 'efficiency' ? `${value}%` : `${Math.min(value * 10, 100)}%`,
                backgroundColor: getProgressColor(value)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TeamPlantCards({ 
  teams, 
  parentOrg,
  selectedMetric = 'efficiency',
  avgEfficiency = 88,
  avgWorkHours = 8.2,
  avgClaimedHours = 8.5,
  avgWeeklyWorkHours = 40.0,
  avgWeeklyClaimedHours = 42.5,
  avgFocusedWorkHours = 4.2,
  avgDataReliability = 83.6,
  thresholds
}: TeamPlantCardsProps) {
  const router = useRouter();
  
  // Handle card click to navigate to groups
  const handleCardClick = (team: OrganizationWithStats) => {
    if (team.orgLevel === 'division') {
      router.push(`/teams?division=${team.orgCode}`);
    } else if (team.orgLevel === 'team') {
      router.push(`/groups?team=${team.orgCode}`);
    }
  };

  const getCurrentThresholds = () => {
    return thresholds?.[selectedMetric]?.thresholds;
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-300 shadow-lg p-6">
      <h2 className="text-lg font-semibold mb-4">
        {parentOrg ? `${parentOrg.orgName} 현황` : 'DS담당 현황'}
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {teams.map((team) => (
          <PlantCard
            key={team.orgCode}
            org={team}
            selectedMetric={selectedMetric}
            thresholds={getCurrentThresholds()}
            onClick={() => handleCardClick(team)}
          />
        ))}
      </div>

      {/* Tooltip for information */}
      <div className="mt-4 p-3 bg-white border border-gray-200 text-gray-900 rounded-lg text-sm max-w-md shadow-sm">
        {selectedMetric === 'efficiency' ? (
          <>
            <div className="font-semibold text-gray-900">평균 효율성 : {avgEfficiency.toFixed(1)}%</div>
            <div className="text-xs text-gray-700 mt-1">
              실제 근무시간 ÷ 총 근무시간 × 100 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 모범사례({thresholds?.efficiency?.high}) | ● 양호({thresholds?.efficiency?.middle}) | ▼ 관찰필요({thresholds?.efficiency?.low})
            </div>
          </>
        ) : selectedMetric === 'workHours' ? (
          <>
            <div className="font-semibold text-gray-900">일간 작업추정시간 : {avgWorkHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-700 mt-1">
              실제 근무시간 평균 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 모범사례({thresholds?.workHours?.high}) | ● 양호({thresholds?.workHours?.middle}) | ▼ 관찰필요({thresholds?.workHours?.low})
            </div>
          </>
        ) : selectedMetric === 'claimedHours' ? (
          <>
            <div className="font-semibold text-gray-900">일간 근무시간 : {avgClaimedHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-700 mt-1">
              신고 근무시간 평균 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 모범사례({thresholds?.claimedHours?.high}) | ● 양호({thresholds?.claimedHours?.middle}) | ▼ 관찰필요({thresholds?.claimedHours?.low})
            </div>
          </>
        ) : selectedMetric === 'weeklyWorkHours' ? (
          <>
            <div className="font-semibold text-gray-900">주간 작업추정시간 : {avgWeeklyWorkHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-700 mt-1">
              주당 실제 근무시간 평균 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 모범사례({thresholds?.weeklyWorkHours?.high}) | ● 양호({thresholds?.weeklyWorkHours?.middle}) | ▼ 관찰필요({thresholds?.weeklyWorkHours?.low})
            </div>
          </>
        ) : selectedMetric === 'weeklyClaimedHours' ? (
          <>
            <div className="font-semibold text-gray-900">주간 근무시간 : {avgWeeklyClaimedHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-700 mt-1">
              주당 신고 근무시간 평균 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 모범사례({thresholds?.weeklyClaimedHours?.high}) | ● 양호({thresholds?.weeklyClaimedHours?.middle}) | ▼ 관찰협요({thresholds?.weeklyClaimedHours?.low})
            </div>
          </>
        ) : selectedMetric === 'focusedWorkHours' ? (
          <>
            <div className="font-semibold text-gray-900">일간 집중근무시간 : {avgFocusedWorkHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-700 mt-1">
              집중적으로 업무에 몰입한 시간 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 모범사례({thresholds?.focusedWorkHours?.high}) | ● 양호({thresholds?.focusedWorkHours?.middle}) | ▼ 관찰필요({thresholds?.focusedWorkHours?.low})
            </div>
          </>
        ) : (
          <>
            <div className="font-semibold text-gray-900">데이터 신뢰도 : {avgDataReliability.toFixed(1)}</div>
            <div className="text-xs text-gray-700 mt-1">
              데이터 품질 및 정확성 점수 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 모범사례({thresholds?.dataReliability?.high}) | ● 양호({thresholds?.dataReliability?.middle}) | ▼ 관찰필요({thresholds?.dataReliability?.low})
            </div>
          </>
        )}
      </div>
    </div>
  );
}