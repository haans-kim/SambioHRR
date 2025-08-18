import { Metadata } from "next";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Insight1View } from "@/components/dashboard/Insight1View";

export const metadata: Metadata = {
  title: "Insight#1 - HR Dashboard",
  description: "인건비와 주간근무시간 분석",
};

export default function Insight1Page() {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Insight1View />
      </div>
    </div>
  );
}