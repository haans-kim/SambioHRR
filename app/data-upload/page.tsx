'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Database, Server, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

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

interface ServerStatus {
  status: 'stopped' | 'running' | 'unhealthy';
  port: number | null;
}

export default function DataUploadPage() {
  const [serverStatus, setServerStatus] = useState<ServerStatus>({ status: 'stopped', port: null });
  const [dataTypes, setDataTypes] = useState<DataType[]>([]);
  const [dataStats, setDataStats] = useState<DataStats[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Check server status
  const checkServerStatus = async () => {
    try {
      const res = await fetch('/api/upload-server/control');
      const data = await res.json();
      setServerStatus(data);
    } catch (err) {
      setServerStatus({ status: 'stopped', port: null });
    }
  };

  // Start server
  const startServer = async () => {
    try {
      setError(null);
      const res = await fetch('/api/upload-server/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      });
      const data = await res.json();

      if (data.success) {
        setServerStatus({ status: 'running', port: data.port });
        // Load data types and stats
        await loadDataTypes();
        await loadDataStats();
      } else {
        setError(data.message || 'Failed to start server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start server');
    }
  };

  // Load available data types
  const loadDataTypes = async () => {
    try {
      const res = await fetch('/api/upload/data-types');
      const data = await res.json();
      setDataTypes(data.data_types || []);
    } catch (err) {
      console.error('Failed to load data types:', err);
    }
  };

  // Load database statistics
  const loadDataStats = async () => {
    try {
      const res = await fetch('/api/upload/stats');
      const data = await res.json();
      setDataStats(data.stats || []);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile || !selectedType) {
      setError('Please select a data type and file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadMessage('Uploading file...');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch(`/api/upload/${selectedType}`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setUploadProgress(100);
        setUploadMessage(`Successfully uploaded ${data.rows_inserted?.toLocaleString()} rows`);
        setSelectedFile(null);
        // Refresh stats
        await loadDataStats();
      } else {
        setError(data.detail || data.message || 'Upload failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Get stats for selected type
  const selectedTypeStats = dataStats.find(s => s.data_type === selectedType);

  // Initial load
  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Excel 데이터 업로드</h1>
          <p className="text-muted-foreground mt-2">
            sambio_human.db로 Excel 파일 업로드
          </p>
        </div>

        {/* Server Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            <span className="text-sm font-medium">업로드 서버:</span>
            {serverStatus.status === 'running' ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                실행중
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                중지됨
              </Badge>
            )}
          </div>

          {serverStatus.status !== 'running' && (
            <Button onClick={startServer} size="sm" className="bg-black hover:bg-gray-800 text-white">
              <Server className="h-4 w-4 mr-2" />
              서버 시작
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {serverStatus.status === 'running' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Excel 파일 업로드</CardTitle>
                <CardDescription>
                  데이터 타입을 선택하고 Excel 파일을 업로드하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Data Type Selector */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    데이터 타입
                  </label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue placeholder="데이터 타입 선택..." />
                    </SelectTrigger>
                    <SelectContent>
                      {dataTypes.map((dt) => (
                        <SelectItem key={dt.id} value={dt.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{dt.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {dt.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* File Upload */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Excel 파일
                  </label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                      disabled={uploading || !selectedType}
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                      <span className="text-sm font-medium">
                        {selectedFile ? selectedFile.name : '클릭하거나 파일을 드래그하세요'}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        Excel 파일만 가능 (.xlsx, .xls)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Upload Button */}
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || !selectedType || uploading}
                  className="w-full"
                  size="lg"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      파일 업로드
                    </>
                  )}
                </Button>

                {/* Upload Progress */}
                {uploading && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} />
                    <p className="text-sm text-center text-muted-foreground">
                      {uploadMessage}
                    </p>
                  </div>
                )}

                {uploadProgress === 100 && !uploading && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-600">
                      {uploadMessage}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Database Status */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  데이터베이스 현황
                </CardTitle>
                <CardDescription>
                  sambio_human.db의 현재 데이터
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedTypeStats ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">테이블명</p>
                      <p className="text-lg font-mono">{selectedTypeStats.table_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">행 개수</p>
                      <p className="text-2xl font-bold">
                        {selectedTypeStats.row_count.toLocaleString()}
                      </p>
                    </div>
                    {selectedTypeStats.date_range && (
                      <div>
                        <p className="text-sm text-muted-foreground">날짜 범위</p>
                        <p className="text-sm font-mono">
                          {selectedTypeStats.date_range.min} ~ {selectedTypeStats.date_range.max}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    데이터 타입을 선택하면 통계를 확인할 수 있습니다
                  </p>
                )}
              </CardContent>
            </Card>

            {/* All Data Types Summary */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">전체 데이터 타입</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {dataStats.map((stat) => (
                    <div
                      key={stat.data_type}
                      className="flex justify-between items-center text-xs p-2 rounded hover:bg-accent cursor-pointer"
                      onClick={() => setSelectedType(stat.data_type)}
                    >
                      <span className="font-medium">{stat.data_type}</span>
                      <span className="text-muted-foreground">
                        {stat.row_count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">업로드 서버 오프라인</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Excel 파일 업로드를 시작하려면 서버를 실행하세요
            </p>
            <Button onClick={startServer} size="lg" className="bg-black hover:bg-gray-800 text-white">
              <Server className="h-4 w-4 mr-2" />
              업로드 서버 시작
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
