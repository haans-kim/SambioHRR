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
    if (selectedEmployee && employeeInfo) {
      const dateStr = selectedDate.toISOString().split('T')[0]
      const newSearch: SearchRecord = {
        employeeId: selectedEmployee.employee_id,
        employeeName: employeeInfo.EMP_NAME,
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

  if (recentSearches.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-lg border border-gray-500 shadow-sm p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-700">최근 조회 기록</h3>
        <button
          onClick={handleClearHistory}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          기록 삭제
        </button>
      </div>
      <div className="space-y-1">
        {recentSearches.map((search, idx) => (
          <button
            key={`${search.employeeId}-${search.date}-${idx}`}
            onClick={() => handleSelectSearch(search)}
            className={`w-full text-left px-3 py-2 rounded hover:bg-gray-50 transition-colors ${
              selectedEmployee === search.employeeId && 
              selectedDate.toISOString().split('T')[0] === search.date
                ? 'bg-blue-50 border border-blue-200'
                : ''
            }`}
          >
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <span className="font-medium text-sm">{search.employeeName}</span>
                <span className="text-gray-500 text-xs ml-2">({search.employeeId})</span>
              </div>
              <span className="text-xs text-gray-600">{search.date}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}