"use client";

import { AlertCard } from "./AlertCard";
import { OrganizationWithStats } from "@/lib/types/organization";

interface StatsSummaryProps {
  organizations: OrganizationWithStats[];
}

export function StatsSummary({ organizations }: StatsSummaryProps) {
  // Calculate statistics
  const totalEmployees = organizations.reduce(
    (sum, org) => sum + (org.stats?.totalEmployees || 0),
    0
  );

  const avgEfficiency =
    organizations.reduce(
      (sum, org) => sum + (org.stats?.avgWorkEfficiency || 0),
      0
    ) / (organizations.length || 1);

  const avgWorkHours =
    organizations.reduce(
      (sum, org) => sum + (org.stats?.avgActualWorkHours || 0),
      0
    ) / (organizations.length || 1);

  // Find best and worst performers
  const sortedByEfficiency = [...organizations]
    .filter(org => org.stats?.avgWorkEfficiency)
    .sort((a, b) => 
      (b.stats?.avgWorkEfficiency || 0) - (a.stats?.avgWorkEfficiency || 0)
    );

  const bestPerformer = sortedByEfficiency[0];
  const needsAttention = sortedByEfficiency[sortedByEfficiency.length - 1];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <AlertCard
        type="success"
        title="전체 평균 효율성"
        value={avgEfficiency}
        description={`${organizations.length}개 조직 평균`}
      />
      
      <AlertCard
        type="warning"
        title="평균 근무시간"
        value={avgWorkHours}
        suffix="시간"
        description={`일 평균 실제 작업시간`}
      />

      {bestPerformer && (
        <AlertCard
          type="success"
          title="최고 효율 조직"
          value={bestPerformer.stats?.avgWorkEfficiency || 0}
          description={bestPerformer.orgName}
        />
      )}

      {needsAttention && needsAttention.stats?.avgWorkEfficiency !== undefined && needsAttention.stats.avgWorkEfficiency < 60 && (
        <AlertCard
          type="danger"
          title="개선 필요 조직"
          value={needsAttention.stats?.avgWorkEfficiency || 0}
          description={needsAttention.orgName}
        />
      )}
    </div>
  );
}