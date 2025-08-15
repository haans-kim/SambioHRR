'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Activity,
  Clock,
  BarChart3
} from 'lucide-react';

interface InsightData {
  type: 'burnout' | 'underutilized' | 'imbalance' | 'trend' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedCount: number;
  recommendation: string;
}

interface RealTimeMetrics {
  currently_working: number;
  overtime_today: number;
  data_reliability: number;
  work_efficiency: number;
}

interface TeamDistribution {
  team_id: string;
  team_name: string;
  headcount: number;
  avg_work_hours: number;
  efficiency_rate: number;
  std_dev_hours: number;
  cv_percentage: number;
  balance_status: 'balanced' | 'moderate' | 'imbalanced';
}

export default function EnterpriseView() {
  const [insights, setInsights] = useState<InsightData[]>([]);
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics | null>(null);
  const [teamDistribution, setTeamDistribution] = useState<TeamDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [insightsRes, metricsRes, distributionRes] = await Promise.all([
        fetch('/api/insights'),
        fetch('/api/metrics/realtime'),
        fetch('/api/teams/distribution')
      ]);

      const insightsData = await insightsRes.json();
      const metricsData = await metricsRes.json();
      const distributionData = await distributionRes.json();

      setInsights(insightsData.insights || []);
      setRealTimeMetrics(metricsData);
      setTeamDistribution(distributionData.teams || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getBalanceColor = (status: string) => {
    switch (status) {
      case 'balanced': return 'text-green-600';
      case 'moderate': return 'text-yellow-600';
      case 'imbalanced': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'burnout': return <AlertTriangle className="h-5 w-5" />;
      case 'trend': return <TrendingUp className="h-5 w-5" />;
      case 'anomaly': return <Activity className="h-5 w-5" />;
      case 'imbalance': return <BarChart3 className="h-5 w-5" />;
      default: return <Users className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 섹션 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">업무 불균형 - 전사 대시보드</h1>
          <p className="text-gray-600 mt-1">5,000명 조직 실시간 모니터링</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <Clock className="mr-2 h-4 w-4" />
          {new Date().toLocaleTimeString('ko-KR')}
        </Badge>
      </div>


      {/* AI 인사이트 섹션 */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">실시간 인사이트</h2>
        <div className="grid grid-cols-3 gap-4">
          {insights.map((insight, index) => (
            <Alert key={index} className={`border-l-4 ${
              insight.severity === 'critical' ? 'border-red-500' :
              insight.severity === 'high' ? 'border-orange-500' :
              insight.severity === 'medium' ? 'border-yellow-500' :
              'border-green-500'
            }`}>
              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-full ${getSeverityColor(insight.severity)} text-white flex-shrink-0`}>
                  {React.cloneElement(getInsightIcon(insight.type), { className: 'h-7 w-7' })}
                </div>
                <div className="flex-1">
                  <AlertTitle className="text-2xl font-bold mb-3 whitespace-nowrap">{insight.title}</AlertTitle>
                  <AlertDescription className="text-lg text-gray-700 whitespace-nowrap">
                    {insight.description}
                  </AlertDescription>
                  {insight.affectedCount > 0 && (
                    <Badge variant="secondary" className="mt-3 text-base px-4 py-2 inline-block">
                      영향: {insight.affectedCount}명
                    </Badge>
                  )}
                  <p className="text-lg font-semibold text-blue-600 mt-4 whitespace-nowrap">
                    💡 {insight.recommendation}
                  </p>
                </div>
              </div>
            </Alert>
          ))}
        </div>
      </div>

      {/* 팀별 업무 균형도 */}
      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold">팀별 업무 균형도 분석</h2>
          <p className="text-lg text-gray-600 mt-2">변동계수(CV)가 높은 상위 24개 팀 - 업무 재분배 필요</p>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
          {teamDistribution.slice(0, 24).map((team, index) => (
            <Card key={team.team_id} className={`relative hover:shadow-md transition-shadow min-h-[160px] border-2 ${
              team.balance_status === 'imbalanced' ? 'bg-red-50 border-red-400' :
              team.balance_status === 'moderate' ? 'bg-yellow-50 border-yellow-400' :
              'bg-green-50 border-green-400'
            }`}>
              <CardContent className="p-0 h-full flex flex-col">
                <div className="text-right px-2">
                  <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                </div>
                <div className="px-2">
                  <h3 className="font-semibold text-sm">{team.team_name}</h3>
                </div>
                
                <div className="h-4"></div>
                
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getBalanceColor(team.balance_status)}`}>
                      {team.cv_percentage}%
                    </div>
                    <div className="text-xs text-gray-600">변동계수</div>
                  </div>
                </div>

                <div className="border-t pt-1 px-2 pb-1 space-y-0.5">
                  <div className="flex justify-between text-base">
                    <span className="text-gray-500">인원</span>
                    <span className="font-medium">{team.headcount}명</span>
                  </div>
                  <div className="flex justify-between text-base">
                    <span className="text-gray-500">평균</span>
                    <span className="font-medium">{team.avg_work_hours}h</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}