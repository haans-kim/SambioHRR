'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import useAppStore from '@/stores/useAppStore'

interface SearchRecord {
  employeeId: number
  employeeName: string
  date: string
  timestamp: number
}

interface EmployeeInfo {
  EMP_NO: number
  EMP_NAME: string
  부서명: string
  조직: string
}

export default function RecentSearches() {
  const [recentSearches, setRecentSearches] = useState<SearchRecord[]>([])
  const { setEmployee, setDate, selectedEmployee, selectedDate } = useAppStore()
  
  console.log('RecentSearches render, searches:', recentSearches.length)

  // Fetch employee info when selected
  const { data: employeeInfo } = useQuery<EmployeeInfo>({
    queryKey: ['employee', selectedEmployee],
    queryFn: async () => {
      if (!selectedEmployee) return null
      const res = await fetch(`/api/employee/${selectedEmployee.employee_id}`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!selectedEmployee
  })

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('recentSearches')
    if (stored) {
      try {
        const searches = JSON.parse(stored) as SearchRecord[]
        setRecentSearches(searches)
      } catch (e) {
        console.error('Failed to parse recent searches:', e)
      }
    }
  }, [])

  // Save to localStorage when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      const dateStr = selectedDate.toISOString().split('T')[0]
      const newSearch: SearchRecord = {
        employeeId: selectedEmployee.employee_id,
        employeeName: selectedEmployee.name || employeeInfo?.EMP_NAME || `사원 ${selectedEmployee.employee_id}`,
        date: dateStr,
        timestamp: Date.now()
      }

      setRecentSearches(prev => {
        // Remove duplicate if exists
        const filtered = prev.filter(
          s => !(s.employeeId === selectedEmployee.employee_id && s.date === dateStr)
        )
        // Add new search at the beginning
        const updated = [newSearch, ...filtered].slice(0, 10)
        // Save to localStorage
        localStorage.setItem('recentSearches', JSON.stringify(updated))
        return updated
      })
    }
  }, [selectedEmployee, employeeInfo, selectedDate])

  const handleSelectSearch = async (search: SearchRecord) => {
    // Fetch employee data first
    try {
      const res = await fetch(`/api/employees/${search.employeeId}`)
      if (res.ok) {
        const employee = await res.json()
        setEmployee(employee)
        setDate(new Date(search.date))
      }
    } catch (error) {
      console.error('Error fetching employee:', error)
    }
  }

  const handleClearHistory = () => {
    setRecentSearches([])
    localStorage.removeItem('recentSearches')
  }

  // Always show the component, even if empty
  // if (recentSearches.length === 0) {
  //   return null
  // }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-gray-900">최근 조회 기록</h3>
          <button
            onClick={handleClearHistory}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            기록 삭제
          </button>
        </div>
      </div>
      <div className="p-2">
        {recentSearches.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            조회 기록이 없습니다
          </div>
        ) : (
          recentSearches.map((search, idx) => (
          <button
            key={`${search.employeeId}-${search.date}-${idx}`}
            onClick={() => handleSelectSearch(search)}
            className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-gray-50 transition-colors ${
              selectedEmployee?.employee_id === search.employeeId && 
              selectedDate.toISOString().split('T')[0] === search.date
                ? 'bg-blue-50 hover:bg-blue-100'
                : ''
            }`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-900">{search.employeeName}</span>
                <span className="text-xs text-gray-500">({search.employeeId})</span>
              </div>
              <span className="text-xs text-gray-400">{search.date}</span>
            </div>
          </button>
        ))
        )}
      </div>
    </div>
  )
}