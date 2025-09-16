"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface LevelTrendTableProps {
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

export function LevelTrendTable({ levelData, period }: LevelTrendTableProps) {
  const [selectedMetric, setSelectedMetric] = useState<'claimed' | 'adjusted'>('adjusted');

  // 레벨별 색상 매핑
  const levelColors = {
    'Lv.4': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
    'Lv.3': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
    'Lv.2': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
    'Lv.1': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  };

  // 월 배열 생성
  const months = [];
  for (let m = period.startMonth; m <= period.endMonth; m++) {
    months.push(m);
  }

  // 전체 평균 계산
  const totalAverage = {
    weeklyClaimedHours: levelData.reduce((sum, l) => sum + l.average.weeklyClaimedHours, 0) / levelData.length,
    weeklyAdjustedHours: levelData.reduce((sum, l) => sum + l.average.weeklyAdjustedHours, 0) / levelData.length
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">레벨별 월별 통계</h3>
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

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[100px]">
                구분
              </th>
              {months.map(month => (
                <th key={month} className="px-4 py-3 text-center text-sm font-medium text-gray-700 min-w-[80px]">
                  {month}월
                </th>
              ))}
              <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 min-w-[80px] bg-gray-100">
                평균
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {/* 전체 평균 행 */}
            <tr className="bg-blue-50">
              <td className="px-4 py-3">
                <div className="flex items-center">
                  <span className="font-semibold text-blue-900">전사 평균</span>
                </div>
              </td>
              {months.map(month => {
                // 해당 월의 전체 평균 계산
                const monthData = levelData
                  .map(l => l.monthlyData.find(m => m.month === month))
                  .filter(Boolean);

                const monthAvg = monthData.length > 0
                  ? monthData.reduce((sum, d) =>
                      sum + (selectedMetric === 'claimed' ? d!.weeklyClaimedHours : d!.weeklyAdjustedHours), 0
                    ) / monthData.length
                  : 0;

                return (
                  <td key={month} className="px-4 py-3 text-center">
                    <span className="font-semibold text-blue-900">
                      {monthAvg.toFixed(1)}
                    </span>
                  </td>
                );
              })}
              <td className="px-4 py-3 text-center bg-blue-100">
                <span className="font-bold text-blue-900">
                  {(selectedMetric === 'claimed'
                    ? totalAverage.weeklyClaimedHours
                    : totalAverage.weeklyAdjustedHours
                  ).toFixed(1)}
                </span>
              </td>
            </tr>

            {/* 레벨별 데이터 행 */}
            {levelData.map(level => {
              const colors = levelColors[level.level as keyof typeof levelColors] || levelColors['Lv.1'];

              return (
                <React.Fragment key={level.level}>
                  {/* 메인 행 - 선택된 메트릭 */}
                  <tr className={colors.bg}>
                    <td className="px-4 py-3">
                      <div className={cn(
                        "inline-flex items-center px-3 py-1 rounded-lg border",
                        colors.bg,
                        colors.border
                      )}>
                        <span className={cn("font-semibold", colors.text)}>
                          {level.level}
                        </span>
                      </div>
                    </td>
                    {months.map(month => {
                      const monthData = level.monthlyData.find(m => m.month === month);
                      const value = monthData
                        ? (selectedMetric === 'claimed'
                            ? monthData.weeklyClaimedHours
                            : monthData.weeklyAdjustedHours)
                        : 0;

                      return (
                        <td key={month} className="px-4 py-3 text-center">
                          <span className={cn("font-medium", colors.text)}>
                            {value.toFixed(1)}
                          </span>
                        </td>
                      );
                    })}
                    <td className={cn("px-4 py-3 text-center", colors.bg)} style={{ backgroundColor: `${colors.bg} !important`, opacity: 0.8 }}>
                      <span className={cn("font-bold", colors.text)}>
                        {(selectedMetric === 'claimed'
                          ? level.average.weeklyClaimedHours
                          : level.average.weeklyAdjustedHours
                        ).toFixed(1)}
                      </span>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          * 주간 근무시간은 일평균을 주 5일 기준으로 환산한 값입니다
        </p>
      </div>
    </div>
  );
}