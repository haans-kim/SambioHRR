"use client";

import { Sidebar } from "@/components/navigation/Sidebar";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";
import { Organization } from "@/lib/types/organization";
import { MetricType, MetricSelector } from "@/components/dashboard/MetricSelector";

interface DashboardLayoutProps {
  children: React.ReactNode;
  totalEmployees?: number;
  avgEfficiency?: number;
  avgWorkHours?: number;
  avgClaimedHours?: number;
  avgWeeklyWorkHours?: number;
  avgWeeklyClaimedHours?: number;
  selectedMetric?: MetricType;
  onMetricChange?: (metric: MetricType) => void;
  parentOrg?: Organization | null;
  breadcrumb?: { label: string; href?: string }[];
}

export function DashboardLayout({ 
  children, 
  totalEmployees = 0, 
  avgEfficiency = 0,
  avgWorkHours = 8.2,
  avgClaimedHours = 8.5,
  avgWeeklyWorkHours = 40.0,
  avgWeeklyClaimedHours = 42.5,
  selectedMetric = 'efficiency',
  onMetricChange,
  parentOrg,
  breadcrumb
}: DashboardLayoutProps) {
  // Build breadcrumb items
  const defaultBreadcrumb = [{ label: "센터", href: "/" } as { label: string; href?: string }];
  if (parentOrg) {
    if (parentOrg.orgLevel === 'center') {
      defaultBreadcrumb.push({ label: parentOrg.orgName, href: `/division?center=${parentOrg.orgCode}` });
    } else if (parentOrg.orgLevel === 'division') {
      defaultBreadcrumb.push({ label: "담당" });
      defaultBreadcrumb.push({ label: parentOrg.orgName });
    }
  }
  const breadcrumbItems = breadcrumb && breadcrumb.length > 0 ? breadcrumb : defaultBreadcrumb;
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 ml-64">
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
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 min-w-[200px]">
                  <div className="text-3xl font-bold text-blue-600">
                    <NumberTicker value={totalEmployees} />
                  </div>
                  <div className="text-sm text-gray-600 mt-1">총 분석 인원</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 min-w-[200px]">
                  <div className="text-3xl font-bold text-blue-600">
                    <NumberTicker 
                      value={
                        selectedMetric === 'efficiency' 
                          ? avgEfficiency 
                          : selectedMetric === 'workHours' 
                          ? avgWorkHours 
                          : selectedMetric === 'claimedHours'
                          ? avgClaimedHours
                          : selectedMetric === 'weeklyWorkHours'
                          ? avgWeeklyWorkHours
                          : avgWeeklyClaimedHours
                      } 
                      decimalPlaces={1} 
                    />
                    {selectedMetric === 'efficiency' ? '%' : 'h'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {selectedMetric === 'efficiency' 
                      ? '평균 효율성 비율' 
                      : selectedMetric === 'workHours' 
                      ? '일간 작업추정시간' 
                      : selectedMetric === 'claimedHours'
                      ? '일간 근무시간'
                      : selectedMetric === 'weeklyWorkHours'
                      ? '주간 작업추정시간'
                      : '주간 근무시간'}
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

            {/* Breadcrumb under stats cards */}
            {breadcrumbItems && breadcrumbItems.length > 0 && (
              <div className="mt-6">
                <Breadcrumb items={breadcrumbItems} />
              </div>
            )}
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