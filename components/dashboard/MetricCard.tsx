"use client";

import { MagicCard } from "@/components/ui/magic-card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar";
import { cn } from "@/lib/utils";
import { Users, TrendingUp, Clock } from "lucide-react";

interface MetricCardProps {
  orgName: string;
  orgCode: string;
  efficiency?: number;
  totalEmployees?: number;
  avgWorkHours?: number;
  childrenCount?: number;
  onClick?: () => void;
  size?: "small" | "medium" | "large";
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
}: MetricCardProps) {
  const getEfficiencyColor = (value: number) => {
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
            <h3 className="font-bold text-lg">{orgName}</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {childrenCount > 0 && `${childrenCount}개 하위조직`}
            </p>
          </div>
          <AnimatedCircularProgressBar
            value={efficiency}
            size={60}
            strokeWidth={6}
            showValue={false}
          />
        </div>

        <div className="space-y-3 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">실근무</span>
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