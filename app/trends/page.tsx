"use client";

import { useState, useEffect } from "react";
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
}

export default function TrendsPage() {
  const [selectedCenter, setSelectedCenter] = useState<string | null>(null);
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          year: "2025",
          startMonth: "1",
          endMonth: "12"
        });

        // Only add center param if it's set
        if (selectedCenter) {
          params.append('center', selectedCenter);
        }

        const response = await fetch(`/api/trends?${params}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) throw new Error('Failed to fetch');
        const trendData = await response.json();
        setData(trendData);

        // Set first center as selected on initial load
        if (initialLoad && trendData.availableCenters && trendData.availableCenters.length > 0) {
          setSelectedCenter(trendData.availableCenters[0].id);
          setInitialLoad(false);
        }
      } catch (error) {
        console.error('Failed to fetch trend data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedCenter, initialLoad]);

  const handleCenterChange = (center: string) => {
    setSelectedCenter(center);
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
    <TrendsLayout>
      <TrendDashboard
        data={data}
        selectedCenter={selectedCenter || ''}
        onCenterChange={handleCenterChange}
      />
    </TrendsLayout>
  );
}