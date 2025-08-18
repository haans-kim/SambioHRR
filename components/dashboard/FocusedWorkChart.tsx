"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart,
  Line,
  ReferenceLine
} from "recharts";

interface FocusedWorkChartProps {
  visible: boolean;
}

interface CenterData {
  center: string;
  employees: number;
  focusedWorkHours: number;
  workHours: number;
  stdDev: number;
  minRange: number;
  maxRange: number;
  efficiency: number;
  focusedRatio: number;
}

export function FocusedWorkChart({ visible }: FocusedWorkChartProps) {
  const [data, setData] = useState<CenterData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;

    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        if (!response.ok) throw new Error('Failed to fetch');
        const result = await response.json();
        
        // Transform the focused work table data into chart format
        if (result.focusedWorkTable) {
          const chartData = result.focusedWorkTable.map((item: any) => ({
            center: item.center,
            employees: item.employees,
            focusedWorkHours: parseFloat(item.avgFocusedWorkHours.toFixed(1)),
            workHours: parseFloat(item.avgWorkHours.toFixed(1)),
            stdDev: parseFloat(item.stdDev.toFixed(1)),
            minRange: parseFloat((item.avgFocusedWorkHours - item.stdDev).toFixed(1)),
            maxRange: parseFloat((item.avgFocusedWorkHours + item.stdDev).toFixed(1)),
            efficiency: parseFloat(item.efficiency.toFixed(1)),
            focusedRatio: parseFloat(item.focusedRatio.toFixed(1))
          }));
          
          // Sort by focused work hours descending
          chartData.sort((a: CenterData, b: CenterData) => b.focusedWorkHours - a.focusedWorkHours);
          
          setData(chartData);
        }
      } catch (error) {
        console.error('Failed to fetch focused work data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [visible]);

  if (!visible) return null;

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-600">데이터를 불러오는 중...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-gray-700">
              데이터 수: <span className="font-medium">{data.employees}명</span>
            </p>
            <p className="text-gray-700">
              평균 집중시간: <span className="font-medium text-blue-600">{data.focusedWorkHours}h</span>
            </p>
            <p className="text-gray-700">
              평균 근무시간: <span className="font-medium">{data.workHours}h</span>
            </p>
            <p className="text-gray-700">
              표준편차: <span className="font-medium">±{data.stdDev}h</span>
            </p>
            <p className="text-gray-700">
              최소-최대: <span className="font-medium">{data.minRange.toFixed(1)}h - {data.maxRange.toFixed(1)}h</span>
            </p>
            <p className="text-gray-700">
              집중률: <span className="font-medium text-green-600">{data.focusedRatio}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Calculate average for reference line
  const avgFocusedHours = data.reduce((sum, item) => sum + item.focusedWorkHours, 0) / data.length;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">센터별 집중 근무시간 상세 분석</CardTitle>
        <p className="text-sm text-gray-600">집중 근무시간이 30분 이상인 데이터만 분석</p>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              data={data} 
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="center" 
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                yAxisId="hours"
                label={{ value: '시간 (h)', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                yAxisId="ratio"
                orientation="right"
                label={{ value: '집중률 (%)', angle: 90, position: 'insideRight' }}
                tick={{ fontSize: 12 }}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: 20 }}
                iconType="rect"
              />
              
              {/* Reference line for average */}
              <ReferenceLine 
                yAxisId="hours"
                y={avgFocusedHours} 
                stroke="#666" 
                strokeDasharray="3 3"
                label={{ value: `평균: ${avgFocusedHours.toFixed(1)}h`, position: "right" }}
              />
              
              {/* Bar for focused work hours */}
              <Bar 
                yAxisId="hours"
                dataKey="focusedWorkHours" 
                fill="#3b82f6" 
                name="평균 집중시간"
                radius={[4, 4, 0, 0]}
              />
              
              {/* Bar for total work hours */}
              <Bar 
                yAxisId="hours"
                dataKey="workHours" 
                fill="#e5e7eb" 
                name="평균 근무시간"
                radius={[4, 4, 0, 0]}
              />
              
              {/* Line for focused ratio */}
              <Line 
                yAxisId="ratio"
                type="monotone" 
                dataKey="focusedRatio" 
                stroke="#10b981" 
                strokeWidth={2}
                name="집중률"
                dot={{ fill: '#10b981', r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div className="text-center">
            <p className="text-sm text-gray-600">전체 평균 집중시간</p>
            <p className="text-lg font-semibold text-blue-600">
              {avgFocusedHours.toFixed(1)}h
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">최고 집중시간</p>
            <p className="text-lg font-semibold text-green-600">
              {data[0]?.center}: {data[0]?.focusedWorkHours}h
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">최저 집중시간</p>
            <p className="text-lg font-semibold text-orange-600">
              {data[data.length - 1]?.center}: {data[data.length - 1]?.focusedWorkHours}h
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">평균 집중률</p>
            <p className="text-lg font-semibold text-purple-600">
              {(data.reduce((sum, item) => sum + item.focusedRatio, 0) / data.length).toFixed(1)}%
            </p>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 mt-4 text-right">
          참고: 집중률은 전체 근무시간 대비 집중 근무시간의 비율을 나타냅니다.
        </p>
      </CardContent>
    </Card>
  );
}