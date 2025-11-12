// @ts-nocheck
"use client";

import { OrganizationWithStats, Organization } from "@/lib/types/organization";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { MetricType } from "./MetricSelector";
import { mapOrganizationName } from "@/lib/organization-mapping";

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
  avgAdjustedWeeklyWorkHours?: number;
  thresholds?: {
    efficiency: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    workHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    claimedHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    adjustedWeeklyWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
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
  // 탄력근무제가 적용된 팀은 보정된 주간 근무시간을 사용
  const weeklyWorkHours = org.stats?.avgWeeklyWorkHoursAdjusted || org.stats?.avgWeeklyWorkHours || (workHours * 5);
  const weeklyClaimedHours = org.stats?.avgWeeklyClaimedHoursAdjusted || org.stats?.avgWeeklyClaimedHours || (claimedHours * 5);
  const focusedWorkHours = org.stats?.avgFocusedWorkHours || 0;
  const dataReliability = org.stats?.avgDataReliability || 0;
  // AI 보정은 탄력근무제가 이미 적용된 값에 추가로 적용됨
  const adjustedWeeklyWorkHours = org.stats?.avgAdjustedWeeklyWorkHours || 0;
  const employees = org.stats?.totalEmployees || 0;
  
  // Debug logging for adjusted values
  if (selectedMetric === 'adjustedWeeklyWorkHours') {
    console.log(`[PlantCard] ${org.orgName}:`, {
      weeklyWorkHours,
      adjustedWeeklyWorkHours,
      dataReliability,
      'org.stats': org.stats
    });
  }

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
      case 'adjustedWeeklyWorkHours':
        console.log(`getValue for ${org.orgName}: adjustedWeeklyWorkHours = ${adjustedWeeklyWorkHours}`);
        return adjustedWeeklyWorkHours;
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

  const getStatusIcon = (value: number) => {
    if (!thresholds) {
      // thresholds가 없으면 중간값으로 표시 (fallback 사용하지 않음)
      return "●";
    }

    // Use dynamic thresholds - 상위 20% (high) 이상은 ▲, 하위 20% (low) 이하는 ▼
    // 3개 이하 팀일 때는 정확히 최대/최소값만 구분
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
        if (value >= 98.1) return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
        if (value > 97.5) return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
        return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
      } else if (selectedMetric === 'workHours') {
        if (value >= 8.0) return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
        if (value >= 6.0) return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
        return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
      } else if (selectedMetric === 'claimedHours') {
        if (value >= 9.0) return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
        if (value >= 7.0) return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
        return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
      } else if (selectedMetric === 'weeklyWorkHours' || selectedMetric === 'adjustedWeeklyWorkHours') {
        if (value >= 48.0) return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
        if (value > 42.5) return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
        return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
      } else if (selectedMetric === 'weeklyClaimedHours') {
        if (value >= 48.0) return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
        if (value >= 38.0) return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
        return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
      } else if (selectedMetric === 'focusedWorkHours') {
        if (value >= 5.0) return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
        if (value >= 2.0) return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
        return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
      } else {
        // dataReliability
        if (value >= 85.0) return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
        if (value >= 70.0) return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
        return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
      }
    }
    
    // Use dynamic thresholds - 상위 20% (high) 이상은 파란색, 하위 20% (low) 이하는 빨간색
    if (value >= thresholds.high) return "border-2 border-red-500 bg-gradient-to-br from-red-50 to-white";
    if (value <= thresholds.low) return "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white";
    return "border-2 border-green-500 bg-gradient-to-br from-green-50 to-white";
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
        "p-4 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer h-[140px]",
        getCardStyle(value)
      )}
      onClick={onClick}
    >
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-semibold text-gray-900 mb-2 truncate">{mapOrganizationName(org.orgName)}</h3>

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
  avgAdjustedWeeklyWorkHours = 38.4,
  avgFocusedWorkHours = 4.2,
  avgDataReliability = 83.6,
  thresholds
}: TeamPlantCardsProps) {
  const router = useRouter();

  console.log('TeamPlantCards received data:', {
    teamsCount: teams?.length,
    avgEfficiency,
    avgDataReliability,
    firstTeam: teams?.[0]
  });
  
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

  // parentOrg가 있으면 기존 방식대로, 없으면 센터별로 그룹화
  const groupedTeams = teams.reduce((acc, team) => {
    if (parentOrg) {
      // 기존 방식: 전체 팀을 하나의 그룹으로
      if (!acc['전체']) {
        acc['전체'] = [];
      }
      acc['전체'].push(team);
    } else {
      // 팀별분석 페이지: 센터별로 그룹화
      const centerName = team.stats?.centerName || '미분류';
      if (!acc[centerName]) {
        acc[centerName] = [];
      }
      acc[centerName].push(team);
    }
    return acc;
  }, {} as Record<string, OrganizationWithStats[]>);

  // 각 센터별 팀들을 정렬하고 상위/중위/하위로 분류
  const categorizeTeams = (teams: OrganizationWithStats[], useLocalThresholds: boolean = false) => {
    // 현재 메트릭의 threshold 가져오기
    const currentThresholds = getCurrentThresholds();
    
    // threshold 기준으로 팀들을 분류
    const top: OrganizationWithStats[] = [];
    const middle: OrganizationWithStats[] = [];
    const bottom: OrganizationWithStats[] = [];
    
    teams.forEach(team => {
      const value = getValue(team);
      if (currentThresholds) {
        if (value >= currentThresholds.high) {
          top.push(team);
        } else if (value <= currentThresholds.low) {
          bottom.push(team);
        } else {
          middle.push(team);
        }
      } else {
        // fallback to count-based categorization
        middle.push(team);
      }
    });
    
    // 각 그룹 내에서 정렬
    top.sort((a, b) => getValue(b) - getValue(a));
    middle.sort((a, b) => getValue(b) - getValue(a));
    bottom.sort((a, b) => getValue(b) - getValue(a));
    
    // 로컬 임계값 계산 (센터 내부에서만 비교할 때 사용)
    let localThresholds = null;
    if (useLocalThresholds && teams.length > 0) {
      const values = teams.map(team => getValue(team)).filter(v => v > 0).sort((a, b) => a - b);
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

  // 팀의 값을 가져오는 헬퍼 함수 - Natural 방식 사용
  const getValue = (team: OrganizationWithStats) => {
    switch (selectedMetric) {
      case 'efficiency':
        return team.stats?.avgWorkEfficiency || 0;
      case 'workHours':
        return team.stats?.avgActualWorkHours || 0;
      case 'claimedHours':
        return team.stats?.avgAttendanceHours || 0;
      case 'weeklyWorkHours':
        // Natural 방식 우선 사용
        return team.stats?.avgWeeklyWorkHoursAdjusted || team.stats?.avgWeeklyWorkHours || 0;
      case 'adjustedWeeklyWorkHours':
        return team.stats?.avgAdjustedWeeklyWorkHours || 0;
      case 'weeklyClaimedHours':
        // Natural 방식 우선 사용
        return team.stats?.avgWeeklyClaimedHoursAdjusted || team.stats?.avgWeeklyClaimedHours || 0;
      case 'focusedWorkHours':
        return team.stats?.avgFocusedWorkHours || 0;
      case 'dataReliability':
        return team.stats?.avgDataReliability || 0;
      default:
        return team.stats?.avgWorkEfficiency || 0;
    }
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-300 shadow-lg p-6">
      <h2 className="text-lg font-semibold mb-4">
        {parentOrg ? `${mapOrganizationName(parentOrg.orgName)} 현황` : '전체 팀 현황'}
      </h2>

      <div className="space-y-6">
        {Object.entries(groupedTeams).map(([center, centerTeams]) => {
          // 항상 전체 기준으로 비교
          const { top, middle, bottom, localThresholds } = categorizeTeams(centerTeams, false);
          const effectiveThresholds = getCurrentThresholds();

          return (
            <div key={center} className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-base font-semibold mb-3 text-gray-900">{mapOrganizationName(center)}</h3>
              
              {/* 개별 센터 뷰에서는 모든 팀을 한 행에 표시 */}
              {parentOrg ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {[...top, ...middle, ...bottom].sort((a, b) => getValue(b) - getValue(a)).map((team) => (
                    <PlantCard
                      key={team.orgCode}
                      org={team}
                      selectedMetric={selectedMetric}
                      thresholds={effectiveThresholds}
                      onClick={() => handleCardClick(team)}
                    />
                  ))}
                </div>
              ) : (
                <>
                  {/* 전체 팀 뷰에서는 기존처럼 상/중/하 구분 표시 */}
                  {top.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-red-600 mb-2">상위 20%</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                        {top.map((team) => (
                          <PlantCard
                            key={team.orgCode}
                            org={team}
                            selectedMetric={selectedMetric}
                            thresholds={effectiveThresholds}
                            onClick={() => handleCardClick(team)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {middle.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-green-600 mb-2">중위 60%</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                        {middle.map((team) => (
                          <PlantCard
                            key={team.orgCode}
                            org={team}
                            selectedMetric={selectedMetric}
                            thresholds={effectiveThresholds}
                            onClick={() => handleCardClick(team)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {bottom.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-blue-600 mb-2">하위 20%</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                        {bottom.map((team) => (
                          <PlantCard
                            key={team.orgCode}
                            org={team}
                            selectedMetric={selectedMetric}
                            thresholds={effectiveThresholds}
                            onClick={() => handleCardClick(team)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
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
              {selectedMetric === 'dataReliability' && '데이터 품질 및 정확성 점수 | 30일 평균 데이터'}
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