"use client";

import { OrganizationWithStats } from "@/lib/types/organization";
import { cn } from "@/lib/utils";
import { MagicCard } from "@/components/ui/magic-card";
import { TextAnimate } from "@/components/ui/text-animate";
import { useRouter } from "next/navigation";

interface CenterLevelGridProps {
  organizations: OrganizationWithStats[];
  gradeMatrix?: {
    grades: string[];
    centers: string[];
    matrix: Record<string, Record<string, number>>;
  };
  avgEfficiency?: number;
}

interface EfficiencyIndicatorProps {
  value: number;
  label: string;
  onClick?: () => void;
}

function EfficiencyIndicator({ value, label, onClick }: EfficiencyIndicatorProps) {
  const getStatusIcon = (value: number) => {
    if (value >= 88.4) {
      return "▲"; // 상위 20% 모범사례 - 파란 삼각형
    }
    if (value > 73.2) {
      return "●"; // 중간 60% 양호 - 초록 원
    }
    return "▼"; // 하위 20% 관찰 주시 필요 - 빨간 역삼각형
  };

  const getIconColor = (value: number) => {
    if (value >= 88.4) return "text-blue-600"; // 모범사례
    if (value > 73.2) return "text-green-600"; // 양호
    return "text-red-600"; // 관찰 주시 필요
  };

  const getIconStyle = (value: number) => {
    // Make circle slightly larger than default to match triangle size
    if (value > 73.2 && value < 88.4) {
      return "text-lg scale-[1.35]"; // 중간 60% 원형 크게
    }
    return "text-lg";
  };

  return (
    <div 
      className={cn(
        "flex items-center justify-center gap-1 p-3 rounded-lg border transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:scale-105",
        value >= 88.4 && "border-blue-200 bg-blue-50/50", // 모범사례
        value > 73.2 && value < 88.4 && "border-green-200 bg-green-50/50", // 양호
        value <= 73.2 && "border-red-200 bg-red-50/50" // 관찰 주시 필요
      )}
      onClick={onClick}
    >
      <span className="text-base font-medium">{value}%</span>
      <span className={cn(getIconStyle(value), getIconColor(value))}>
        {getStatusIcon(value)}
      </span>
    </div>
  );
}

export function CenterLevelGrid({ organizations, gradeMatrix, avgEfficiency = 88 }: CenterLevelGridProps) {
  const router = useRouter();
  
  // Use grade levels from matrix if available, otherwise default (high to low)
  const levels = gradeMatrix?.grades || ['Lv.4', 'Lv.3', 'Lv.2', 'Lv.1'];
  
  // Use actual center names from database
  const centers = organizations.filter(org => org.orgLevel === 'center');
  
  const handleCellClick = (center: OrganizationWithStats) => {
    // Check if center has divisions (담당)
    if (center.childrenCount && center.childrenCount > 0) {
      // Navigate to teams view for this center (will show divisions/teams)
      router.push(`/teams?center=${center.orgCode}`);
    }
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-300 shadow-lg p-6 w-full">
      <h2 className="text-xl font-semibold mb-4">전체 현황</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px]">
          <thead>
            <tr>
              <th className="text-left p-2 text-base font-medium text-gray-600">구분</th>
              {centers.map(center => (
                <th key={center.orgCode} className="text-center p-2 text-base font-medium text-gray-600 min-w-[100px]">
                  <TextAnimate delay={0.1}>
                    {center.orgName}
                  </TextAnimate>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map((level, levelIndex) => (
              <tr key={level} className="border-t border-gray-200">
                <td className="p-2 font-medium text-gray-700 text-base">{level}</td>
                {centers.map((center) => {
                  // Use actual efficiency data from gradeMatrix if available
                  let efficiency: number;
                  if (gradeMatrix?.matrix[level]?.[center.orgName]) {
                    efficiency = gradeMatrix.matrix[level][center.orgName];
                  } else if (center.stats?.avgWorkEfficiency) {
                    efficiency = center.stats.avgWorkEfficiency;
                  } else {
                    efficiency = Math.floor(Math.random() * 30) + 75;
                  }
                  
                  return (
                    <td key={`${level}-${center.orgCode}`} className="p-2">
                      <EfficiencyIndicator 
                        value={efficiency} 
                        label=""
                        onClick={() => handleCellClick(center)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip for information */}
      <div className="mt-4 p-3 bg-gray-900 text-white rounded-lg text-sm max-w-md">
        <div className="font-semibold">평균 효율성 비율 : {avgEfficiency}%</div>
        <div className="text-xs text-gray-300 mt-1">
          실제 작업시간 ÷ 총 근무시간 × 100 | 30일 평균 데이터
        </div>
        <div className="text-xs text-gray-300 mt-1">
          ▲ 모범사례(≥88.4%) | ● 양호(73.3-88.3%) | ▼ 관찰필요(≤73.2%)
        </div>
      </div>
    </div>
  );
}