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

      {/* 상위 10개 팀 버블 차트 */}
      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold">업무 불균형 상위 10개 팀</h2>
          <p className="text-lg text-gray-600 mt-2">버블 크기: 인원수 | 색상: 위험도</p>
        </div>
        <Card>
          <CardContent className="p-2">
            <div className="relative h-[400px] bg-gray-50 rounded-lg">
              <svg className="w-full h-full" viewBox="0 0 800 400">
                {/* X축 */}
                <line x1="50" y1="350" x2="750" y2="350" stroke="#374151" strokeWidth="2"/>
                {/* Y축 */}
                <line x1="50" y1="50" x2="50" y2="350" stroke="#374151" strokeWidth="2"/>
                
                {/* X축 레이블 - 평균 근무시간 */}
                <text x="400" y="390" textAnchor="middle" className="text-sm font-semibold fill-gray-700">
                  평균 근무시간 (시간)
                </text>
                
                {/* Y축 레이블 - 변동계수 */}
                <text x="25" y="200" textAnchor="middle" className="text-sm font-semibold fill-gray-700" transform="rotate(-90 25 200)">
                  변동계수 (CV%)
                </text>
                
                {/* X축 눈금 및 라벨 */}
                {[6, 7, 8, 9, 10].map((hour) => {
                  const xPos = 50 + ((hour - 6) / 4) * 700;
                  return (
                    <g key={hour}>
                      <line x1={xPos} y1="345" x2={xPos} y2="355" stroke="#374151" strokeWidth="1"/>
                      <text x={xPos} y="370" textAnchor="middle" className="text-xs fill-gray-600">
                        {hour}h
                      </text>
                    </g>
                  );
                })}
                
                {/* Y축 눈금 및 라벨 */}
                {[15, 20, 25, 30].map((cv) => {
                  const yPos = 350 - ((cv - 15) / 15) * 300;
                  return (
                    <g key={cv}>
                      <line x1="45" y1={yPos} x2="55" y2={yPos} stroke="#374151" strokeWidth="1"/>
                      <text x="35" y={yPos + 5} textAnchor="end" className="text-xs fill-gray-600">
                        {cv}%
                      </text>
                    </g>
                  );
                })}
                
                {/* 그리드 라인 */}
                {[6, 7, 8, 9, 10].map((hour) => {
                  const xPos = 50 + ((hour - 6) / 4) * 700;
                  return (
                    <line key={`grid-x-${hour}`} x1={xPos} y1="50" y2="350" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2 2"/>
                  );
                })}
                
                {[15, 20, 25, 30].map((cv) => {
                  const yPos = 350 - ((cv - 15) / 15) * 300;
                  return (
                    <line key={`grid-y-${cv}`} x1="50" y1={yPos} x2="750" y2={yPos} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2 2"/>
                  );
                })}
                
                {/* 버블 */}
                {teamDistribution.slice(0, 10).map((team, index) => {
                  // 평균 근무시간에 따른 X 위치 (6-10시간 스케일)
                  const xPosition = 50 + ((team.avg_work_hours - 6) / 4) * 700;
                  
                  // CV 값에 따른 Y 위치 (15-30% 스케일)
                  const yPosition = 350 - ((team.cv_percentage - 15) / 15) * 300;
                  
                  // 버블 크기: 인원수에 따라 조정 (훨씬 더 크게)
                  const radius = Math.min(Math.max(Math.sqrt(team.headcount) * 12, 50), 100); // 최소 50, 최대 100
                  
                  // 색상 설정
                  const color = index < 3 ? '#ef4444' :     // 상위 3개 빨강
                               index < 7 ? '#eab308' :      // 중간 4개 노랑
                               '#22c55e';                    // 하위 3개 초록
                  
                  return (
                    <g key={team.team_id}>
                      <circle
                        cx={xPosition}
                        cy={yPosition}
                        r={radius}
                        fill={color}
                        fillOpacity="0.5"
                        stroke={color}
                        strokeWidth="3"
                        className="hover:fillOpacity-80 transition-all cursor-pointer"
                      />
                      <text
                        x={xPosition}
                        y={yPosition - 10}
                        textAnchor="middle"
                        className="text-2xl font-bold fill-black pointer-events-none"
                      >
                        #{index + 1}
                      </text>
                      <text
                        x={xPosition}
                        y={yPosition + 15}
                        textAnchor="middle"
                        className="text-base font-semibold fill-black pointer-events-none"
                      >
                        {team.team_name.length > 12 ? team.team_name.substring(0, 12) + '...' : team.team_name}
                      </text>
                      {/* 팀명 툴팁 표시 */}
                      <title>{team.team_name}&#10;CV: {team.cv_percentage}%&#10;인원: {team.headcount}명&#10;평균: {team.avg_work_hours}시간</title>
                    </g>
                  );
                })}
              </svg>
              
              {/* 범례 */}
              <div className="absolute bottom-4 right-4 bg-white p-3 rounded shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full opacity-60"></div>
                    <span className="text-xs">불균형 (CV≥25%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full opacity-60"></div>
                    <span className="text-xs">보통 (15%≤CV&lt;25%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full opacity-60"></div>
                    <span className="text-xs">균형 (CV&lt;15%)</span>
                  </div>
                </div>
              </div>
              
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 팀별 업무 균형도 */}
      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold">팀별 업무 균형도 분석</h2>
          <p className="text-lg text-gray-600 mt-2">변동계수(CV)가 높은 상위 24개 팀 - 업무 재분배 필요</p>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
          {teamDistribution.slice(0, 24).map((team, index) => {
            // 상위 20% (0-4번째) = 빨간색, 하위 20% (20-23번째) = 초록색, 나머지 = 노란색
            const colorClass = index < 5 ? 'bg-red-50 border-red-400' :
                              index >= 20 ? 'bg-green-50 border-green-400' :
                              'bg-yellow-50 border-yellow-400';
            
            return (
            <Card key={team.team_id} className={`relative hover:shadow-md transition-shadow min-h-[160px] border-2 ${colorClass}`}>
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
            );
          })}
        </div>
      </div>
    </div>
  );
}