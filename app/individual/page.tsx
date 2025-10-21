'use client'

import { useState, useEffect } from 'react'
import useAppStore from '@/stores/useAppStore'
import MillerColumn from '@/components/organization/MillerColumn'
import MetricsDashboard from '@/components/metrics/MetricsDashboard'
import GanttChart from '@/components/timeline/GanttChart'
import TimelineTable from '@/components/timeline/TimelineTable'
import RecentSearches from '@/components/searches/RecentSearches'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Breadcrumb } from "@/components/navigation/Breadcrumb"

export default function IndividualAnalysisPage() {
  const { 
    selectedEmployee, 
    selectedDate,
    organizationPath,
    setEmployee,
    setDate
  } = useAppStore()
  
  const [employeeIdInput, setEmployeeIdInput] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  
  // Fetch available dates on mount
  useEffect(() => {
    fetch('/api/analysis/available-dates')
      .then(res => res.json())
      .then(data => {
        if (data.dates) {
          setAvailableDates(data.dates)
          // Set to latest date on first load
          if (data.latestDate) {
            setDate(new Date(data.latestDate + 'T00:00:00'))
          }
        }
      })
      .catch(err => console.error('Failed to fetch dates:', err))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Generate breadcrumb based on organization path
  const generateBreadcrumb = (): { label: string; href?: string }[] => {
    const breadcrumb: { label: string; href?: string }[] = [{ label: '센터', href: '/' }];
    
    if (organizationPath?.centerName) {
      breadcrumb.push({ 
        label: organizationPath.centerName, 
        href: `/teams?center=${organizationPath.center}` 
      });
    }
    
    if (organizationPath?.divisionName && organizationPath.divisionName !== '센터 직속') {
      breadcrumb.push({ 
        label: organizationPath.divisionName, 
        href: `/teams?division=${organizationPath.division}` 
      });
    }
    
    if (organizationPath?.teamName) {
      breadcrumb.push({ 
        label: organizationPath.teamName, 
        href: `/groups?team=${organizationPath.team}` 
      });
    }
    
    if (organizationPath?.groupName) {
      breadcrumb.push({ 
        label: organizationPath.groupName 
      });
    }
    
    if (selectedEmployee) {
      breadcrumb.push({ 
        label: `${selectedEmployee.name} (${selectedEmployee.employee_id})` 
      });
    }
    
    return breadcrumb;
  };

  const handleEmployeeSearch = async () => {
    if (!employeeIdInput) return
    
    setIsSearching(true)
    try {
      const response = await fetch(`/api/employees/${employeeIdInput}`)
      if (response.ok) {
        const employee = await response.json()
        setEmployee(employee)
        // Add to recent searches
        const recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]')
        const newSearch = {
          employeeId: employee.employee_id,
          name: employee.name,
          department: employee.department,
          position: employee.position,
          timestamp: new Date().toISOString()
        }
        const filtered = recentSearches.filter((s: any) => s.employeeId !== employee.employee_id)
        localStorage.setItem('recentSearches', JSON.stringify([newSearch, ...filtered].slice(0, 10)))
        window.dispatchEvent(new Event('storage'))
      } else {
        alert('해당 사번의 직원을 찾을 수 없습니다.')
      }
    } catch (error) {
      console.error('Error searching employee:', error)
      alert('직원 검색 중 오류가 발생했습니다.')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              개인 근무 분석
            </h1>
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:border-gray-400">
                  <span className="text-sm font-medium text-gray-700">
                    {format(selectedDate, 'yyyy. MM. dd.')}
                  </span>
                  <CalendarIcon className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="[&_.rdp]:p-4 [&_[data-slot=calendar]]:[--cell-size:3rem]">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setDate(date)}
                    disabled={(date) => {
                      const dateStr = date.toISOString().split('T')[0]
                      return !availableDates.includes(dateStr)
                    }}
                    defaultMonth={selectedDate}
                    locale={ko}
                    initialFocus
                    className="[&_button]:text-base [&_.rdp-weekday]:text-sm"
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Breadcrumb */}
          {(organizationPath?.centerName || selectedEmployee) && (
            <div className="pb-4">
              <Breadcrumb items={generateBreadcrumb()} />
            </div>
          )}
        </div>
      </header>

      {/* Main Content with Sidebar */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-6">
          {/* Main Content Area */}
          <main className="flex-1 space-y-6">
            {/* Organization Browser - Full Width */}
            <div className="bg-white rounded-lg border border-gray-500 shadow-sm p-4">
              <h2 className="text-lg font-medium text-gray-900 mb-4">직원 선택</h2>
              
              {/* Employee ID Search */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="사번 입력 (예: 20210871)"
                    value={employeeIdInput}
                    onChange={(e) => setEmployeeIdInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleEmployeeSearch()
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                  <button
                    onClick={handleEmployeeSearch}
                    disabled={!employeeIdInput || isSearching}
                    className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 ${
                      !employeeIdInput || isSearching
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {isSearching ? '검색 중...' : '검색'}
                  </button>
                </div>
                {selectedEmployee && (
                  <div className="mt-2 text-sm text-gray-600">
                    현재 선택: {selectedEmployee.name} ({selectedEmployee.employee_id})
                  </div>
                )}
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">또는 조직에서 선택</span>
                </div>
              </div>
              
              <div className="mt-4">
                <MillerColumn />
              </div>
            </div>

            {/* Work Metrics - Full Width */}
            <div className="bg-white rounded-lg border border-gray-500 shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">근무 지표</h2>
              <MetricsDashboard />
            </div>

            {/* Gantt Chart - Full Width */}
            <GanttChart className="bg-white rounded-lg border border-gray-500 shadow-sm p-6" />

            {/* Timeline - Full Width */}
            <div className="bg-white rounded-lg border border-gray-500 shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">타임라인</h2>
              <TimelineTable />
            </div>
          </main>

          {/* Right Sidebar - Recent Searches */}
          <aside className="w-80 flex-shrink-0">
            <RecentSearches />
          </aside>
        </div>
      </div>
    </div>
  )
}