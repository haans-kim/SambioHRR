"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CenterLevelGrid } from "@/components/dashboard/CenterLevelGrid";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { FocusedWorkTable } from "@/components/dashboard/FocusedWorkTable";
import { FocusedWorkChart } from "@/components/dashboard/FocusedWorkChart";
import { MetricType } from "@/components/dashboard/MetricSelector";
import { DataRefreshIndicator } from "@/components/ui/data-refresh-indicator";
import { useToast } from "@/components/ui/use-toast";

interface DashboardData {
  centers: any[];
  totalEmployees: number;
  avgEfficiency: number;
  avgWorkHours: number;
  avgClaimedHours: number;
  avgWeeklyWorkHours: number;
  avgWeeklyClaimedHours: number;
  avgAdjustedWeeklyWorkHours?: number;
  avgFocusedWorkHours?: number;
  avgDataReliability?: number;
  gradeMatrix: any;
  workHoursMatrix: any;
  claimedHoursMatrix: any;
  weeklyWorkHoursMatrix: any;
  weeklyClaimedHoursMatrix: any;
  adjustedWeeklyWorkHoursMatrix?: any;
  focusedWorkHoursMatrix?: any;
  dataReliabilityMatrix?: any;
  thresholds: {
    efficiency: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    workHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    claimedHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyWorkHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    adjustedWeeklyWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    weeklyClaimedHours: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    focusedWorkHours?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
    dataReliability?: { low: string; middle: string; high: string; thresholds: { low: number; high: number } };
  };
  // 월 선택 관련 데이터
  availableMonths?: string[];
  currentMonth?: string;
  // 분석 모드 및 데이터 품질 정보
  analysisMode?: 'enhanced' | 'legacy';
  availableMetrics?: string[];
  dataQuality?: {
    mode: 'enhanced' | 'legacy';
    description: string;
    limitations: string[];
  };
}

export default function HomePage() {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('hrDashboard.selectedMetric') as MetricType | null;
      if (saved) return saved;
    }
    return 'efficiency';
  });
  const [selectedMonth, setSelectedMonth] = useState<string>('2025-06'); // 기본값 2025-06
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      // Show loading toast only for manual refresh
      if (lastUpdated) {
        toast({
          title: "데이터 업데이트 중",
          description: "최신 데이터를 가져오고 있습니다...",
          duration: 2000,
        });
      }

      try {
        const params = new URLSearchParams({
          _t: Date.now().toString(),
          month: selectedMonth
        });

        const response = await fetch(`/api/dashboard?${params}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        if (!response.ok) throw new Error('Failed to fetch');
        const dashboardData = await response.json();
        setData(dashboardData);
        setLastUpdated(new Date());

        // 첫 로딩 시 서버에서 받은 currentMonth로 상태 업데이트
        if (dashboardData.currentMonth && selectedMonth !== dashboardData.currentMonth) {
          setSelectedMonth(dashboardData.currentMonth);
        }

        // Show success toast only for manual refresh
        if (lastUpdated) {
          toast({
            variant: "success",
            title: "업데이트 완료",
            description: `${new Date().toLocaleTimeString('ko-KR')}에 데이터가 갱신되었습니다`,
            duration: 3000,
          });
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        toast({
          variant: "destructive",
          title: "업데이트 실패",
          description: "데이터를 불러오는 중 오류가 발생했습니다.",
          duration: 5000,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth]); // selectedMonth 변경 시 재로딩

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
  };

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
      avgWeeklyClaimedHours={data.avgWeeklyClaimedHours}
      avgAdjustedWeeklyWorkHours={data.avgAdjustedWeeklyWorkHours}
      avgDataReliability={data.avgDataReliability}
      selectedMetric={selectedMetric}
      onMetricChange={setSelectedMetric}
      selectedMonth={selectedMonth}
      onMonthChange={handleMonthChange}
      availableMonths={data.availableMonths}
      analysisMode={data.analysisMode}
      availableMetrics={data.availableMetrics}
      dataQuality={data.dataQuality}
    >
      <div className="mb-4 flex justify-end">
        <DataRefreshIndicator
          isLoading={loading}
          lastUpdated={lastUpdated}
          error={error}
          className="text-sm"
        />
      </div>
      <CenterLevelGrid
        organizations={data.centers}
        gradeMatrix={data.gradeMatrix}
        weeklyWorkHoursMatrix={data.weeklyWorkHoursMatrix}
        weeklyClaimedHoursMatrix={data.weeklyClaimedHoursMatrix}
        adjustedWeeklyWorkHoursMatrix={data.adjustedWeeklyWorkHoursMatrix}
        dataReliabilityMatrix={data.dataReliabilityMatrix}
        avgEfficiency={data.avgEfficiency}
        avgWeeklyWorkHours={data.avgWeeklyWorkHours}
        avgWeeklyClaimedHours={data.avgWeeklyClaimedHours}
        avgAdjustedWeeklyWorkHours={data.avgAdjustedWeeklyWorkHours}
        avgDataReliability={data.avgDataReliability}
        selectedMetric={selectedMetric}
        thresholds={data.thresholds}
      />
      <SummaryCards selectedMetric={selectedMetric} thresholds={data.thresholds} />
    </DashboardLayout>
  );
}