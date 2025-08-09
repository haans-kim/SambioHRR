"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TeamPlantCards } from "@/components/dashboard/TeamPlantCards";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { MetricType } from "@/components/dashboard/MetricSelector";
import { useSearchParams } from "next/navigation";

interface TeamData {
  teams: any[];
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

export default function TeamsPage() {
  const searchParams = useSearchParams();
  const centerCode = searchParams.get('center');
  const divisionCode = searchParams.get('division');
  
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('efficiency');
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams();
        if (centerCode) params.append('center', centerCode);
        if (divisionCode) params.append('division', divisionCode);
        
        const response = await fetch(`/api/teams?${params}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const teamData = await response.json();
        setData(teamData);
      } catch (error) {
        console.error('Failed to fetch team data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [centerCode, divisionCode]);

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
      <TeamPlantCards 
        teams={data.teams} 
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