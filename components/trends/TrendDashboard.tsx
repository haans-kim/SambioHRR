"use client";

import React from "react";
import { CenterTabs } from "./CenterTabs";
import { LevelGridTable } from "./LevelGridTable";

interface TrendDashboardProps {
  data: any;
  selectedCenter: string;
  onCenterChange: (center: string) => void;
  selectedMetric: 'claimed' | 'adjusted';
  onMetricChange: (metric: 'claimed' | 'adjusted') => void;
}

export function TrendDashboard({ data, selectedCenter, onCenterChange, selectedMetric, onMetricChange }: TrendDashboardProps) {
  return (
    <div className="space-y-6">
      {/* 센터 탭 네비게이션 */}
      <CenterTabs
        centers={data.availableCenters}
        selectedCenter={selectedCenter}
        onCenterChange={onCenterChange}
        currentCenterName={data.centerName}
      />

      {/* 레벨별 월별 통계 그리드 */}
      <LevelGridTable
        levelData={data.levelData}
        companyAverageData={data.companyAverageData}
        period={data.period}
        centerName={data.centerName}
        selectedMetric={selectedMetric}
        onMetricChange={onMetricChange}
      />
    </div>
  );
}