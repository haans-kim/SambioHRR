"use client";

import { MagicCard } from "@/components/ui/magic-card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar";
import { cn } from "@/lib/utils";
import { Users, TrendingUp, Clock } from "lucide-react";
import { mapOrganizationName } from "@/lib/organization-mapping";

interface MetricCardProps {
  orgName: string;
  orgCode: string;
  efficiency?: number;
  totalEmployees?: number;
  avgWorkHours?: number;
  childrenCount?: number;
  onClick?: () => void;
  size?: "small" | "medium" | "large";
  // 동적 threshold 계산을 위한 추가 props
  siblingValues?: number[]; // 같은 레벨의 다른 조직들의 값들
  weeklyWorkHours?: number; // 주간 근무시간 (threshold 계산용)
}

export function MetricCard({
  orgName,
  orgCode,
  efficiency = 0,
  totalEmployees = 0,
  avgWorkHours = 0,
  childrenCount = 0,
  onClick,
  size = "medium",
  siblingValues = [],
  weeklyWorkHours = 0,
}: MetricCardProps) {
  // 동적 threshold 계산 함수
  const calculateDynamicThresholds = (currentValue: number, siblingValues: number[]) => {
    // 유효한 값들만 필터링 (0보다 큰 값들)
    const validValues = siblingValues.filter(v => v > 0);
    
    if (validValues.length === 0) {
      // 비교할 값이 없으면 기본 threshold 사용
      return null;
    }
    
    // 값들을 내림차순 정렬
    const sortedValues = [...validValues].sort((a, b) => b - a);
    const totalCount = sortedValues.length;
    
    // 현재 값의 순위 찾기
    const rank = sortedValues.findIndex(v => v === currentValue) + 1;
    
    if (rank === 0) {
      // 현재 값이 siblingValues에 없는 경우 기본 처리
      return null;
    }
    
    // 상위 1개, 하위 1개 기준으로 구분 (최소 3개 이상일 때)
    if (totalCount >= 3) {
      if (rank === 1) {
        // 최상위 - 빨간색 (상위)
        return { status: 'high', color: 'text-red-500 border-red-500/50', icon: '▲' };
      } else if (rank === totalCount) {
        // 최하위 - 파란색 (하위)
        return { status: 'low', color: 'text-blue-500 border-blue-500/50', icon: '▼' };
      } else {
        // 중위 - 녹색 (중위)
        return { status: 'middle', color: 'text-green-500 border-green-500/50', icon: '●' };
      }
    } else if (totalCount === 2) {
      // 2개만 있을 때
      if (rank === 1) {
        return { status: 'high', color: 'text-red-500 border-red-500/50', icon: '▲' };
      } else {
        return { status: 'low', color: 'text-blue-500 border-blue-500/50', icon: '▼' };
      }
    }
    
    // 1개만 있거나 기타 경우
    return { status: 'middle', color: 'text-green-500 border-green-500/50', icon: '●' };
  };
  
  // 주간 근무시간을 기준으로 동적 threshold 적용
  const thresholdInfo = weeklyWorkHours > 0 && siblingValues.length > 0 
    ? calculateDynamicThresholds(weeklyWorkHours, siblingValues)
    : null;
    
  const getEfficiencyColor = (value: number) => {
    // 동적 threshold가 있으면 사용, 없으면 기본값 사용
    if (thresholdInfo) {
      return thresholdInfo.color;
    }
    
    // 기본 효율성 기준
    if (value >= 90) return "text-green-500 border-green-500/50";
    if (value >= 75) return "text-blue-500 border-blue-500/50";
    if (value >= 60) return "text-amber-500 border-amber-500/50";
    return "text-red-500 border-red-500/50";
  };

  const sizeClasses = {
    small: "p-4",
    medium: "p-6",
    large: "p-8 col-span-2 row-span-2",
  };

  return (
    <MagicCard
      className={cn(
        "cursor-pointer transition-all hover:scale-[1.02]",
        getEfficiencyColor(efficiency),
        sizeClasses[size]
      )}
      onClick={onClick}
      gradientColor={efficiency >= 75 ? "#10b981" : "#ef4444"}
      gradientOpacity={0.3}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg">{mapOrganizationName(orgName)}</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {childrenCount > 0 && `${childrenCount}개 하위조직`}
            </p>
          </div>
          <div className="flex flex-col items-center">
            <AnimatedCircularProgressBar
              value={efficiency}
              size={60}
              strokeWidth={6}
              showValue={false}
            />
            {/* 주간 근무시간 threshold 아이콘 표시 */}
            {thresholdInfo && weeklyWorkHours > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <span className="text-sm font-medium">{weeklyWorkHours.toFixed(1)}h</span>
                <span className={cn("text-lg", thresholdInfo.color.split(' ')[0])}>
                  {thresholdInfo.icon}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">효율성</span>
            <NumberTicker
              value={efficiency}
              suffix="%"
              className="font-bold text-lg"
            />
          </div>

          {totalEmployees > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                <Users className="w-4 h-4" />
                인원
              </span>
              <span className="font-semibold">{totalEmployees}명</span>
            </div>
          )}

          {avgWorkHours > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                평균 근무
              </span>
              <span className="font-semibold">{avgWorkHours.toFixed(1)}시간</span>
            </div>
          )}
        </div>
      </div>
    </MagicCard>
  );
}