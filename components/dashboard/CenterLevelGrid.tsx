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
  avgEfficiency?: number;
  avgWorkHours?: number;
  avgClaimedHours?: number;
  avgWeeklyWorkHours?: number;
  avgWeeklyClaimedHours?: number;
  selectedMetric?: MetricType;
  onMetricChange?: (metric: MetricType) => void;
  thresholds?: {
    efficiency: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    workHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    claimedHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyClaimedHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
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
      } else {
        // weeklyClaimedHours
        if (value >= 48.0) return "▲";
        if (value >= 38.0) return "●";
        return "▼";
      }
    }
    
    // Use dynamic thresholds
    if (value >= thresholds.high) return "▲"; // 상위 20% 모범사례 - 파란 삼각형
    if (value > thresholds.low) return "●"; // 중간 60% 양호 - 초록 원
    return "▼"; // 하위 20% 관찰 주시 필요 - 빨간 역삼각형
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
      } else {
        // weeklyClaimedHours
        if (value >= 48.0) return "text-blue-600";
        if (value >= 38.0) return "text-green-600";
        return "text-red-600";
      }
    }
    
    // Use dynamic thresholds
    if (value >= thresholds.high) return "text-blue-600"; // 모범사례
    if (value > thresholds.low) return "text-green-600"; // 양호
    return "text-red-600"; // 관찰 주시 필요
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
      } else {
        isCircle = value >= 7.0 && value < 9.0;
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
        if (value >= 88.4) return "border-blue-200 bg-blue-50";
        if (value > 73.2) return "border-green-200 bg-green-50";
        return "border-red-200 bg-red-50";
      } else if (metricType === 'workHours') {
        if (value >= 8.0) return "border-blue-200 bg-blue-50";
        if (value >= 6.0) return "border-green-200 bg-green-50";
        return "border-red-200 bg-red-50";
      } else if (metricType === 'claimedHours') {
        if (value >= 9.0) return "border-blue-200 bg-blue-50";
        if (value >= 7.0) return "border-green-200 bg-green-50";
        return "border-red-200 bg-red-50";
      } else if (metricType === 'weeklyWorkHours') {
        if (value >= 45.0) return "border-blue-200 bg-blue-50";
        if (value >= 35.0) return "border-green-200 bg-green-50";
        return "border-red-200 bg-red-50";
      } else {
        // weeklyClaimedHours
        if (value >= 48.0) return "border-blue-200 bg-blue-50";
        if (value >= 38.0) return "border-green-200 bg-green-50";
        return "border-red-200 bg-red-50";
      }
    }
    
    // Use dynamic thresholds
    if (value >= thresholds.high) return "border-blue-200 bg-blue-50"; // 모범사례
    if (value > thresholds.low) return "border-green-200 bg-green-50"; // 양호
    return "border-red-200 bg-red-50"; // 관찰 주시 필요
  };

  const formatValue = (value: number, metricType: MetricType) => {
    if (metricType === 'efficiency') {
      return `${value.toFixed(1)}%`;
    } else {
      return `${value.toFixed(1)}h`;
    }
  };

  return (
    <div 
      className={cn(
        "flex items-center justify-center gap-1 p-3 rounded-lg border transition-all",
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
  avgEfficiency = 88, 
  avgWorkHours = 8.2,
  avgClaimedHours = 8.5,
  avgWeeklyWorkHours = 40.0,
  avgWeeklyClaimedHours = 42.5,
  selectedMetric = 'efficiency',
  onMetricChange,
  thresholds
}: CenterLevelGridProps) {
  const router = useRouter();
  
  // Use grade levels from matrix if available, otherwise default (high to low)
  const levels = gradeMatrix?.grades || ['Lv.4', 'Lv.3', 'Lv.2', 'Lv.1'];
  
  // Use actual center names from database
  const centers = organizations.filter(org => org.orgLevel === 'center');
  
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
            {levels.map((level, levelIndex) => (
              <tr key={level} className="border-t border-gray-200">
                <td className="p-2 font-medium text-gray-700 text-base">{level}</td>
                {centers.map((center) => {
                  let value: number;
                  
                  if (selectedMetric === 'efficiency') {
                    // Use actual efficiency data from gradeMatrix if available
                    if (gradeMatrix?.matrix[level]?.[center.orgName]) {
                      value = gradeMatrix.matrix[level][center.orgName];
                    } else if (center.stats?.avgWorkEfficiency) {
                      value = center.stats.avgWorkEfficiency;
                    } else {
                      value = Math.floor(Math.random() * 30) + 75;
                    }
                  } else if (selectedMetric === 'workHours') {
                    // Use work hours data from workHoursMatrix
                    if (workHoursMatrix?.matrix[level]?.[center.orgName]) {
                      value = workHoursMatrix.matrix[level][center.orgName];
                    } else {
                      value = Math.floor(Math.random() * 3) + 7; // 7-10 hours range
                    }
                  } else if (selectedMetric === 'claimedHours') {
                    // Use claimed hours data from claimedHoursMatrix
                    if (claimedHoursMatrix?.matrix[level]?.[center.orgName]) {
                      value = claimedHoursMatrix.matrix[level][center.orgName];
                    } else {
                      value = Math.floor(Math.random() * 3) + 8; // 8-11 hours range
                    }
                  } else if (selectedMetric === 'weeklyWorkHours') {
                    // Use weekly work hours data
                    if (weeklyWorkHoursMatrix?.matrix[level]?.[center.orgName]) {
                      value = weeklyWorkHoursMatrix.matrix[level][center.orgName];
                    } else {
                      value = Math.floor(Math.random() * 10) + 35; // 35-45 hours range
                    }
                  } else {
                    // Use weekly claimed hours data
                    if (weeklyClaimedHoursMatrix?.matrix[level]?.[center.orgName]) {
                      value = weeklyClaimedHoursMatrix.matrix[level][center.orgName];
                    } else {
                      value = Math.floor(Math.random() * 10) + 40; // 40-50 hours range
                    }
                  }
                  
                  return (
                    <td key={`${level}-${center.orgCode}`} className="p-2">
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

      {/* Tooltip for information */}
      <div className="mt-4 p-3 bg-white border border-gray-200 text-gray-900 rounded-lg text-sm max-w-md shadow-sm">
        {selectedMetric === 'efficiency' ? (
          <>
            <div className="font-semibold text-gray-900">평균 효율성 비율 : {avgEfficiency.toFixed(1)}%</div>
            <div className="text-xs text-gray-700 mt-1">
              실제 작업시간 ÷ 총 근무시간 × 100 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 모범사례({thresholds?.efficiency?.high}) | ● 양호({thresholds?.efficiency?.middle}) | ▼ 관찰필요({thresholds?.efficiency?.low})
            </div>
          </>
        ) : selectedMetric === 'workHours' ? (
          <>
            <div className="font-semibold text-gray-900">일간 작업추정시간 : {avgWorkHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-700 mt-1">
              실제 작업시간 평균 | 30일 평균 데이터
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
              주당 실제 작업시간 평균 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 모범사례({thresholds?.weeklyWorkHours?.high}) | ● 양호({thresholds?.weeklyWorkHours?.middle}) | ▼ 관찰필요({thresholds?.weeklyWorkHours?.low})
            </div>
          </>
        ) : (
          <>
            <div className="font-semibold text-gray-900">주간 근무시간 : {avgWeeklyClaimedHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-700 mt-1">
              주당 신고 근무시간 평균 | 30일 평균 데이터
            </div>
            <div className="text-xs text-gray-700 mt-1">
              ▲ 모범사례({thresholds?.weeklyClaimedHours?.high}) | ● 양호({thresholds?.weeklyClaimedHours?.middle}) | ▼ 관찰필요({thresholds?.weeklyClaimedHours?.low})
            </div>
          </>
        )}
      </div>
    </div>
  );
}