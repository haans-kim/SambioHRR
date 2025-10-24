"use client";

import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { cn } from "@/lib/utils";

interface TrendChartProps {
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

export function TrendChart({ levelData, period }: TrendChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<'claimed' | 'adjusted'>('adjusted');

  // 차트 데이터 준비
  const chartData = [];
  for (let m = period.startMonth; m <= period.endMonth; m++) {
    const monthData: any = { month: `${m}월` };

    levelData.forEach(level => {
      const data = level.monthlyData.find(d => d.month === m);
      if (data) {
        const value = selectedMetric === 'claimed'
          ? data.weeklyClaimedHours
          : data.weeklyAdjustedHours;

        // null 또는 0인 값은 차트에 표시하지 않음 (근무추정시간의 경우)
        if (selectedMetric === 'adjusted' && (value === null || value === 0)) {
          // 데이터 포인트를 추가하지 않음
        } else {
          monthData[level.level] = value;
        }
      }
    });

    // 전체 평균 추가
    const avgValues = levelData
      .map(l => l.monthlyData.find(d => d.month === m))
      .filter(Boolean)
      .map(d => selectedMetric === 'claimed' ? d!.weeklyClaimedHours : d!.weeklyAdjustedHours)
      .filter(v => v !== null && v !== 0); // null과 0 제외

    if (avgValues.length > 0) {
      monthData['전사 평균'] = Math.round(
        avgValues.reduce((sum, v) => sum + v, 0) / avgValues.length * 10
      ) / 10;
    }

    chartData.push(monthData);
  }

  // 레벨별 색상
  const levelColors = {
    'Lv.4': '#ef4444',  // red-500
    'Lv.3': '#f97316',  // orange-500
    'Lv.2': '#eab308',  // yellow-600
    'Lv.1': '#22c55e',  // green-500
    '전사 평균': '#3b82f6'  // blue-500
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-semibold">{entry.value}시간</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">월별 트렌드</h3>
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

      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#9ca3af' }}
          />
          <YAxis
            domain={[38, 52]}
            ticks={[38, 40, 42, 44, 46, 48, 50, 52]}
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#9ca3af' }}
            label={{
              value: '주간 근무시간 (시간)',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12 }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />

          {/* 전사 평균 라인 (먼저 그려서 뒤로 배치) */}
          <Line
            type="monotone"
            dataKey="전사 평균"
            stroke={levelColors['전사 평균']}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />

          {/* 레벨별 라인 */}
          {levelData.map(level => (
            <Line
              key={level.level}
              type="monotone"
              dataKey={level.level}
              stroke={levelColors[level.level as keyof typeof levelColors]}
              strokeWidth={2.5}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 flex flex-wrap gap-4 justify-center">
        {Object.entries(levelColors).map(([level, color]) => (
          <div key={level} className="flex items-center gap-2">
            <div
              className="w-4 h-1"
              style={{
                backgroundColor: color,
                borderStyle: level === '전사 평균' ? 'dashed' : 'solid',
                borderWidth: '2px',
                borderColor: color
              }}
            />
            <span className="text-sm text-gray-600">{level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}