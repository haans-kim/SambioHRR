'use client'

import { useQuery } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarIcon } from 'lucide-react'

interface DateSelectorProps {
  value: Date
  onChange: (date: Date) => void
}

export default function DateSelector({ value, onChange }: DateSelectorProps) {
  // Fetch available dates
  const { data, isLoading } = useQuery({
    queryKey: ['available-dates'],
    queryFn: async () => {
      const res = await fetch('/api/analysis/available-dates')
      if (!res.ok) throw new Error('Failed to fetch dates')
      return res.json()
    }
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
    return `${year}.${month}.${day} (${weekday})`
  }

  const selectedValue = value.toISOString().split('T')[0]

  return (
    <div className="flex items-center gap-2">
      <CalendarIcon className="w-4 h-4 text-gray-500" />
      <Select
        value={selectedValue}
        onValueChange={(val) => onChange(new Date(val + 'T00:00:00'))}
        disabled={isLoading}
      >
        <SelectTrigger className="w-[180px] h-9 text-sm">
          <SelectValue placeholder={isLoading ? "로딩 중..." : "날짜 선택"}>
            {selectedValue && formatDate(selectedValue)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {data?.dates?.map((date: string) => (
            <SelectItem key={date} value={date}>
              {formatDate(date)}
            </SelectItem>
          ))}
          {!data?.dates?.length && !isLoading && (
            <div className="px-2 py-1 text-sm text-gray-500">
              사용 가능한 날짜가 없습니다
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}