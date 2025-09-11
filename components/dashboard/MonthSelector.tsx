"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthSelectorProps {
  selectedMonth: string; // "2025-06" 형식
  onMonthChange: (month: string) => void;
  availableMonths?: string[]; // 사용 가능한 월 배열
}

// 2025.01부터 2025.06까지 기본 월 리스트
const DEFAULT_MONTHS = [
  "2025-01", "2025-02", "2025-03", 
  "2025-04", "2025-05", "2025-06"
];

export function MonthSelector({ 
  selectedMonth, 
  onMonthChange, 
  availableMonths = DEFAULT_MONTHS 
}: MonthSelectorProps) {
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const visibleCount = 4; // 한 번에 보여줄 탭 수

  // 월을 "2025.06" 형식으로 포맷
  const formatMonth = (month: string) => {
    return month.replace("-", ".");
  };

  // 현재 선택된 월의 인덱스
  const selectedIndex = availableMonths.indexOf(selectedMonth);
  
  // 선택된 월이 보이는 범위에 있는지 확인하고 조정
  const ensureSelectedVisible = () => {
    if (selectedIndex < visibleStartIndex) {
      setVisibleStartIndex(selectedIndex);
    } else if (selectedIndex >= visibleStartIndex + visibleCount) {
      setVisibleStartIndex(Math.max(0, selectedIndex - visibleCount + 1));
    }
  };

  // 좌측 화살표 클릭
  const handlePrevious = () => {
    if (visibleStartIndex > 0) {
      setVisibleStartIndex(visibleStartIndex - 1);
    }
  };

  // 우측 화살표 클릭
  const handleNext = () => {
    if (visibleStartIndex + visibleCount < availableMonths.length) {
      setVisibleStartIndex(visibleStartIndex + 1);
    }
  };

  // 월 선택
  const handleMonthClick = (month: string) => {
    onMonthChange(month);
    ensureSelectedVisible();
  };

  const visibleMonths = availableMonths.slice(
    visibleStartIndex, 
    visibleStartIndex + visibleCount
  );

  const canGoPrevious = visibleStartIndex > 0;
  const canGoNext = visibleStartIndex + visibleCount < availableMonths.length;

  return (
    <div className="flex items-center gap-2">
      {/* 좌측 화살표 */}
      <button
        onClick={handlePrevious}
        disabled={!canGoPrevious}
        className={cn(
          "p-1 rounded-md transition-colors",
          canGoPrevious
            ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            : "text-gray-300 cursor-not-allowed"
        )}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* 월 탭들 */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
        {visibleMonths.map((month) => {
          const isSelected = month === selectedMonth;
          return (
            <button
              key={month}
              onClick={() => handleMonthClick(month)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                isSelected
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
              )}
            >
              {formatMonth(month)}
            </button>
          );
        })}
      </div>

      {/* 우측 화살표 */}
      <button
        onClick={handleNext}
        disabled={!canGoNext}
        className={cn(
          "p-1 rounded-md transition-colors",
          canGoNext
            ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            : "text-gray-300 cursor-not-allowed"
        )}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}