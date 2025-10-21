"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GroupCards } from "@/components/dashboard/GroupCards";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { MetricType } from "@/components/dashboard/MetricSelector";
import { useSearchParams, useRouter } from "next/navigation";

interface GroupData {
  groups: any[];
  parentOrg: any;
  totalEmployees: number;
  avgEfficiency: number;
  avgWeeklyWorkHours: number;
  avgWeeklyClaimedHours: number;
  avgAdjustedWeeklyWorkHours?: number;
  avgDataReliability: number;
  breadcrumb?: { label: string; href?: string }[];
  thresholds: {
    efficiency: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyClaimedHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    adjustedWeeklyWorkHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    dataReliability: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
  };
}

export default function GroupsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const teamCode = searchParams.get('team');
  
  const [selectedMetric, setSelectedMetric] = useState<MetricType>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('hrDashboard.selectedMetric') as MetricType | null;
      if (saved) return saved;
    }
    return 'efficiency';
  });
  const [selectedMonth, setSelectedMonth] = useState<string>('2025-06');
  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams();
        if (teamCode) params.append('team', teamCode);
        params.append('month', selectedMonth);

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
  }, [teamCode, selectedMonth]);

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

  // 분석 모드 정보 생성
  const analysisMode: 'enhanced' | 'legacy' = selectedMonth >= '2025-06' ? 'enhanced' : 'legacy';
  const availableMetrics = analysisMode === 'enhanced'
    ? ['efficiency', 'weeklyWorkHours', 'weeklyClaimedHours', 'adjustedWeeklyWorkHours', 'dataReliability', 'mealTime', 'meetingTime', 'equipmentTime', 'movementTime', 'focusedWorkTime']
    : ['efficiency', 'weeklyWorkHours', 'weeklyClaimedHours', 'adjustedWeeklyWorkHours', 'dataReliability'];

  const dataQuality: {
    mode: 'enhanced' | 'legacy';
    description: string;
    limitations: string[];
  } = {
    mode: analysisMode,
    description: analysisMode === 'enhanced'
      ? '전체 데이터 기반 상세 분석'
      : '제한 데이터 기반 기본 분석 (Tag + Claim 데이터만)',
    limitations: analysisMode === 'legacy'
      ? ['장비 사용 시간 미포함', '식사 시간 추정치', '회의실 이용 데이터 제한']
      : []
  };

  return (
    <DashboardLayout 
      totalEmployees={data.totalEmployees}
      avgEfficiency={data.avgEfficiency}
      avgWeeklyClaimedHours={data.avgWeeklyClaimedHours}
      avgAdjustedWeeklyWorkHours={data.avgAdjustedWeeklyWorkHours}
      avgDataReliability={data.avgDataReliability}
      selectedMetric={selectedMetric}
      onMetricChange={setSelectedMetric}
      parentOrg={data.parentOrg}
      breadcrumb={data.breadcrumb}
      selectedMonth={selectedMonth}
      onMonthChange={handleMonthChange}
      analysisMode={analysisMode}
      availableMetrics={availableMetrics}
      dataQuality={dataQuality}
    >
      <GroupCards 
        groups={data.groups} 
        parentOrg={data.parentOrg}
        selectedMetric={selectedMetric}
        avgEfficiency={data.avgEfficiency}
        avgWeeklyWorkHours={data.avgWeeklyWorkHours}
        avgWeeklyClaimedHours={data.avgWeeklyClaimedHours}
        avgAdjustedWeeklyWorkHours={data.avgAdjustedWeeklyWorkHours}
        avgDataReliability={data.avgDataReliability}
        thresholds={data.thresholds}
      />
      <SummaryCards selectedMetric={selectedMetric} thresholds={data.thresholds} />
    </DashboardLayout>
  );
}