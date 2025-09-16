"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CenterTabsProps {
  centers: { id: string; name: string }[];
  selectedCenter: string;
  onCenterChange: (center: string) => void;
  currentCenterName: string;
}

export function CenterTabs({ centers, selectedCenter, onCenterChange, currentCenterName }: CenterTabsProps) {
  // 센터를 그대로 순서대로 표시
  const sortedCenters = centers;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">
          트렌드 분석 - {currentCenterName}
        </h2>
        <p className="text-sm text-gray-500">
          2025년 1월 ~ 12월 레벨별 근무시간 추이
        </p>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        {sortedCenters.map((center) => (
          <button
            key={center.id}
            onClick={() => onCenterChange(center.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all text-center",
              selectedCenter === center.id
                ? "bg-black text-white shadow-sm"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            {center.name}
          </button>
        ))}
      </div>
    </div>
  );
}