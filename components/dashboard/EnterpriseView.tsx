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
  avg_weekly_adjusted_hours: number;
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
      <div>
        <h1 className="text-2xl font-bold">근무 불균형 - 전사 대시보드</h1>
        <p className="text-gray-600 mt-1">5,000명 조직 모니터링</p>
      </div>


      {/* AI 인사이트 섹션 */}
      <div className="max-w-[90%] mx-auto">
        <div className="grid grid-cols-3 gap-4">
          {insights.map((insight, index) => (
            <Alert key={index} className={`border-l-4 ${
              insight.severity === 'critical' ? 'border-red-500' :
              insight.severity === 'high' ? 'border-orange-500' :
              insight.severity === 'medium' ? 'border-yellow-500' :
              'border-green-500'
            }`}>
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-full ${getSeverityColor(insight.severity)} text-white flex-shrink-0`}>
                  {React.cloneElement(getInsightIcon(insight.type), { className: 'h-5 w-5' })}
                </div>
                <div className="flex-1">
                  <AlertTitle className="text-base font-semibold mb-2 whitespace-nowrap">{insight.title}</AlertTitle>
                  <AlertDescription className="text-sm text-gray-700 whitespace-nowrap">
                    {insight.description}
                  </AlertDescription>
                  {insight.affectedCount > 0 && (
                    <div className="flex justify-center mt-2">
                      <Badge variant="secondary" className="text-2xl px-4 py-2">
                        {insight.affectedCount}{insight.type === 'imbalance' ? '개팀' : '명'}
                      </Badge>
                    </div>
                  )}
                  <p className="text-sm font-medium text-blue-600 mt-3 whitespace-nowrap">
                    💡 {insight.recommendation}
                  </p>
                </div>
              </div>
            </Alert>
          ))}
        </div>
      </div>

      {/* 상위 24개 팀 버블 차트 */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">근무 불균형 상위 24개 팀</h2>
          <p className="text-sm text-gray-600 mt-1">버블 크기: 인원수 | 색상: 위험도</p>
        </div>
        
        {/* 변동계수 설명 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-[90%] mx-auto">
          <div className="flex items-start space-x-2">
            <div className="text-blue-600 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900">변동계수(CV, Coefficient of Variation)란?</h3>
              <p className="text-sm text-blue-800 mt-1">
                팀 내 구성원들의 근무시간 편차를 나타내는 지표입니다. 
                <span className="font-medium"> CV = (표준편차 ÷ 평균) × 100</span>으로 계산되며, 
                수치가 높을수록 팀원 간 업무량 차이가 크다는 의미입니다.
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span className="text-gray-700">CV &lt; 15%: 균형적</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                  <span className="text-gray-700">CV 15-25%: 보통</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  <span className="text-gray-700">CV &gt; 25%: 불균형</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="max-w-[90%] mx-auto">
          <div className="relative h-[600px] bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-300 p-2">
              <svg className="w-full h-full" viewBox="0 0 1200 600">
                {(() => {
                  // 실제 데이터 범위 계산
                  const data = teamDistribution.slice(0, 24);
                  const minHours = Math.min(...data.map(t => t.avg_weekly_adjusted_hours));
                  const maxHours = Math.max(...data.map(t => t.avg_weekly_adjusted_hours));
                  const minCV = Math.min(...data.map(t => t.cv_percentage));
                  const maxCV = Math.max(...data.map(t => t.cv_percentage));
                  
                  // 축 범위 설정 (X: 35-50h 주간, Y: 11-23%)
                  const xMin = 35;
                  const xMax = 50;
                  const yMin = 11;
                  const yMax = 23;
                  
                  // X축 눈금 생성 (2.5시간 간격)
                  const xTicks = [];
                  for (let i = xMin; i <= xMax; i += 2.5) {
                    xTicks.push(i);
                  }
                  
                  // Y축 눈금 생성 (1% 간격)
                  const yTicks = [];
                  for (let i = yMin; i <= yMax; i += 1) {
                    yTicks.push(i);
                  }
                  
                  return (
                    <>
                      {/* X축 */}
                      <line x1="80" y1="530" x2="1150" y2="530" stroke="#4B5563" strokeWidth="2"/>
                      {/* Y축 */}
                      <line x1="80" y1="50" x2="80" y2="530" stroke="#4B5563" strokeWidth="2"/>
                      
                      {/* X축 레이블 - 주간 추정근태시간 */}
                      <text x="615" y="585" textAnchor="middle" className="text-lg font-bold fill-gray-800">
                        주간 추정근태시간 (시간/주)
                      </text>
                      
                      {/* Y축 레이블 - 변동계수 */}
                      <text x="25" y="290" textAnchor="middle" className="text-lg font-bold fill-gray-800" transform="rotate(-90 25 290)">
                        변동계수 (CV%)
                      </text>
                      
                      {/* X축 눈금 및 라벨 */}
                      {xTicks.map((hour) => {
                        const xPos = 80 + ((hour - xMin) / (xMax - xMin)) * 1070;
                        return (
                          <g key={hour}>
                            <line x1={xPos} y1="525" x2={xPos} y2="535" stroke="#4B5563" strokeWidth="1.5"/>
                            <text x={xPos} y="555" textAnchor="middle" className="text-sm font-medium fill-gray-700">
                              {hour}h
                            </text>
                            <line x1={xPos} y1="50" y2="530" stroke="#D1D5DB" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.4"/>
                          </g>
                        );
                      })}
                      
                      {/* Y축 눈금 및 라벨 */}
                      {yTicks.map((cv) => {
                        const yPos = 530 - ((cv - yMin) / (yMax - yMin)) * 480;
                        return (
                          <g key={cv}>
                            <line x1="75" y1={yPos} x2="85" y2={yPos} stroke="#4B5563" strokeWidth="1.5"/>
                            <text x="60" y={yPos + 5} textAnchor="end" className="text-sm font-medium fill-gray-700">
                              {cv}%
                            </text>
                            <line x1="80" y1={yPos} x2="1150" y2={yPos} stroke="#D1D5DB" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.4"/>
                          </g>
                        );
                      })}
                      
                      {/* 버블 */}
                      {data.map((team, index) => {
                        // X축 위치 (실제 데이터 범위에 맞춤)
                        const xPosition = 80 + ((team.avg_weekly_adjusted_hours - xMin) / (xMax - xMin)) * 1070;
                        
                        // Y축 위치 (실제 데이터 범위에 맞춤, CV가 높을수록 위로)
                        const yPosition = 530 - ((team.cv_percentage - yMin) / (yMax - yMin)) * 480;
                        
                        // 겹침 방지를 위한 더 큰 오프셋
                        const offsetX = (index % 3 - 1) * 40; // -40, 0, 40 반복
                        const offsetY = (Math.floor(index / 3) % 2 - 0.5) * 30; // -15, 15 반복
                        const adjustedX = xPosition + offsetX;
                        const adjustedY = yPosition + offsetY;
                        
                        // 버블 크기: 인원수에 따라 조정 (더 크고 뚜렷하게)
                        const radius = Math.min(Math.max(Math.sqrt(team.headcount) * 7, 35), 60); // 최소 35, 최대 60
                        
                        // 색상 설정 (진한 색상에 opacity 적용)
                        const color = index < 5 ? '#ef4444' :     // 상위 5개 빨강 (red-500)
                                     index >= 20 ? '#22c55e' :    // 하위 4개 초록 (green-500)
                                     '#eab308';                    // 중간 15개 노랑 (yellow-600)
                        
                        return (
                          <g key={team.team_id}>
                            {/* 그림자 효과 */}
                            <circle
                              cx={adjustedX + 2}
                              cy={adjustedY + 2}
                              r={radius}
                              fill="#000000"
                              fillOpacity="0.1"
                              filter="blur(2px)"
                            />
                            {/* 메인 버블 */}
                            <circle
                              cx={adjustedX}
                              cy={adjustedY}
                              r={radius}
                              fill={color}
                              fillOpacity="0.2"
                              className="hover:fillOpacity-0.3 transition-all duration-200 cursor-pointer"
                            />
                            <text
                              x={adjustedX}
                              y={adjustedY - 8}
                              textAnchor="middle"
                              className="text-xl font-bold pointer-events-none"
                              fill="#374151"
                            >
                              #{index + 1}
                            </text>
                            <text
                              x={adjustedX}
                              y={adjustedY + 10}
                              textAnchor="middle"
                              className="text-xs font-medium pointer-events-none"
                              fill="#1f2937"
                            >
                              {team.team_name}
                            </text>
                            {/* 팀명 툴팁 표시 */}
                            <title>{team.team_name}&#10;CV: {team.cv_percentage}%&#10;인원: {team.headcount}명&#10;주간: {team.avg_weekly_adjusted_hours}시간</title>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
          </div>
        </div>
      </div>


      {/* 팀별 업무 균형도 */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">팀별 근무 균형도 분석</h2>
          <p className="text-sm text-gray-600 mt-1">변동계수(CV)가 높은 상위 24개 팀 - 근무 재분배 필요</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 max-w-[90%] mx-auto">
          {teamDistribution.slice(0, 24).map((team, index) => {
            // 상위 20% (0-4번째) = 빨간색, 하위 20% (20-23번째) = 초록색, 나머지 = 노란색
            const colorClass = index < 5 ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300' :
                              index >= 20 ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-300' :
                              'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300';
            
            const shadowClass = index < 5 ? 'hover:shadow-red-200' :
                               index >= 20 ? 'hover:shadow-green-200' :
                               'hover:shadow-yellow-200';
            
            return (
            <Card key={team.team_id} className={`relative hover:shadow-lg ${shadowClass} transition-all duration-200 h-[234px] border ${colorClass}`}>
              <CardContent className="px-3 pb-3 flex flex-col h-full !pt-0.5">
                <span className="text-sm font-bold text-gray-600">#{index + 1}</span>
                
                <div className="mt-1 min-h-[2.5rem]">
                  <h3 className="font-semibold text-base text-gray-900 leading-tight line-clamp-2" title={team.team_name}>
                    {team.team_name}
                  </h3>
                </div>
                
                <div className="flex-grow"></div>
                
                <div className="mt-auto">
                  <div className="text-center pb-2">
                    <div className={`text-3xl font-bold ${getBalanceColor(team.balance_status)}`}>
                      {team.cv_percentage}%
                    </div>
                    <div className="text-xs text-gray-600 mt-1">변동계수</div>
                  </div>

                  <div className="border-t border-gray-200 pt-2 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">인원</span>
                      <span className="font-semibold text-gray-700">{team.headcount}명</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">주간</span>
                      <span className="font-semibold text-gray-700">{team.avg_weekly_adjusted_hours}h</span>
                    </div>
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