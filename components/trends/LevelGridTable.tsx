"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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
  period: {
    year: number;
    startMonth: number;
    endMonth: number;
  };
}

export function LevelGridTable({ levelData, period }: LevelGridTableProps) {
  const [selectedMetric, setSelectedMetric] = useState<'claimed' | 'adjusted'>('adjusted');

  // 월 배열 생성
  const months = [];
  for (let m = period.startMonth; m <= period.endMonth; m++) {
    months.push(m);
  }

  // 전사 평균 계산
  const calculateMonthlyAverage = (month: number) => {
    const monthData = levelData
      .map(l => l.monthlyData.find(m => m.month === month))
      .filter(Boolean);

    if (monthData.length === 0) return 0;

    const sum = monthData.reduce((acc, d) =>
      acc + (selectedMetric === 'claimed' ? d!.weeklyClaimedHours : d!.weeklyAdjustedHours), 0
    );
    return sum / monthData.length;
  };

  // 전체 평균
  const overallAverage = levelData.reduce((sum, l) =>
    sum + (selectedMetric === 'claimed' ? l.average.weeklyClaimedHours : l.average.weeklyAdjustedHours), 0
  ) / levelData.length;

  // 값에 따른 색상과 아이콘 결정
  const getValueStyle = (value: number, baseValue: number = 42) => {
    const diff = value - baseValue;

    if (Math.abs(diff) < 0.5) {
      return {
        borderColor: 'border-green-300',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        icon: Minus,
        iconColor: 'text-green-600'
      };
    } else if (diff > 0) {
      return {
        borderColor: 'border-red-300',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        icon: TrendingUp,
        iconColor: 'text-red-600'
      };
    } else {
      return {
        borderColor: 'border-blue-300',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        icon: TrendingDown,
        iconColor: 'text-blue-600'
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
                  ? "bg-blue-100 text-blue-700"
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
                  ? "bg-blue-100 text-blue-700"
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
              <span className="text-sm font-bold text-gray-900">평균</span>
            </div>
          </div>

          {/* 전사 평균 Row and Bar Charts */}
          <div className="flex gap-2 mb-4 min-w-[1200px]">
            <div className="w-20 flex items-center justify-center">
              <span className="text-sm font-semibold text-gray-700">전사평균</span>
            </div>
            {months.map(month => {
              const value = calculateMonthlyAverage(month);
              const style = getValueStyle(value);
              const Icon = style.icon;

              return (
                <div key={month} className="flex-1">
                  <div className={cn(
                    "px-2 py-3 rounded-lg border transition-all hover:shadow-sm",
                    style.borderColor,
                    style.bgColor
                  )}>
                    <div className="flex items-center justify-center gap-1">
                      <span className={cn("text-sm font-semibold", style.textColor)}>
                        {value.toFixed(1)}
                      </span>
                      <Icon className={cn("w-3 h-3", style.iconColor)} />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="w-24">
              <div className="px-2 py-3 rounded-lg border border-gray-400 bg-gray-100">
                <div className="flex items-center justify-center">
                  <span className="text-sm font-bold text-gray-900">
                    {overallAverage.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Divider between 전사평균 and Level rows */}
          <div className="my-3 border-t border-gray-300"></div>

          {/* Level Rows */}
          {levelData.map((level, levelIndex) => (
            <div key={level.level}>
              <div className="flex gap-2 mb-2 min-w-[1200px]">
                <div className="w-20 flex items-center justify-center">
                  <span className="text-sm font-semibold text-gray-700">{level.level}</span>
                </div>
                {months.map(month => {
                  const monthData = level.monthlyData.find(m => m.month === month);
                  const value = monthData
                    ? (selectedMetric === 'claimed'
                        ? monthData.weeklyClaimedHours
                        : monthData.weeklyAdjustedHours)
                    : 0;
                  const style = getValueStyle(value);
                  const Icon = style.icon;

                  return (
                    <div key={month} className="flex-1">
                      <div className={cn(
                        "px-2 py-3 rounded-lg border transition-all hover:shadow-sm",
                        style.borderColor,
                        style.bgColor
                      )}>
                        <div className="flex items-center justify-center gap-1">
                          <span className={cn("text-sm font-semibold", style.textColor)}>
                            {value.toFixed(1)}
                          </span>
                          <Icon className={cn("w-3 h-3", style.iconColor)} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="w-24">
                  <div className="px-2 py-3 rounded-lg border border-gray-400 bg-gray-100">
                    <div className="flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-900">
                        {(selectedMetric === 'claimed'
                          ? level.average.weeklyClaimedHours
                          : level.average.weeklyAdjustedHours
                        ).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Monthly Bar Charts */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">월별 트렌드</h4>
            <div className="flex gap-2 min-w-[1200px]">
              <div className="w-20 flex flex-col justify-end pb-8">
                {/* Y-axis labels */}
                <div className="flex flex-col justify-between h-48 text-xs text-gray-500 text-right pr-2">
                  <span>55h</span>
                  <span>40h</span>
                  <span>25h</span>
                  <span>10h</span>
                </div>
              </div>
              {months.map(month => {
                return (
                  <div key={month} className="flex-1">
                    <div className="h-48 bg-gray-50 border border-gray-200 rounded-lg flex items-end gap-0.5 justify-center px-1 pb-1 relative">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
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
                        // Map 0-55 hour range to 0-180px height
                        const minValue = 0;
                        const maxValue = 55;
                        const maxHeight = 180; // max height in pixels
                        const normalizedValue = Math.max(minValue, Math.min(value, maxValue));
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
                              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-[10px] font-medium text-gray-700 whitespace-nowrap">
                                {value.toFixed(0)}
                              </div>

                              {/* Tooltip on hover */}
                              <div className="absolute bottom-full mb-6 left-1/2 transform -translate-x-1/2 hidden group-hover:block z-10">
                                <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                  {level.level}: {value.toFixed(1)}시간
                                </div>
                              </div>
                            </div>
                            {/* Level label at bottom */}
                            <div className="text-[9px] text-gray-600 mt-0.5">
                              {level.level.replace('Lv.', 'L')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-center mt-2">
                      <span className="text-xs text-gray-500">{month}월</span>
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
                <TrendingUp className="w-3 h-3 text-red-600" />
                <span>상위(≥43시간)</span>
              </div>
              <div className="flex items-center gap-1">
                <Minus className="w-3 h-3 text-green-600" />
                <span>중위(41.5-43시간)</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-blue-600" />
                <span>하위(≤41.5시간)</span>
              </div>
            </div>
            <span>* 주간 근무시간은 일평균을 주 5일 기준으로 환산한 값입니다</span>
          </div>
        </div>
      </div>
    </div>
  );
}