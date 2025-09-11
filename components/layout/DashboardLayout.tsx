"use client";

import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";
import { Organization } from "@/lib/types/organization";
import { MetricType, MetricSelector } from "@/components/dashboard/MetricSelector";
import { MonthSelector } from "@/components/dashboard/MonthSelector";

interface DashboardLayoutProps {
  children: React.ReactNode;
  totalEmployees?: number;
  avgEfficiency?: number;
  avgWeeklyClaimedHours?: number;
  avgAdjustedWeeklyWorkHours?: number;
  avgDataReliability?: number;
  selectedMetric?: MetricType;
  onMetricChange?: (metric: MetricType) => void;
  parentOrg?: Organization | null;
  breadcrumb?: { label: string; href?: string }[];
  // 월 선택 관련 props
  selectedMonth?: string;
  onMonthChange?: (month: string) => void;
  availableMonths?: string[];
}

export function DashboardLayout({ 
  children, 
  totalEmployees = 0, 
  avgEfficiency = 0,
  avgWeeklyClaimedHours = 42.5,
  avgAdjustedWeeklyWorkHours = 38.4,
  avgDataReliability = 65.0,
  selectedMetric = 'efficiency',
  onMetricChange,
  parentOrg,
  breadcrumb,
  selectedMonth,
  onMonthChange,
  availableMonths
}: DashboardLayoutProps) {
  // Build breadcrumb items
  const defaultBreadcrumb = [{ label: "센터", href: "/" } as { label: string; href?: string }];
  if (parentOrg) {
    if (parentOrg.orgLevel === 'center') {
      // 센터 클릭 시 기본 이동: 팀 목록 (센터에 담당이 있어도 우선 팀 페이지로 연결)
      defaultBreadcrumb.push({ label: parentOrg.orgName, href: `/teams?center=${parentOrg.orgCode}` });
    } else if (parentOrg.orgLevel === 'division') {
      defaultBreadcrumb.push({ label: "담당" });
      defaultBreadcrumb.push({ label: parentOrg.orgName });
    }
  }
  const breadcrumbItems = breadcrumb && breadcrumb.length > 0 ? breadcrumb : defaultBreadcrumb;
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content Area */}
      <div className="flex-1">
        {/* Title Section */}
        <div className="bg-gradient-to-br from-blue-50 to-white border-b border-gray-200">
          <div className="max-w-[1600px] mx-auto px-6 py-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              조직별 분석 {parentOrg && `- ${parentOrg.orgName}`}
            </h1>
            <p className="text-gray-600">
              실시간 업무패턴 분석 및 근무 추정시간 모니터링
            </p>
            
            {/* Stats Cards */}
            <div className="flex justify-between items-end gap-12 mt-6">
              <div className="flex gap-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 min-w-[160px]">
                  <div className="text-3xl font-bold text-blue-600">
                    <NumberTicker value={totalEmployees} />
                  </div>
                  <div className="text-sm text-gray-600 mt-1">총 분석 인원</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 min-w-[160px]">
                  <div className="text-3xl font-bold text-blue-600">
                    <NumberTicker 
                      value={
                        selectedMetric === 'efficiency' 
                          ? avgEfficiency 
                          : selectedMetric === 'adjustedWeeklyWorkHours'
                          ? avgAdjustedWeeklyWorkHours
                          : selectedMetric === 'weeklyClaimedHours'
                          ? avgWeeklyClaimedHours
                          : selectedMetric === 'dataReliability'
                          ? avgDataReliability
                          : 0
                      } 
                      decimalPlaces={1} 
                    />
                    {selectedMetric === 'efficiency' || selectedMetric === 'dataReliability' ? '%' : 'h'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {selectedMetric === 'efficiency' 
                      ? '평균 효율성 비율' 
                      : selectedMetric === 'adjustedWeeklyWorkHours'
                      ? '근무추정시간(AI보정)'
                      : selectedMetric === 'weeklyClaimedHours'
                      ? '주간 근무시간'
                      : selectedMetric === 'dataReliability'
                      ? '데이터 신뢰도'
                      : ''}
                  </div>
                </div>
              </div>
              
              {/* 지표 선택기 */}
              {onMetricChange && (
                <div className="flex-shrink-0">
                  <MetricSelector 
                    selectedMetric={selectedMetric}
                    onMetricChange={onMetricChange}
                  />
                </div>
              )}
            </div>

            {/* Breadcrumb and Month Selector */}
            <div className="mt-6 flex justify-between items-center">
              {breadcrumbItems && breadcrumbItems.length > 0 && (
                <Breadcrumb items={breadcrumbItems} />
              )}
              
              {/* Month Selector - Right aligned */}
              {selectedMonth && onMonthChange && availableMonths && (
                <div className="flex-shrink-0">
                  <MonthSelector
                    selectedMonth={selectedMonth}
                    onMonthChange={onMonthChange}
                    availableMonths={availableMonths}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-[1600px] mx-auto px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}