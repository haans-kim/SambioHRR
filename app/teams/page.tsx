import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TeamPlantCards } from "@/components/dashboard/TeamPlantCards";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { getOrganizationsWithStats } from "@/lib/db/queries/organization";

export default function TeamsPage() {
  const teams = getOrganizationsWithStats('team');
  
  // Calculate total employees and average efficiency
  const totalEmployees = teams.reduce(
    (sum, org) => sum + (org.stats?.totalEmployees || 0),
    0
  );
  
  const avgEfficiency =
    teams.reduce(
      (sum, org) => sum + (org.stats?.avgWorkEfficiency || 0),
      0
    ) / (teams.length || 1);

  return (
    <DashboardLayout 
      totalEmployees={totalEmployees}
      avgEfficiency={avgEfficiency}
    >
      <TeamPlantCards teams={teams} />
      <SummaryCards />
    </DashboardLayout>
  );
}