import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import db from '@/lib/db/client';

interface FocusedWorkTableProps {
  visible: boolean;
}

// 30일 집계 데이터를 가져오는 함수
function getCenterFocusedWorkData() {
  const dateRange = db.prepare(`
    SELECT 
      date(MAX(analysis_date), '-30 days') as startDate, 
      MAX(analysis_date) as endDate 
    FROM daily_analysis_results
  `).get() as any;
  
  const startDate = dateRange?.startDate || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
  const endDate = dateRange?.endDate || new Date().toISOString().split('T')[0];
  
  // 센터별 집중 근무시간 통계 (30분 이상인 데이터만)
  const centerData = db.prepare(`
    SELECT 
      e.center_name as name,
      COUNT(DISTINCT dar.employee_id) as unique_employees,
      COUNT(*) as count,
      ROUND(AVG(dar.focused_work_minutes / 60.0), 2) as avg,
      ROUND(STDDEV(dar.focused_work_minutes / 60.0), 2) as std,
      ROUND(MIN(dar.focused_work_minutes / 60.0), 2) as min,
      ROUND(MAX(dar.focused_work_minutes / 60.0), 2) as max,
      ROUND(AVG(dar.actual_work_hours), 2) as work,
      ROUND(AVG(dar.confidence_score), 1) as confidence,
      ROUND((AVG(dar.focused_work_minutes / 60.0) / AVG(dar.actual_work_hours)) * 100, 1) as ratio
    FROM daily_analysis_results dar
    JOIN employees e ON e.employee_id = dar.employee_id
    WHERE dar.analysis_date BETWEEN ? AND ?
      AND dar.focused_work_minutes >= 30  -- 30분 이상만 분석
      AND e.center_name IS NOT NULL
      AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
    GROUP BY e.center_name
    ORDER BY avg DESC
  `).all(startDate, endDate) as any[];
  
  return centerData.map(center => ({
    name: center.name,
    count: center.count || 0,
    avg: center.avg || 0,
    std: center.std || 0,
    min: center.min || 0,
    max: center.max || 0,
    work: center.work || 0,
    confidence: center.confidence || 0,
    ratio: center.ratio || 0
  }));
}

export function FocusedWorkTable({ visible }: FocusedWorkTableProps) {
  if (!visible) return null;
  
  const centerData = getCenterFocusedWorkData();
  
  // 데이터가 없는 경우 처리
  if (!centerData || centerData.length === 0) {
    return (
      <div className="mt-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold">센터별 집중 근무시간 상세 분석</h2>
          <p className="text-sm text-gray-600 mt-1">집중 근무시간이 30분 이상인 데이터만 분석</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-gray-500">데이터가 없습니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold">센터별 집중 근무시간 상세 분석</h2>
        <p className="text-sm text-gray-600 mt-1">집중 근무시간이 30분 이상인 데이터만 분석 (최근 30일)</p>
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
              집중률은 전체 근무시간 대비 집중 근무시간의 비율을 나타냅니다. 최근 30일간의 데이터를 기준으로 합니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}