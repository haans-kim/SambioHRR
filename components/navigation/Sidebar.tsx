"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    { 
      name: "전체 개요", 
      href: "/", 
      description: "센터별 현황"
    },
    { 
      name: "팀별 분석", 
      href: "/teams", 
      description: "팀 단위 분석"
    },
    { 
      name: "그룹별 분석", 
      href: "/groups", 
      description: "그룹 단위 분석"
    },
    { 
      name: "업무 불균형", 
      href: "/enterprise", 
      description: "팀별 편차 모니터링"
    },
    { 
      name: "통계 분석", 
      href: "/statistics", 
      description: "표준편차 분석"
    },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 overflow-y-auto">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">HR Dashboard</h1>
        <p className="text-base text-gray-500 mt-1">업무 패턴 분석</p>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = item.href === "/" 
            ? pathname === "/" 
            : pathname.startsWith(item.href);
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "block px-4 py-3 rounded-lg text-base font-medium transition-all",
                isActive
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <div className="font-medium">{item.name}</div>
              <div className={cn(
                "text-sm mt-1",
                isActive ? "text-blue-600" : "text-gray-400"
              )}>
                {item.description}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-500">
          <div>데이터 기준: 2025.06.01~30</div>
          <div className="mt-1">30일 집계 분석</div>
        </div>
      </div>
    </div>
  );
}