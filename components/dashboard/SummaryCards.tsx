"use client";

import { NeonGradientCard } from "@/components/ui/neon-gradient-card";
import { cn } from "@/lib/utils";
import { MetricType } from "./MetricSelector";

interface SummaryCardsProps {
  selectedMetric?: MetricType;
  thresholds?: {
    efficiency: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    workHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    claimedHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyClaimedHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    focusedWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    dataReliability?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
  };
  immediateAttention?: string[];
  bestPractices?: string[];
  improvementTargets?: string[];
}

export function SummaryCards({
  selectedMetric = 'efficiency',
  thresholds,
  immediateAttention = ["심각한 과로 상태입니다. 업무량 재분배 및 인력 충원이 시급합니다."],
  bestPractices = ["최적 범위의 근무율과 높은 효율성을 보이는 조직/직급입니다."],
  improvementTargets = ["Lv.4 직급의 효율성이 낮습니다. [의사결정 프로세스 개선] 및 [관리 업무 간소화]가 필요합니다."]
}: SummaryCardsProps) {
  
  // 동적 임계값 또는 기본값 사용
  const currentThresholds = thresholds?.[selectedMetric] || {
    high: '기준값 로딩중',
    middle: '기준값 로딩중',
    low: '기준값 로딩중',
    thresholds: { low: 0, high: 0 }
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
      {/* 모범사례 상위 20% */}
      <div className="relative">
        <div className={cn(
          "rounded-lg p-6 h-full bg-gradient-to-br from-blue-50 to-white",
          "border-2 border-gray-300 border-l-4 border-l-blue-500 shadow-sm"
        )}>
          <div className="flex items-start space-x-3">
            <div className="text-blue-500 text-xl">▲</div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">모범사례</h3>
              <p className="text-sm text-gray-500">상위 20% ({currentThresholds.high})</p>
            </div>
          </div>
        </div>
      </div>

      {/* 양호 */}
      <div className="relative">
        <div className={cn(
          "rounded-lg p-6 h-full bg-gradient-to-br from-green-50 to-white",
          "border-2 border-gray-300 border-l-4 border-l-green-500 shadow-sm"
        )}>
          <div className="flex items-start space-x-3">
            <div className="text-green-500 text-xl">●</div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">양호</h3>
              <p className="text-sm text-gray-500">중간 60% ({currentThresholds.middle})</p>
            </div>
          </div>
        </div>
      </div>

      {/* 관찰 주시 필요 하위 20% */}
      <div className="relative">
        <div className={cn(
          "rounded-lg p-6 h-full bg-gradient-to-br from-red-50 to-white",
          "border-2 border-gray-300 border-l-4 border-l-red-500 shadow-sm"
        )}>
          <div className="flex items-start space-x-3">
            <div className="text-red-500 text-xl">▼</div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">관찰 주시 필요</h3>
              <p className="text-sm text-gray-500">하위 20% ({currentThresholds.low})</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}