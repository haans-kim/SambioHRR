"use client";

import { cn } from "@/lib/utils";

export type MetricType = 'efficiency' | 'workHours' | 'claimedHours' | 'weeklyWorkHours' | 'weeklyClaimedHours';

interface MetricSelectorProps {
  selectedMetric: MetricType;
  onMetricChange: (metric: MetricType) => void;
}

export function MetricSelector({ selectedMetric, onMetricChange }: MetricSelectorProps) {
  const metrics = [
    { id: 'weeklyClaimedHours' as MetricType, label: '주간 근무시간' },
    { id: 'weeklyWorkHours' as MetricType, label: '주간 작업추정시간' },
    { id: 'claimedHours' as MetricType, label: '일간 근무시간' },
    { id: 'workHours' as MetricType, label: '일간 작업추정시간' },
    { id: 'efficiency' as MetricType, label: '효율성 지표' },
  ];

  return (
    <div className="flex bg-gray-200 rounded-lg p-2 gap-3">
      {metrics.map((metric) => (
        <button
          key={metric.id}
          onClick={() => onMetricChange(metric.id)}
          className={cn(
            "px-3 py-2 text-sm font-medium rounded-md transition-all",
            selectedMetric === metric.id
              ? "bg-blue-500 text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900 hover:bg-white"
          )}
        >
          {metric.label}
        </button>
      ))}
    </div>
  );
}