'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface FocusedWorkTableProps {
  visible: boolean;
}

interface CenterData {
  center: string;
  employees: number;
  avgFocusedWorkHours: number;
  stdDev: number;
  maxFocusedWorkHours: number;
  avgWorkHours: number;
  efficiency: number;
  focusedRatio: number;
}

export function FocusedWorkTable({ visible }: FocusedWorkTableProps) {
  const [data, setData] = useState<CenterData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;

    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        if (!response.ok) throw new Error('Failed to fetch');
        const result = await response.json();
        
        if (result.focusedWorkTable) {
          // Define the desired center order
          const centerOrder = [
            '영업센터',
            '오퍼레이션센터', 
            'EPCV센터',
            '품질운영센터',
            'CDO개발센터',
            '바이오연구소',
            '경영지원센터',
            'People센터',
            '상생협력센터'
          ];
          
          // Create a map for easy lookup
          const dataMap = new Map<string, any>();
          result.focusedWorkTable.forEach((item: any) => {
            dataMap.set(item.center, {
              center: item.center,
              employees: item.employees,
              avgFocusedWorkHours: item.avgFocusedWorkHours,
              stdDev: item.stdDev,
              maxFocusedWorkHours: item.avgFocusedWorkHours + item.stdDev, // Calculate max
              avgWorkHours: item.avgWorkHours,
              efficiency: item.efficiency,
              focusedRatio: item.focusedRatio
            });
          });
          
          // Sort according to the defined order
          const sortedData = centerOrder
            .map(center => dataMap.get(center))
            .filter(item => item !== undefined);
          
          setData(sortedData);
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
      <div className="mt-6 space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-600">데이터를 불러오는 중...</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold">센터별 집중 근무시간 상세 분석</h2>
        <p className="text-sm text-gray-600 mt-1">집중 근무시간이 30분 이상인 데이터만 분석</p>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">센터</th>
                  <th className="px-6 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">평균 집중시간</th>
                  <th className="px-6 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">표준편차</th>
                  <th className="px-6 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">최대</th>
                  <th className="px-6 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">평균 근무시간</th>
                  <th className="px-6 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">데이터 신뢰도</th>
                  <th className="px-6 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">집중률</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((center, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-2 whitespace-nowrap text-base font-medium text-gray-900 text-center">{center.center}</td>
                    <td className="px-6 py-2 whitespace-nowrap text-base text-gray-900 text-center font-semibold">{center.avgFocusedWorkHours.toFixed(2)}h</td>
                    <td className="px-6 py-2 whitespace-nowrap text-base text-gray-500 text-center">±{center.stdDev.toFixed(2)}h</td>
                    <td className="px-6 py-2 whitespace-nowrap text-base text-gray-500 text-center">{center.maxFocusedWorkHours.toFixed(2)}h</td>
                    <td className="px-6 py-2 whitespace-nowrap text-base text-gray-500 text-center">{center.avgWorkHours.toFixed(2)}h</td>
                    <td className="px-6 py-2 whitespace-nowrap text-base text-center">
                      <span className={`inline-flex px-2 text-sm leading-5 font-semibold rounded-full ${
                        center.efficiency >= 80 ? 'bg-green-100 text-green-800' : 
                        center.efficiency >= 70 ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'
                      }`}>
                        {center.efficiency.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-base text-center">
                      <span className={`font-semibold ${
                        center.focusedRatio >= 25 ? 'text-green-600' : 
                        center.focusedRatio >= 20 ? 'text-yellow-600' : 
                        'text-red-600'
                      }`}>
                        {center.focusedRatio.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">참고:</span> 집중 근무시간이 30분 미만인 데이터는 제외하고 분석한 결과입니다. 
              집중률은 전체 근무시간 대비 집중 근무시간의 비율을 나타냅니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}