import { BentoGrid } from "@/components/ui/bento-grid";
import { MetricCard } from "@/components/dashboard/MetricCard";
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
    breadcrumbItems.push({ label: parent.orgName });
  } else {
    breadcrumbItems.push({ label: parent.orgName });
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

      <BentoGrid className="max-w-7xl mx-auto">
        {teamsWithStats.map((team) => (
          <MetricCard
            key={team.orgCode}
            orgName={team.orgName}
            orgCode={team.orgCode}
            efficiency={team.stats?.avgWorkEfficiency || 0}
            totalEmployees={team.stats?.totalEmployees || 0}
            avgWorkHours={team.stats?.avgActualWorkHours || 0}
            childrenCount={team.childrenCount}
            onClick={() => window.location.href = `/group?team=${team.orgCode}`}
            size="medium"
          />
        ))}
      </BentoGrid>
    </div>
  );
}