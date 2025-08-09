"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CenterLevelGrid } from "@/components/dashboard/CenterLevelGrid";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { MetricType } from "@/components/dashboard/MetricSelector";

interface DashboardData {
  centers: any[];
  totalEmployees: number;
  avgEfficiency: number;
  avgWorkHours: number;
  avgClaimedHours: number;
  gradeMatrix: any;
  workHoursMatrix: any;
  claimedHoursMatrix: any;
  thresholds: {
    efficiency: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    workHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    claimedHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
  };
}

export default function HomePage() {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('efficiency');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        if (!response.ok) throw new Error('Failed to fetch');
        const dashboardData = await response.json();
        setData(dashboardData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
      selectedMetric={selectedMetric}
      onMetricChange={setSelectedMetric}
    >
      <CenterLevelGrid 
        organizations={data.centers} 
        gradeMatrix={data.gradeMatrix}
        workHoursMatrix={data.workHoursMatrix}
        claimedHoursMatrix={data.claimedHoursMatrix}
        avgEfficiency={data.avgEfficiency}
        avgWorkHours={data.avgWorkHours}
        avgClaimedHours={data.avgClaimedHours}
        selectedMetric={selectedMetric}
        thresholds={data.thresholds}
      />
      <SummaryCards selectedMetric={selectedMetric} thresholds={data.thresholds} />
    </DashboardLayout>
  );
}