"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { BarChart3, PieChart, TrendingUp, Users, Clock, Target, Brain, Activity } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

interface GroupStatsData {
  group: {
    orgCode: string;
    orgName: string;
    parentTeam: string;
    parentCenter: string;
    parentDivision?: string | null;
  };
  summary: {
    totalEmployees: number;
    totalRecords: number;
    avgEfficiency: number;
    avgWorkHours: number;
    avgClaimedHours: number;
    avgGroundRulesWorkHours: number;
    avgGroundRulesConfidence: number;
    avgAdjustedWeeklyWorkHours: number;
    totalManDays: number;
  };
  distributions: {
    efficiencyDistribution: Array<{range: string, count: number, percentage: number}>;
    workHoursDistribution: Array<{range: string, count: number, percentage: number}>;
    confidenceDistribution: Array<{range: string, count: number, percentage: number}>;
    groundRulesDistribution: Array<{range: string, count: number, percentage: number}>;
  };
  metrics: {
    // 시간 관련 지표
    avgTotalHours: number;
    avgActualWorkHours: number;
    avgClaimedWorkHours: number;
    avgEfficiencyRatio: number;
    
    // 활동별 시간 (분 단위)
    avgWorkMinutes: number;
    avgFocusedWorkMinutes: number;
    avgEquipmentMinutes: number;
    avgMeetingMinutes: number;
    avgTrainingMinutes: number;
    
    // 식사 시간 상세
    avgMealMinutes: number;
    avgBreakfastMinutes: number;
    avgLunchMinutes: number;
    avgDinnerMinutes: number;
    avgMidnightMealMinutes: number;
    
    // 기타 활동 시간
    avgMovementMinutes: number;
    avgRestMinutes: number;
    avgFitnessMinutes: number;
    avgCommuteInMinutes: number;
    avgCommuteOutMinutes: number;
    avgPreparationMinutes: number;
    
    // 구역별 시간
    avgWorkAreaMinutes: number;
    avgNonWorkAreaMinutes: number;
    avgGateAreaMinutes: number;
    
    // Ground Rules 지표
    avgGroundRulesWorkHours: number;
    avgGroundRulesConfidence: number;
    avgWorkMovementMinutes: number;
    avgNonWorkMovementMinutes: number;
    avgAnomalyScore: number;
    
    // 기타 지표
    avgConfidenceScore: number;
    avgActivityCount: number;
    avgMealCount: number;
    avgTagCount: number;
  };
  ranges: {
    efficiencyRange: {min: number, max: number};
    workHoursRange: {min: number, max: number};
    confidenceRange: {min: number, max: number};
  };
  analysisDate: string;
}

export default function GroupStatsPage() {
  const params = useParams();
  const groupId = params.id as string;
  
  const [data, setData] = useState<GroupStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/group-stats/${groupId}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const statsData = await response.json();
        console.log('Fetched stats for', groupId, ':', {
          totalEmployees: statsData.summary?.totalEmployees,
          totalRecords: statsData.summary?.totalRecords,
          avgEfficiency: statsData.summary?.avgEfficiency
        });
        setData(statsData);
      } catch (error) {
        console.error('Failed to fetch group stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId]);

  // Helper function to format minutes to hours
  const formatMinutesToHours = (minutes: number) => {
    return (minutes / 60).toFixed(1) + 'h';
  };

  // Helper function to get distribution color
  const getDistributionColor = (percentage: number) => {
    if (percentage >= 30) return 'bg-blue-500';
    if (percentage >= 20) return 'bg-blue-400';
    if (percentage >= 10) return 'bg-blue-300';
    return 'bg-blue-200';
  };

  // Build breadcrumb for DashboardLayout
  const breadcrumb = useMemo(() => {
    if (!data) {
      return [{ label: '센터', href: '/' }];
    }
    const crumbs: { label: string; href?: string }[] = [{ label: '센터', href: '/' }];
    
    // Add center - need to find center code from API or use name-based navigation
    if (data.group.parentCenter) {
      crumbs.push({ 
        label: data.group.parentCenter, 
        href: `/teams?center=${data.group.parentCenter}` 
      });
    }
    
    // Add division if exists
    if (data.group.parentDivision) {
      crumbs.push({ 
        label: data.group.parentDivision, 
        href: `/teams?division=${data.group.parentDivision}` 
      });
    }
    
    // Add team - parent of the current group
    if (data.group.parentTeam) {
      crumbs.push({ 
        label: data.group.parentTeam, 
        href: `/groups?team=${data.group.parentTeam}` 
      });
    }
    
    // Current group (no link)
    crumbs.push({ label: data.group.orgName });
    
    // Debug log
    console.log('Generated breadcrumb for group:', data.group.orgName, crumbs);
    return crumbs;
  }, [data]);

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
      totalEmployees={data?.summary.totalEmployees || 0}
      avgEfficiency={data?.summary.avgEfficiency || 0}
      avgWeeklyClaimedHours={(data?.summary.avgClaimedHours || 0) * 5}
      avgAdjustedWeeklyWorkHours={data?.summary.avgAdjustedWeeklyWorkHours || 0}
      selectedMetric={'efficiency'}
      breadcrumb={breadcrumb}
    >
      {/* 그룹 정보 헤더 */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{data.group.orgName}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {data.group.parentCenter}
              {data.group.parentDivision ? ` / ${data.group.parentDivision}` : ''}
              {` / ${data.group.parentTeam}`}
            </p>
            <p className="text-xs text-gray-500 mt-1">분석일자: {data.analysisDate || '최신 데이터'}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{data.summary.totalEmployees}명</div>
            <div className="text-sm text-gray-500">총 {data.summary.totalRecords}건 분석</div>
          </div>
        </div>
      </div>

      {/* 주요 지표 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">평균 효율성</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.avgEfficiency}%</p>
              <p className="text-xs text-gray-400">범위: {data.ranges.efficiencyRange.min}% - {data.ranges.efficiencyRange.max}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">평균 근무시간</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.avgAdjustedWeeklyWorkHours}h</p>
              <p className="text-xs text-gray-400">주간 추정근무시간 (AI보정)</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <Brain className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Ground Rules 신뢰도</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.avgGroundRulesConfidence}%</p>
              <p className="text-xs text-gray-400">Ground Rules 작업시간: {data.summary.avgGroundRulesWorkHours}h</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">데이터 신뢰도</p>
              <p className="text-2xl font-bold text-gray-900">{data.metrics.avgConfidenceScore}%</p>
              <p className="text-xs text-gray-400">범위: {data.ranges.confidenceRange.min}% - {data.ranges.confidenceRange.max}%</p>
            </div>
          </div>
        </div>
      </div>


      {/* 상세 지표 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 시간 관련 지표 */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">⏰ 시간 관련 지표</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">총 체류시간</span>
              <span className="text-sm font-medium">{data.metrics.avgTotalHours}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">실제 근무시간</span>
              <span className="text-sm font-medium">{data.metrics.avgActualWorkHours}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">신고 근무시간</span>
              <span className="text-sm font-medium">{data.metrics.avgClaimedWorkHours}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">효율성 비율</span>
              <span className="text-sm font-medium">{data.metrics.avgEfficiencyRatio}%</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-sm text-gray-600">Ground Rules 근무시간</span>
              <span className="text-sm font-medium text-purple-600">{data.metrics.avgGroundRulesWorkHours}h</span>
            </div>
          </div>
        </div>

        {/* 활동별 시간 */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 활동별 시간 (분)</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">업무 시간</span>
              <span className="text-sm font-medium">{data.metrics.avgWorkMinutes}분</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">집중 업무</span>
              <span className="text-sm font-medium">{data.metrics.avgFocusedWorkMinutes}분</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">회의 시간</span>
              <span className="text-sm font-medium">{data.metrics.avgMeetingMinutes}분</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">교육 시간</span>
              <span className="text-sm font-medium">{data.metrics.avgTrainingMinutes}분</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">장비 조작</span>
              <span className="text-sm font-medium">{data.metrics.avgEquipmentMinutes}분</span>
            </div>
          </div>
        </div>

        {/* 기타 활동 시간 */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 기타 활동 (분)</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">식사 시간</span>
              <span className="text-sm font-medium">{data.metrics.avgMealMinutes}분</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">이동 시간</span>
              <span className="text-sm font-medium">{data.metrics.avgMovementMinutes}분</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">휴식 시간</span>
              <span className="text-sm font-medium">{data.metrics.avgRestMinutes}분</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">피트니스</span>
              <span className="text-sm font-medium">{data.metrics.avgFitnessMinutes}분</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">출퇴근</span>
              <span className="text-sm font-medium">{data.metrics.avgCommuteInMinutes + data.metrics.avgCommuteOutMinutes}분</span>
            </div>
          </div>
        </div>

        {/* Ground Rules 관련 지표 */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🧠 Ground Rules 지표</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Ground Rules 신뢰도</span>
              <span className="text-sm font-medium text-purple-600">{data.metrics.avgGroundRulesConfidence}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">업무 관련 이동</span>
              <span className="text-sm font-medium">{data.metrics.avgWorkMovementMinutes}분</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">비업무 이동</span>
              <span className="text-sm font-medium">{data.metrics.avgNonWorkMovementMinutes}분</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">이상치 점수</span>
              <span className="text-sm font-medium">{data.metrics.avgAnomalyScore}</span>
            </div>
          </div>
        </div>

        {/* 구역별 시간 */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📍 구역별 시간 (분)</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">근무 구역</span>
              <span className="text-sm font-medium">{data.metrics.avgWorkAreaMinutes}분</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">비근무 구역</span>
              <span className="text-sm font-medium">{data.metrics.avgNonWorkAreaMinutes}분</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">게이트 구역</span>
              <span className="text-sm font-medium">{data.metrics.avgGateAreaMinutes}분</span>
            </div>
          </div>
        </div>

        {/* 기타 지표 */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 기타 지표</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">평균 활동 횟수</span>
              <span className="text-sm font-medium">{data.metrics.avgActivityCount}회</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">평균 식사 횟수</span>
              <span className="text-sm font-medium">{data.metrics.avgMealCount}회</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">평균 태그 수</span>
              <span className="text-sm font-medium">{data.metrics.avgTagCount}개</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}