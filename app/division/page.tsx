import { BentoGrid } from "@/components/ui/bento-grid";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { 
  getOrganizationById, 
  getChildOrganizations,
  getOrganizationsWithStats 
} from "@/lib/db/queries/organization";
import { redirect } from "next/navigation";

interface DivisionPageProps {
  searchParams: Promise<{ center?: string }>;
}

export default async function DivisionPage({ searchParams }: DivisionPageProps) {
  const params = await searchParams;
  const centerCode = params.center;
  
  if (!centerCode) {
    redirect('/');
  }

  const center = getOrganizationById(centerCode);
  if (!center) {
    redirect('/');
  }

  const divisions = getChildOrganizations(centerCode).filter(
    org => org.orgLevel === 'division'
  );

  const divisionsWithStats = getOrganizationsWithStats('division')
    .filter(div => div.parentOrgCode === centerCode);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb 
          items={[
            { label: "센터", href: "/" },
            { label: center.orgName }
          ]} 
        />
        <h2 className="text-2xl font-bold mt-4">{center.orgName} - 담당별 현황</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">
          {divisions.length}개 담당 운영 현황
        </p>
      </div>

      <BentoGrid className="max-w-7xl mx-auto">
        {divisionsWithStats.map((division) => (
          <MetricCard
            key={division.orgCode}
            orgName={division.orgName}
            orgCode={division.orgCode}
            efficiency={division.stats?.avgWorkEfficiency || 0}
            totalEmployees={division.stats?.totalEmployees || 0}
            avgWorkHours={division.stats?.avgActualWorkHours || 0}
            childrenCount={division.childrenCount}
            onClick={() => window.location.href = `/team?division=${division.orgCode}`}
            size="medium"
          />
        ))}
      </BentoGrid>
    </div>
  );
}