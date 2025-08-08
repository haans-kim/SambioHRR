import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GroupCards } from "@/components/dashboard/GroupCards";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { getOrganizationsWithStats } from "@/lib/db/queries/organization";

export default function GroupsPage() {
  const groups = getOrganizationsWithStats('group');
  
  // For demo, we'll show Plant 2팀's groups
  const plant2Groups = groups.slice(0, 4);
  
  // Calculate total employees and average efficiency
  const totalEmployees = 401; // From Plant 2팀
  const avgEfficiency = 89.4;

  return (
    <DashboardLayout 
      totalEmployees={totalEmployees}
      avgEfficiency={avgEfficiency}
    >
      <GroupCards groups={plant2Groups} plantName="Plant 2팀" />
      <SummaryCards />
    </DashboardLayout>
  );
}