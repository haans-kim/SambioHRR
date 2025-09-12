"use client";

import { useState } from "react";
import { Calendar, BarChart3, Info, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LegacyAnalysisButtonProps {
  onMonthSelect: (month: string) => void;
  className?: string;
}

const LEGACY_MONTHS = [
  { value: "2025-01", label: "2025.01" },
  { value: "2025-02", label: "2025.02" },
  { value: "2025-03", label: "2025.03" },
  { value: "2025-04", label: "2025.04" },
  { value: "2025-05", label: "2025.05" }
];

export function LegacyAnalysisButton({ onMonthSelect, className }: LegacyAnalysisButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleMonthClick = (month: string) => {
    onMonthSelect(month);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors shadow-sm",
          "border border-orange-700"
        )}
      >
        <BarChart3 className="w-4 h-4" />
        <span className="font-medium">1-5월 추가분석</span>
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-orange-600" />
                <h3 className="font-semibold text-gray-900">1-5월 기본분석 모드</h3>
              </div>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <Info className="w-3 h-3 mt-0.5 text-blue-500 flex-shrink-0" />
                <div>
                  <p className="mb-1">제한 데이터 기반 분석 (Claim + Tag 데이터만)</p>
                  <ul className="text-xs space-y-0.5">
                    <li>• 장비 사용시간 미포함</li>
                    <li>• 식사시간 추정치</li>
                    <li>• 회의실 이용 데이터 제한</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Month Selection */}
            <div className="p-3">
              <div className="text-sm font-medium text-gray-700 mb-2">분석 월 선택</div>
              <div className="grid grid-cols-3 gap-2">
                {LEGACY_MONTHS.map((month) => (
                  <button
                    key={month.value}
                    onClick={() => handleMonthClick(month.value)}
                    className={cn(
                      "px-3 py-2 text-sm rounded border transition-colors",
                      "hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700",
                      "border-gray-200 text-gray-700"
                    )}
                  >
                    <Calendar className="w-3 h-3 inline-block mr-1" />
                    {month.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Note */}
            <div className="px-4 pb-3">
              <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                ⚠️ 이 모드는 제한된 데이터로 추정 분석을 수행합니다. 정확성이 상대적으로 낮을 수 있습니다.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}