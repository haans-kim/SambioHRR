import { BentoGrid } from "@/components/ui/bento-grid";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { 
  getOrganizationById, 
  getChildOrganizations,
  getOrganizationsWithStats 
} from "@/lib/db/queries/organization";
import { redirect } from "next/navigation";

interface GroupPageProps {
  searchParams: Promise<{ team?: string }>;
}

export default async function GroupPage({ searchParams }: GroupPageProps) {
  const params = await searchParams;
  const teamCode = params.team;
  
  if (!teamCode) {
    redirect('/');
  }

  const team = getOrganizationById(teamCode);
  if (!team) {
    redirect('/');
  }

  // Build breadcrumb path
  const breadcrumbItems = [{ label: "센터", href: "/" }];
  
  // Check if team has a division parent
  const parent = team.parentOrgCode ? getOrganizationById(team.parentOrgCode) : null;
  
  if (parent) {
    if (parent.orgLevel === 'division') {
      // Team is under a division
      const center = parent.parentOrgCode ? getOrganizationById(parent.parentOrgCode) : null;
      if (center) {
        breadcrumbItems.push({ 
          label: center.orgName, 
          href: `/division?center=${center.orgCode}` 
        });
      }
      breadcrumbItems.push({ 
        label: parent.orgName, 
        href: `/team?division=${parent.orgCode}` 
      });
    } else if (parent.orgLevel === 'center') {
      // Team is directly under a center
      breadcrumbItems.push({ 
        label: parent.orgName, 
        href: `/team?center=${parent.orgCode}` 
      });
    }
  }
  
  breadcrumbItems.push({ label: team.orgName, href: '' });

  const groups = getChildOrganizations(teamCode).filter(
    org => org.orgLevel === 'group'
  );

  const groupsWithStats = getOrganizationsWithStats('group')
    .filter(group => group.parentOrgCode === teamCode);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={breadcrumbItems} />
        <h2 className="text-2xl font-bold mt-4">{team.orgName} - 그룹별 현황</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">
          {groups.length}개 그룹 운영 현황
        </p>
      </div>

      <BentoGrid className="max-w-7xl mx-auto grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {groupsWithStats.map((group) => (
          <MetricCard
            key={group.orgCode}
            orgName={group.orgName}
            orgCode={group.orgCode}
            efficiency={group.stats?.avgWorkEfficiency || 0}
            totalEmployees={group.stats?.totalEmployees || 0}
            avgWorkHours={group.stats?.avgActualWorkHours || 0}
            childrenCount={0}
            size="small"
          />
        ))}
      </BentoGrid>
    </div>
  );
}