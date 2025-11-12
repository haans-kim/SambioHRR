import { DivisionGrid } from "@/components/dashboard/DivisionGrid";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import {
  getOrganizationById,
  getChildOrganizations,
  getOrganizationsWithStatsForPeriod
} from "@/lib/db/queries/organization";
import { getLatestMonth } from "@/lib/db/queries/analytics";
import { redirect } from "next/navigation";
import { mapOrganizationName } from "@/lib/organization-mapping";

export const dynamic = 'force-dynamic';

interface DivisionPageProps {
  searchParams: Promise<{ center?: string; month?: string }>;
}

export default async function DivisionPage({ searchParams }: DivisionPageProps) {
  const params = await searchParams;
  const centerCode = params.center;
  const selectedMonth = params.month || getLatestMonth();

  if (!centerCode) {
    redirect('/');
  }

  const center = getOrganizationById(centerCode);
  if (!center) {
    redirect('/');
  }

  const children = getChildOrganizations(centerCode);
  const divisions = children.filter(org => org.orgLevel === 'division');

  // People센터처럼 담당이 없는 센터는 팀 페이지로 리다이렉트
  if (divisions.length === 0) {
    redirect(`/teams?center=${centerCode}&month=${selectedMonth}`);
  }

  // 월별 데이터 사용 (전체 개요와 동일한 기간)
  const startDate = `${selectedMonth}-01`;
  const endDate = `${selectedMonth}-31`;

  let divisionsWithStats = getOrganizationsWithStatsForPeriod('division', startDate, endDate)
    .filter(div => div.parentOrgCode === centerCode);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "센터", href: "/" },
            { label: mapOrganizationName(center.orgName) }
          ]}
        />
        <h2 className="text-2xl font-bold mt-4">{mapOrganizationName(center.orgName)} - 담당별 현황</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">
          {divisions.length}개 담당 운영 현황
        </p>
      </div>

      <DivisionGrid divisions={divisionsWithStats} />
    </div>
  );
}