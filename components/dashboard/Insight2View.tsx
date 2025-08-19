"use client";

import { useState, useEffect } from "react";
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
  location_fixity: number;
  movement_complexity: number;
  data_density: number;
  external_activity: number;
  cluster: number;
  reliability_score: number;
  correction_factor: number;
  correction_type: string;
}

interface ClusterStats {
  cluster_name: string;
  cluster: number;
  team_count: number;
  total_employees: number;
  avg_location_fixity: number;
  avg_data_density: number;
  avg_external_activity: number;
  avg_reliability: number;
  avg_correction_factor: number;
}

const CLUSTER_COLORS = [
  '#FF6B6B', // Type A - 빨강
  '#FFD93D', // Type B - 노랑
  '#95E77E', // Type C - 연두
  '#4ECDC4', // Type D - 청록
  '#2C3E50', // Type E - 짙은 남색
];

const CLUSTER_NAMES = [
  'Type_A_생산고정형',
  'Type_B_생산중심형(외부활동)',
  'Type_C_혼합근무형',
  'Type_D_사무중심형',
  'Type_E_사무전문형'
];

export function Insight2View() {
  const [patterns, setPatterns] = useState<PatternData[]>([]);
  const [clusterStats, setClusterStats] = useState<ClusterStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatternAnalysis();
  }, []);

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
    const clusters: { [key: number]: { x: number[], y: number[], count: number[] } } = {};
    
    patterns.forEach(p => {
      if (!clusters[p.cluster]) {
        clusters[p.cluster] = { x: [], y: [], count: [] };
      }
      clusters[p.cluster].x.push(p.location_fixity);
      clusters[p.cluster].y.push(p.data_density);
      clusters[p.cluster].count.push(p.employee_count);
    });

    return Object.entries(clusters).map(([cluster, data]) => {
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
        cluster: parseInt(cluster),
        cx: weightedX,
        cy: weightedY,
        rx: Math.max(stdX * 1.8, 10),
        ry: Math.max(stdY * 1.8, 3),
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
              key={`gradient-${ellipse.cluster}`} 
              id={`cluster-gradient-${ellipse.cluster}`}
            >
              <stop offset="0%" stopColor={CLUSTER_COLORS[ellipse.cluster]} stopOpacity={0.2} />
              <stop offset="50%" stopColor={CLUSTER_COLORS[ellipse.cluster]} stopOpacity={0.1} />
              <stop offset="100%" stopColor={CLUSTER_COLORS[ellipse.cluster]} stopOpacity={0.05} />
            </radialGradient>
          ))}
        </defs>
        {ellipses.map((ellipse) => {
          const xPixel = xAxis.scale(ellipse.cx);
          const yPixel = yAxis.scale(ellipse.cy);
          const rxPixel = (ellipse.rx / 100) * xAxis.width;
          const ryPixel = (ellipse.ry / 30) * yAxis.height;
          
          return (
            <ellipse
              key={`cluster-bg-${ellipse.cluster}`}
              cx={xPixel}
              cy={yPixel}
              rx={rxPixel}
              ry={ryPixel}
              fill={`url(#cluster-gradient-${ellipse.cluster})`}
              stroke={CLUSTER_COLORS[ellipse.cluster]}
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
          <p className="text-sm text-gray-600">{data.center} / {data.bu}</p>
          <div className="mt-2 space-y-1 text-sm">
            <p>직원수: {data.employee_count}명</p>
            <p>위치 고정성: {data.location_fixity.toFixed(1)}%</p>
            <p>데이터 밀도: {data.data_density.toFixed(1)}</p>
            <p>클러스터: {CLUSTER_NAMES[data.cluster]}</p>
            <p>신뢰도: {(data.reliability_score * 100).toFixed(1)}%</p>
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">패턴 분석 대시보드</h1>
        <p className="text-gray-600 mt-1">팀별 근무 패턴 분석 및 클러스터링 결과</p>
      </div>

      {/* 산점도 차트 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            팀별 근무 패턴 분포
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex items-center gap-6">
              <span className="text-sm font-medium text-gray-700">패턴 유형</span>
              <div className="flex gap-4 flex-wrap">
                {CLUSTER_NAMES.map((name, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: CLUSTER_COLORS[index] }}
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
                dataKey="location_fixity" 
                type="number"
                domain={[0, 100]}
                label={{ value: '위치 고정성 (%)', position: 'insideBottom', offset: -10 }}
                stroke="#666"
              />
              <YAxis 
                dataKey="data_density"
                type="number"
                domain={[0, 30]}
                label={{ value: '데이터 밀도', angle: -90, position: 'insideLeft' }}
                stroke="#666"
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* 클러스터 타원 배경 영역 */}
              <Customized component={ClusterBackground} />
              
              {/* 데이터 포인트 (더 진한 색상) */}
              <Scatter 
                data={patterns} 
                fill="#8884d8"
                shape={(props: any) => {
                  const { cx, cy, fill, payload } = props;
                  // 직원 수에 따라 원의 크기 조정 (최소 3, 최대 30)
                  const radius = Math.min(30, Math.max(3, Math.sqrt(payload.employee_count) * 2));
                  return (
                    <circle 
                      cx={cx} 
                      cy={cy} 
                      r={radius} 
                      fill={fill}
                      fillOpacity={0.9}  // 더 진하게 (기존 0.7 → 0.9)
                      stroke={fill}
                      strokeWidth={1.5}  // 테두리도 약간 굵게
                    />
                  );
                }}
              >
                {patterns.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CLUSTER_COLORS[entry.cluster]}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 클러스터별 통계 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            패턴 유형별 분포
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">cluster</TableHead>
                <TableHead className="text-center font-semibold">팀수</TableHead>
                <TableHead className="text-center font-semibold">총직원수</TableHead>
                <TableHead className="text-center font-semibold">평균위치고정성</TableHead>
                <TableHead className="text-center font-semibold">평균데이터밀도</TableHead>
                <TableHead className="text-center font-semibold">평균신뢰도</TableHead>
                <TableHead className="text-center font-semibold">평균보정Factor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusterStats
                .sort((a, b) => a.cluster - b.cluster)
                .map((stat) => (
                  <TableRow key={stat.cluster} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: CLUSTER_COLORS[stat.cluster] }}
                        />
                        {stat.cluster_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{stat.team_count}</TableCell>
                    <TableCell className="text-center">{stat.total_employees.toLocaleString()}</TableCell>
                    <TableCell className="text-center">{stat.avg_location_fixity.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{stat.avg_data_density.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{stat.avg_reliability.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{stat.avg_correction_factor.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}