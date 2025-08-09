import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CenterLevelGrid } from "@/components/dashboard/CenterLevelGrid";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { getOrganizationsWithStats, getTotalEmployees } from "@/lib/db/queries/organization";
import { getOrganizationStats30Days, getGradeEfficiencyMatrix30Days } from "@/lib/db/queries/analytics";

export default function HomePage() {
  const centers = getOrganizationsWithStats('center');
  
  // Get organization-wide statistics for 30 days
  const orgStats = getOrganizationStats30Days();
  const totalEmployees = orgStats?.totalEmployees || 0;
  const avgEfficiency = orgStats?.avgEfficiencyRatio || 0;
  
  // Get grade efficiency matrix for 30 days
  const gradeMatrix = getGradeEfficiencyMatrix30Days();

  return (
    <DashboardLayout 
      totalEmployees={totalEmployees}
      avgEfficiency={avgEfficiency}
    >
      <CenterLevelGrid 
        organizations={centers} 
        gradeMatrix={gradeMatrix}
      />
      <SummaryCards />
    </DashboardLayout>
  );
}