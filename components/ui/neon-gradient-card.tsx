"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export const NeonGradientCard = ({
  children,
  className,
  borderColor = "rgb(59, 130, 246)", // blue-500
  glowColor = "rgba(59, 130, 246, 0.5)",
}: {
  children: ReactNode;
  className?: string;
  borderColor?: string;
  glowColor?: string;
}) => {
  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden p-[2px]",
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${borderColor}, ${glowColor})`,
      }}
    >
      <div
        className="absolute inset-0 rounded-xl blur-xl opacity-75"
        style={{
          background: `linear-gradient(135deg, ${borderColor}, ${glowColor})`,
        }}
      />
      <div className="relative rounded-[10px] bg-white dark:bg-neutral-950 p-4">
        {children}
      </div>
    </div>
  );
};