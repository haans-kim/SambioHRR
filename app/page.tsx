import { CenterGrid } from "@/components/dashboard/CenterGrid";
import { StatsSummary } from "@/components/dashboard/StatsSummary";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { getOrganizationsWithStats } from "@/lib/db/queries/organization";

export default function HomePage() {
  const centers = getOrganizationsWithStats('center');

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: "센터", href: "/" }]} />
        <h2 className="text-2xl font-bold mt-4">센터별 현황</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">
          전체 {centers.length}개 센터의 실시간 근무 현황
        </p>
      </div>

      <StatsSummary organizations={centers} />

      <CenterGrid organizations={centers} />
    </div>
  );
}