"use client";

import { Settings, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

// 분석 모드 판별 함수
const getAnalysisMode = (month: string): 'enhanced' | 'legacy' => {
  return month >= '2025-06' ? 'enhanced' : 'legacy';
};

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
  // 월을 "2025.06" 형식으로 포맷
  const formatMonth = (month: string) => {
    return month.replace("-", ".");
  };

  // 월 선택
  const handleMonthClick = (month: string) => {
    onMonthChange(month);
  };

  return (
    <div className="flex items-center justify-end gap-2 w-full">
      {/* 월 탭들 - 모두 표시 */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
        {availableMonths.map((month) => {
          const isSelected = month === selectedMonth;
          const analysisMode = getAnalysisMode(month);
          const isEnhanced = analysisMode === 'enhanced';

          return (
            <button
              key={month}
              onClick={() => handleMonthClick(month)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                isSelected
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              )}
              title={isEnhanced ? '상세 분석 모드 (전체 데이터)' : '기본 분석 모드 (제한 데이터)'}
            >
              {formatMonth(month)}
            </button>
          );
        })}
      </div>
    </div>
  );
}