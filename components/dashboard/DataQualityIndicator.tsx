"use client";

import { Info, AlertTriangle, CheckCircle, Settings, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataQualityIndicatorProps {
  analysisMode: 'enhanced' | 'legacy';
  dataQuality: {
    mode: 'enhanced' | 'legacy';
    description: string;
    limitations: string[];
  };
  availableMetrics: string[];
  className?: string;
}

const METRIC_LABELS = {
  efficiency: '효율성 비율',
  weeklyWorkHours: '주간 근태시간', 
  weeklyClaimedHours: '주간 신청시간',
  adjustedWeeklyWorkHours: '주간 추정근태시간',
  dataReliability: '데이터 신뢰도',
  mealTime: '식사시간',
  meetingTime: '회의시간', 
  equipmentTime: '장비 이용시간',
  movementTime: '이동시간',
  focusedWorkTime: '집중 업무시간'
} as const;

const ALL_METRICS = Object.keys(METRIC_LABELS);

export function DataQualityIndicator({ 
  analysisMode, 
  dataQuality, 
  availableMetrics,
  className 
}: DataQualityIndicatorProps) {
  const isEnhanced = analysisMode === 'enhanced';
  const unavailableMetrics = ALL_METRICS.filter(metric => !availableMetrics.includes(metric));

  return (
    <div className={cn("bg-white rounded-lg border shadow-sm p-4", className)}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        {isEnhanced ? (
          <Settings className="w-4 h-4 text-blue-600" />
        ) : (
          <BarChart3 className="w-4 h-4 text-orange-600" />
        )}
        <h3 className="font-semibold text-gray-900">
          데이터 분석 모드
        </h3>
        <div className={cn(
          "px-2 py-1 rounded-full text-xs font-medium",
          isEnhanced 
            ? "bg-blue-100 text-blue-800"
            : "bg-orange-100 text-orange-800"
        )}>
          {isEnhanced ? '상세 분석' : '기본 분석'}
        </div>
      </div>

      {/* 설명 */}
      <p className="text-sm text-gray-600 mb-4">
        {dataQuality.description}
      </p>

      {/* 메트릭 가용성 */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-900">메트릭 가용성</h4>
        
        {/* 사용 가능한 메트릭 */}
        {availableMetrics.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-2">
              <CheckCircle className="w-3 h-3 text-green-600" />
              <span className="text-xs font-medium text-green-700">사용 가능</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {availableMetrics.map((metric) => (
                <span
                  key={metric}
                  className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded border"
                >
                  {METRIC_LABELS[metric as keyof typeof METRIC_LABELS] || metric}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 사용 불가능한 메트릭 */}
        {unavailableMetrics.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-2">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span className="text-xs font-medium text-amber-700">제한/추정치</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {unavailableMetrics.map((metric) => (
                <span
                  key={metric}
                  className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded border border-amber-200"
                >
                  {METRIC_LABELS[metric as keyof typeof METRIC_LABELS] || metric}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 제한사항 */}
        {dataQuality.limitations.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-2">
              <Info className="w-3 h-3 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">분석 제한사항</span>
            </div>
            <ul className="text-xs text-gray-600 space-y-1">
              {dataQuality.limitations.map((limitation, index) => (
                <li key={index} className="flex items-start gap-1">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}