import { DivisionGrid } from "@/components/dashboard/DivisionGrid";
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

  const children = getChildOrganizations(centerCode);
  const divisions = children.filter(org => org.orgLevel === 'division');

  let divisionsWithStats = getOrganizationsWithStats('division')
    .filter(div => div.parentOrgCode === centerCode);

  // People센터처럼 담당이 없는 센터는 팀 페이지로 리다이렉트
  if (divisions.length === 0) {
    redirect(`/teams?center=${centerCode}`);
  }

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

      <DivisionGrid divisions={divisionsWithStats} />
    </div>
  );
}