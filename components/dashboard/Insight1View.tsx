"use client";

import { useState, useEffect } from "react";
import { useDevMode } from "@/contexts/DevModeContext";
import { cn } from "@/lib/utils";

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

export function Insight1View() {
  const [data, setData] = useState<CenterData[]>([]);
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
      } else {
        console.error('Invalid data format:', result);
        setData([]);
      }
    } catch (error) {
      console.error('Failed to fetch insight data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // 레벨별 색상 정의 (이미지와 동일하게)
  const getLevelColor = (level: number) => {
    const colors = {
      1: "bg-red-50",
      2: "bg-orange-50", 
      3: "bg-yellow-50",
      4: "bg-green-50"
    };
    return colors[level as keyof typeof colors] || "bg-gray-50";
  };

  const getLevelBorderColor = (level: number) => {
    const colors = {
      1: "border-red-400",
      2: "border-orange-400", 
      3: "border-yellow-400",
      4: "border-green-400"
    };
    return colors[level as keyof typeof colors] || "border-gray-400";
  };

  const getLevelTextColor = (level: number) => {
    const colors = {
      1: "text-red-900",
      2: "text-orange-900", 
      3: "text-yellow-900",
      4: "text-green-900"
    };
    return colors[level as keyof typeof colors] || "text-gray-900";
  };

  // 포맷팅 함수들
  const formatSalary = (value: number) => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(1)}억`;
    }
    return `${(value / 10000).toFixed(0)}만`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-500">데이터를 불러오는 중...</div>
      </div>
    );
  }

  // 데이터에서 센터 목록 추출
  const centerList = Array.from(new Set(data.map(d => d.center_name))).sort();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          인건비 크기 시각화 설명
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          센터별 · 레벨별 인건비와 주간 추정근태시간 통계
        </p>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <span className="text-xs text-gray-600">모범사례</span>
          <div className="w-2 h-2 rounded-full bg-green-500 ml-2"></div>
          <span className="text-xs text-gray-600">양호</span>
          <div className="w-2 h-2 rounded-full bg-orange-500 ml-2"></div>
          <span className="text-xs text-gray-600">관찰필요</span>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          크기: 인건비 규모 = 원의 크기 = 인건비 · 인원수 인건비
        </p>
      </div>

      {/* 전체 현황 테이블 */}
      <div className="bg-white rounded-lg overflow-hidden">
        <div className="bg-blue-50 px-4 py-3">
          <h3 className="text-lg font-bold text-blue-900">전체 현황</h3>
        </div>
        
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="w-24 p-2 text-center text-sm font-medium text-gray-700">구분</th>
              {centerList.map((center, idx) => (
                <th key={idx} className="p-2 text-center text-sm font-medium text-gray-700 min-w-[120px]">
                  {center}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 레벨별 데이터 */}
            {[4, 3, 2, 1].map(level => (
              <tr key={level} className="border-b">
                <td className="p-3">
                  <div className={cn(
                    "rounded-lg py-2 px-3 text-center font-bold",
                    getLevelColor(level),
                    getLevelBorderColor(level),
                    "border"
                  )}>
                    <span className={getLevelTextColor(level)}>Lv.{level}</span>
                  </div>
                </td>
                {centerList.map((centerName, idx) => {
                  const center = data.find(c => c.center_name === centerName);
                  if (!center) {
                    return <td key={idx} className="p-2 text-center">-</td>;
                  }
                  
                  const levelData = center.levels.find(l => l.level === level);
                  if (!levelData || levelData.grades.length === 0) {
                    return <td key={idx} className="p-2 text-center">-</td>;
                  }
                  
                  const totalMembers = levelData.grades.reduce((sum, g) => sum + g.total_members, 0);
                  if (totalMembers === 0) {
                    return <td key={idx} className="p-2 text-center">-</td>;
                  }
                  
                  const avgHours = levelData.grades.reduce((sum, g) => sum + g.avg_weekly_work_hours * g.total_members, 0) / totalMembers;
                  
                  // 버블 크기 계산 (인원수 기준으로 수정)
                  const maxBubbleSize = 65;
                  const minBubbleSize = 40;
                  const bubbleSize = Math.min(maxBubbleSize, Math.max(minBubbleSize, Math.sqrt(totalMembers) * 8));
                  
                  return (
                    <td key={idx} className="p-2">
                      <div className="flex flex-col items-center justify-center">
                        <div 
                          className={cn(
                            "rounded-full flex flex-col items-center justify-center",
                            getLevelColor(level),
                            getLevelBorderColor(level),
                            "border-2"
                          )}
                          style={{
                            width: `${bubbleSize}px`,
                            height: `${bubbleSize}px`,
                          }}
                        >
                          <div className={cn("text-xs font-bold", getLevelTextColor(level))}>
                            {avgHours.toFixed(1)}h
                          </div>
                          {bubbleSize > 45 && (
                            <div className={cn("text-[10px]", getLevelTextColor(level))}>
                              {totalMembers}명
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            
            {/* 총계 행 */}
            <tr className="bg-gray-50">
              <td className="p-3 font-bold text-center">총계</td>
              {centerList.map((centerName, idx) => {
                const center = data.find(c => c.center_name === centerName);
                if (!center) {
                  return <td key={idx} className="p-2 text-center">-</td>;
                }
                
                const totalSalary = center.center_total_salary;
                const totalMembers = center.levels.reduce((sum, l) => 
                  sum + l.grades.reduce((gSum, g) => gSum + g.total_members, 0), 0
                );
                
                return (
                  <td key={idx} className="p-2 text-center">
                    <div className="text-sm font-bold text-blue-900">{formatSalary(totalSalary)}</div>
                    <div className="text-xs text-gray-600">{totalMembers}명</div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* 하단 설명 */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>양호</span>
          </div>
          <div>출근 60%</div>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-200"></div>
            <span className="text-xs text-gray-600">관찰 주시 필요</span>
          </div>
          <div className="text-xs text-gray-600">작성 20% (+37.2h)</div>
        </div>
      </div>
    </div>
  );
}