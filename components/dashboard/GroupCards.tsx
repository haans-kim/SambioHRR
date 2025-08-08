"use client";

import { OrganizationWithStats } from "@/lib/types/organization";
import { MagicCard } from "@/components/ui/magic-card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

interface GroupCardsProps {
  groups: OrganizationWithStats[];
  plantName: string;
}

interface GroupCardProps {
  name: string;
  efficiency: number;
  employees: number;
}

function GroupCard({ name, efficiency, employees }: GroupCardProps) {
  const getCardStyle = (value: number) => {
    if (value >= 90) return "border-green-200 bg-gradient-to-br from-green-50/50 to-white";
    if (value >= 85) return "border-blue-200 bg-gradient-to-br from-blue-50/50 to-white";
    return "border-amber-200 bg-gradient-to-br from-amber-50/50 to-white";
  };

  const getProgressColor = (value: number) => {
    if (value >= 90) return "#10b981"; // green
    if (value >= 85) return "#3b82f6"; // blue
    return "#f59e0b"; // amber
  };

  return (
    <MagicCard 
      className={cn(
        "p-6 rounded-xl border shadow-sm hover:shadow-lg transition-all",
        getCardStyle(efficiency)
      )}
    >
      <div className="flex flex-col h-full">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{name}</h3>
        
        <div className="flex items-center justify-between mb-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {efficiency.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 mt-1">평균 효율성</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-700">
              <NumberTicker value={employees} />명
            </div>
            <div className="text-sm text-gray-600 mt-1">팀원 수</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-auto">
          <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${efficiency}%`,
                backgroundColor: getProgressColor(efficiency)
              }}
            />
          </div>
        </div>
      </div>
    </MagicCard>
  );
}

export function GroupCards({ groups, plantName }: GroupCardsProps) {
  // Mock data for groups (replace with actual data)
  const groupData = [
    { name: "P2배양그룹", efficiency: 91.2, employees: 168 },
    { name: "P2정제그룹", efficiency: 88.3, employees: 156 },
    { name: "sP배양그룹", efficiency: 92.0, employees: 33 },
    { name: "sP정제그룹", efficiency: 85.2, employees: 41 },
  ];

  return (
    <div className="bg-white rounded-lg border-2 border-gray-300 shadow-lg p-6">
      <h2 className="text-lg font-semibold mb-4">{plantName} 현황</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {groupData.map((group) => (
          <GroupCard
            key={group.name}
            name={group.name}
            efficiency={group.efficiency}
            employees={group.employees}
          />
        ))}
      </div>
    </div>
  );
}