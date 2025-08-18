import { Metadata } from "next";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Insight2View } from "@/components/dashboard/Insight2View";

export const metadata: Metadata = {
  title: "Insight#2 - HR Dashboard",
  description: "인건비와 주간근무시간 버블차트 분석",
};

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