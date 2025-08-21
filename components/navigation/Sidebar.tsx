"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useDevMode } from "@/contexts/DevModeContext";

export function Sidebar() {
  const pathname = usePathname();
  const { isDevMode, setDevMode } = useDevMode();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");

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
      name: "근무 불균형", 
      href: "/enterprise", 
      description: "팀별 편차 모니터링"
    },
    { 
      name: "근무 패턴분석", 
      href: "/insight2", 
      description: "팀별 근무 패턴 클러스터링"
    }
  ];

  return (
    <div className="w-56 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 overflow-y-auto">
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
      <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-gray-50">
        {/* Developer Mode Toggle */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">개발자 모드</span>
            <button
              onClick={() => {
                if (isDevMode) {
                  // Turn off dev mode
                  setDevMode(false);
                } else {
                  // Show password dialog to turn on
                  setShowPasswordDialog(true);
                  setPassword("");
                }
              }}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                isDevMode ? "bg-blue-600" : "bg-gray-300"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  isDevMode ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>
        
        <div className="p-4">
          <div className="text-sm text-gray-500">
            <div>데이터 기준: 2025.06.01~30</div>
            <div className="mt-1">30일 집계 분석</div>
          </div>
        </div>
      </div>

      {/* Password Dialog */}
      {showPasswordDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80">
            <h3 className="text-lg font-semibold mb-4">개발자 모드 활성화</h3>
            <p className="text-sm text-gray-600 mb-4">
              개발자 모드를 활성화하려면 패스워드를 입력하세요.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (password === "0000") {
                    setDevMode(true);
                    setShowPasswordDialog(false);
                    setPassword("");
                  } else {
                    alert("패스워드가 일치하지 않습니다.");
                    setPassword("");
                  }
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="패스워드 입력"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  if (password === "0000") {
                    setDevMode(true);
                    setShowPasswordDialog(false);
                    setPassword("");
                  } else {
                    alert("패스워드가 일치하지 않습니다.");
                    setPassword("");
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                확인
              </button>
              <button
                onClick={() => {
                  setShowPasswordDialog(false);
                  setPassword("");
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}