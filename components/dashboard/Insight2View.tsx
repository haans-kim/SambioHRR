"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Users, Building2, Activity, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp } from "lucide-react";
import {
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Customized,
  Legend,
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
  avg_actual_work_hours?: number;
  avg_meeting_hours?: number;
  avg_movement_hours?: number;
}

const CLUSTER_COLORS: { [key: string]: string } = {
  '시스템운영집중형': '#1f77b4',  // 파란색
  '현장이동활발형': '#ff7f0e',  // 주황색
  '디지털협업중심형': '#2ca02c',  // 녹색
  '저활동형': '#8c564b',  // 갈색
  '균형업무형': '#d62728',  // 빨간색
};

export function Insight2View() {
  const [patterns, setPatterns] = useState<PatternData[]>([]);
  const [clusterStats, setClusterStats] = useState<ClusterStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPatternAnalysis();
  }, []);

  const toggleCluster = (clusterName: string) => {
    const newExpanded = new Set(expandedClusters);
    if (newExpanded.has(clusterName)) {
      newExpanded.delete(clusterName);
    } else {
      newExpanded.add(clusterName);
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
        <h1 className="text-3xl font-bold text-gray-900">근무 패턴 분석</h1>
        <p className="text-lg text-gray-600 mt-1">실시간 업무패턴 분석 및 근무 추정시간 모니터링</p>
      </div>

      {/* Top 5 팀 - 단일 행 표시 */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">패턴별 주요 팀</h2>
        <div className="flex gap-4 overflow-x-auto">
          {Object.entries(topTeamsByCluster).map(([clusterType, teams]) => (
            <Card key={clusterType} className="min-w-[250px] flex-shrink-0">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: CLUSTER_COLORS[clusterType] }}
                  />
                  <CardTitle className="text-sm">{clusterType}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {teams.slice(0, 5).map((team: any) => (
                    <div key={team.team} className="flex justify-between text-xs">
                      <span className="truncate flex-1">{team.team}</span>
                      <span className="text-gray-600">{team.employees}명</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 발견된 패턴 그룹 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl">발견된 패턴 그룹</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-16 text-base">패턴 유형</TableHead>
                <TableHead className="text-center text-base">팀 수</TableHead>
                <TableHead className="text-center text-base">직원 수</TableHead>
                <TableHead className="text-center text-base">평균 Knox</TableHead>
                <TableHead className="text-center text-base">평균 장비</TableHead>
                <TableHead className="text-base">주요 팀</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...clusterStats]
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
                        <span className="font-medium text-base">{stat.cluster_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-base">{stat.team_count}개</TableCell>
                    <TableCell className="text-center text-base">{stat.total_employees.toLocaleString()}명</TableCell>
                    <TableCell className="text-center text-base">{stat.avg_knox_per_person?.toFixed(1) || 0}</TableCell>
                    <TableCell className="text-center text-base">{stat.avg_equipment_per_person?.toFixed(1) || 0}</TableCell>
                    <TableCell className="text-base">
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
          <CardTitle className="text-xl">시스템 사용 vs 이동성 지수 패턴 분포</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex items-center gap-6">
              <span className="text-base font-medium text-gray-700">패턴 유형</span>
              <div className="flex gap-4 flex-wrap">
                {Object.entries(CLUSTER_COLORS).map(([name, color]) => (
                  <div key={name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-base text-gray-600">{name}</span>
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
                label={{ value: '시스템 사용 (건/인)', position: 'insideBottom', offset: -10 }}
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
              <div className="flex gap-6 text-base text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">X축 (시스템 사용):</span>
                  <span>1인당 일일 시스템 사용 건수 (o_tag_count / employee_count)</span>
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
              <p className="text-base text-blue-800">
                <span className="font-semibold">분석 기준:</span> 5인 이상인 팀, 직속 제외
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 패턴별 지표 분포 (박스플롯) */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Knox 활동 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">패턴별 Knox 활동 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] relative">
              {(() => {
                // 패턴별로 실제 데이터 그룹화
                const clusterData: { [key: string]: number[] } = {};
                const order = ['시스템운영집중형', '현장이동활발형', '디지털협업중심형', '저활동형', '균형업무형'];
                
                patterns.forEach(p => {
                  if (!clusterData[p.cluster_type]) {
                    clusterData[p.cluster_type] = [];
                  }
                  clusterData[p.cluster_type].push(p.knox_per_person || 0);
                });
                
                // 박스플롯 계산 함수
                const calculateBoxPlot = (values: number[]) => {
                  if (values.length === 0) return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
                  const sorted = [...values].sort((a, b) => a - b);
                  const len = sorted.length;
                  
                  return {
                    min: sorted[0],
                    q1: sorted[Math.floor(len * 0.25)],
                    median: sorted[Math.floor(len * 0.5)],
                    q3: sorted[Math.floor(len * 0.75)],
                    max: sorted[len - 1]
                  };
                };
                
                // 고정 스케일 사용 (800을 최대값으로)
                const maxValue = 800;
                const height = 240;
                const scale = height / maxValue;
                
                // Y축 그리드와 라벨 생성
                const yAxisTicks = [0, 200, 400, 600, 800];
                
                return (
                  <>
                    {/* Y축 그리드와 라벨 */}
                    <div className="absolute left-0 bottom-10 h-[240px] w-full">
                      {yAxisTicks.map(tick => (
                        <div key={tick}>
                          <div 
                            className="absolute w-full border-t border-gray-200"
                            style={{ bottom: `${tick * scale}px` }}
                          />
                          <div 
                            className="absolute text-xs text-gray-500"
                            style={{ 
                              bottom: `${tick * scale - 5}px`,
                              left: '5px'
                            }}
                          >
                            {tick}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* 박스플롯 */}
                    <div className="flex items-end justify-around h-[250px] absolute bottom-10 left-10 right-0">
                      {order.map(clusterName => {
                        const values = clusterData[clusterName] || [];
                        const stats = calculateBoxPlot(values);
                        
                        return (
                          <div key={clusterName} className="flex flex-col items-center flex-1 relative">
                            <div className="absolute bottom-0 w-full flex justify-center" style={{ height: `${height}px` }}>
                              {values.length > 0 && (
                                <>
                                  {/* Whisker line */}
                                  <div 
                                    className="absolute w-0.5 bg-gray-400"
                                    style={{
                                      bottom: `${stats.min * scale}px`,
                                      height: `${(stats.max - stats.min) * scale}px`,
                                      left: '50%',
                                      transform: 'translateX(-50%)'
                                    }}
                                  />
                                  {/* Max whisker */}
                                  <div 
                                    className="absolute w-4 h-0.5 bg-gray-600"
                                    style={{
                                      bottom: `${stats.max * scale}px`,
                                      left: '50%',
                                      transform: 'translateX(-50%)'
                                    }}
                                  />
                                  {/* Min whisker */}
                                  <div 
                                    className="absolute w-4 h-0.5 bg-gray-600"
                                    style={{
                                      bottom: `${stats.min * scale}px`,
                                      left: '50%',
                                      transform: 'translateX(-50%)'
                                    }}
                                  />
                                  {/* Box */}
                                  <div 
                                    className="absolute w-12 bg-blue-200 border-2 border-blue-500"
                                    style={{
                                      bottom: `${stats.q1 * scale}px`,
                                      height: `${Math.max(1, (stats.q3 - stats.q1) * scale)}px`,
                                      left: '50%',
                                      transform: 'translateX(-50%)'
                                    }}
                                  />
                                  {/* Median line */}
                                  <div 
                                    className="absolute w-12 h-0.5 bg-blue-700"
                                    style={{
                                      bottom: `${stats.median * scale}px`,
                                      left: '50%',
                                      transform: 'translateX(-50%)'
                                    }}
                                  />
                                </>
                              )}
                            </div>
                            <div className="absolute -bottom-10 text-xs text-center w-full">
                              <div className="font-medium truncate">{clusterName}</div>
                              <div className="text-gray-500">중앙값: {stats.median.toFixed(0)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* 장비 사용 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">패턴별 장비 사용 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] relative">
              {(() => {
                // 패턴별로 실제 데이터 그룹화
                const clusterData: { [key: string]: number[] } = {};
                const order = ['시스템운영집중형', '현장이동활발형', '디지털협업중심형', '저활동형', '균형업무형'];
                
                patterns.forEach(p => {
                  if (!clusterData[p.cluster_type]) {
                    clusterData[p.cluster_type] = [];
                  }
                  clusterData[p.cluster_type].push(p.equipment_per_person || 0);
                });
                
                // 박스플롯 계산 함수
                const calculateBoxPlot = (values: number[]) => {
                  if (values.length === 0) return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
                  const sorted = [...values].sort((a, b) => a - b);
                  const len = sorted.length;
                  
                  return {
                    min: sorted[0],
                    q1: sorted[Math.floor(len * 0.25)],
                    median: sorted[Math.floor(len * 0.5)],
                    q3: sorted[Math.floor(len * 0.75)],
                    max: sorted[len - 1]
                  };
                };
                
                // 고정 스케일 사용 (800을 최대값으로)
                const maxValue = 800;
                const height = 240;
                const scale = height / maxValue;
                
                // Y축 그리드와 라벨 생성
                const yAxisTicks = [0, 200, 400, 600, 800];
                
                return (
                  <>
                    {/* Y축 그리드와 라벨 */}
                    <div className="absolute left-0 bottom-10 h-[240px] w-full">
                      {yAxisTicks.map(tick => (
                        <div key={tick}>
                          <div 
                            className="absolute w-full border-t border-gray-200"
                            style={{ bottom: `${tick * scale}px` }}
                          />
                          <div 
                            className="absolute text-xs text-gray-500"
                            style={{ 
                              bottom: `${tick * scale - 5}px`,
                              left: '5px'
                            }}
                          >
                            {tick}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* 박스플롯 */}
                    <div className="flex items-end justify-around h-[250px] absolute bottom-10 left-10 right-0">
                      {order.map(clusterName => {
                        const values = clusterData[clusterName] || [];
                        const stats = calculateBoxPlot(values);
                  
                        return (
                          <div key={clusterName} className="flex flex-col items-center flex-1 relative">
                            <div className="absolute bottom-0 w-full flex justify-center" style={{ height: `${height}px` }}>
                              {values.length > 0 && (
                                <>
                                  {/* Whisker line */}
                                  <div 
                                    className="absolute w-0.5 bg-gray-400"
                                    style={{
                                      bottom: `${stats.min * scale}px`,
                                      height: `${(stats.max - stats.min) * scale}px`,
                                      left: '50%',
                                      transform: 'translateX(-50%)'
                                    }}
                                  />
                                  {/* Max whisker */}
                                  <div 
                                    className="absolute w-4 h-0.5 bg-gray-600"
                                    style={{
                                      bottom: `${stats.max * scale}px`,
                                      left: '50%',
                                      transform: 'translateX(-50%)'
                                    }}
                                  />
                                  {/* Min whisker */}
                                  <div 
                                    className="absolute w-4 h-0.5 bg-gray-600"
                                    style={{
                                      bottom: `${stats.min * scale}px`,
                                      left: '50%',
                                      transform: 'translateX(-50%)'
                                    }}
                                  />
                                  {/* Box */}
                                  <div 
                                    className="absolute w-12 bg-blue-200 border-2 border-blue-500"
                                    style={{
                                      bottom: `${stats.q1 * scale}px`,
                                      height: `${Math.max(1, (stats.q3 - stats.q1) * scale)}px`,
                                      left: '50%',
                                      transform: 'translateX(-50%)'
                                    }}
                                  />
                                  {/* Median line */}
                                  <div 
                                    className="absolute w-12 h-0.5 bg-blue-700"
                                    style={{
                                      bottom: `${stats.median * scale}px`,
                                      left: '50%',
                                      transform: 'translateX(-50%)'
                                    }}
                                  />
                                </>
                              )}
                            </div>
                            <div className="absolute -bottom-10 text-xs text-center w-full">
                              <div className="font-medium truncate">{clusterName}</div>
                              <div className="text-gray-500">중앙값: {stats.median.toFixed(0)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 패턴별 상세 정보 */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">패턴별 상세 분석</h2>
        {[...clusterStats]
          .sort((a, b) => b.total_employees - a.total_employees)
          .map((stat) => {
            const clusterTeams = patterns
              .filter(p => p.cluster_type === stat.cluster_name)
              .sort((a, b) => b.employee_count - a.employee_count);
            
            // 센터별로 그룹화
            const teamsByCenter = clusterTeams.reduce((acc, team) => {
              if (!acc[team.center]) {
                acc[team.center] = [];
              }
              acc[team.center].push(team);
              return acc;
            }, {} as { [key: string]: PatternData[] });
            
            const isExpanded = expandedClusters.has(stat.cluster_name);
            
            return (
              <Card key={stat.cluster_name}>
                <CardHeader 
                  className="cursor-pointer"
                  onClick={() => toggleCluster(stat.cluster_name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: CLUSTER_COLORS[stat.cluster_name] }}
                        />
                        <CardTitle className="text-xl">
                          {stat.cluster_name} ({stat.team_count}개 팀)
                        </CardTitle>
                      </div>
                      <div className="text-base text-gray-600 ml-7">
                        <span className="font-medium">주요 팀:</span> {clusterTeams.slice(0, 5).map(t => t.team).join(', ')}
                        {clusterTeams.length > 5 && ` 외 ${clusterTeams.length - 5}개`}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-base text-gray-500">총 인원</div>
                        <div className="text-lg font-semibold">{stat.total_employees.toLocaleString()}명</div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </CardHeader>
                
                {isExpanded && (
                  <CardContent>
                    {/* 통계 요약 */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="flex items-center gap-2 text-gray-600 text-base mb-1">
                          <Users className="w-3 h-3" />
                          <span>소속 팀 수</span>
                        </div>
                        <div className="text-lg font-semibold">{stat.team_count}개</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="flex items-center gap-2 text-gray-600 text-base mb-1">
                          <Users className="w-3 h-3" />
                          <span>총 직원 수</span>
                        </div>
                        <div className="text-lg font-semibold">{stat.total_employees.toLocaleString()}명</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="flex items-center gap-2 text-gray-600 text-base mb-1">
                          <Activity className="w-3 h-3" />
                          <span>평균 Knox 활동</span>
                        </div>
                        <div className="text-lg font-semibold">{stat.avg_knox_per_person?.toFixed(1)}건/인</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="flex items-center gap-2 text-gray-600 text-base mb-1">
                          <BarChart3 className="w-3 h-3" />
                          <span>평균 장비 사용</span>
                        </div>
                        <div className="text-lg font-semibold">{stat.avg_equipment_per_person?.toFixed(1)}건/인</div>
                      </div>
                    </div>
                    
                    {/* 소속 팀 전체 목록 */}
                    <div className="border rounded-lg p-4">
                      <h4 className="text-base font-semibold mb-3">소속 팀 전체 목록 ({stat.team_count}개):</h4>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="text-base">센터</TableHead>
                            <TableHead className="text-base">팀 수</TableHead>
                            <TableHead className="text-base">소속 팀</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(teamsByCenter)
                            .sort(([, a], [, b]) => b.length - a.length)
                            .map(([center, teams]) => (
                              <TableRow key={center}>
                                <TableCell className="font-medium text-base">{center}</TableCell>
                                <TableCell className="text-base">{teams.length}개</TableCell>
                                <TableCell className="text-base">
                                  {teams.map(t => t.team).join(', ')}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
      </div>
    </div>
  );
}