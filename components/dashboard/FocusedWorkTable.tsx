'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface FocusedWorkTableProps {
  visible: boolean;
}

export function FocusedWorkTable({ visible }: FocusedWorkTableProps) {
  if (!visible) return null;

  const centerData = [
    { name: 'CDO개발센터', count: 696, avg: 2.87, std: 2.42, min: 0.50, max: 9.77, work: 9.43, confidence: 72.1, ratio: 30.7 },
    { name: 'People센터', count: 421, avg: 2.51, std: 1.82, min: 0.50, max: 10.97, work: 9.51, confidence: 76.8, ratio: 26.2 },
    { name: 'EPCV센터', count: 3090, avg: 2.47, std: 1.64, min: 0.50, max: 11.48, work: 9.05, confidence: 86.2, ratio: 28.1 },
    { name: '상생협력센터', count: 1158, avg: 2.42, std: 1.87, min: 0.50, max: 12.48, work: 8.57, confidence: 85.0, ratio: 29.1 },
    { name: '품질운영센터', count: 4403, avg: 2.18, std: 1.48, min: 0.50, max: 9.97, work: 9.64, confidence: 80.1, ratio: 24.0 },
    { name: '오퍼레이션센터', count: 9342, avg: 2.13, std: 1.53, min: 0.50, max: 13.68, work: 10.01, confidence: 79.2, ratio: 22.8 },
    { name: '경영지원센터', count: 1161, avg: 1.93, std: 1.25, min: 0.50, max: 10.25, work: 9.16, confidence: 80.9, ratio: 22.1 },
    { name: '바이오연구소', count: 331, avg: 1.84, std: 1.34, min: 0.50, max: 8.30, work: 8.71, confidence: 69.1, ratio: 22.1 },
    { name: '영업센터', count: 417, avg: 1.73, std: 1.22, min: 0.50, max: 9.22, work: 8.92, confidence: 72.9, ratio: 20.1 },
    { name: '경영진단팀', count: 14, avg: 1.72, std: 1.02, min: 0.73, max: 4.27, work: 8.97, confidence: 69.4, ratio: 20.2 }
  ];

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold">센터별 집중 근무시간 상세 분석</h2>
        <p className="text-sm text-gray-600 mt-1">집중 근무시간이 30분 이상인 데이터만 분석</p>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">센터</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">데이터 수</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">평균 집중시간</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">표준편차</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">최소</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">최대</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">평균 근무시간</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">데이터 신뢰도</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">집중률</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {centerData.map((center, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{center.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">{center.count.toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">{center.avg}h</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">±{center.std}h</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">{center.min}h</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">{center.max}h</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">{center.work}h</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      <span className={`inline-flex px-2 text-xs leading-5 font-semibold rounded-full ${
                        center.confidence >= 80 ? 'bg-green-100 text-green-800' : 
                        center.confidence >= 70 ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'
                      }`}>
                        {center.confidence}%
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      <span className={`font-semibold ${
                        center.ratio >= 25 ? 'text-green-600' : 
                        center.ratio >= 20 ? 'text-yellow-600' : 
                        'text-red-600'
                      }`}>
                        {center.ratio}%
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