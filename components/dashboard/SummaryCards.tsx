"use client";

import { NeonGradientCard } from "@/components/ui/neon-gradient-card";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  immediateAttention?: string[];
  bestPractices?: string[];
  improvementTargets?: string[];
}

export function SummaryCards({
  immediateAttention = ["실각한 과로 상태입니다. 업무량 재분배 및 인력 충원이 시급합니다."],
  bestPractices = ["최적 범위의 근무율과 높은 효율성을 보이는 조직/직급입니다."],
  improvementTargets = ["Lv.4 직급의 실근무율이 낮습니다. [의사결정 프로세스 개선] 및 [관리 업무 간소화]가 필요합니다."]
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
      {/* 즉시 개입 필요 */}
      <div className="relative">
        <div className={cn(
          "rounded-lg p-6 h-full bg-gradient-to-br from-red-50 to-white",
          "border-l-4 border-red-500 shadow-sm"
        )}>
          <div className="flex items-start space-x-3">
            <div className="text-red-500 text-3xl">⚠</div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">즉시 개입 필요</h3>
              <p className="text-sm text-gray-600">
                {immediateAttention[0]}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 모범 사례 */}
      <div className="relative">
        <div className={cn(
          "rounded-lg p-6 h-full bg-gradient-to-br from-green-50 to-white",
          "border-l-4 border-green-500 shadow-sm"
        )}>
          <div className="flex items-start space-x-3">
            <div className="text-green-500 text-3xl">✓</div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">모범 사례</h3>
              <p className="text-sm text-gray-600">
                {bestPractices[0]}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 효율성 개선 대상 */}
      <div className="relative">
        <div className={cn(
          "rounded-lg p-6 h-full bg-gradient-to-br from-blue-50 to-white",
          "border-l-4 border-blue-500 shadow-sm"
        )}>
          <div className="flex items-start space-x-3">
            <div className="text-blue-500 text-3xl">📊</div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">효율성 개선 대상</h3>
              <p className="text-sm text-gray-600">
                {improvementTargets[0]}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}