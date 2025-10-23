import { Metadata } from "next";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Insight2View } from "@/components/dashboard/Insight2View";

export const metadata: Metadata = {
  title: "근무 패턴 분석 - HR Dashboard",
  description: "장비 사용과 이동성 지수 기반 근무 패턴 분석",
};

export const dynamic = 'force-dynamic';

export default function Insight2Page() {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Insight2View />
      </div>
    </div>
  );
}