'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface WorkTimeStatistics {
  orgId: string;
  orgName: string;
  orgLevel: string;
  avgWorkTime: number;
  stdDeviation: number;
  varianceCoefficient: number;
  minWorkTime: number;
  maxWorkTime: number;
  q1: number;
  median: number;
  q3: number;
  employeeCount: number;
  outlierCount: number;
  riskLevel: 'safe' | 'warning' | 'danger';
}

export default function StatisticsPage() {
  const [statistics, setStatistics] = useState<WorkTimeStatistics[]>([]);
  const [orgLevel, setOrgLevel] = useState<'center' | 'team' | 'group'>('center');
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'cv' | 'stdDev'>('cv');

  useEffect(() => {
    fetchStatistics();
  }, [orgLevel]);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/statistics?level=${orgLevel}`);
      const data = await response.json();
      setStatistics(data.statistics || []);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'danger': return 'text-red-600 bg-red-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'safe': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'danger': return <XCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'safe': return <CheckCircle className="h-4 w-4" />;
      default: return <Minus className="h-4 w-4" />;
    }
  };

  const getTrendIcon = (value: number, threshold: number) => {
    if (value > threshold) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (value < threshold / 2) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  // 통계 요약
  const summary = {
    total: statistics.length,
    safe: statistics.filter(s => s.riskLevel === 'safe').length,
    warning: statistics.filter(s => s.riskLevel === 'warning').length,
    danger: statistics.filter(s => s.riskLevel === 'danger').length,
    avgCV: statistics.reduce((sum, s) => sum + s.varianceCoefficient, 0) / statistics.length || 0,
    totalEmployees: statistics.reduce((sum, s) => sum + s.employeeCount, 0),
    totalOutliers: statistics.reduce((sum, s) => sum + s.outlierCount, 0),
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">표준편차 분석</h1>
          <p className="text-gray-600 mt-1">조직별 업무 균형도 상세 분석</p>
        </div>
        <div className="flex gap-2">
          <Select value={orgLevel} onValueChange={(value: any) => setOrgLevel(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="center">센터별</SelectItem>
              <SelectItem value="team">팀별</SelectItem>
              <SelectItem value="group">그룹별</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchStatistics} variant="outline">
            새로고침
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">전체 조직</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-gray-500">개</p>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700">균형</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.safe}</div>
            <Progress 
              value={(summary.safe / summary.total) * 100} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card className="border-yellow-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-700">주의</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.warning}</div>
            <Progress 
              value={(summary.warning / summary.total) * 100} 
              className="mt-2 h-2"
              color="yellow"
            />
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-700">위험</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.danger}</div>
            <Progress 
              value={(summary.danger / summary.total) * 100} 
              className="mt-2 h-2"
              color="red"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">평균 변동계수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avgCV.toFixed(1)}%</div>
            <Badge variant={summary.avgCV < 15 ? 'default' : summary.avgCV < 25 ? 'secondary' : 'destructive'}>
              {summary.avgCV < 15 ? '양호' : summary.avgCV < 25 ? '관찰필요' : '개선필요'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">이상치 인원</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary.totalOutliers}</div>
            <p className="text-xs text-gray-500">
              전체 {summary.totalEmployees}명 중 {((summary.totalOutliers / summary.totalEmployees) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 상세 테이블 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>조직별 상세 분석</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={selectedMetric === 'cv' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedMetric('cv')}
              >
                변동계수 기준
              </Button>
              <Button
                variant={selectedMetric === 'stdDev' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedMetric('stdDev')}
              >
                표준편차 기준
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">데이터를 불러오는 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>조직명</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead className="text-right">인원</TableHead>
                    <TableHead className="text-right">평균 근무(분)</TableHead>
                    <TableHead className="text-right">표준편차</TableHead>
                    <TableHead className="text-right">변동계수(%)</TableHead>
                    <TableHead className="text-right">최소-최대</TableHead>
                    <TableHead className="text-right">Q1-중앙값-Q3</TableHead>
                    <TableHead className="text-right">이상치</TableHead>
                    <TableHead className="text-center">추세</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statistics
                    .sort((a, b) => selectedMetric === 'cv' 
                      ? b.varianceCoefficient - a.varianceCoefficient
                      : b.stdDeviation - a.stdDeviation
                    )
                    .map((stat) => (
                      <TableRow key={stat.orgId} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{stat.orgName}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={getRiskColor(stat.riskLevel)}>
                            <span className="flex items-center gap-1">
                              {getRiskIcon(stat.riskLevel)}
                              {stat.riskLevel === 'safe' ? '균형' : 
                               stat.riskLevel === 'warning' ? '주의' : '위험'}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{stat.employeeCount}</TableCell>
                        <TableCell className="text-right">
                          {Math.round(stat.avgWorkTime)}
                          <span className="text-xs text-gray-500 ml-1">
                            ({(stat.avgWorkTime / 60).toFixed(1)}h)
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {stat.stdDeviation.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${
                            stat.varianceCoefficient < 15 ? 'text-green-600' :
                            stat.varianceCoefficient < 25 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {stat.varianceCoefficient.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {Math.round(stat.minWorkTime)}-{Math.round(stat.maxWorkTime)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {Math.round(stat.q1)}-{Math.round(stat.median)}-{Math.round(stat.q3)}
                        </TableCell>
                        <TableCell className="text-right">
                          {stat.outlierCount > 0 && (
                            <Badge variant="outline" className="text-orange-600">
                              {stat.outlierCount}명
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {getTrendIcon(stat.varianceCoefficient, 25)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 분석 가이드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              균형 상태 (CV &lt; 15%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• 팀원 간 업무 분배가 균등함</li>
              <li>• 현재 상태 유지 권장</li>
              <li>• 분기별 모니터링으로 충분</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              주의 상태 (15% ≤ CV &lt; 25%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• 일부 직원에게 업무 쏠림 현상</li>
              <li>• 업무 재분배 검토 필요</li>
              <li>• 주간 단위 모니터링 권장</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              위험 상태 (CV ≥ 25%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• 심각한 업무 불균형 발생</li>
              <li>• 즉시 개입 필요</li>
              <li>• 일일 모니터링 및 조치</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}