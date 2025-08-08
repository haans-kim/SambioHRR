"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export const AnimatedCircularProgressBar = ({
  value,
  max = 100,
  min = 0,
  size = 100,
  strokeWidth = 8,
  className,
  showValue = true,
  suffix = "%",
}: {
  value: number;
  max?: number;
  min?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showValue?: boolean;
  suffix?: string;
}) => {
  const percentage = ((value - min) / (max - min)) * 100;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = (percent: number) => {
    if (percent >= 90) return "#10b981"; // green
    if (percent >= 75) return "#3b82f6"; // blue
    if (percent >= 60) return "#f59e0b"; // amber
    return "#ef4444"; // red
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-neutral-200 dark:text-neutral-800"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(percentage)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeInOut" }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold">
            {Math.round(value)}{suffix}
          </span>
        </div>
      )}
    </div>
  );
};