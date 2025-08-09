"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GroupCards } from "@/components/dashboard/GroupCards";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { MetricType } from "@/components/dashboard/MetricSelector";
import { useSearchParams } from "next/navigation";

interface GroupData {
  groups: any[];
  parentOrg: any;
  totalEmployees: number;
  avgEfficiency: number;
  avgWorkHours: number;
  avgClaimedHours: number;
  avgWeeklyWorkHours: number;
  avgWeeklyClaimedHours: number;
  thresholds: {
    efficiency: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    workHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    claimedHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyWorkHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyClaimedHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
  };
}

export default function GroupsPage() {
  const searchParams = useSearchParams();
  const teamCode = searchParams.get('team');
  
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('efficiency');
  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams();
        if (teamCode) params.append('team', teamCode);
        
        const response = await fetch(`/api/groups?${params}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const groupData = await response.json();
        setData(groupData);
      } catch (error) {
        console.error('Failed to fetch group data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-red-600">데이터를 불러올 수 없습니다.</div>
      </div>
    );
  }

  return (
    <DashboardLayout 
      totalEmployees={data.totalEmployees}
      avgEfficiency={data.avgEfficiency}
      avgWorkHours={data.avgWorkHours}
      avgClaimedHours={data.avgClaimedHours}
      avgWeeklyWorkHours={data.avgWeeklyWorkHours}
      avgWeeklyClaimedHours={data.avgWeeklyClaimedHours}
      selectedMetric={selectedMetric}
      onMetricChange={setSelectedMetric}
      parentOrg={data.parentOrg}
    >
      <GroupCards 
        groups={data.groups} 
        parentOrg={data.parentOrg}
        selectedMetric={selectedMetric}
        avgEfficiency={data.avgEfficiency}
        avgWorkHours={data.avgWorkHours}
        avgClaimedHours={data.avgClaimedHours}
        avgWeeklyWorkHours={data.avgWeeklyWorkHours}
        avgWeeklyClaimedHours={data.avgWeeklyClaimedHours}
        thresholds={data.thresholds}
      />
      <SummaryCards selectedMetric={selectedMetric} thresholds={data.thresholds} />
    </DashboardLayout>
  );
}