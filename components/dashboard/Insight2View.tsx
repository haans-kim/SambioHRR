"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDevMode } from "@/contexts/DevModeContext";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

interface CenterData {
  center_name: string;
  levels: {
    level: number;
    grades: {
      grade: string;
      avg_weekly_work_hours: number;
      total_members: number;
      level_salary: number;
    }[];
    total_salary: number;
    avg_members: number;
  }[];
  center_total_salary: number;
}

interface BubbleData {
  x: number; // 주간근무시간(AI보정)
  y: number; // 인건비
  z: number; // 인원수
  center: string;
  level: number;
  grades: string[];
}

export function Insight2View() {
  const [data, setData] = useState<CenterData[]>([]);
  const [bubbleData, setBubbleData] = useState<BubbleData[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDevMode } = useDevMode();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/insights/salary-worktime');
      const result = await response.json();
      
      // 데이터가 배열인지 확인
      if (Array.isArray(result)) {
        setData(result);
        
        // 버블차트용 데이터 변환
        const transformedData: BubbleData[] = [];
        
        result.forEach((center: CenterData) => {
          center.levels.forEach((level) => {
            // 레벨별로 평균 근무시간 계산
            const totalHours = level.grades.reduce((sum, g) => sum + g.avg_weekly_work_hours * g.total_members, 0);
            const totalMembers = level.grades.reduce((sum, g) => sum + g.total_members, 0);
            const avgHours = totalMembers > 0 ? totalHours / totalMembers : 0;
            
            transformedData.push({
              x: Number(avgHours.toFixed(1)),
              y: level.total_salary,
              z: totalMembers,
              center: center.center_name,
              level: level.level,
              grades: level.grades.map(g => g.grade)
            });
          });
        });
        
        setBubbleData(transformedData);
      } else {
        console.error('Invalid data format:', result);
        setData([]);
        setBubbleData([]);
      }
    } catch (error) {
      console.error('Failed to fetch insight data:', error);
      setData([]);
      setBubbleData([]);
    } finally {
      setLoading(false);
    }
  };

  // 레벨별 색상 정의
  const getLevelColor = (level: number) => {
    const colors = {
      1: "#ef4444", // red-500
      2: "#f97316", // orange-500
      3: "#eab308", // yellow-500
      4: "#22c55e", // green-500
    };
    return colors[level as keyof typeof colors] || "#6b7280";
  };

  // 커스텀 툴팁
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900">{data.center}</p>
          <p className="text-sm text-gray-600">레벨: Lv.{data.level}</p>
          <p className="text-sm text-gray-600">직급: {data.grades.join(", ")}</p>
          <p className="text-sm text-gray-600">
            주간근무시간: <span className="font-semibold">{data.x}h</span>
          </p>
          <p className="text-sm text-gray-600">
            인건비: <span className="font-semibold">{(data.y / 100000000).toFixed(1)}억</span>
          </p>
          <p className="text-sm text-gray-600">
            인원: <span className="font-semibold">{data.z}명</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Y축 포맷터
  const formatYAxis = (value: number) => {
    return `${(value / 100000000).toFixed(0)}억`;
  };

  // 범례 데이터
  const legendData = [
    { value: 'Lv.1 (36h 이하)', type: 'circle', color: getLevelColor(1) },
    { value: 'Lv.2 (36-38h)', type: 'circle', color: getLevelColor(2) },
    { value: 'Lv.3 (38-40h)', type: 'circle', color: getLevelColor(3) },
    { value: 'Lv.4 (40h 이상)', type: 'circle', color: getLevelColor(4) },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-500">데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            인건비 × 주간 근무추정시간(AI보정) 분석
          </CardTitle>
          <p className="text-sm text-gray-500 mt-2">
            센터별 레벨 기준 인건비와 AI 보정된 주간 근무시간의 상관관계를 버블차트로 표현합니다.
            버블 크기는 해당 레벨의 인원수를 나타냅니다.
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 20, bottom: 60, left: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="주간근무시간"
                  unit="h"
                  domain={[30, 50]}
                  label={{
                    value: "주간 근무추정시간(AI보정)",
                    position: "insideBottom",
                    offset: -10,
                    style: { fontSize: 14, fill: '#374151' }
                  }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="인건비"
                  tickFormatter={formatYAxis}
                  label={{
                    value: "레벨별 인건비",
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: 'middle', fontSize: 14, fill: '#374151' }
                  }}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="circle"
                  payload={legendData}
                  wrapperStyle={{ paddingBottom: '20px' }}
                />
                <Scatter
                  name="센터별 데이터"
                  data={bubbleData}
                  fill="#8884d8"
                >
                  {bubbleData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getLevelColor(entry.level)}
                      fillOpacity={0.7}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          
          {/* 추가 설명 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">차트 읽는 방법</h4>
              <ul className="space-y-1">
                <li>• X축: AI로 보정된 주간 근무시간 (신뢰도 기반 조정)</li>
                <li>• Y축: 레벨별 총 인건비</li>
                <li>• 버블 크기: 해당 레벨의 총 인원수</li>
                <li>• 색상: 근무시간 기준 레벨 구분</li>
              </ul>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">AI 보정 계수</h4>
              <ul className="space-y-1">
                <li>• 데이터 신뢰도가 높을수록 보정 계수가 1에 가까워짐</li>
                <li>• 신뢰도가 낮으면 근무시간이 하향 조정됨 (최대 8%)</li>
                <li>• 시그모이드 함수 적용으로 부드러운 전환</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}