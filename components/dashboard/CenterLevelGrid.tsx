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
  adjustedWeeklyWorkHoursMatrix?: {
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
    efficiency?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    workHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    claimedHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    adjustedWeeklyWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyClaimedHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    focusedWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    dataReliability?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    [key: string]: any; // Allow any other keys
  };
}

interface MetricIndicatorProps {
  value: number;
  label: string;
  metricType: MetricType;
  thresholds?: { low: number; high: number };
  onClick?: () => void;
  isAverage?: boolean;
}

function MetricIndicator({ value, label, metricType, thresholds, onClick, isAverage = false }: MetricIndicatorProps) {
  const getStatusIcon = (value: number, metricType: MetricType, thresholds?: { low: number; high: number }) => {
    // Average cards don't show icons
    if (isAverage) {
      return "";
    }

    if (!thresholds || typeof thresholds.low !== 'number' || typeof thresholds.high !== 'number') {
      // thresholds가 없거나 불완전하면 아이콘 표시하지 않음
      return "";
    }
    
    // Use dynamic thresholds - 상위 20% (high) 이상은 ▲, 하위 20% (low) 이하는 ▼
    if (value >= thresholds.high) return "▲"; // 상위 20% - 빨간 삼각형 (번아웃 위험)
    if (value <= thresholds.low) return "▼"; // 하위 20% - 파란 역삼각형 (양호)
    return "●"; // 중간 60% 중위 - 초록 원
  };

  const getIconColor = (value: number, metricType: MetricType, thresholds?: { low: number; high: number }) => {
    if (!thresholds || typeof thresholds.low !== 'number' || typeof thresholds.high !== 'number') {
      // thresholds가 없거나 불완전하면 기본 회색
      return "text-gray-400";
    }

    // Use dynamic thresholds
    if (value >= thresholds.high) return "text-red-600"; // 상위 (번아웃 위험)
    if (value <= thresholds.low) return "text-blue-600"; // 하위 (양호)
    return "text-green-600"; // 중위
  };

  const getIconStyle = (value: number, metricType: MetricType, thresholds?: { low: number; high: number }) => {
    // Make circle slightly larger than default to match triangle size
    let isCircle = false;

    if (!thresholds || typeof thresholds.low !== 'number' || typeof thresholds.high !== 'number') {
      // thresholds가 없거나 불완전하면 기본 스타일
      return "text-base";
    }

    // Use dynamic thresholds
    isCircle = value > thresholds.low && value < thresholds.high;

    if (isCircle) {
      return "text-lg scale-[1.35]"; // 중간 60% 원형 크게
    }
    return "text-lg";
  };

  const getBorderColor = (value: number, metricType: MetricType, thresholds?: { low: number; high: number }) => {
    // Average cards always get gray color
    if (isAverage) {
      return "border-gray-400 bg-gray-100";
    }

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
        "flex items-center justify-center gap-1 px-1.5 py-2.5 rounded-lg border transition-all w-full",
        onClick && "cursor-pointer hover:shadow-md hover:scale-105",
        getBorderColor(value, metricType, thresholds)
      )}
      onClick={onClick}
    >
      <span className="text-base font-medium">{formatValue(value, metricType)}</span>
      <span className={cn("text-base", getIconColor(value, metricType, thresholds))}>
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
  adjustedWeeklyWorkHoursMatrix,
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
  // Filter out Special group
  const levelsFromMatrix = gradeMatrix?.grades || ['Lv.4', 'Lv.3', 'Lv.2', 'Lv.1'];
  const levels = levelsFromMatrix.filter(level => level !== 'Special');

  // Use actual center names from database
  const centers = organizations.filter(org => org.orgLevel === 'center');

  // 현재 화면에 표시된 모든 값을 수집하여 동적 임계값 계산
  const calculateDynamicThresholds = () => {
    const values: number[] = [];

    // 선택된 메트릭의 매트릭스 가져오기
    let currentMatrix: any = null;
    if (selectedMetric === 'efficiency') currentMatrix = gradeMatrix;
    else if (selectedMetric === 'workHours') currentMatrix = workHoursMatrix;
    else if (selectedMetric === 'claimedHours') currentMatrix = claimedHoursMatrix;
    else if (selectedMetric === 'weeklyWorkHours') currentMatrix = weeklyWorkHoursMatrix;
    else if (selectedMetric === 'weeklyClaimedHours') currentMatrix = weeklyClaimedHoursMatrix;
    else if (selectedMetric === 'adjustedWeeklyWorkHours') currentMatrix = adjustedWeeklyWorkHoursMatrix;
    else if (selectedMetric === 'focusedWorkHours') currentMatrix = focusedWorkHoursMatrix;
    else if (selectedMetric === 'dataReliability') currentMatrix = dataReliabilityMatrix;

    // 센터 평균 값 수집
    centers.forEach(center => {
      let value = 0;
      if (selectedMetric === 'efficiency') value = center.stats?.avgWorkEfficiency || 0;
      else if (selectedMetric === 'workHours') value = center.stats?.avgActualWorkHoursAdjusted || center.stats?.avgActualWorkHours || 0;
      else if (selectedMetric === 'claimedHours') value = center.stats?.avgAttendanceHoursAdjusted || center.stats?.avgAttendanceHours || 0;
      else if (selectedMetric === 'weeklyWorkHours') value = center.stats?.avgWeeklyWorkHoursAdjusted || center.stats?.avgWeeklyWorkHours || 0;
      else if (selectedMetric === 'weeklyClaimedHours') value = center.stats?.avgWeeklyClaimedHoursAdjusted || center.stats?.avgWeeklyClaimedHours || 0;
      else if (selectedMetric === 'adjustedWeeklyWorkHours') value = center.stats?.avgAdjustedWeeklyWorkHours || 0;
      else if (selectedMetric === 'focusedWorkHours') value = center.stats?.avgFocusedWorkHours || 0;
      else if (selectedMetric === 'dataReliability') value = 0; // 임시 숨김

      if (value > 0) values.push(value);
    });

    // 레벨별 데이터 값 수집
    if (currentMatrix?.matrix) {
      levels.forEach(level => {
        centers.forEach(center => {
          const value = currentMatrix.matrix[level]?.[center.orgName] || 0;
          if (value > 0) values.push(value);
        });
      });
    }

    // 값을 정렬하여 백분위수 계산
    values.sort((a, b) => a - b);

    if (values.length === 0) return null;

    // 20%, 80% 백분위수 계산
    const percentile20 = values[Math.floor(values.length * 0.2)];
    const percentile80 = values[Math.floor(values.length * 0.8)];

    return { low: percentile20, high: percentile80 };
  };

  const dynamicThresholds = calculateDynamicThresholds();
  
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
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-center p-2 text-base font-semibold text-gray-600 w-[90px]">구분</th>
              {centers.map((center, index) => (
                <th key={center.orgCode || `center-${index}`} className="text-center p-2 text-sm font-medium text-gray-600">
                  <TextAnimate delay={0.1}>
                    <span className="text-base font-semibold">{center.orgName}</span>
                  </TextAnimate>
                </th>
              ))}
              <th className="text-center p-2 text-base font-semibold text-gray-600 min-w-[100px]">평균</th>
            </tr>
          </thead>
          <tbody>
            {/* Center Average Row */}
            <tr key="center-avg" className="border-t-2 border-gray-400">
              <td className="p-2 font-semibold text-gray-700 text-base bg-gray-50 whitespace-nowrap text-center">전체 평균</td>
              {centers.map((center, centerIndex) => {
                let value: number;
                
                // Calculate center average based on selected metric
                if (selectedMetric === 'efficiency') {
                  value = center.stats?.avgWorkEfficiency || 0;
                } else if (selectedMetric === 'workHours') {
                  // 탄력근무제 보정된 일간 값 사용
                  value = center.stats?.avgActualWorkHoursAdjusted || center.stats?.avgActualWorkHours || 0;
                } else if (selectedMetric === 'claimedHours') {
                  // 탄력근무제 보정된 일간 값 사용
                  value = center.stats?.avgAttendanceHoursAdjusted || center.stats?.avgAttendanceHours || 0;
                } else if (selectedMetric === 'weeklyWorkHours') {
                  // 탄력근무제 보정된 값 사용
                  value = center.stats?.avgWeeklyWorkHoursAdjusted || center.stats?.avgWeeklyWorkHours || 0;
                } else if (selectedMetric === 'weeklyClaimedHours') {
                  // 탄력근무제 보정된 값 사용
                  value = center.stats?.avgWeeklyClaimedHoursAdjusted || center.stats?.avgWeeklyClaimedHours || 0;
                } else if (selectedMetric === 'adjustedWeeklyWorkHours') {
                  value = center.stats?.avgAdjustedWeeklyWorkHours || 0;
                } else if (selectedMetric === 'focusedWorkHours') {
                  value = center.stats?.avgFocusedWorkHours || 0;
                } else {
                  // dataReliability - 임시로 숨김, 기본값 0 사용
                  // value = center.stats?.avgDataReliability || 0;
                  value = 0;
                }
                
                // Calculate ranking among centers for color coding
                const centerValuesWithIndex = centers.map((c, idx) => ({
                  value: (() => {
                    if (selectedMetric === 'efficiency') return c.stats?.avgWorkEfficiency || 0;
                    else if (selectedMetric === 'workHours') return c.stats?.avgActualWorkHoursAdjusted || c.stats?.avgActualWorkHours || 0;
                    else if (selectedMetric === 'claimedHours') return c.stats?.avgAttendanceHoursAdjusted || c.stats?.avgAttendanceHours || 0;
                    else if (selectedMetric === 'weeklyWorkHours') return c.stats?.avgWeeklyWorkHoursAdjusted || c.stats?.avgWeeklyWorkHours || 0;
                    else if (selectedMetric === 'weeklyClaimedHours') return c.stats?.avgWeeklyClaimedHoursAdjusted || c.stats?.avgWeeklyClaimedHours || 0;
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
                  <td key={`center-avg-${center.orgCode || centerIndex}`} className="p-2 bg-gray-50">
                    <MetricIndicator
                      value={value}
                      label=""
                      metricType={selectedMetric}
                      thresholds={dynamicThresholds || customThresholds}
                      onClick={() => handleCellClick(center)}
                    />
                  </td>
                );
              })}
              {/* 전체 평균 열 - API에서 받은 실제 가중평균 사용 */}
              <td className="p-2 bg-gray-50">
                {(() => {
                  // Use the actual weighted averages from API props
                  let avg = 0;
                  if (selectedMetric === 'efficiency') {
                    avg = avgEfficiency;
                  } else if (selectedMetric === 'workHours') {
                    avg = avgWorkHours;
                  } else if (selectedMetric === 'claimedHours') {
                    avg = avgClaimedHours;
                  } else if (selectedMetric === 'weeklyWorkHours') {
                    avg = avgWeeklyWorkHours;
                  } else if (selectedMetric === 'weeklyClaimedHours') {
                    avg = avgWeeklyClaimedHours;
                  } else if (selectedMetric === 'adjustedWeeklyWorkHours') {
                    avg = avgAdjustedWeeklyWorkHours;
                  } else if (selectedMetric === 'focusedWorkHours') {
                    avg = avgFocusedWorkHours;
                  } else if (selectedMetric === 'dataReliability') {
                    avg = avgDataReliability;
                  }

                  // 평균값을 위한 특별한 thresholds 설정 (회색 표시용)
                  const avgThresholds = { low: avg - 1, high: avg + 1 };

                  return (
                    <MetricIndicator
                      value={avg}
                      label=""
                      metricType={selectedMetric}
                      thresholds={avgThresholds}
                      isAverage={true}
                    />
                  );
                })()}
              </td>
            </tr>
            
            {/* Grade Level Rows */}
            {levels.map((level, levelIndex) => (
              <tr key={level} className={levelIndex === 0 ? "border-t-2 border-gray-400" : "border-t border-gray-200"}>
                <td className="p-2 font-semibold text-gray-700 text-base whitespace-nowrap text-center">{level}</td>
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
                    // Use adjustedWeeklyWorkHours matrix for AI보정
                    if (adjustedWeeklyWorkHoursMatrix?.matrix[level]?.[center.orgName]) {
                      value = adjustedWeeklyWorkHoursMatrix.matrix[level][center.orgName];
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
                    // Use data reliability data - 임시로 숨김
                    // if (dataReliabilityMatrix?.matrix[level]?.[center.orgName]) {
                    //   value = dataReliabilityMatrix.matrix[level][center.orgName];
                    // } else {
                    //   value = 0; // 데이터 없음을 명확히 표시
                    // }
                    value = 0; // dataReliability 숨김 처리
                  }
                  
                  // Get appropriate thresholds based on selected metric
                  let metricThresholds = undefined;

                  // Direct access to threshold data
                  if (thresholds && selectedMetric) {
                    const thresholdData = thresholds[selectedMetric];
                    if (thresholdData && thresholdData.thresholds) {
                      metricThresholds = thresholdData.thresholds;
                    }
                  }

                  return (
                    <td key={`${level}-${center.orgCode}`} className="p-2">
                      <MetricIndicator
                        value={value}
                        label=""
                        metricType={selectedMetric}
                        thresholds={dynamicThresholds || metricThresholds}
                        onClick={() => handleCellClick(center)}
                      />
                    </td>
                  );
                })}
                {/* 레벨별 평균 열 */}
                <td className="p-2">
                  {(() => {
                    const levelValues = centers.map(center => {
                      let value = 0;

                      if (selectedMetric === 'efficiency') {
                        if (gradeMatrix?.matrix[level]?.[center.orgName]) {
                          value = gradeMatrix.matrix[level][center.orgName];
                        }
                      } else if (selectedMetric === 'workHours') {
                        if (workHoursMatrix?.matrix[level]?.[center.orgName]) {
                          value = workHoursMatrix.matrix[level][center.orgName];
                        }
                      } else if (selectedMetric === 'claimedHours') {
                        if (claimedHoursMatrix?.matrix[level]?.[center.orgName]) {
                          value = claimedHoursMatrix.matrix[level][center.orgName];
                        }
                      } else if (selectedMetric === 'weeklyWorkHours') {
                        if (weeklyWorkHoursMatrix?.matrix[level]?.[center.orgName]) {
                          value = weeklyWorkHoursMatrix.matrix[level][center.orgName];
                        }
                      } else if (selectedMetric === 'weeklyClaimedHours') {
                        if (weeklyClaimedHoursMatrix?.matrix[level]?.[center.orgName]) {
                          value = weeklyClaimedHoursMatrix.matrix[level][center.orgName];
                        }
                      } else if (selectedMetric === 'adjustedWeeklyWorkHours') {
                        if (adjustedWeeklyWorkHoursMatrix?.matrix[level]?.[center.orgName]) {
                          value = adjustedWeeklyWorkHoursMatrix.matrix[level][center.orgName];
                        }
                      } else if (selectedMetric === 'focusedWorkHours') {
                        if (focusedWorkHoursMatrix?.matrix[level]?.[center.orgName]) {
                          value = focusedWorkHoursMatrix.matrix[level][center.orgName];
                        }
                      }

                      return value;
                    }).filter(v => v > 0);

                    const avg = levelValues.length > 0
                      ? levelValues.reduce((sum, val) => sum + val, 0) / levelValues.length
                      : 0;

                    // 평균값을 위한 특별한 thresholds 설정 (회색 표시용)
                    const avgThresholds = { low: avg - 1, high: avg + 1 };

                    return (
                      <MetricIndicator
                        value={avg}
                        label=""
                        metricType={selectedMetric}
                        thresholds={avgThresholds}
                        isAverage={true}
                      />
                    );
                  })()}
                </td>
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
          <div className="grid grid-cols-2 gap-4">
            {/* 왼쪽: 기본 정보 */}
            <div>
              <div className="font-semibold text-gray-900">주간 근태시간 : {avgWeeklyClaimedHours.toFixed(1)}h</div>
              <div className="text-xs text-gray-700 mt-1">
                주당 신고 근무시간 평균 | 30일 평균 데이터
              </div>
              <div className="text-xs text-gray-700 mt-1">
                ▲ 상위({thresholds?.weeklyClaimedHours?.high}) | ● 중위({thresholds?.weeklyClaimedHours?.middle}) | ▼ 하위({thresholds?.weeklyClaimedHours?.low})
              </div>
            </div>
            {/* 오른쪽: 포함된 시간 설명 */}
            <div className="border-l pl-4">
              <div className="font-semibold text-gray-900">포함된 시간</div>
              <div className="text-xs text-gray-700 mt-1">
                ✓ 실제 근태시간 (출퇴근 기록)
              </div>
              <div className="text-xs text-gray-700 mt-1">
                ✓ 연차·휴가 시간 (8h/일, 4h/반차, 시간연차)
              </div>
              <div className="text-xs text-gray-700 mt-1">
                ✓ 출장·교육 시간 (8h 기본값)
              </div>
            </div>
          </div>
        ) : selectedMetric === 'adjustedWeeklyWorkHours' ? (
          <div className="grid grid-cols-2 gap-0">
            <div className="pr-4">
              <div className="font-semibold text-gray-900">주간 근무추정시간 : {avgAdjustedWeeklyWorkHours?.toFixed(1) || '0.0'}h</div>
              <div className="text-xs text-gray-700 mt-1">
                주당 근무추정시간 평균 | 30일 평균 데이터
              </div>
              <div className="text-xs text-gray-700 mt-1">
                ▲ 상위({thresholds?.adjustedWeeklyWorkHours?.high || '≥40h'}) | ● 중위({thresholds?.adjustedWeeklyWorkHours?.middle || '35-40h'}) | ▼ 하위({thresholds?.adjustedWeeklyWorkHours?.low || '<35h'})
              </div>
            </div>
            <div className="pl-4 border-l border-gray-300 grid grid-cols-3 gap-2">
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
                  - 비업무구역체류
                </div>
                <div className="text-xs text-gray-600">
                  - 비업무이동
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-800">AI 보정 요소</div>
                <div className="text-xs text-gray-600 mt-1">
                  ✓ 데이터 신뢰도 기반 조정
                </div>
                <div className="text-xs text-gray-600">
                  ✓ 팀별 업무 패턴 분석
                </div>
                <div className="text-xs text-gray-600">
                  ✓ 개인별 근무 특성 반영
                </div>
              </div>
            </div>
          </div>
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
            <div className="space-y-3">
              <h4 className="font-medium text-gray-800 text-sm">신뢰도 계산 5단계 프로세스</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold text-sm min-w-[40px]">1단계</span>
                  <div className="text-xs text-gray-700">
                    <span className="font-medium">팀별 기본 확률</span>
                    <span className="text-gray-600"> - 부서 특성(현장형/사무실형)에 따른 기본 신뢰도 (80-90%)</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold text-sm min-w-[40px]">2단계</span>
                  <div className="text-xs text-gray-700">
                    <span className="font-medium">시퀀스 기반 조정</span>
                    <span className="text-gray-600"> - O-T1-O 패턴(95%+), O-T1-X/X-T1-O (80-90%), X-T1-X (30-40%)</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold text-sm min-w-[40px]">3단계</span>
                  <div className="text-xs text-gray-700">
                    <span className="font-medium">시간대별 가중치</span>
                    <span className="text-gray-600"> - 출근(06-08시), 점심(12-13시), 퇴근(17-19시) 시간대별 조정</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold text-sm min-w-[40px]">4단계</span>
                  <div className="text-xs text-gray-700">
                    <span className="font-medium">지속시간 미세조정</span>
                    <span className="text-gray-600"> - 짧은 이동(&lt;5분) 업무 확률↑, 긴 이동(&gt;30분) 업무 확률↓</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold text-sm min-w-[40px]">5단계</span>
                  <div className="text-xs text-gray-700">
                    <span className="font-medium">특별규칙 적용</span>
                    <span className="text-gray-600"> - 팀 평균 대비 이상치 감지, 개인별 반복 패턴 학습</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-blue-200">
                <p className="text-xs text-gray-600">
                  개인의 업무 패턴을 조직의 집단지성과 비교하여 업무시간의 정확도를 평가합니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}