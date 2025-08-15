'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Building2, 
  TrendingUp,
  BarChart3,
  Home
} from 'lucide-react';

export default function MainNav() {
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState<string>('');
  
  useEffect(() => {
    setCurrentTime(new Date().toLocaleString('ko-KR'));
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('ko-KR'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    {
      href: '/',
      label: '센터 뷰',
      icon: Home,
      description: '센터별 현황'
    },
    {
      href: '/enterprise',
      label: '전사 대시보드',
      icon: LayoutDashboard,
      description: '5,000명 전체 현황'
    },
    {
      href: '/statistics',
      label: '표준편차 분석',
      icon: BarChart3,
      description: '업무 균형도 분석'
    }
  ];

  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {/* 로고/타이틀 */}
            <div className="flex-shrink-0 flex items-center">
              <Building2 className="h-8 w-8 text-blue-600 mr-2" />
              <span className="text-xl font-bold">HR Dashboard</span>
            </div>

            {/* 네비게이션 메뉴 */}
            <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? 'default' : 'ghost'}
                      className="flex items-center space-x-2"
                    >
                      <Icon className="h-4 w-4" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className="text-xs text-gray-500">{item.description}</span>
                      </div>
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* 우측 정보 */}
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm font-medium">실시간 모니터링</div>
              <div className="text-xs text-gray-500">
                {currentTime}
              </div>
            </div>
          </div>
        </div>

        {/* 모바일 메뉴 */}
        <div className="sm:hidden flex space-x-2 pb-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <Button
                  variant={isActive ? 'default' : 'outline'}
                  className="w-full flex flex-col py-3"
                  size="sm"
                >
                  <Icon className="h-5 w-5 mb-1" />
                  <span className="text-xs">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}