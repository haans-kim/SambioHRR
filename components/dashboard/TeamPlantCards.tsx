"use client";

import { OrganizationWithStats } from "@/lib/types/organization";
import { MagicCard } from "@/components/ui/magic-card";
import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

interface TeamPlantCardsProps {
  teams: OrganizationWithStats[];
}

interface PlantCardProps {
  name: string;
  efficiency: number;
  employees: number;
}

function PlantCard({ name, efficiency, employees }: PlantCardProps) {
  const getCardStyle = (value: number) => {
    if (value >= 90) return "border-green-200 bg-gradient-to-br from-green-50 to-white";
    if (value >= 75) return "border-blue-200 bg-gradient-to-br from-blue-50 to-white";
    return "border-amber-200 bg-gradient-to-br from-amber-50 to-white";
  };

  const getProgressColor = (value: number) => {
    if (value >= 90) return "#10b981"; // green
    if (value >= 75) return "#3b82f6"; // blue
    return "#f59e0b"; // amber
  };

  return (
    <MagicCard 
      className={cn(
        "p-6 rounded-xl border-2 shadow-sm hover:shadow-lg transition-all",
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

export function TeamPlantCards({ teams }: TeamPlantCardsProps) {
  // Group teams by Plant (mock data - replace with actual grouping logic)
  const plants = [
    { name: "Plant 1팀", teams: teams.slice(0, 4), efficiency: 92.1, employees: 179 },
    { name: "Plant 2팀", teams: teams.slice(4, 8), efficiency: 89.4, employees: 401 },
    { name: "Plant 3팀", teams: teams.slice(8, 12), efficiency: 87.8, employees: 430 },
    { name: "Plant 4A팀", teams: teams.slice(12, 16), efficiency: 93.6, employees: 435 },
    { name: "Plant 4B팀", teams: teams.slice(16, 20), efficiency: 92.1, employees: 209 },
    { name: "Plant 5팀", teams: teams.slice(20, 24), efficiency: 84.2, employees: 111 },
    { name: "오퍼레이션혁신팀", teams: teams.slice(24, 28), efficiency: 91.3, employees: 24 },
    { name: "오퍼레이션기획팀", teams: teams.slice(28, 32), efficiency: 88.7, employees: 48 },
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-lg font-semibold mb-4">DS담당 현황</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plants.map((plant) => (
          <PlantCard
            key={plant.name}
            name={plant.name}
            efficiency={plant.efficiency}
            employees={plant.employees}
          />
        ))}
      </div>
    </div>
  );
}