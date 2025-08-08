"use client";

import { BentoGrid } from "@/components/ui/bento-grid";
import { MetricCard } from "./MetricCard";
import { OrganizationWithStats } from "@/lib/types/organization";
import { useRouter } from "next/navigation";

interface DivisionGridProps {
  divisions: OrganizationWithStats[];
}

export function DivisionGrid({ divisions }: DivisionGridProps) {
  const router = useRouter();

  return (
    <BentoGrid className="max-w-7xl mx-auto">
      {divisions.map((division) => (
        <MetricCard
          key={division.orgCode}
          orgName={division.orgName}
          orgCode={division.orgCode}
          efficiency={division.stats?.avgWorkEfficiency || 0}
          totalEmployees={division.stats?.totalEmployees || 0}
          avgWorkHours={division.stats?.avgActualWorkHours || 0}
          childrenCount={division.childrenCount}
          onClick={() => router.push(`/team?division=${division.orgCode}`)}
          size="medium"
        />
      ))}
    </BentoGrid>
  );
}