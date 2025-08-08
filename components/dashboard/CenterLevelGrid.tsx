"use client";

import { OrganizationWithStats } from "@/lib/types/organization";
import { cn } from "@/lib/utils";
import { MagicCard } from "@/components/ui/magic-card";
import { TextAnimate } from "@/components/ui/text-animate";

interface CenterLevelGridProps {
  organizations: OrganizationWithStats[];
}

interface EfficiencyIndicatorProps {
  value: number;
  label: string;
}

function EfficiencyIndicator({ value, label }: EfficiencyIndicatorProps) {
  const getStatusIcon = (value: number) => {
    if (value >= 100) {
      return "▲";
    }
    if (value >= 90) {
      return "●";
    }
    if (value >= 75) {
      return "▼";
    }
    return "▲";
  };

  const getIconColor = (value: number) => {
    if (value >= 100) return "text-red-500";
    if (value >= 90) return "text-green-500";
    if (value >= 75) return "text-blue-500";
    return "text-red-500";
  };

  const getIconStyle = (value: number) => {
    // Make circle slightly larger than default to match triangle size
    if (value >= 90 && value < 100) {
      return "text-lg scale-[1.35]";
    }
    return "text-lg";
  };

  return (
    <div className={cn(
      "flex items-center justify-center gap-1 p-3 rounded-lg border transition-all hover:shadow-md",
      value >= 100 && "border-red-200 bg-red-50/50",
      value >= 90 && value < 100 && "border-green-200 bg-green-50/50",
      value >= 75 && value < 90 && "border-blue-200 bg-blue-50/50",
      value < 75 && "border-red-200 bg-red-50/50"
    )}>
      <span className="text-sm font-medium">{value}%</span>
      <span className={cn(getIconStyle(value), getIconColor(value))}>
        {getStatusIcon(value)}
      </span>
    </div>
  );
}

export function CenterLevelGrid({ organizations }: CenterLevelGridProps) {
  // Group organizations by level
  const levels = ['Lv.4', 'Lv.3', 'Lv.2', 'Lv.1'];
  
  // Define centers order as shown in the design
  const centerOrder = [
    '구분', '영업센터', 'DS담당', 'DP담당', 'MSAT담당', 
    'Validation팀', 'EPCV센터', 'CDO개발센터', '바이오연구소',
    '경영지원센터', 'People센터', '상생협력센터', '경영진단팀'
  ];

  // Map organizations to their display positions
  const centerMap: { [key: string]: OrganizationWithStats | undefined } = {};
  organizations.forEach(org => {
    const displayName = org.orgName.replace('센터', '').replace('팀', '');
    centerMap[displayName] = org;
  });

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-lg font-semibold mb-4">전체 현황</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-2 text-sm font-medium text-gray-600">구분</th>
              {centerOrder.slice(1).map(center => (
                <th key={center} className="text-center p-2 text-sm font-medium text-gray-600 min-w-[100px]">
                  <TextAnimate delay={0.1}>
                    {center}
                  </TextAnimate>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map((level, levelIndex) => (
              <tr key={level} className="border-t border-gray-200">
                <td className="p-2 font-medium text-gray-700">{level}</td>
                {centerOrder.slice(1).map((centerName, colIndex) => {
                  // Generate mock data for demonstration (replace with actual data mapping)
                  const mockEfficiency = Math.floor(Math.random() * 30) + 75;
                  
                  return (
                    <td key={`${level}-${centerName}`} className="p-2">
                      <EfficiencyIndicator 
                        value={mockEfficiency} 
                        label=""
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip for selected cell */}
      <div className="mt-4 p-3 bg-gray-900 text-white rounded-lg text-sm max-w-xs">
        <div className="font-semibold">효율율 : 80.3%</div>
        <div className="text-xs text-gray-300 mt-1">
          근무추정시간 38h | 근테기록시간 43h
        </div>
        <div className="text-xs text-gray-300">오늘 기준 주간 데이터</div>
      </div>
    </div>
  );
}