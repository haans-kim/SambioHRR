"use client";

import { OrganizationWithStats, Organization } from "@/lib/types/organization";
import { MagicCard } from "@/components/ui/magic-card";
import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface TeamPlantCardsProps {
  teams: OrganizationWithStats[];
  parentOrg?: Organization | null;
}

interface PlantCardProps {
  org: OrganizationWithStats;
  onClick?: () => void;
}

function PlantCard({ org, onClick }: PlantCardProps) {
  const efficiency = org.stats?.avgWorkEfficiency || 0;
  const employees = org.stats?.totalEmployees || 0;
  const getCardStyle = (value: number) => {
    if (value >= 90) return "border-green-200 bg-gradient-to-br from-green-50/50 to-white";
    if (value >= 75) return "border-blue-200 bg-gradient-to-br from-blue-50/50 to-white";
    return "border-amber-200 bg-gradient-to-br from-amber-50/50 to-white";
  };

  const getProgressColor = (value: number) => {
    if (value >= 90) return "#10b981"; // green
    if (value >= 75) return "#3b82f6"; // blue
    return "#f59e0b"; // amber
  };

  return (
    <MagicCard 
      className={cn(
        "p-6 rounded-xl border shadow-sm hover:shadow-lg transition-all cursor-pointer",
        getCardStyle(efficiency)
      )}
      onClick={onClick}
    >
      <div className="flex flex-col h-full">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{org.orgName}</h3>
        
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

export function TeamPlantCards({ teams, parentOrg }: TeamPlantCardsProps) {
  const router = useRouter();
  
  // Handle card click to navigate to groups
  const handleCardClick = (team: OrganizationWithStats) => {
    if (team.orgLevel === 'division') {
      router.push(`/teams?division=${team.orgCode}`);
    } else if (team.orgLevel === 'team') {
      router.push(`/groups?team=${team.orgCode}`);
    }
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-300 shadow-lg p-6">
      <h2 className="text-lg font-semibold mb-4">
        {parentOrg ? `${parentOrg.orgName} 현황` : 'DS담당 현황'}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {teams.map((team) => (
          <PlantCard
            key={team.orgCode}
            org={team}
            onClick={() => handleCardClick(team)}
          />
        ))}
      </div>
    </div>
  );
}