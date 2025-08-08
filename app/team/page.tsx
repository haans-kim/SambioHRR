import { TeamGrid } from "@/components/dashboard/TeamGrid";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { 
  getOrganizationById, 
  getChildOrganizations,
  getOrganizationsWithStats 
} from "@/lib/db/queries/organization";
import { redirect } from "next/navigation";

interface TeamPageProps {
  searchParams: Promise<{ center?: string; division?: string }>;
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const params = await searchParams;
  const centerCode = params.center;
  const divisionCode = params.division;
  
  if (!centerCode && !divisionCode) {
    redirect('/');
  }

  const parentCode = divisionCode || centerCode;
  const parent = getOrganizationById(parentCode!);
  
  if (!parent) {
    redirect('/');
  }

  // Build breadcrumb path
  const breadcrumbItems = [{ label: "센터", href: "/" }];
  
  if (divisionCode) {
    const division = getOrganizationById(divisionCode);
    if (division && division.parentOrgCode) {
      const center = getOrganizationById(division.parentOrgCode);
      if (center) {
        breadcrumbItems.push({ 
          label: center.orgName, 
          href: `/division?center=${center.orgCode}` 
        });
      }
    }
    breadcrumbItems.push({ label: parent.orgName, href: '' });
  } else {
    breadcrumbItems.push({ label: parent.orgName, href: '' });
  }

  const teams = getChildOrganizations(parentCode!).filter(
    org => org.orgLevel === 'team'
  );

  const teamsWithStats = getOrganizationsWithStats('team')
    .filter(team => team.parentOrgCode === parentCode);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={breadcrumbItems} />
        <h2 className="text-2xl font-bold mt-4">{parent.orgName} - 팀별 현황</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">
          {teams.length}개 팀 운영 현황
        </p>
      </div>

      <TeamGrid teams={teamsWithStats} />
    </div>
  );
}