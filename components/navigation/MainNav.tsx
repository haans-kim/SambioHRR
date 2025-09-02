'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { 
  User, 
  Users, 
  FileSpreadsheet,
  Code,
  ChevronRight
} from 'lucide-react'

const devMenuItems = [
  { name: '개인분석', href: '/individual', icon: User },
  { name: '조직분석', href: '/organization', icon: Users },
  { name: 'Excel 업로드', href: '/excel-upload', icon: FileSpreadsheet },
]

export function MainNav() {
  const pathname = usePathname()
  const [isDevMode, setIsDevMode] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <>
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">SambioHRR</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => setIsDevMode(!isDevMode)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  isDevMode
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                <Code className="w-4 h-4 inline mr-1" />
                개발자 모드
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar - Only shown in dev mode */}
      {isDevMode && (
        <>
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="fixed left-0 top-20 z-40 bg-white border border-l-0 border-gray-200 rounded-r-md px-2 py-4 shadow-md hover:bg-gray-50"
          >
            <ChevronRight className={cn(
              "w-5 h-5 text-gray-600 transition-transform",
              isSidebarOpen && "rotate-180"
            )} />
          </button>

          {/* Sidebar */}
          <div className={cn(
            "fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 shadow-lg transition-transform z-30",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}>
            <div className="w-64 p-4">
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  개발자 메뉴
                </h3>
              </div>
              <nav className="space-y-1">
                {devMenuItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || 
                    (item.href !== '/' && pathname.startsWith(item.href))
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        isActive
                          ? "bg-blue-100 text-blue-700"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      )}
                    >
                      <Icon className="w-4 h-4 mr-3" />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </div>
        </>
      )}
    </>
  )
}