"use client";

import { BentoGrid } from "@/components/ui/bento-grid";
import { MetricCard } from "./MetricCard";
import { OrganizationWithStats } from "@/lib/types/organization";
import { useRouter } from "next/navigation";

interface TeamGridProps {
  teams: OrganizationWithStats[];
}

export function TeamGrid({ teams }: TeamGridProps) {
  const router = useRouter();

  return (
    <BentoGrid className="max-w-7xl mx-auto">
      {teams.map((team) => (
        <MetricCard
          key={team.orgCode}
          orgName={team.orgName}
          orgCode={team.orgCode}
          efficiency={team.stats?.avgWorkEfficiency || 0}
          totalEmployees={team.stats?.totalEmployees || 0}
          avgWorkHours={team.stats?.avgActualWorkHours || 0}
          childrenCount={team.childrenCount}
          onClick={() => router.push(`/group?team=${team.orgCode}`)}
          size="medium"
        />
      ))}
    </BentoGrid>
  );
}