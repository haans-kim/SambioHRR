"use client";

import { useState, useEffect, useRef } from "react";
import { TrendsLayout } from "@/components/layout/TrendsLayout";
import { TrendDashboard } from "@/components/trends/TrendDashboard";

interface TrendData {
  centerName: string;
  period: {
    year: number;
    startMonth: number;
    endMonth: number;
  };
  levelData: {
    level: string;
    monthlyData: {
      month: number;
      weeklyClaimedHours: number;
      weeklyAdjustedHours: number;
      employeeCount: number;
    }[];
    average: {
      weeklyClaimedHours: number;
      weeklyAdjustedHours: number;
    };
  }[];
  summary: {
    totalEmployees: number;
    avgWeeklyClaimedHours: number;
    avgWeeklyAdjustedHours: number;
    efficiency: number;
  };
  availableCenters: {
    id: string;
    name: string;
  }[];
  companyAverageData?: any;
}

export default function TrendsPage() {
  const [selectedCenter, setSelectedCenter] = useState<string | null>(null);
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState<'claimed' | 'adjusted'>('claimed');
  const abortControllerRef = useRef<AbortController | null>(null);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    const fetchData = async () => {
      // 첫 로드 시 센터 선택 전에는 센터 목록만 가져오기
      if (initialLoadRef.current && !selectedCenter) {
        try {
          // loading은 true 유지 (센터가 선택될 때까지)
          const response = await fetch('/api/trends?year=2025&startMonth=1&endMonth=12');
          if (!response.ok) throw new Error('Failed to fetch');
          const trendData = await response.json();

          if (trendData.availableCenters && trendData.availableCenters.length > 0) {
            setSelectedCenter(trendData.availableCenters[0].id);
            initialLoadRef.current = false;
          }
        } catch (error) {
          console.error('Failed to fetch center list:', error);
        }
        // finally 없음 - loading은 그대로 유지
        return;
      }

      // 센터가 선택되지 않았으면 아무것도 하지 않음
      if (!selectedCenter) return;

      try {
        // 이전 요청 취소
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        // 이미 loading이 true이므로 setLoading(true) 불필요
        setLoadingProgress(0);

        const params = new URLSearchParams({
          year: "2025",
          startMonth: "1",
          endMonth: "12",
          center: selectedCenter
        });

        // 프로그레스 시뮬레이션 (실제 로딩 진행상황 표시)
        const progressInterval = setInterval(() => {
          setLoadingProgress(prev => Math.min(prev + 10, 90));
        }, 200);

        const response = await fetch(`/api/trends?${params}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
          },
          signal: abortControllerRef.current.signal
        });

        clearInterval(progressInterval);

        if (!response.ok) throw new Error('Failed to fetch');
        const trendData = await response.json();

        setLoadingProgress(100);
        setData(trendData);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Request cancelled');
          return;
        }
        console.error('Failed to fetch trend data:', error);
      } finally {
        setLoading(false);
        setLoadingProgress(0);
      }
    };

    fetchData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedCenter]);

  const handleCenterChange = (center: string) => {
    setLoading(true); // 센터 변경 시 명시적으로 loading 설정
    setSelectedCenter(center);
  };

  // 센터가 선택되지 않았거나 로딩 중이면 로딩 표시
  if (!selectedCenter || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="space-y-4">
          <div className="text-lg text-gray-600">데이터를 불러오는 중...</div>
          {loadingProgress > 0 && (
            <div className="w-64 bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          )}
        </div>
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
    <TrendsLayout>
      <TrendDashboard
        data={data}
        selectedCenter={selectedCenter || ''}
        onCenterChange={handleCenterChange}
        selectedMetric={selectedMetric}
        onMetricChange={setSelectedMetric}
      />
    </TrendsLayout>
  );
}