"use client";

import { Sidebar } from "@/components/navigation/Sidebar";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";
import { Organization } from "@/lib/types/organization";

interface DashboardLayoutProps {
  children: React.ReactNode;
  totalEmployees?: number;
  avgEfficiency?: number;
  parentOrg?: Organization | null;
}

export function DashboardLayout({ 
  children, 
  totalEmployees = 0, 
  avgEfficiency = 0,
  parentOrg 
}: DashboardLayoutProps) {
  // Build breadcrumb items
  const breadcrumbItems = [{ label: "전체 개요", href: "/" }];
  
  if (parentOrg) {
    if (parentOrg.orgLevel === 'center') {
      breadcrumbItems.push({ 
        label: parentOrg.orgName, 
        href: `/teams?center=${parentOrg.orgCode}` 
      });
    } else if (parentOrg.orgLevel === 'division') {
      // TODO: Add parent center to breadcrumb
      breadcrumbItems.push({ 
        label: parentOrg.orgName, 
        href: `/teams?division=${parentOrg.orgCode}` 
      });
    }
  }
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 ml-64">
        {/* Title Section */}
        <div className="bg-gradient-to-br from-blue-50 to-white border-b border-gray-200">
          <div className="max-w-[1600px] mx-auto px-6 py-6">
            {/* Breadcrumb */}
            {breadcrumbItems.length > 1 && (
              <div className="mb-4">
                <Breadcrumb items={breadcrumbItems} />
              </div>
            )}
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              조직별 분석 {parentOrg && `- ${parentOrg.orgName}`}
            </h1>
            <p className="text-gray-600">
              실시간 업무패턴 분석 및 근무 추정시간 모니터링
            </p>
            
            {/* Stats Cards */}
            <div className="flex gap-6 mt-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 min-w-[200px]">
                <div className="text-3xl font-bold text-blue-600">
                  <NumberTicker value={totalEmployees} />
                </div>
                <div className="text-sm text-gray-600 mt-1">총 분석 인원</div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 min-w-[200px]">
                <div className="text-3xl font-bold text-blue-600">
                  <NumberTicker value={avgEfficiency} decimalPlaces={1} />%
                </div>
                <div className="text-sm text-gray-600 mt-1">평균 효율성 비율</div>
              </div>
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