'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Database, Upload, Calendar, Hash, ExternalLink, AlertCircle } from 'lucide-react';

interface DataType {
  id: string;
  label: string;
  description: string;
  priority: string;
  file_pattern: string;
  sample_columns: string[];
}

interface DataStats {
  data_type: string;
  table_name: string;
  row_count: number;
  date_range: { min: string; max: string } | null;
}

export default function DataUploadPage() {
  const [dataTypes, setDataTypes] = useState<DataType[]>([]);
  const [dataStats, setDataStats] = useState<DataStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load available data types from JSON
  useEffect(() => {
    const loadDataTypes = async () => {
      try {
        const response = await fetch('/data-types.json');
        const data = await response.json();
        setDataTypes(data.data_types || []);
      } catch (err) {
        console.error('Failed to load data types:', err);
      }
    };
    loadDataTypes();
  }, []);

  // Load database statistics
  useEffect(() => {
    const loadDataStats = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/data-stats');
        const data = await res.json();
        setDataStats(data.stats || []);
      } catch (err) {
        console.error('Failed to load stats:', err);
        setError('데이터 통계를 불러오는데 실패했습니다');
      } finally {
        setLoading(false);
      }
    };
    loadDataStats();
  }, []);

  const handleOpenUploadApp = () => {
    // Open Python Streamlit app in new window
    window.open('http://localhost:8501', '_blank');
  };

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Excel 데이터 업로드</h1>
          <p className="text-muted-foreground mt-2">
            sambio_human.db 데이터 현황 및 업로드
          </p>
        </div>

        <Button
          onClick={handleOpenUploadApp}
          size="lg"
          className="bg-black hover:bg-gray-800 text-white"
        >
          <Upload className="h-4 w-4 mr-2" />
          Excel 데이터 업로드
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Database Tables List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            데이터베이스 현황
          </CardTitle>
          <CardDescription>
            sambio_human.db에 저장된 데이터의 현재 상태를 확인할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              데이터 로딩 중...
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full table-fixed">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="text-center p-3 font-medium text-base w-[22%]">데이터 유형</th>
                    <th className="text-center p-3 font-medium text-base w-[20%]">테이블명</th>
                    <th className="text-center p-3 font-medium text-base w-[23%]">데이터 기간</th>
                    <th className="text-center p-3 font-medium text-base w-[15%]">마지막 업로드</th>
                    <th className="text-right p-3 pr-8 font-medium text-base w-[20%]">데이터 수</th>
                  </tr>
                </thead>
                <tbody>
                  {dataTypes.map((dataType) => {
                    const stats = dataStats.find(s => s.data_type === dataType.id);

                    return (
                      <tr
                        key={dataType.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3 text-center">
                          <div className="font-medium text-base">{dataType.label}</div>
                        </td>
                        <td className="p-3 text-center">
                          <code className="text-base bg-muted px-2 py-1 rounded">
                            {stats?.table_name || '-'}
                          </code>
                        </td>
                        <td className="p-3">
                          {stats?.date_range ? (
                            <div className="flex items-center gap-1 text-base justify-center">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-mono">
                                {stats.date_range.min} ~ {stats.date_range.max}
                              </span>
                            </div>
                          ) : (
                            <span className="text-base text-muted-foreground text-center block">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-base text-muted-foreground">
                            {stats?.date_range?.max || '-'}
                          </span>
                        </td>
                        <td className="p-3 pr-8 text-right">
                          <span className="font-mono text-base">
                            {stats ? stats.row_count.toLocaleString() : '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>업로드 방법</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>위의 "Excel 데이터 업로드" 버튼을 클릭하면 업로드 앱이 새 창에서 열립니다</li>
            <li>업로드 앱에서 데이터 타입을 선택하고 Excel 파일을 업로드하세요</li>
            <li>업로드가 완료되면 이 페이지를 새로고침하여 업데이트된 현황을 확인하세요</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
