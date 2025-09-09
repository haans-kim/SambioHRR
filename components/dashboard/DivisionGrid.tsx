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
  
  // divisions의 주간 근무시간 값들을 추출하여 threshold 계산에 사용
  const weeklyWorkHoursValues = divisions
    .map(div => div.stats?.avgWeeklyWorkHoursAdjusted || div.stats?.avgWeeklyWorkHours || 0)
    .filter(value => value > 0); // 유효한 값들만 필터링

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
          onClick={() => router.push(`/teams?division=${division.orgCode}`)}
          size="medium"
          // 동적 threshold 계산을 위한 추가 props
          siblingValues={weeklyWorkHoursValues}
          weeklyWorkHours={division.stats?.avgWeeklyWorkHoursAdjusted || division.stats?.avgWeeklyWorkHours || 0}
        />
      ))}
    </BentoGrid>
  );
}