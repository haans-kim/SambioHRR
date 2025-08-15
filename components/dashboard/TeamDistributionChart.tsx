'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TeamData {
  team_id: string;
  team_name: string;
  center_name: string;
  headcount: number;
  avg_work_hours: number;
  efficiency_rate: number;
  std_dev_hours: number;
  cv_percentage: number;
  balance_status: 'balanced' | 'moderate' | 'imbalanced';
}

interface TeamDistributionChartProps {
  centerId?: string;
  onTeamClick?: (teamId: string) => void;
}

export default function TeamDistributionChart({ 
  centerId, 
  onTeamClick 
}: TeamDistributionChartProps) {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<'stdDev' | 'efficiency'>('stdDev');
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchTeamData();
  }, [centerId]);

  useEffect(() => {
    if (teams.length > 0) {
      drawBubbleChart();
    }
  }, [teams, selectedMetric, hoveredTeam]);

  const fetchTeamData = async () => {
    try {
      const url = centerId 
        ? `/api/teams/distribution?centerId=${centerId}`
        : '/api/teams/distribution';
      const response = await fetch(url);
      const data = await response.json();
      setTeams(data.teams || []);
    } catch (error) {
      console.error('Failed to fetch team data:', error);
    }
  };

  const drawBubbleChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas 크기 설정
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 차트 영역 설정 (여백 증가)
    const padding = { left: 80, right: 180, top: 40, bottom: 70 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    // 축 그리기
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // X축
    ctx.beginPath();
    ctx.moveTo(padding.left, rect.height - padding.bottom);
    ctx.lineTo(rect.width - padding.right, rect.height - padding.bottom);
    ctx.stroke();
    
    // Y축
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, rect.height - padding.bottom);
    ctx.stroke();

    // 데이터 범위 계산 (고정 범위 사용)
    const maxHours = 12; // 최대 12시간
    const minHours = 4; // 최소 4시간
    const maxEfficiency = 100; // 최대 100%
    const minEfficiency = 40; // 최소 40%
    const maxHeadcount = Math.max(...teams.map(t => t.headcount));

    // 격자선 그리기
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 0.5;
    
    // X축 격자선 (효율성 10% 단위)
    for (let i = 0; i <= 6; i++) {
      const x = padding.left + (i / 6) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, rect.height - padding.bottom);
      ctx.stroke();
      
      // X축 값 표시 (40%부터 100%까지 10%씩)
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      const value = 40 + i * 10;
      ctx.fillText(value + '%', x, rect.height - padding.bottom + 15);
    }
    
    // Y축 격자선 (시간 단위)
    for (let i = 0; i <= 4; i++) {
      const y = rect.height - padding.bottom - (i / 4) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(rect.width - padding.right, y);
      ctx.stroke();
      
      // Y축 값 표시 (4시간부터 12시간까지 2시간씩)
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      const value = 4 + i * 2;
      ctx.fillText(value + 'h', padding.left - 5, y + 3);
    }

    // 축 레이블
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 12px sans-serif';
    
    // X축 레이블 (효율성)
    ctx.textAlign = 'center';
    ctx.fillText('효율성 (%)', rect.width / 2, rect.height - 20);
    
    // Y축 레이블 (근무시간)
    ctx.save();
    ctx.translate(20, rect.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('평균 근무시간 (시간)', 0, 0);
    ctx.restore();

    // 버블 그리기
    teams.forEach((team) => {
      const x = padding.left + ((team.efficiency_rate - minEfficiency) / (maxEfficiency - minEfficiency)) * chartWidth;
      const y = rect.height - padding.bottom - ((team.avg_work_hours - minHours) / (maxHours - minHours)) * chartHeight;
      
      // 버블 크기 (인원수 기반, 크기 조정)
      const radius = 8 + (team.headcount / maxHeadcount) * 30;
      
      // 색상 결정 (표준편차 또는 효율성 기반)
      let color: string;
      if (selectedMetric === 'stdDev') {
        if (team.cv_percentage < 15) {
          color = 'rgba(34, 197, 94, 0.6)'; // green
        } else if (team.cv_percentage < 25) {
          color = 'rgba(251, 191, 36, 0.6)'; // yellow
        } else {
          color = 'rgba(239, 68, 68, 0.6)'; // red
        }
      } else {
        if (team.efficiency_rate > 80) {
          color = 'rgba(34, 197, 94, 0.6)'; // green
        } else if (team.efficiency_rate > 60) {
          color = 'rgba(251, 191, 36, 0.6)'; // yellow
        } else {
          color = 'rgba(239, 68, 68, 0.6)'; // red
        }
      }

      // 호버 효과
      if (hoveredTeam === team.team_id) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      // 버블 그리기
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = color.replace('0.6', '1');
      ctx.lineWidth = 2;
      ctx.stroke();

      // 그림자 제거
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // 팀 이름 표시 (큰 버블만)
      if (radius > 20) {
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(team.team_name.substring(0, 10), x, y);
        
        ctx.font = '10px sans-serif';
        ctx.fillText(`${team.headcount}명`, x, y + 12);
      }
    });

    // 범례 그리기
    const legendX = rect.width - padding.right + 20;
    const legendY = padding.top;
    
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(selectedMetric === 'stdDev' ? '업무 균형도' : '효율성', legendX, legendY);
    
    const colors = [
      { color: 'rgba(34, 197, 94, 0.6)', label: selectedMetric === 'stdDev' ? '균형' : '높음' },
      { color: 'rgba(251, 191, 36, 0.6)', label: '보통' },
      { color: 'rgba(239, 68, 68, 0.6)', label: selectedMetric === 'stdDev' ? '불균형' : '낮음' }
    ];
    
    colors.forEach((item, index) => {
      ctx.beginPath();
      ctx.arc(legendX + 10, legendY + 25 + index * 20, 6, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();
      
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, legendX + 20, legendY + 29 + index * 20);
    });

    // 버블 크기 범례
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('인원수', legendX, legendY + 100);
    
    const sizeExamples = [
      { size: 8, label: '소' },
      { size: 15, label: '중' },
      { size: 25, label: '대' }
    ];
    
    sizeExamples.forEach((item, index) => {
      ctx.beginPath();
      ctx.arc(legendX + 10, legendY + 125 + index * 30, item.size / 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#9ca3af';
      ctx.stroke();
      
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.fillText(item.label, legendX + 20, legendY + 128 + index * 30);
    });
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 차트 영역 설정
    const padding = { left: 80, right: 180, top: 40, bottom: 70 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    // 클릭된 팀 찾기
    const maxHours = 12;
    const minHours = 4;
    const maxEfficiency = 100;
    const minEfficiency = 40;
    const maxHeadcount = Math.max(...teams.map(t => t.headcount));

    teams.forEach((team) => {
      const bubbleX = padding.left + ((team.efficiency_rate - minEfficiency) / (maxEfficiency - minEfficiency)) * chartWidth;
      const bubbleY = rect.height - padding.bottom - ((team.avg_work_hours - minHours) / (maxHours - minHours)) * chartHeight;
      const radius = 8 + (team.headcount / maxHeadcount) * 30;

      const distance = Math.sqrt(Math.pow(x - bubbleX, 2) + Math.pow(y - bubbleY, 2));
      if (distance <= radius) {
        if (onTeamClick) {
          onTeamClick(team.team_id);
        }
      }
    });
  };

  const handleCanvasHover = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 차트 영역 설정
    const padding = { left: 80, right: 180, top: 40, bottom: 70 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    // 호버된 팀 찾기
    const maxHours = 12;
    const minHours = 4;
    const maxEfficiency = 100;
    const minEfficiency = 40;
    const maxHeadcount = Math.max(...teams.map(t => t.headcount));

    let foundTeam = null;
    teams.forEach((team) => {
      const bubbleX = padding.left + ((team.efficiency_rate - minEfficiency) / (maxEfficiency - minEfficiency)) * chartWidth;
      const bubbleY = rect.height - padding.bottom - ((team.avg_work_hours - minHours) / (maxHours - minHours)) * chartHeight;
      const radius = 8 + (team.headcount / maxHeadcount) * 30;

      const distance = Math.sqrt(Math.pow(x - bubbleX, 2) + Math.pow(y - bubbleY, 2));
      if (distance <= radius) {
        foundTeam = team.team_id;
      }
    });

    if (foundTeam !== hoveredTeam) {
      setHoveredTeam(foundTeam);
      canvas.style.cursor = foundTeam ? 'pointer' : 'default';
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>팀별 분포도</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              버블 크기: 인원수 | 색상: {selectedMetric === 'stdDev' ? '업무 균형도' : '효율성'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={selectedMetric === 'stdDev' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMetric('stdDev')}
            >
              균형도 기준
            </Button>
            <Button
              variant={selectedMetric === 'efficiency' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMetric('efficiency')}
            >
              효율성 기준
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full h-[500px]"
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasHover}
            onMouseLeave={() => setHoveredTeam(null)}
          />
          
          {/* 호버 툴팁 */}
          {hoveredTeam && (
            <TooltipProvider>
              <Tooltip open={true}>
                <TooltipTrigger asChild>
                  <div className="absolute top-0 left-0 w-0 h-0" />
                </TooltipTrigger>
                <TooltipContent>
                  {(() => {
                    const team = teams.find(t => t.team_id === hoveredTeam);
                    if (!team) return null;
                    return (
                      <div className="p-2">
                        <p className="font-semibold">{team.team_name}</p>
                        <p className="text-sm">센터: {team.center_name}</p>
                        <p className="text-sm">인원: {team.headcount}명</p>
                        <p className="text-sm">평균 근무: {team.avg_work_hours}시간</p>
                        <p className="text-sm">효율성: {team.efficiency_rate}%</p>
                        <p className="text-sm">변동계수: {team.cv_percentage}%</p>
                        <Badge variant={
                          team.balance_status === 'balanced' ? 'default' :
                          team.balance_status === 'moderate' ? 'secondary' :
                          'destructive'
                        } className="mt-1">
                          {team.balance_status === 'balanced' ? '균형' :
                           team.balance_status === 'moderate' ? '주의' : '불균형'}
                        </Badge>
                      </div>
                    );
                  })()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* 사분면 설명 */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="p-3 border rounded-lg bg-green-50">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium">최적 구간</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              효율성 70% 이상, 근무시간 7-9시간
            </p>
          </div>
          <div className="p-3 border rounded-lg bg-blue-50">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium">효율적 구간</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              효율성 높음, 근무시간 적정
            </p>
          </div>
          <div className="p-3 border rounded-lg bg-yellow-50">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-sm font-medium">개선 필요</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              효율성 60% 미만 또는 과도한 근무
            </p>
          </div>
          <div className="p-3 border rounded-lg bg-red-50">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm font-medium">즉시 조치</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              효율성 50% 미만 또는 10시간 초과
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}