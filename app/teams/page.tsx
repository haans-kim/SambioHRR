"use client";

import { useState, useEffect } from "react";

export const dynamic = 'force-dynamic';
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TeamPlantCards } from "@/components/dashboard/TeamPlantCards";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { MetricType } from "@/components/dashboard/MetricSelector";
import { useSearchParams } from "next/navigation";

interface TeamData {
  teams: any[];
  parentOrg: any;
  summary: {
    totalEmployees: number;
    avgEfficiency: number;
    avgWorkHours: number;
    avgClaimedHours: number;
    avgWeeklyWorkHours: number;
    avgWeeklyClaimedHours: number;
    avgAdjustedWeeklyWorkHours?: number;
    avgFocusedWorkHours: number;
    avgDataReliability: number;
  };
  breadcrumb?: { label: string; href?: string }[];
  thresholds: {
    efficiency: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    workHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    claimedHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyWorkHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyClaimedHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    focusedWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    dataReliability?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    adjustedWeeklyWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
  };
}

export default function TeamsPage() {
  const searchParams = useSearchParams();
  const centerCode = searchParams.get('center');
  const divisionCode = searchParams.get('division');
  
  const [selectedMetric, setSelectedMetric] = useState<MetricType>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('hrDashboard.selectedMetric') as MetricType | null;
      if (saved) return saved;
    }
    return 'efficiency';
  });
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
      totalEmployees={data.summary?.totalEmployees || 0}
      avgEfficiency={data.summary?.avgEfficiency || 0}
      avgWorkHours={data.summary?.avgWorkHours || 0}
      avgClaimedHours={data.summary?.avgClaimedHours || 0}
      avgWeeklyWorkHours={data.summary?.avgWeeklyWorkHours || 0}
      avgWeeklyClaimedHours={data.summary?.avgWeeklyClaimedHours || 0}
      avgAdjustedWeeklyWorkHours={data.summary?.avgAdjustedWeeklyWorkHours || 0}
      avgFocusedWorkHours={data.summary?.avgFocusedWorkHours || 0}
      avgDataReliability={data.summary?.avgDataReliability || 0}
      selectedMetric={selectedMetric}
      onMetricChange={setSelectedMetric}
      parentOrg={data.parentOrg}
      breadcrumb={data.breadcrumb}
    >
      <TeamPlantCards 
        teams={data.teams} 
        parentOrg={data.parentOrg}
        selectedMetric={selectedMetric}
        avgEfficiency={data.summary?.avgEfficiency || 0}
        avgWorkHours={data.summary?.avgWorkHours || 0}
        avgClaimedHours={data.summary?.avgClaimedHours || 0}
        avgWeeklyWorkHours={data.summary?.avgWeeklyWorkHours || 0}
        avgWeeklyClaimedHours={data.summary?.avgWeeklyClaimedHours || 0}
        avgAdjustedWeeklyWorkHours={data.summary?.avgAdjustedWeeklyWorkHours || 0}
        avgFocusedWorkHours={data.summary?.avgFocusedWorkHours || 0}
        avgDataReliability={data.summary?.avgDataReliability || 0}
        thresholds={data.thresholds}
      />
      <SummaryCards selectedMetric={selectedMetric} thresholds={data.thresholds} />
    </DashboardLayout>
  );
}