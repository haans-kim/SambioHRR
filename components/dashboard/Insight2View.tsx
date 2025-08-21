"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp } from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Customized,
} from "recharts";

interface PatternData {
  center: string;
  bu: string;
  team: string;
  employee_count: number;
  equipment_per_person: number;  // X축: 장비 사용 (건/인)
  movement_per_person: number;  // Y축: 이동성 지수
  cluster_type: string;  // 클러스터 타입
  knox_per_person: number;  // Knox 사용량
  meeting_per_person: number;  // 회의 활동
  reliability_score: number;
  correction_factor: number;
  correction_type: string;
}

interface ClusterStats {
  cluster_name: string;
  team_count: number;
  total_employees: number;
  avg_knox_per_person: number;
  avg_equipment_per_person: number;
  avg_movement_per_person: number;
  avg_meeting_per_person: number;
  avg_reliability: number;
  avg_correction_factor: number;
}

const CLUSTER_COLORS: { [key: string]: string } = {
  '장비운영집중형': '#1f77b4',  // 파란색
  '현장이동활발형': '#ff7f0e',  // 주황색
  '디지털협업중심형': '#2ca02c',  // 녹색
  '저활동형': '#8c564b',  // 갈색
  '균형업무형': '#d62728',  // 빨간색
};

export function Insight2View() {
  const [patterns, setPatterns] = useState<PatternData[]>([]);
  const [clusterStats, setClusterStats] = useState<ClusterStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchPatternAnalysis();
  }, []);

  const toggleCluster = (clusterId: number) => {
    const newExpanded = new Set(expandedClusters);
    if (newExpanded.has(clusterId)) {
      newExpanded.delete(clusterId);
    } else {
      newExpanded.add(clusterId);
    }
    setExpandedClusters(newExpanded);
  };

  const fetchPatternAnalysis = async () => {
    try {
      const response = await fetch('/api/insights/pattern-analysis');
      const data = await response.json();
      
      setPatterns(data.patterns || []);
      setClusterStats(data.clusterStats || []);
    } catch (error) {
      console.error('Failed to fetch pattern analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  // 클러스터별 타원 영역 계산
  const getClusterEllipses = () => {
    const clusters: { [key: string]: { x: number[], y: number[], count: number[] } } = {};
    
    patterns.forEach(p => {
      if (!clusters[p.cluster_type]) {
        clusters[p.cluster_type] = { x: [], y: [], count: [] };
      }
      // X축: equipment_per_person (장비 사용), Y축: movement_per_person (이동성 지수)
      clusters[p.cluster_type].x.push(p.equipment_per_person);
      clusters[p.cluster_type].y.push(p.movement_per_person);
      clusters[p.cluster_type].count.push(p.employee_count);
    });

    return Object.entries(clusters).map(([cluster_type, data]) => {
      // 가중 평균 중심점 계산
      const totalCount = data.count.reduce((sum, c) => sum + c, 0);
      const weightedX = data.x.reduce((sum, x, i) => sum + x * data.count[i], 0) / totalCount;
      const weightedY = data.y.reduce((sum, y, i) => sum + y * data.count[i], 0) / totalCount;
      
      // 표준편차로 타원 크기 결정
      const avgX = data.x.reduce((sum, x) => sum + x, 0) / data.x.length;
      const avgY = data.y.reduce((sum, y) => sum + y, 0) / data.y.length;
      const stdX = Math.sqrt(data.x.reduce((sum, x) => sum + Math.pow(x - avgX, 2), 0) / data.x.length);
      const stdY = Math.sqrt(data.y.reduce((sum, y) => sum + Math.pow(y - avgY, 2), 0) / data.y.length);
      
      return {
        cluster_type,
        cx: weightedX,
        cy: weightedY,
        rx: Math.max(stdX * 1.5, 3),  // 장비 사용 축 타원 크기 조정
        ry: Math.max(stdY * 1.5, 0.5),   // 이동성 지수 축 타원 크기 조정  
      };
    });
  };

  // 커스텀 타원 배경 컴포넌트
  const ClusterBackground = ({ viewBox, xAxisMap, yAxisMap }: any) => {
    if (!xAxisMap || !yAxisMap || patterns.length === 0) return null;
    
    const xAxis = xAxisMap[0];
    const yAxis = yAxisMap[0];
    
    if (!xAxis || !yAxis || !xAxis.scale || !yAxis.scale) return null;
    
    const ellipses = getClusterEllipses();
    
    return (
      <g>
        <defs>
          {ellipses.map((ellipse) => (
            <radialGradient 
              key={`gradient-${ellipse.cluster_type}`} 
              id={`cluster-gradient-${ellipse.cluster_type}`}
            >
              <stop offset="0%" stopColor={CLUSTER_COLORS[ellipse.cluster_type]} stopOpacity={0.2} />
              <stop offset="50%" stopColor={CLUSTER_COLORS[ellipse.cluster_type]} stopOpacity={0.1} />
              <stop offset="100%" stopColor={CLUSTER_COLORS[ellipse.cluster_type]} stopOpacity={0.05} />
            </radialGradient>
          ))}
        </defs>
        {ellipses.map((ellipse) => {
          const xPixel = xAxis.scale(ellipse.cx);
          const yPixel = yAxis.scale(ellipse.cy);
          // 동적으로 도메인 크기 계산
          const xDomain = Math.max(...patterns.map(p => p.equipment_per_person)) || 500;
          const yDomain = Math.max(...patterns.map(p => p.movement_per_person)) || 10;
          const rxPixel = (ellipse.rx / xDomain) * xAxis.width;
          const ryPixel = (ellipse.ry / yDomain) * yAxis.height;
          
          return (
            <ellipse
              key={`cluster-bg-${ellipse.cluster_type}`}
              cx={xPixel}
              cy={yPixel}
              rx={rxPixel}
              ry={ryPixel}
              fill={`url(#cluster-gradient-${ellipse.cluster_type})`}
              stroke={CLUSTER_COLORS[ellipse.cluster_type]}
              strokeWidth={1.5}
              strokeOpacity={0.3}
              strokeDasharray="5,5"
            />
          );
        })}
      </g>
    );
  };

  // 커스텀 툴팁
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold">{data.team}</p>
          <p className="text-sm text-gray-600">{data.center} {data.bu && data.bu !== '-' ? `/ ${data.bu}` : ''}</p>
          <div className="mt-2 space-y-1 text-sm">
            <p>직원수: {data.employee_count}명</p>
            <p>장비 사용: {data.equipment_per_person?.toFixed(1) || '0.0'}건/인</p>
            <p>이동성 지수: {data.movement_per_person?.toFixed(1) || '0.0'}</p>
            <p>Knox 사용: {data.knox_per_person?.toFixed(1) || '0.0'}건/인</p>
            <p>회의 활동: {data.meeting_per_person?.toFixed(1) || '0.0'}건/인</p>
            <p>패턴 유형: {data.cluster_type}</p>
            <p>신뢰도: {((data.reliability_score || 0) * 100).toFixed(1)}%</p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-500">데이터를 불러오는 중...</div>
      </div>
    );
  }

  // 패턴 그룹별 Top 5 팀 계산
  const getTopTeamsByCluster = () => {
    const result: { [key: string]: any[] } = {};
    
    // 고유한 클러스터 타입 추출
    const uniqueClusters = [...new Set(patterns.map(p => p.cluster_type))];
    
    // 클러스터별로 그룹화하고 직원 수 기준으로 정렬
    uniqueClusters.forEach(clusterType => {
      const clusterTeams = patterns
        .filter(p => p.cluster_type === clusterType)
        .sort((a, b) => b.employee_count - a.employee_count)
        .slice(0, 5)
        .map((team, idx) => ({
          rank: idx + 1,
          team: team.team,
          employees: team.employee_count,
          equipment: team.equipment_per_person.toFixed(1),
          mobility: team.movement_per_person.toFixed(1),
          knox: team.knox_per_person.toFixed(1),
          meeting: team.meeting_per_person.toFixed(1),
          teams: team.bu && team.bu !== '-' ? team.bu : ''
        }));
      result[clusterType] = clusterTeams;
    });
    
    return result;
  };

  const topTeamsByCluster = getTopTeamsByCluster();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">근무 패턴 분석</h1>
        <p className="text-gray-600 mt-1">실시간 업무패턴 분석 및 근무 추정시간 모니터링</p>
      </div>

      {/* 발견된 패턴 그룹 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">발견된 패턴 그룹</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-16">패턴 유형</TableHead>
                <TableHead className="text-center">팀 수</TableHead>
                <TableHead className="text-center">직원 수</TableHead>
                <TableHead className="text-center">평균 Knox</TableHead>
                <TableHead className="text-center">평균 장비</TableHead>
                <TableHead>주요 팀</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusterStats
                .sort((a, b) => b.total_employees - a.total_employees)
                .map((stat) => {
                const clusterTeams = patterns
                  .filter(p => p.cluster_type === stat.cluster_name)
                  .sort((a, b) => b.employee_count - a.employee_count);
                
                return (
                  <TableRow key={stat.cluster_name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: CLUSTER_COLORS[stat.cluster_name] }}
                        />
                        <span className="font-medium">{stat.cluster_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{stat.team_count}개</TableCell>
                    <TableCell className="text-center">{stat.total_employees.toLocaleString()}명</TableCell>
                    <TableCell className="text-center">{stat.avg_knox_per_person?.toFixed(1) || 0}</TableCell>
                    <TableCell className="text-center">{stat.avg_equipment_per_person?.toFixed(1) || 0}</TableCell>
                    <TableCell className="text-xs">
                      {clusterTeams.slice(0, 5).map(t => t.team).join(', ')}
                      {clusterTeams.length > 5 && ` 외 ${clusterTeams.length - 5}개`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 산점도 차트 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            장비 사용 (건/인) vs 이동성 지수 패턴 분포
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex items-center gap-6">
              <span className="text-sm font-medium text-gray-700">패턴 유형</span>
              <div className="flex gap-4 flex-wrap">
                {Object.entries(CLUSTER_COLORS).map(([name, color]) => (
                  <div key={name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm text-gray-600">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={500}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="equipment_per_person" 
                type="number"
                domain={[0, 700]}
                label={{ value: '장비 사용 (건/인)', position: 'insideBottom', offset: -10 }}
                stroke="#666"
                ticks={[0, 100, 200, 300, 400, 500, 600, 700]}
              />
              <YAxis 
                dataKey="movement_per_person"
                type="number"
                domain={[0, 250]}
                label={{ value: '이동성 지수', angle: -90, position: 'insideLeft' }}
                stroke="#666"
                ticks={[0, 50, 100, 150, 200, 250]}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* 데이터 포인트 (더 진한 색상) */}
              <Scatter 
                data={patterns} 
                fill="#8884d8"
                shape={(props: any) => {
                  const { cx, cy, fill, payload } = props;
                  // 직원 수에 따라 원의 크기 조정 (최소 2, 최대 15)
                  const radius = Math.min(15, Math.max(2, Math.sqrt(payload.employee_count) * 0.8));
                  return (
                    <circle 
                      cx={cx} 
                      cy={cy} 
                      r={radius} 
                      fill={fill}
                      fillOpacity={0.7}  // 약간 더 진하게
                      stroke={fill}
                      strokeWidth={0.5}  // 얇은 테두리
                      strokeOpacity={0.8}
                    />
                  );
                }}
              >
                {patterns.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CLUSTER_COLORS[entry.cluster_type] || '#999999'}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          
          {/* 지표 설명 */}
          <div className="mt-4 space-y-2">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex gap-6 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">X축 (장비 사용):</span>
                  <span>1인당 일일 장비 사용 건수 (o_tag_count / employee_count)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Y축 (이동성 지수):</span>
                  <span>1인당 이동 활동 건수 (t1_count / employee_count)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">원 크기:</span>
                  <span>팀 인원수</span>
                </div>
              </div>
            </div>
            <div className="p-2 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">분석 기준:</span> 분석 대상 팀 데이터 (is_analysis_target = 1)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 클러스터별 통계 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-lg">주요 발견사항</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">패턴 유형</TableHead>
                <TableHead className="text-center font-semibold">팀 수</TableHead>
                <TableHead className="text-center font-semibold">직원 수</TableHead>
                <TableHead className="text-center font-semibold">평균 Knox</TableHead>
                <TableHead className="text-center font-semibold">평균 장비</TableHead>
                <TableHead className="text-center font-semibold">주요 팀</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusterStats
                .map((stat) => {
                  // 해당 클러스터의 상위 3개 팀 찾기
                  const topTeams = patterns
                    .filter(p => p.cluster_type === stat.cluster_name)
                    .sort((a, b) => b.employee_count - a.employee_count)
                    .slice(0, 3)
                    .map(t => t.team);
                  
                  return (
                    <TableRow key={stat.cluster_name} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: CLUSTER_COLORS[stat.cluster_name] }}
                          />
                          {stat.cluster_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{stat.team_count}개</TableCell>
                      <TableCell className="text-center">{stat.total_employees.toLocaleString()}명</TableCell>
                      <TableCell className="text-center">{stat.avg_knox_per_person?.toFixed(1) || '0.0'}</TableCell>
                      <TableCell className="text-center">{stat.avg_equipment_per_person?.toFixed(1) || '0.0'}건/인</TableCell>
                      <TableCell className="text-xs">
                        {topTeams.slice(0, 2).join(', ')}
                        {topTeams.length > 2 && ' 외'}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}