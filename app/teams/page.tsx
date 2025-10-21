"use client";

import { useState, useEffect } from "react";

export const dynamic = 'force-dynamic';
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TeamPlantCards } from "@/components/dashboard/TeamPlantCards";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { MetricType } from "@/components/dashboard/MetricSelector";
import { useSearchParams, useRouter } from "next/navigation";

interface TeamData {
  teams: any[];
  parentOrg: any;
  summary: {
    totalEmployees: number;
    avgEfficiency: number;
    avgWeeklyWorkHours: number;
    avgWeeklyClaimedHours: number;
    avgAdjustedWeeklyWorkHours?: number;
    avgDataReliability: number;
  };
  breadcrumb?: { label: string; href?: string }[];
  thresholds: {
    efficiency: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyClaimedHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    dataReliability: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    adjustedWeeklyWorkHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
  };
}

export default function TeamsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const centerCode = searchParams.get('center');
  const divisionCode = searchParams.get('division');
  
  const [selectedMetric, setSelectedMetric] = useState<MetricType>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('hrDashboard.selectedMetric') as MetricType | null;
      if (saved) return saved;
    }
    return 'efficiency';
  });
  const [selectedMonth, setSelectedMonth] = useState<string>('2025-06'); // 기본값 2025-06
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  // 월 변경 핸들러 (Legacy Analysis 버튼용)
  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    // 현재는 UI만 업데이트, 실제 데이터는 6월 데이터 사용
    // 추후 1-5월 데이터가 업로드되면 API 호출도 추가
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams();
        if (centerCode) params.append('center', centerCode);
        if (divisionCode) params.append('division', divisionCode);
        params.append('month', selectedMonth);

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
  }, [centerCode, divisionCode, selectedMonth]);

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
      totalEmployees={data.summary?.totalEmployees || 0}
      avgEfficiency={data.summary?.avgEfficiency || 0}
      avgWeeklyClaimedHours={data.summary?.avgWeeklyClaimedHours || 0}
      avgAdjustedWeeklyWorkHours={data.summary?.avgAdjustedWeeklyWorkHours || 0}
      avgDataReliability={data.summary?.avgDataReliability || 0}
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
      <TeamPlantCards 
        teams={data.teams} 
        parentOrg={data.parentOrg}
        selectedMetric={selectedMetric}
        avgEfficiency={data.summary?.avgEfficiency || 0}
        avgWeeklyWorkHours={data.summary?.avgWeeklyWorkHours || 0}
        avgWeeklyClaimedHours={data.summary?.avgWeeklyClaimedHours || 0}
        avgAdjustedWeeklyWorkHours={data.summary?.avgAdjustedWeeklyWorkHours || 0}
        avgDataReliability={data.summary?.avgDataReliability || 0}
        thresholds={data.thresholds}
      />
      <SummaryCards selectedMetric={selectedMetric} thresholds={data.thresholds} />
    </DashboardLayout>
  );
}