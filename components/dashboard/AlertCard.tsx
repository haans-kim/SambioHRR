"use client";

import { NeonGradientCard } from "@/components/ui/neon-gradient-card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertCardProps {
  type: "warning" | "success" | "danger";
  title: string;
  value: number;
  suffix?: string;
  description?: string;
  className?: string;
}

export function AlertCard({
  type,
  title,
  value,
  suffix = "%",
  description,
  className,
}: AlertCardProps) {
  const typeConfig = {
    warning: {
      icon: AlertTriangle,
      borderColor: "rgb(245, 158, 11)", // amber-500
      glowColor: "rgba(245, 158, 11, 0.3)",
      iconColor: "text-amber-500",
    },
    success: {
      icon: TrendingUp,
      borderColor: "rgb(16, 185, 129)", // green-500
      glowColor: "rgba(16, 185, 129, 0.3)",
      iconColor: "text-green-500",
    },
    danger: {
      icon: TrendingDown,
      borderColor: "rgb(239, 68, 68)", // red-500
      glowColor: "rgba(239, 68, 68, 0.3)",
      iconColor: "text-red-500",
    },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <NeonGradientCard
      className={cn("w-full", className)}
      borderColor={config.borderColor}
      glowColor={config.glowColor}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className={cn("w-5 h-5", config.iconColor)} />
          <div>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              {title}
            </p>
            <div className="flex items-baseline gap-1">
              <NumberTicker
                value={value}
                suffix={suffix}
                className="text-2xl font-bold"
              />
            </div>
            {description && (
              <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
    </NeonGradientCard>
  );
}