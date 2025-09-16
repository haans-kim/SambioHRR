"use client";

import React from "react";
import { Users, Clock, Activity } from "lucide-react";

interface TrendMetricCardsProps {
  summary: {
    totalEmployees: number;
    avgWeeklyClaimedHours: number;
    avgWeeklyAdjustedHours: number;
    efficiency: number;
  };
}

export function TrendMetricCards({ summary }: TrendMetricCardsProps) {
  const cards = [
    {
      title: "전체 인원",
      value: summary.totalEmployees.toLocaleString(),
      unit: "명",
      icon: Users,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
      description: "평균 인원수"
    },
    {
      title: "주간 근태시간",
      value: summary.avgWeeklyClaimedHours.toFixed(1),
      unit: "시간",
      icon: Clock,
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
      description: "레벨 평균"
    },
    {
      title: "주간 근무추정시간",
      value: summary.avgWeeklyAdjustedHours.toFixed(1),
      unit: "시간",
      icon: Activity,
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
      description: "AI 보정 포함"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <div className="mt-2 flex items-baseline">
                  <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                  <p className="ml-1 text-lg text-gray-500">{card.unit}</p>
                </div>
                <p className="mt-1 text-xs text-gray-500">{card.description}</p>
              </div>
              <div className={cn("p-3 rounded-lg", card.bgColor)}>
                <Icon className={cn("h-6 w-6", card.iconColor)} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}