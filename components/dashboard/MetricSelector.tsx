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
    <div className="flex bg-white rounded-lg p-1 gap-2">
      {metrics.map((metric) => (
        <button
          key={metric.id}
          onClick={() => onMetricChange(metric.id)}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-md transition-all",
            selectedMetric === metric.id
              ? "bg-gray-900 text-white shadow-sm"
              : "bg-white text-gray-700 border-2 border-gray-400 hover:border-gray-600"
          )}
        >
          {metric.label}
        </button>
      ))}
    </div>
  );
}