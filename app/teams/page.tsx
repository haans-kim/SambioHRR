import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TeamPlantCards } from "@/components/dashboard/TeamPlantCards";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { 
  getOrganizationsWithStats,
  getOrganizationById,
  getChildOrganizations
} from "@/lib/db/queries/organization";
import { redirect } from "next/navigation";

interface TeamsPageProps {
  searchParams: Promise<{ center?: string; division?: string }>;
}

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  const params = await searchParams;
  const centerCode = params.center;
  const divisionCode = params.division;
  
  let parentOrg;
  let teams;
  
  if (divisionCode) {
    // Show teams under a specific division
    parentOrg = getOrganizationById(divisionCode);
    teams = getChildOrganizations(divisionCode).filter(org => org.orgLevel === 'team');
  } else if (centerCode) {
    // Show divisions or teams under a specific center
    parentOrg = getOrganizationById(centerCode);
    const children = getChildOrganizations(centerCode);
    
    // Check if this center has divisions
    const divisions = children.filter(org => org.orgLevel === 'division');
    if (divisions.length > 0) {
      // Show divisions
      teams = getOrganizationsWithStats('division')
        .filter(div => div.parentOrgCode === centerCode);
    } else {
      // Show teams directly
      teams = getOrganizationsWithStats('team')
        .filter(team => team.parentOrgCode === centerCode);
    }
  } else {
    // Default: show all teams
    teams = getOrganizationsWithStats('team');
  }
  
  if (!parentOrg && centerCode) {
    redirect('/');
  }
  
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
      parentOrg={parentOrg}
    >
      <TeamPlantCards teams={teams} parentOrg={parentOrg} />
      <SummaryCards />
    </DashboardLayout>
  );
}