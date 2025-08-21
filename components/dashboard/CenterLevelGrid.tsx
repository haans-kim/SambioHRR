"use client";

import { OrganizationWithStats } from "@/lib/types/organization";
import { cn } from "@/lib/utils";
import { MagicCard } from "@/components/ui/magic-card";
import { TextAnimate } from "@/components/ui/text-animate";
import { useRouter } from "next/navigation";
import { MetricSelector, MetricType } from "./MetricSelector";
import { useState } from "react";

interface CenterLevelGridProps {
  organizations: OrganizationWithStats[];
  gradeMatrix?: {
    grades: string[];
    centers: string[];
    matrix: Record<string, Record<string, number>>;
  };
  workHoursMatrix?: {
    grades: string[];
    centers: string[];
    matrix: Record<string, Record<string, number>>;
  };
  claimedHoursMatrix?: {
    grades: string[];
    centers: string[];
    matrix: Record<string, Record<string, number>>;
  };
  weeklyWorkHoursMatrix?: {
    grades: string[];
    centers: string[];
    matrix: Record<string, Record<string, number>>;
  };
  weeklyClaimedHoursMatrix?: {
    grades: string[];
    centers: string[];
    matrix: Record<string, Record<string, number>>;
  };
  focusedWorkHoursMatrix?: {
    grades: string[];
    centers: string[];
    matrix: Record<string, Record<string, number>>;
  };
  dataReliabilityMatrix?: {
    grades: string[];
    centers: string[];
    matrix: Record<string, Record<string, number>>;
  };
  avgEfficiency?: number;
  avgWorkHours?: number;
  avgClaimedHours?: number;
  avgWeeklyWorkHours?: number;
  avgWeeklyClaimedHours?: number;
  avgAdjustedWeeklyWorkHours?: number;
  avgFocusedWorkHours?: number;
  avgDataReliability?: number;
  selectedMetric?: MetricType;
  onMetricChange?: (metric: MetricType) => void;
  thresholds?: {
    efficiency: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    workHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    claimedHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    adjustedWeeklyWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyClaimedHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    focusedWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    dataReliability?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
  };
}

interface MetricIndicatorProps {
  value: number;
  label: string;
  metricType: MetricType;
  thresholds?: { low: number; high: number };
  onClick?: () => void;
}

function MetricIndicator({ value, label, metricType, thresholds, onClick }: MetricIndicatorProps) {
  const getStatusIcon = (value: number, metricType: MetricType, thresholds?: { low: number; high: number }) => {
    if (!thresholds) {
      // Fallback to hardcoded values if thresholds are not available
      if (metricType === 'efficiency') {
        if (value >= 88.4) return "▲";
        if (value > 73.2) return "●";
        return "▼";
      } else if (metricType === 'workHours') {
        if (value >= 8.0) return "▲";
        if (value >= 6.0) return "●";
        return "▼";
      } else if (metricType === 'claimedHours') {
        if (value >= 9.0) return "▲";
        if (value >= 7.0) return "●";
        return "▼";
      } else if (metricType === 'weeklyWorkHours') {
        if (value >= 45.0) return "▲";
        if (value >= 35.0) return "●";
        return "▼";
      } else if (metricType === 'weeklyClaimedHours') {
        if (value >= 48.0) return "▲";
        if (value >= 38.0) return "●";
        return "▼";
      } else if (metricType === 'adjustedWeeklyWorkHours') {
        if (value >= 42.0) return "▲";
        if (value >= 35.0) return "●";
        return "▼";
      } else if (metricType === 'focusedWorkHours') {
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
    if (value >= thresholds.high) return "▲"; // 상위 20% - 빨간 삼각형 (번아웃 위험)
    if (value <= thresholds.low) return "▼"; // 하위 20% - 파란 역삼각형 (양호)
    return "●"; // 중간 60% 중위 - 초록 원
  };

  const getIconColor = (value: number, metricType: MetricType, thresholds?: { low: number; high: number }) => {
    if (!thresholds) {
      // Fallback to hardcoded values if thresholds are not available
      if (metricType === 'efficiency') {
        if (value >= 88.4) return "text-blue-600";
        if (value > 73.2) return "text-green-600";
        return "text-red-600";
      } else if (metricType === 'workHours') {
        if (value >= 8.0) return "text-blue-600";
        if (value >= 6.0) return "text-green-600";
        return "text-red-600";
      } else if (metricType === 'claimedHours') {
        if (value >= 9.0) return "text-blue-600";
        if (value >= 7.0) return "text-green-600";
        return "text-red-600";
      } else if (metricType === 'weeklyWorkHours') {
        if (value >= 45.0) return "text-blue-600";
        if (value >= 35.0) return "text-green-600";
        return "text-red-600";
      } else if (metricType === 'weeklyClaimedHours') {
        if (value >= 48.0) return "text-blue-600";
        if (value >= 38.0) return "text-green-600";
        return "text-red-600";
      } else if (metricType === 'adjustedWeeklyWorkHours') {
        if (value >= 42.0) return "text-blue-600";
        if (value >= 35.0) return "text-green-600";
        return "text-red-600";
      } else if (metricType === 'focusedWorkHours') {
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
    
    // Use dynamic thresholds
    if (value >= thresholds.high) return "text-red-600"; // 상위 (번아웃 위험)
    if (value <= thresholds.low) return "text-blue-600"; // 하위 (양호)
    return "text-green-600"; // 중위
  };

  const getIconStyle = (value: number, metricType: MetricType, thresholds?: { low: number; high: number }) => {
    // Make circle slightly larger than default to match triangle size
    let isCircle = false;
    
    if (!thresholds) {
      // Fallback to hardcoded values if thresholds are not available
      if (metricType === 'efficiency') {
        isCircle = value > 73.2 && value < 88.4;
      } else if (metricType === 'workHours') {
        isCircle = value >= 6.0 && value < 8.0;
      } else if (metricType === 'claimedHours') {
        isCircle = value >= 7.0 && value < 9.0;
      } else if (metricType === 'weeklyWorkHours') {
        isCircle = value >= 35.0 && value < 45.0;
      } else if (metricType === 'weeklyClaimedHours') {
        isCircle = value >= 38.0 && value < 48.0;
      } else if (metricType === 'adjustedWeeklyWorkHours') {
        isCircle = value >= 35.0 && value < 42.0;
      } else if (metricType === 'focusedWorkHours') {
        isCircle = value >= 2.0 && value < 5.0;
      } else {
        // dataReliability
        isCircle = value >= 70.0 && value < 85.0;
      }
    } else {
      // Use dynamic thresholds
      isCircle = value > thresholds.low && value < thresholds.high;
    }
    
    if (isCircle) {
      return "text-lg scale-[1.35]"; // 중간 60% 원형 크게
    }
    return "text-lg";
  };

  const getBorderColor = (value: number, metricType: MetricType, thresholds?: { low: number; high: number }) => {
    if (!thresholds) {
      // Fallback to hardcoded values if thresholds are not available
      if (metricType === 'efficiency') {
        if (value >= 88.4) return "border-red-400 bg-red-50";
        if (value > 73.2) return "border-green-400 bg-green-50";
        return "border-blue-400 bg-blue-50";
      } else if (metricType === 'workHours') {
        if (value >= 8.0) return "border-red-400 bg-red-50";
        if (value >= 6.0) return "border-green-400 bg-green-50";
        return "border-blue-400 bg-blue-50";
      } else if (metricType === 'claimedHours') {
        if (value >= 9.0) return "border-red-400 bg-red-50";
        if (value >= 7.0) return "border-green-400 bg-green-50";
        return "border-blue-400 bg-blue-50";
      } else if (metricType === 'weeklyWorkHours') {
        if (value >= 45.0) return "border-red-400 bg-red-50";
        if (value >= 35.0) return "border-green-400 bg-green-50";
        return "border-blue-400 bg-blue-50";
      } else if (metricType === 'weeklyClaimedHours') {
        if (value >= 48.0) return "border-red-400 bg-red-50";
        if (value >= 38.0) return "border-green-400 bg-green-50";
        return "border-blue-400 bg-blue-50";
      } else if (metricType === 'adjustedWeeklyWorkHours') {
        if (value >= 42.0) return "border-red-400 bg-red-50";
        if (value >= 35.0) return "border-green-400 bg-green-50";
        return "border-blue-400 bg-blue-50";
      } else if (metricType === 'focusedWorkHours') {
        if (value >= 5.0) return "border-red-400 bg-red-50";
        if (value >= 2.0) return "border-green-400 bg-green-50";
        return "border-blue-400 bg-blue-50";
      } else {
        // dataReliability
        if (value >= 85.0) return "border-red-400 bg-red-50";
        if (value >= 70.0) return "border-green-400 bg-green-50";
        return "border-blue-400 bg-blue-50";
      }
    }
    
    // Use dynamic thresholds
    if (value >= thresholds.high) return "border-red-400 bg-red-50"; // 상위 (번아웃 위험)
    if (value <= thresholds.low) return "border-blue-400 bg-blue-50"; // 하위 (양호)
    return "border-green-400 bg-green-50"; // 중위
  };

  const formatValue = (value: number, metricType: MetricType) => {
    if (metricType === 'efficiency') {
      return `${value.toFixed(1)}%`;
    } else if (metricType === 'dataReliability') {
      return value.toFixed(1);
    } else {
      return `${value.toFixed(1)}h`;
    }
  };

  return (
    <div 
      className={cn(
        "flex items-center justify-center gap-1 p-3 rounded-lg border transition-all w-full min-w-[100px]",
        onClick && "cursor-pointer hover:shadow-md hover:scale-105",
        getBorderColor(value, metricType, thresholds)
      )}
      onClick={onClick}
    >
      <span className="text-base font-medium">{formatValue(value, metricType)}</span>
      <span className={cn(getIconStyle(value, metricType, thresholds), getIconColor(value, metricType, thresholds))}>
        {getStatusIcon(value, metricType, thresholds)}
      </span>
    </div>
  );
}

export function CenterLevelGrid({ 
  organizations, 
  gradeMatrix, 
  workHoursMatrix, 
  claimedHoursMatrix,
  weeklyWorkHoursMatrix,
  weeklyClaimedHoursMatrix,
  focusedWorkHoursMatrix,
  dataReliabilityMatrix,
  avgEfficiency = 88, 
  avgWorkHours = 8.2,
  avgClaimedHours = 8.5,
  avgWeeklyWorkHours = 40.0,
  avgWeeklyClaimedHours = 42.5,
  avgAdjustedWeeklyWorkHours = 38.4,
  avgFocusedWorkHours = 4.2,
  avgDataReliability = 83.6,
  selectedMetric = 'efficiency',
  onMetricChange,
  thresholds
}: CenterLevelGridProps) {
  const router = useRouter();
  
  // Use grade levels from matrix if available, otherwise default (high to low)
  const levels = gradeMatrix?.grades || ['Lv.4', 'Lv.3', 'Lv.2', 'Lv.1'];
  
  // Use actual center names from database
  const centers = organizations.filter(org => org.orgLevel === 'center');
  
  // Debug: Check if 경영진단팀 is in the centers array
  console.log('Centers from organizations:', centers.map(c => c.orgName));
  console.log('Centers from gradeMatrix:', gradeMatrix?.centers);
  
  const handleCellClick = (center: OrganizationWithStats) => {
    // Check if center has divisions (담당)
    if (center.childrenCount && center.childrenCount > 0) {
      // Navigate to teams view for this center (will show divisions/teams)
      router.push(`/teams?center=${center.orgCode}`);
    }
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-300 shadow-lg p-6 w-full">
      <h2 className="text-xl font-semibold mb-4">전체 현황</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px]">
          <thead>
            <tr>
              <th className="text-left p-2 text-base font-medium text-gray-600">구분</th>
              {centers.map(center => (
                <th key={center.orgCode} className="text-center p-2 text-base font-medium text-gray-600 min-w-[100px]">
                  <TextAnimate delay={0.1}>
                    {center.orgName}
                  </TextAnimate>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Center Average Row */}
            <tr key="center-avg" className="border-t-2 border-gray-400">
              <td className="p-2 font-medium text-gray-700 text-base bg-gray-50 whitespace-nowrap min-w-[100px] text-center">센터평균</td>
              {centers.map((center) => {
                let value: number;
                
                // Calculate center average based on selected metric
                if (selectedMetric === 'efficiency') {
                  value = center.stats?.avgWorkEfficiency || 0;
                } else if (selectedMetric === 'workHours') {
                  value = center.stats?.avgActualWorkHours || 0;
                } else if (selectedMetric === 'claimedHours') {
                  value = center.stats?.avgAttendanceHours || 0;
                } else if (selectedMetric === 'weeklyWorkHours') {
                  value = center.stats?.avgWeeklyWorkHours || 0;
                } else if (selectedMetric === 'weeklyClaimedHours') {
                  value = center.stats?.avgWeeklyClaimedHours || 0;
                } else if (selectedMetric === 'adjustedWeeklyWorkHours') {
                  value = center.stats?.avgAdjustedWeeklyWorkHours || 0;
                } else if (selectedMetric === 'focusedWorkHours') {
                  value = center.stats?.avgFocusedWorkHours || 0;
                } else {
                  // dataReliability
                  value = center.stats?.avgDataReliability || 0;
                }
                
                // Calculate ranking among centers for color coding
                const centerValuesWithIndex = centers.map((c, idx) => ({
                  value: (() => {
                    if (selectedMetric === 'efficiency') return c.stats?.avgWorkEfficiency || 0;
                    else if (selectedMetric === 'workHours') return c.stats?.avgActualWorkHours || 0;
                    else if (selectedMetric === 'claimedHours') return c.stats?.avgAttendanceHours || 0;
                    else if (selectedMetric === 'weeklyWorkHours') return c.stats?.avgWeeklyWorkHours || 0;
                    else if (selectedMetric === 'weeklyClaimedHours') return c.stats?.avgWeeklyClaimedHours || 0;
                    else if (selectedMetric === 'adjustedWeeklyWorkHours') return c.stats?.avgAdjustedWeeklyWorkHours || 0;
                    else if (selectedMetric === 'focusedWorkHours') return c.stats?.avgFocusedWorkHours || 0;
                    else return c.stats?.avgDataReliability || 0;
                  })(),
                  index: idx
                })).filter(item => item.value > 0);
                
                // Sort values (descending)
                const sortedValues = [...centerValuesWithIndex].sort((a, b) => b.value - a.value);
                const currentCenterIndex = centers.indexOf(center);
                const currentItem = centerValuesWithIndex.find(item => item.index === currentCenterIndex);
                const rank = currentItem ? sortedValues.findIndex(item => item.index === currentCenterIndex) + 1 : -1;
                const totalValidCenters = sortedValues.length;
                
                // Top 2 centers get blue, bottom 2 get red, rest get green
                let customThresholds;
                if (totalValidCenters > 0 && rank > 0 && value > 0) {
                  if (rank <= 2) {
                    // Force blue (top 2)
                    customThresholds = { low: value - 1, high: value - 0.1 };
                  } else if (rank >= totalValidCenters - 1) {
                    // Force red (bottom 2)
                    customThresholds = { low: value + 0.1, high: value + 1 };
                  } else {
                    // Force green (middle)
                    customThresholds = { low: value - 0.1, high: value + 0.1 };
                  }
                } else {
                  // Default thresholds for invalid data
                  customThresholds = thresholds?.[selectedMetric]?.thresholds;
                }
                
                return (
                  <td key={`center-avg-${center.orgCode}`} className="p-2 bg-gray-50">
                    <MetricIndicator 
                      value={value} 
                      label=""
                      metricType={selectedMetric}
                      thresholds={customThresholds}
                      onClick={() => handleCellClick(center)}
                    />
                  </td>
                );
              })}
            </tr>
            
            {/* Grade Level Rows */}
            {levels.map((level, levelIndex) => (
              <tr key={level} className={levelIndex === 0 ? "border-t-2 border-gray-400" : "border-t border-gray-200"}>
                <td className="p-2 font-medium text-gray-700 text-base whitespace-nowrap min-w-[100px] text-center">{level}</td>
                {centers.map((center) => {
                  let value: number;
                  
                  if (selectedMetric === 'efficiency') {
                    // Use actual efficiency data from gradeMatrix if available
                    if (gradeMatrix?.matrix[level]?.[center.orgName]) {
                      value = gradeMatrix.matrix[level][center.orgName];
                    } else if (center.stats?.avgWorkEfficiency) {
                      value = center.stats.avgWorkEfficiency;
                    } else {
                      value = 0; // 데이터 없음을 명확히 표시
                    }
                  } else if (selectedMetric === 'workHours') {
                    // Use work hours data from workHoursMatrix
                    if (workHoursMatrix?.matrix[level]?.[center.orgName]) {
                      value = workHoursMatrix.matrix[level][center.orgName];
                    } else {
                      value = 0; // 데이터 없음을 명확히 표시
                    }
                  } else if (selectedMetric === 'claimedHours') {
                    // Use claimed hours data from claimedHoursMatrix
                    if (claimedHoursMatrix?.matrix[level]?.[center.orgName]) {
                      value = claimedHoursMatrix.matrix[level][center.orgName];
                    } else {
                      value = 0; // 데이터 없음을 명확히 표시
                    }
                  } else if (selectedMetric === 'weeklyWorkHours') {
                    // Use weekly work hours data
                    if (weeklyWorkHoursMatrix?.matrix[level]?.[center.orgName]) {
                      value = weeklyWorkHoursMatrix.matrix[level][center.orgName];
                    } else {
                      value = 0; // 데이터 없음을 명확히 표시
                    }
                  } else if (selectedMetric === 'weeklyClaimedHours') {
                    // Use weekly claimed hours data
                    if (weeklyClaimedHoursMatrix?.matrix[level]?.[center.orgName]) {
                      value = weeklyClaimedHoursMatrix.matrix[level][center.orgName];
                    } else {
                      value = 0; // 데이터 없음을 명확히 표시
                    }
                  } else if (selectedMetric === 'adjustedWeeklyWorkHours') {
                    // Use adjusted weekly work hours data (AI보정)
                    // weeklyWorkHours와 dataReliability를 조합하여 계산
                    const weeklyHours = weeklyWorkHoursMatrix?.matrix[level]?.[center.orgName] || 0;
                    const reliability = dataReliabilityMatrix?.matrix[level]?.[center.orgName] || 0;
                    
                    if (weeklyHours > 0 && reliability > 0) {
                      // AI adjustment factor 계산 - 시그모이드 함수 사용
                      const normalized = reliability / 100;
                      const sigmoid = 1 / (1 + Math.exp(-12 * (normalized - 0.65)));
                      const adjustmentFactor = 0.92 + (sigmoid * 0.08);
                      value = weeklyHours * adjustmentFactor;
                      
                      // 디버깅용 로그
                      if (levelIndex === 0) { // 첫 번째 레벨에서만 로그
                        console.log(`[${center.orgName}] ${level}:`, {
                          weeklyHours,
                          reliability,
                          adjustmentFactor,
                          adjustedValue: value,
                          thresholds: thresholds?.[selectedMetric]?.thresholds
                        });
                      }
                    } else {
                      value = 0; // 데이터 없음을 명확히 표시
                    }
                  } else if (selectedMetric === 'focusedWorkHours') {
                    // Use focused work hours data
                    if (focusedWorkHoursMatrix?.matrix[level]?.[center.orgName]) {
                      value = focusedWorkHoursMatrix.matrix[level][center.orgName];
                    } else {
                      value = 0; // 데이터 없음을 명확히 표시
                    }
                  } else {
                    // Use data reliability data
                    if (dataReliabilityMatrix?.matrix[level]?.[center.orgName]) {
                      value = dataReliabilityMatrix.matrix[level][center.orgName];
                    } else {
                      value = 0; // 데이터 없음을 명확히 표시
                    }
                  }
                  
                  return (
                    <td key={`${level}-${center.orgCode}`} className="p-2 w-[160px]">
                      <MetricIndicator 
                        value={value} 
                        label=""
                        metricType={selectedMetric}
                        thresholds={thresholds?.[selectedMetric]?.thresholds}
                        onClick={() => handleCellClick(center)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Information section */}
      <div className={`mt-4 ${selectedMetric === 'dataReliability' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}`}>
        {/* Summary box */}
        <div className="p-3 bg-white border border-gray-200 text-gray-900 rounded-lg text-sm shadow-sm">
        {selectedMetric === 'efficiency' ? (
          <>
            <div className="font-semibold text-gray-900">평균 효율성 : {avgEfficiency.toFixed(1)}%</div>
            <div className="text-xs text-gray-700 mt-1">
              실제 근무시간 ÷ 총 근무시간 × 100 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 상위({thresholds?.efficiency?.high}) | ● 중위({thresholds?.efficiency?.middle}) | ▼ 하위({thresholds?.efficiency?.low})
            </div>
          </>
        ) : selectedMetric === 'workHours' ? (
          <>
            <div className="font-semibold text-gray-900">일간 근무추정시간 : {avgWorkHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-700 mt-1">
              실제 근무시간 평균 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 상위({thresholds?.workHours?.high}) | ● 중위({thresholds?.workHours?.middle}) | ▼ 하위({thresholds?.workHours?.low})
            </div>
          </>
        ) : selectedMetric === 'claimedHours' ? (
          <>
            <div className="font-semibold text-gray-900">일간 근무시간 : {avgClaimedHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-700 mt-1">
              신고 근무시간 평균 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 상위({thresholds?.claimedHours?.high}) | ● 중위({thresholds?.claimedHours?.middle}) | ▼ 하위({thresholds?.claimedHours?.low})
            </div>
          </>
        ) : selectedMetric === 'weeklyWorkHours' ? (
          <>
            <div className="font-semibold text-gray-900">주간 근무추정시간 : {avgWeeklyWorkHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-700 mt-1">
              주당 실제 근무시간 평균 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 상위({thresholds?.weeklyWorkHours?.high}) | ● 중위({thresholds?.weeklyWorkHours?.middle}) | ▼ 하위({thresholds?.weeklyWorkHours?.low})
            </div>
          </>
        ) : selectedMetric === 'weeklyClaimedHours' ? (
          <>
            <div className="font-semibold text-gray-900">주간 근무시간 : {avgWeeklyClaimedHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-700 mt-1">
              주당 신고 근무시간 평균 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 상위({thresholds?.weeklyClaimedHours?.high}) | ● 중위({thresholds?.weeklyClaimedHours?.middle}) | ▼ 하위({thresholds?.weeklyClaimedHours?.low})
            </div>
          </>
        ) : selectedMetric === 'adjustedWeeklyWorkHours' ? (
          <>
            <div className="font-semibold text-gray-900">주간 근무추정시간(AI보정) : {avgAdjustedWeeklyWorkHours?.toFixed(1) || '0.0'}h</div>
            <div className="text-xs text-gray-700 mt-1">
              AI 신뢰도 보정 적용 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 상위({thresholds?.adjustedWeeklyWorkHours?.high || '상위 20%'}) | ● 중위({thresholds?.adjustedWeeklyWorkHours?.middle || '중위 60%'}) | ▼ 하위({thresholds?.adjustedWeeklyWorkHours?.low || '하위 20%'})
            </div>
          </>
        ) : selectedMetric === 'focusedWorkHours' ? (
          <>
            <div className="font-semibold text-gray-900">일간 집중근무시간 : {avgFocusedWorkHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-700 mt-1">
              집중적으로 업무에 몰입한 시간 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 상위({thresholds?.focusedWorkHours?.high}) | ● 중위({thresholds?.focusedWorkHours?.middle}) | ▼ 하위({thresholds?.focusedWorkHours?.low})
            </div>
          </>
        ) : (
          <>
            <div className="font-semibold text-gray-900">데이터 신뢰도 : {avgDataReliability.toFixed(1)}</div>
            <div className="text-xs text-gray-700 mt-1">
              데이터 품질 및 정확성 점수 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 상위({thresholds?.dataReliability?.high}) | ● 중위({thresholds?.dataReliability?.middle}) | ▼ 하위({thresholds?.dataReliability?.low})
            </div>
          </>
        )}
        </div>
        
        {/* Data reliability metric explanation - only show when dataReliability is selected */}
        {selectedMetric === 'dataReliability' && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-800 text-sm mb-2">신뢰도 증가 요인</h4>
                <ul className="space-y-1">
                  <li className="text-sm text-gray-700">• 장비 사용 기록 비율 높은 경우 : <span className="text-blue-600 font-medium">+30점</span></li>
                  <li className="text-sm text-gray-700">• 이벤트 빈도 높은 경우 : <span className="text-blue-600 font-medium">+20점</span></li>
                  <li className="text-sm text-gray-700">• 태그 간격 일정한 경우 : <span className="text-blue-600 font-medium">+10점</span></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-800 text-sm mb-2">신뢰도 감소 요인</h4>
                <ul className="space-y-1">
                  <li className="text-sm text-gray-700">• 불확실한 이벤트 많은 경우 : <span className="text-red-600 font-medium">-20점</span></li>
                  <li className="text-sm text-gray-700">• 2시간 이상 공백 발생한 경우 : <span className="text-red-600 font-medium">-10점</span></li>
                  <li className="text-sm text-gray-700">• 이동 추정시간 많음 : <span className="text-red-600 font-medium">-5점~-15점</span></li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}