"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface LevelGridTableProps {
  levelData: {
    level: string;
    monthlyData: {
      month: number;
      weeklyClaimedHours: number;
      weeklyAdjustedHours: number;
      employeeCount: number;
    }[];
    average: {
      weeklyClaimedHours: number;
      weeklyAdjustedHours: number;
    };
  }[];
  companyAverageData?: {
    level: string;
    monthlyData: {
      month: number;
      weeklyClaimedHours: number;
      weeklyAdjustedHours: number;
      employeeCount: number;
    }[];
    average: {
      weeklyClaimedHours: number;
      weeklyAdjustedHours: number;
    };
  }[];
  period: {
    year: number;
    startMonth: number;
    endMonth: number;
  };
  centerName?: string;
}

export function LevelGridTable({ levelData, companyAverageData, period, centerName }: LevelGridTableProps) {
  const [selectedMetric, setSelectedMetric] = useState<'claimed' | 'adjusted'>('claimed');


  // 월 배열 생성
  const months = [];
  for (let m = period.startMonth; m <= period.endMonth; m++) {
    months.push(m);
  }

  // 전사 평균 계산 (모든 센터의 평균)
  const calculateCompanyMonthlyAverage = (month: number) => {
    if (!companyAverageData || companyAverageData.length === 0) return 0;

    const monthData = companyAverageData
      .map(l => l.monthlyData.find(m => m.month === month))
      .filter(Boolean);

    if (monthData.length === 0) return 0;

    const sum = monthData.reduce((acc, d) =>
      acc + (selectedMetric === 'claimed' ? d!.weeklyClaimedHours : d!.weeklyAdjustedHours), 0
    );
    return sum / monthData.length;
  };

  // 전사 전체 평균
  const companyOverallAverage = companyAverageData && companyAverageData.length > 0
    ? companyAverageData.reduce((sum, l) =>
        sum + (selectedMetric === 'claimed' ? l.average.weeklyClaimedHours : l.average.weeklyAdjustedHours), 0
      ) / companyAverageData.length
    : 0;

  // 센터 평균 계산 (레벨별 평균)
  const calculateCenterMonthlyAverage = (month: number) => {
    const monthData = levelData
      .map(l => l.monthlyData.find(m => m.month === month))
      .filter(Boolean);

    if (monthData.length === 0) return 0;

    const sum = monthData.reduce((acc, d) =>
      acc + (selectedMetric === 'claimed' ? d!.weeklyClaimedHours : d!.weeklyAdjustedHours), 0
    );
    return sum / monthData.length;
  };

  // 센터 전체 평균
  const centerOverallAverage = levelData.reduce((sum, l) =>
    sum + (selectedMetric === 'claimed' ? l.average.weeklyClaimedHours : l.average.weeklyAdjustedHours), 0
  ) / levelData.length;

  // 현재 화면에 표시된 모든 데이터 값들 수집
  const getAllVisibleValues = () => {
    const values: number[] = [];

    // 전사평균 데이터
    if (companyAverageData) {
      months.forEach(month => {
        const value = calculateCompanyMonthlyAverage(month);
        if (value > 0) values.push(value);
      });

      // 전사 전체 평균도 추가
      if (companyOverallAverage > 0) {
        values.push(companyOverallAverage);
      }
    }

    // 센터평균 데이터 (항상 포함 - 레벨별 데이터의 평균이므로)
    months.forEach(month => {
      const value = calculateCenterMonthlyAverage(month);
      if (value > 0) values.push(value);
    });

    // 센터 전체 평균도 추가
    if (centerOverallAverage > 0) {
      values.push(centerOverallAverage);
    }

    // 레벨별 데이터
    levelData.forEach(level => {
      level.monthlyData.forEach(monthData => {
        const value = selectedMetric === 'claimed'
          ? monthData.weeklyClaimedHours
          : monthData.weeklyAdjustedHours;
        if (value > 0) values.push(value);
      });

      // 각 레벨의 평균값도 추가
      const avgValue = selectedMetric === 'claimed'
        ? level.average.weeklyClaimedHours
        : level.average.weeklyAdjustedHours;
      if (avgValue > 0) values.push(avgValue);
    });

    return values.sort((a, b) => a - b);
  };

  // 값에 따른 색상 결정 (상위 20%, 하위 20% 기준)
  const getValueStyle = (value: number) => {
    // 데이터가 없는 경우 (0 또는 NaN)
    if (!value || value === 0) {
      return {
        borderColor: 'border-gray-200',
        bgColor: 'bg-white',
        textColor: 'text-gray-400'
      };
    }

    const allValues = getAllVisibleValues();
    console.log('getAllVisibleValues result:', allValues);
    console.log('Current value:', value, 'Values count:', allValues.length);

    if (allValues.length === 0) {
      return {
        borderColor: 'border-gray-200',
        bgColor: 'bg-white',
        textColor: 'text-gray-400'
      };
    }

    // 상위 20%, 하위 20% 경계값 계산
    const percentile20 = allValues[Math.floor(allValues.length * 0.2)];
    const percentile80 = allValues[Math.floor(allValues.length * 0.8)];

    if (value >= percentile80) {
      // 상위 20%
      return {
        borderColor: 'border-red-300',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700'
      };
    } else if (value <= percentile20) {
      // 하위 20%
      return {
        borderColor: 'border-blue-300',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700'
      };
    } else {
      // 중위 60%
      return {
        borderColor: 'border-green-300',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700'
      };
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">월별통계</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedMetric('claimed')}
              className={cn(
                "px-3 py-1 rounded-lg text-sm font-medium transition-all",
                selectedMetric === 'claimed'
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              주간 근태시간
            </button>
            <button
              onClick={() => setSelectedMetric('adjusted')}
              className={cn(
                "px-3 py-1 rounded-lg text-sm font-medium transition-all",
                selectedMetric === 'adjusted'
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              주간 근무추정시간
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="overflow-x-auto">
          {/* Header Row */}
          <div className="flex gap-2 mb-3 min-w-[1200px]">
            <div className="w-20 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">구분</span>
            </div>
            {months.map(month => (
              <div key={month} className="flex-1 text-center">
                <span className="text-sm font-medium text-gray-700">{month}월</span>
              </div>
            ))}
            <div className="w-24 text-center">
              <span className="text-sm font-semibold text-gray-900">평균</span>
            </div>
          </div>

          {/* 전사 평균 Row */}
          {companyAverageData && (
            <>
              <div className="flex gap-2 mb-2 min-w-[1200px]">
                <div className="w-20 flex items-center justify-center">
                  <span className="text-base font-semibold text-gray-700">전사평균</span>
                </div>
                {months.map(month => {
                  const value = calculateCompanyMonthlyAverage(month);
                  const style = getValueStyle(value);

                  return (
                    <div key={month} className="flex-1">
                      <div className={cn(
                        "px-2 py-3 rounded-lg border-2 transition-all hover:shadow-sm min-h-[52px] flex items-center justify-center",
                        style.borderColor,
                        style.bgColor
                      )}>
                          {value > 0 ? (
                            <span className={cn("text-base font-semibold", style.textColor)}>
                              {value.toFixed(1)}
                            </span>
                          ) : null}
                      </div>
                    </div>
                  );
                })}
                <div className="w-24">
                  <div className="px-2 py-3 rounded-lg border-2 border-gray-400 bg-gray-100 min-h-[52px] flex items-center justify-center">
                      <span className="text-base font-semibold text-gray-900">
                        {companyOverallAverage.toFixed(1)}
                      </span>
                  </div>
                </div>
              </div>

              {/* Divider between 전사평균 and 센터평균 */}
              <div className="my-3 border-t border-gray-300"></div>
            </>
          )}

          {/* 센터 평균 Row */}
          {centerName && (
            <>
              <div className="flex gap-2 mb-2 min-w-[1200px]">
                <div className="w-20 flex items-center justify-center">
                  <span className="text-base font-semibold text-gray-700">센터평균</span>
                </div>
                {months.map(month => {
                  const value = calculateCenterMonthlyAverage(month);
                  const style = getValueStyle(value);

                  return (
                    <div key={month} className="flex-1">
                      <div className={cn(
                        "px-2 py-3 rounded-lg border-2 transition-all hover:shadow-sm min-h-[52px] flex items-center justify-center",
                        style.borderColor,
                        style.bgColor
                      )}>
                          {value > 0 ? (
                            <span className={cn("text-base font-semibold", style.textColor)}>
                              {value.toFixed(1)}
                            </span>
                          ) : null}
                      </div>
                    </div>
                  );
                })}
                <div className="w-24">
                  <div className="px-2 py-3 rounded-lg border-2 border-gray-400 bg-gray-100 min-h-[52px] flex items-center justify-center">
                      <span className="text-base font-semibold text-gray-900">
                        {centerOverallAverage.toFixed(1)}
                      </span>
                  </div>
                </div>
              </div>

              {/* Divider between 센터평균 and Level rows */}
              <div className="my-3 border-t border-gray-300"></div>
            </>
          )}

          {/* Level Rows */}
          {levelData.map((level, levelIndex) => (
            <div key={level.level}>
              <div className="flex gap-2 mb-2 min-w-[1200px]">
                <div className="w-20 flex items-center justify-center">
                  <span className="text-base font-semibold text-gray-700">{level.level}</span>
                </div>
                {months.map(month => {
                  const monthData = level.monthlyData.find(m => m.month === month);
                  const value = monthData
                    ? (selectedMetric === 'claimed'
                        ? monthData.weeklyClaimedHours
                        : monthData.weeklyAdjustedHours)
                    : 0;


                  const style = getValueStyle(value);

                  return (
                    <div key={month} className="flex-1">
                      <div className={cn(
                        "px-2 py-3 rounded-lg border-2 transition-all hover:shadow-sm min-h-[52px] flex items-center justify-center",
                        style.borderColor,
                        style.bgColor
                      )}>
                          {value > 0 ? (
                            <span className={cn("text-base font-semibold", style.textColor)}>
                              {selectedMetric === 'claimed' ? monthData?.weeklyClaimedHours?.toFixed(1) : monthData?.weeklyAdjustedHours?.toFixed(1)}
                            </span>
                          ) : null}
                      </div>
                    </div>
                  );
                })}
                <div className="w-24">
                  <div className="px-2 py-3 rounded-lg border-2 border-gray-400 bg-gray-100 min-h-[52px] flex items-center justify-center">
                      <span className="text-base font-semibold text-gray-900">
                        {(selectedMetric === 'claimed'
                          ? level.average.weeklyClaimedHours
                          : level.average.weeklyAdjustedHours
                        ).toFixed(1)}
                      </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Monthly Bar Charts */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-base font-semibold text-gray-800 mb-4">월별 트렌드</h4>
            <div className="flex gap-2 min-w-[1200px]">
              <div className="w-20 flex flex-col justify-end pb-8">
                {/* Y-axis labels */}
                <div className="flex flex-col justify-between h-64 text-xs font-medium text-gray-600 text-right pr-2 pt-8">
                  <span>55h</span>
                  <span>40h</span>
                  <span>25h</span>
                  <span>10h</span>
                </div>
              </div>
              {months.map(month => {
                return (
                  <div key={month} className="flex-1">
                    <div className="h-64 bg-gray-50 border border-gray-200 rounded-lg flex items-end gap-0.5 justify-center px-1 pb-1 pt-8 relative">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pt-8 pb-1">
                        <div className="border-b border-gray-200 opacity-30"></div>
                        <div className="border-b border-gray-200 opacity-30"></div>
                        <div className="border-b border-gray-200 opacity-30"></div>
                        <div></div>
                      </div>

                      {levelData.map((level) => {
                        const monthData = level.monthlyData.find(m => m.month === month);
                        const value = monthData
                          ? (selectedMetric === 'claimed'
                              ? monthData.weeklyClaimedHours
                              : monthData.weeklyAdjustedHours)
                          : 0;

                        // Calculate height in pixels for better visibility
                        // Map 0-55 hour range to 0-210px height (increased from 180)
                        const minValue = 0;
                        const maxValue = 55;
                        const maxHeight = 210; // max height in pixels
                        const safeValue = value ?? 0;
                        const normalizedValue = Math.max(minValue, Math.min(safeValue, maxValue));
                        const heightPixels = ((normalizedValue - minValue) / (maxValue - minValue)) * maxHeight;

                        // Gray scale colors for each level
                        const colors = {
                          'Lv.4': 'bg-gray-700',
                          'Lv.3': 'bg-gray-600',
                          'Lv.2': 'bg-gray-500',
                          'Lv.1': 'bg-gray-400'
                        };
                        const bgColor = colors[level.level as keyof typeof colors] || 'bg-gray-500';

                        return (
                          <div key={level.level} className="relative group flex-1 flex flex-col items-center justify-end">
                            {safeValue > 0 ? (
                              <>
                                <div
                                  className={cn(
                                    "w-5 transition-all rounded-t relative",
                                    bgColor
                                  )}
                                  style={{
                                    height: `${Math.max(heightPixels, 20)}px`
                                  }}
                                >
                                  {/* Value label on top of bar */}
                                  <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-600 whitespace-nowrap z-10">
                                    {(safeValue).toFixed(0)}
                                  </div>

                                  {/* Tooltip on hover */}
                                  <div className="absolute bottom-full mb-6 left-1/2 transform -translate-x-1/2 hidden group-hover:block z-10">
                                    <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                      {level.level}: {(safeValue).toFixed(1)}시간
                                    </div>
                                  </div>
                                </div>
                                {/* Level label at bottom */}
                                <div className="text-xs font-medium text-gray-700 mt-0.5">
                                  {level.level.replace('Lv.', 'L')}
                                </div>
                              </>
                            ) : (
                              // 데이터가 없을 때는 레벨 라벨만 표시
                              <div className="text-xs font-medium text-gray-400 mt-0.5">
                                {level.level.replace('Lv.', 'L')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-center mt-2">
                      <span className="text-sm font-medium text-gray-700">{month}월</span>
                    </div>
                  </div>
                );
              })}
              <div className="w-24"></div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-300 rounded"></div>
                <span>상위 20%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-300 rounded"></div>
                <span>중위 60%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-300 rounded"></div>
                <span>하위 20%</span>
              </div>
            </div>
            <span>* 주간 근무시간은 일평균을 주 5일 기준으로 환산한 값입니다</span>
          </div>
        </div>
      </div>
    </div>
  );
}