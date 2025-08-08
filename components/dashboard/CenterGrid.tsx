"use client";

import { BentoGrid } from "@/components/ui/bento-grid";
import { MetricCard } from "./MetricCard";
import { OrganizationWithStats } from "@/lib/types/organization";
import { useRouter } from "next/navigation";

interface CenterGridProps {
  organizations: OrganizationWithStats[];
}

export function CenterGrid({ organizations }: CenterGridProps) {
  const router = useRouter();

  const handleCardClick = (org: OrganizationWithStats) => {
    // Check if center has divisions
    const hasDivisions = organizations.some(o => o.childrenCount && o.childrenCount > 0);
    
    if (hasDivisions && org.childrenCount && org.childrenCount > 0) {
      router.push(`/division?center=${org.orgCode}`);
    } else {
      router.push(`/team?center=${org.orgCode}`);
    }
  };

  return (
    <BentoGrid className="max-w-7xl mx-auto">
      {organizations.map((org) => (
        <MetricCard
          key={org.orgCode}
          orgName={org.orgName}
          orgCode={org.orgCode}
          efficiency={org.stats?.avgWorkEfficiency || 0}
          totalEmployees={org.stats?.totalEmployees || 0}
          avgWorkHours={org.stats?.avgActualWorkHours || 0}
          childrenCount={org.childrenCount}
          onClick={() => handleCardClick(org)}
          size="medium"
        />
      ))}
    </BentoGrid>
  );
}