"use client";

import { cn } from "@/lib/utils";

export type MetricType = 'efficiency' | 'workHours' | 'claimedHours' | 'weeklyWorkHours' | 'weeklyClaimedHours' | 'focusedWorkHours' | 'dataReliability';

interface MetricSelectorProps {
  selectedMetric: MetricType;
  onMetricChange: (metric: MetricType) => void;
}

export function MetricSelector({ selectedMetric, onMetricChange }: MetricSelectorProps) {
  // 선택값을 로컬스토리지에 지속
  // 키: hrDashboard.selectedMetric
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem('hrDashboard.selectedMetric');
      if (saved && saved !== selectedMetric) {
        // 외부에서 state를 관리하므로, 여기서 직접 set은 못함. 호출 측에서 초기값을 저장/복원하도록 권장.
      }
    } catch {}
  }

  const metrics = [
    { id: 'weeklyClaimedHours' as MetricType, label: '주간 근무시간' },
    { id: 'weeklyWorkHours' as MetricType, label: '주간 작업추정시간' },
    { id: 'claimedHours' as MetricType, label: '일간 근무시간' },
    { id: 'workHours' as MetricType, label: '일간 작업추정시간' },
    { id: 'focusedWorkHours' as MetricType, label: '집중근무시간' },
    { id: 'efficiency' as MetricType, label: '실근무 지표' },
    { id: 'dataReliability' as MetricType, label: '데이터 신뢰도' },
  ];

  return (
    <div className="flex bg-white rounded-lg p-1 gap-2">
      {metrics.map((metric) => (
        <button
          key={metric.id}
          onClick={() => {
            try { window.localStorage.setItem('hrDashboard.selectedMetric', metric.id); } catch {}
            onMetricChange(metric.id);
          }}
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