"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Filter, X } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

interface EmployeeData {
  employeeId: string;
  name: string;
  centerName: string;
  teamName: string;
  groupName: string;
  jobGrade: string;
  jobTitle: string;
  efficiencyRatio: number;
  actualWorkHours: number;
  claimedWorkHours: number;
  totalActualHours: number;
  totalClaimedHours: number;
  workMinutes: number;
  meetingMinutes: number;
  mealMinutes: number;
  movementMinutes: number;
  restMinutes: number;
  confidenceScore: number;
  workDays: number;
  analysisDate: string;
}

interface GroupDetailData {
  group: {
    orgCode: string;
    orgName: string;
    parentTeam: string;
    parentTeamCode?: string;
    parentCenter: string;
    parentCenterCode?: string;
    parentDivision?: string | null;
    parentDivisionCode?: string | null;
  };
  employees: EmployeeData[];
  summary: {
    totalEmployees: number;
    avgEfficiency: number;
    avgWorkHours: number;
    avgClaimedHours: number;
    totalManDays: number;
  };
  analysisDate: string;
}

type SortField = 'employeeId' | 'name' | 'efficiencyRatio' | 'actualWorkHours' | 'claimedWorkHours' | 'confidenceScore';
type SortDirection = 'asc' | 'desc';

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params.id as string;
  
  const [data, setData] = useState<GroupDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('employeeId');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterText, setFilterText] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [efficiencyFilter, setEfficiencyFilter] = useState<{ min: number; max: number }>({ min: 0, max: 200 });
  const [workHoursFilter, setWorkHoursFilter] = useState<{ min: number; max: number }>({ min: 0, max: 24 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/group-detail/${groupId}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const groupData = await response.json();
        console.log('Fetched data for', groupId, ':', {
          totalEmployees: groupData.employees?.length,
          summary: groupData.summary,
          firstFew: groupData.employees?.slice(0, 3).map(e => ({
            id: e.employeeId,
            name: e.name,
            efficiency: e.efficiencyRatio
          }))
        });
        setData(groupData);
      } catch (error) {
        console.error('Failed to fetch group detail:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId]);

  // Sort and filter employees
  const processedEmployees = useMemo(() => {
    if (!data) return [];
    
    let filtered = data.employees;
    
    // Filter by search text
    if (filterText) {
      filtered = filtered.filter(emp => 
        emp.employeeId?.toLowerCase().includes(filterText.toLowerCase()) ||
        emp.name?.toLowerCase().includes(filterText.toLowerCase()) ||
        emp.jobGrade?.toLowerCase().includes(filterText.toLowerCase())
      );
    }
    
    // Filter by efficiency
    filtered = filtered.filter(emp => 
      emp.efficiencyRatio >= efficiencyFilter.min && 
      emp.efficiencyRatio <= efficiencyFilter.max
    );
    
    // Filter by work hours
    filtered = filtered.filter(emp => 
      emp.actualWorkHours >= workHoursFilter.min && 
      emp.actualWorkHours <= workHoursFilter.max
    );
    
    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (typeof aValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue as string)
          : (bValue as string).localeCompare(aValue);
      }
      
      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
    
    console.log('Final processed employees:', sorted.length);
    return sorted;
  }, [data, sortField, sortDirection, filterText, efficiencyFilter, workHoursFilter]);
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1 text-blue-600" />
      : <ArrowDown className="h-3 w-3 ml-1 text-blue-600" />;
  };
  
  const handleSelectAll = () => {
    if (selectedRows.size === processedEmployees.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(processedEmployees.map(emp => emp.employeeId)));
    }
  };
  
  const handleSelectRow = (employeeId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedRows(newSelected);
  };
  
  const exportToCSV = () => {
    const selectedEmployees = processedEmployees.filter(emp => selectedRows.has(emp.employeeId));
    const dataToExport = selectedEmployees.length > 0 ? selectedEmployees : processedEmployees;
    
    const headers = ['사번', '이름', '직급', '직책', '효율성(%)', '실제작업(h)', '근무시간(h)', '작업(분)', '회의(분)', '식사(분)', '이동(분)', '휴식(분)', '신뢰도', '분석일자'];
    const rows = dataToExport.map(emp => [
      emp.employeeId,
      emp.name || '-',
      emp.jobGrade || '-',
      emp.jobTitle || '-',
      emp.efficiencyRatio.toFixed(1),
      emp.actualWorkHours.toFixed(1),
      emp.claimedWorkHours.toFixed(1),
      emp.workMinutes.toFixed(0),
      emp.meetingMinutes.toFixed(0),
      emp.mealMinutes.toFixed(0),
      emp.movementMinutes.toFixed(0),
      emp.restMinutes.toFixed(0),
      emp.confidenceScore.toFixed(1),
      emp.analysisDate || '-'
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${data?.group.orgName}_직원데이터_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };
  
  const resetFilters = () => {
    setFilterText('');
    setEfficiencyFilter({ min: 0, max: 100 });
    setWorkHoursFilter({ min: 0, max: 24 });
  };

  // Build breadcrumb for DashboardLayout. Keep hook order consistent by declaring before returns
  const breadcrumb = useMemo(() => {
    if (!data) {
      return [{ label: '센터', href: '/' }];
    }
    const crumbs: { label: string; href?: string }[] = [{ label: '센터', href: '/' }];
    if (data.group.parentCenter && data.group.parentCenterCode) {
      crumbs.push({ label: data.group.parentCenter, href: `/division?center=${data.group.parentCenterCode}` });
    }
    if (data.group.parentDivision && data.group.parentDivisionCode) {
      crumbs.push({ label: data.group.parentDivision, href: `/teams?division=${data.group.parentDivisionCode}` });
    }
    if (data.group.parentTeam && data.group.parentTeamCode) {
      crumbs.push({ label: data.group.parentTeam, href: `/groups?team=${data.group.parentTeamCode}` });
    }
    crumbs.push({ label: data.group.orgName });
    return crumbs;
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-red-600">데이터를 불러올 수 없습니다.</div>
      </div>
    );
  }

  return (
    <DashboardLayout
      totalEmployees={data?.summary.totalEmployees || 0}
      avgEfficiency={data?.summary.avgEfficiency || 0}
      avgWorkHours={data?.summary.avgWorkHours || 0}
      avgClaimedHours={data?.summary.avgClaimedHours || 0}
      avgWeeklyWorkHours={(data?.summary.avgWorkHours || 0) * 5}
      avgWeeklyClaimedHours={(data?.summary.avgClaimedHours || 0) * 5}
      selectedMetric={'efficiency'}
      breadcrumb={breadcrumb}
    >
      {/* 제목/요약 */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.group.orgName}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {data.group.parentCenter}
            {data.group.parentDivision ? ` / ${data.group.parentDivision}` : ''}
            {` / ${data.group.parentTeam}`}
          </p>
          <p className="text-xs text-gray-500 mt-1">분석일자: {data.analysisDate || '최신 데이터'}</p>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-gray-500">총 인원:</span>
            <span className="ml-2 font-semibold">{data.summary.totalEmployees}명</span>
          </div>
          <div>
            <span className="text-gray-500">총 Man-day:</span>
            <span className="ml-2 font-semibold">{data.summary.totalManDays || 0}일</span>
          </div>
          <div>
            <span className="text-gray-500">평균 효율성:</span>
            <span className="ml-2 font-semibold">{data.summary.avgEfficiency.toFixed(1)}%</span>
          </div>
          <div>
            <span className="text-gray-500">평균 작업시간:</span>
            <span className="ml-2 font-semibold">{data.summary.avgWorkHours.toFixed(1)}h/일</span>
          </div>
          <div>
            <span className="text-gray-500">평균 근무시간:</span>
            <span className="ml-2 font-semibold">{data.summary.avgClaimedHours.toFixed(1)}h/일</span>
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">직원 상세 데이터</h2>
              <div className="flex items-center gap-2">
                {selectedRows.size > 0 && (
                  <span className="text-sm text-blue-600 font-medium">
                    {selectedRows.size}명 선택됨
                  </span>
                )}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50 flex items-center gap-1"
                >
                  <Filter className="h-4 w-4" />
                  필터
                </button>
                <button
                  onClick={exportToCSV}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  Excel 내보내기
                </button>
              </div>
            </div>
            
            {/* Search and Filter Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  placeholder="사번, 이름, 직급으로 검색..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="text-sm text-gray-600">
                  {processedEmployees.length}명 / {data?.employees.length || 0}명
                </div>
              </div>
              
              {/* Advanced Filters */}
              {showFilters && (
                <div className="p-3 bg-gray-50 rounded-md space-y-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">효율성:</label>
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={efficiencyFilter.min}
                        onChange={(e) => setEfficiencyFilter({ ...efficiencyFilter, min: Number(e.target.value) })}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="최소"
                      />
                      <span className="text-gray-500">~</span>
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={efficiencyFilter.max}
                        onChange={(e) => setEfficiencyFilter({ ...efficiencyFilter, max: Number(e.target.value) })}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="최대"
                      />
                      <span className="text-sm text-gray-600">%</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">작업시간:</label>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        value={workHoursFilter.min}
                        onChange={(e) => setWorkHoursFilter({ ...workHoursFilter, min: Number(e.target.value) })}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="최소"
                      />
                      <span className="text-gray-500">~</span>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        value={workHoursFilter.max}
                        onChange={(e) => setWorkHoursFilter({ ...workHoursFilter, max: Number(e.target.value) })}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="최대"
                      />
                      <span className="text-sm text-gray-600">시간</span>
                    </div>
                    
                    <button
                      onClick={resetFilters}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                    >
                      <X className="h-3 w-3" />
                      초기화
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={processedEmployees.length > 0 && selectedRows.size === processedEmployees.length}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('employeeId')}
                  >
                    <div className="flex items-center">
                      사번
                      {getSortIcon('employeeId')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      이름
                      {getSortIcon('name')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    직급
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    직책
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('efficiencyRatio')}
                  >
                    <div className="flex items-center justify-end">
                      효율성(%)
                      {getSortIcon('efficiencyRatio')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('actualWorkHours')}
                  >
                    <div className="flex items-center justify-end">
                      실제작업(h)
                      {getSortIcon('actualWorkHours')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('claimedWorkHours')}
                  >
                    <div className="flex items-center justify-end">
                      근무시간(h)
                      {getSortIcon('claimedWorkHours')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업(분)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    회의(분)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    식사(분)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이동(분)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    휴식(분)
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('confidenceScore')}
                  >
                    <div className="flex items-center justify-end">
                      신뢰도
                      {getSortIcon('confidenceScore')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    분석일자
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedEmployees.map((employee) => (
                  <tr key={employee.employeeId} className={`hover:bg-gray-50 ${selectedRows.has(employee.employeeId) ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(employee.employeeId)}
                        onChange={() => handleSelectRow(employee.employeeId)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {employee.employeeId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {employee.jobGrade || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {employee.jobTitle || '-'}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      employee.efficiencyRatio >= 90 ? 'text-blue-600' :
                      employee.efficiencyRatio >= 70 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {employee.efficiencyRatio.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {employee.actualWorkHours.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {employee.claimedWorkHours.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {employee.workMinutes.toFixed(0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {employee.meetingMinutes.toFixed(0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {employee.mealMinutes.toFixed(0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {employee.movementMinutes.toFixed(0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {employee.restMinutes.toFixed(0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {employee.confidenceScore.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                      {employee.analysisDate || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    </DashboardLayout>
  );
}