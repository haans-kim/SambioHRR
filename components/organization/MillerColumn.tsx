'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import useAppStore from '@/stores/useAppStore'

interface OrganizationNode {
  code: string
  name: string
  display_order: number
}

interface Employee {
  employee_id: number
  name: string
  department: string
  position: string
}

const ColumnPane = ({
  title,
  items,
  selectedValue,
  onSelect,
  renderItem
}: {
  title: string
  items: any[]
  selectedValue: string | number | null
  onSelect: (value: any) => void
  renderItem: (item: any) => { label: string; value: string | number }
}) => {
  return (
    <div className="flex-1 min-w-[200px] border-r border-gray-200 last:border-r-0">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      </div>
      <div className="overflow-y-auto h-[240px]">
        {items.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-500">
            데이터 없음
          </div>
        ) : (
          items.map((item, index) => {
            const { label, value } = renderItem(item)
            const isSelected = selectedValue === value
            return (
              <div
                key={value || `item-${index}`}
                onClick={() => onSelect(value)}
                className={`
                  px-4 py-2 cursor-pointer text-sm
                  ${isSelected 
                    ? 'bg-blue-50 text-blue-700 font-medium' 
                    : 'hover:bg-gray-50 text-gray-900'}
                `}
              >
                {label}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default function MillerColumn() {
  const { setEmployee, setOrganizationPath } = useAppStore()
  const [selectedCenter, setSelectedCenter] = useState<string | null>(null)
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  // Fetch centers
  const { data: centers = [] } = useQuery<OrganizationNode[]>({
    queryKey: ['centers'],
    queryFn: async () => {
      const res = await fetch('/api/organization/centers')
      if (!res.ok) throw new Error('Failed to fetch centers')
      const data = await res.json()
      // Map orgCode to code for compatibility
      return (data.centers || []).map((center: any) => ({
        code: center.orgCode,
        name: center.orgName,
        display_order: center.displayOrder || 0
      }))
    }
  })

  // Fetch divisions by center
  const { data: divisions = [] } = useQuery<OrganizationNode[]>({
    queryKey: ['divisions', selectedCenter],
    queryFn: async () => {
      if (!selectedCenter) return []
      const res = await fetch(`/api/organization/centers/${selectedCenter}/divisions`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.divisions || []).map((division: any) => ({
        code: division.orgCode,
        name: division.orgName,
        display_order: division.displayOrder || 0
      }))
    },
    enabled: !!selectedCenter
  })

  // Fetch teams directly under center (for centers with direct teams)
  const { data: centerDirectTeams = [] } = useQuery<OrganizationNode[]>({
    queryKey: ['center-direct-teams', selectedCenter],
    queryFn: async () => {
      if (!selectedCenter) return []
      const res = await fetch(`/api/organization/centers/${selectedCenter}/teams`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.teams || []).map((team: any) => ({
        code: team.orgCode,
        name: team.orgName,
        display_order: team.displayOrder || 0
      }))
    },
    enabled: !!selectedCenter
  })

  // Fetch teams by division or center
  const { data: teams = [] } = useQuery<OrganizationNode[]>({
    queryKey: ['teams', selectedDivision, selectedCenter],
    queryFn: async () => {
      if (selectedDivision) {
        const res = await fetch(`/api/organization/divisions/${selectedDivision}/teams`)
        if (!res.ok) return []
        const data = await res.json()
        return (data.teams || []).map((team: any) => ({
          code: team.orgCode,
          name: team.orgName,
          display_order: team.displayOrder || 0
        }))
      } else if (selectedCenter && !selectedDivision) {
        // Get teams directly under center when no division is selected
        const res = await fetch(`/api/organization/centers/${selectedCenter}/teams`)
        if (!res.ok) return []
        const data = await res.json()
        return (data.teams || []).map((team: any) => ({
          code: team.orgCode,
          name: team.orgName,
          display_order: team.displayOrder || 0
        }))
      }
      return []
    },
    enabled: !!selectedDivision || !!selectedCenter
  })

  // Fetch groups by team
  const { data: groups = [] } = useQuery<OrganizationNode[]>({
    queryKey: ['groups', selectedTeam],
    queryFn: async () => {
      if (!selectedTeam) return []
      const res = await fetch(`/api/organization/teams/${selectedTeam}/groups`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.groups || []).map((group: any) => ({
        code: group.orgCode,
        name: group.orgName,
        display_order: group.displayOrder || 0
      }))
    },
    enabled: !!selectedTeam
  })

  // Fetch employees by selected organization
  const selectedOrg = selectedGroup || selectedTeam || 
    (selectedDivision === 'center_direct' ? selectedCenter : selectedDivision) || 
    selectedCenter
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees', selectedOrg],
    queryFn: async () => {
      if (!selectedOrg) return []
      const res = await fetch(`/api/organization/${selectedOrg}/employees`)
      if (!res.ok) return []
      const data = await res.json()
      return data.employees || data || []
    },
    enabled: !!selectedOrg
  })

  // Update global state when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      setEmployee(selectedEmployee as any)
      const centerName = centers.find(c => c.code === selectedCenter)?.name
      const divisionName = selectedDivision === 'center_direct' 
        ? '센터 직속' 
        : divisions.find(d => d.code === selectedDivision)?.name
      const teamName = teams.find(t => t.code === selectedTeam)?.name || 
        (selectedDivision === 'center_direct' ? centerDirectTeams.find(t => t.code === selectedTeam)?.name : undefined)
      const groupName = groups.find(g => g.code === selectedGroup)?.name
      
      setOrganizationPath({
        center: selectedCenter || undefined,
        centerName: centerName || undefined,
        division: selectedDivision || undefined,
        divisionName: divisionName || undefined,
        team: selectedTeam || undefined,
        teamName: teamName || undefined,
        group: selectedGroup || undefined,
        groupName: groupName || undefined
      })
    }
  }, [selectedEmployee, selectedCenter, selectedDivision, selectedTeam, selectedGroup, centers, divisions, teams, groups, setEmployee, setOrganizationPath, centerDirectTeams])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex">
        {/* Center Column */}
        <ColumnPane
          title="센터"
          items={centers}
          selectedValue={selectedCenter}
          onSelect={(center) => {
            setSelectedCenter(center)
            setSelectedDivision(null)
            setSelectedTeam(null)
            setSelectedGroup(null)
            setSelectedEmployee(null)
            // Update organization path when center is selected
            const centerName = centers.find(c => c.code === center)?.name
            setOrganizationPath({
              center: centerName || undefined,  // Use name, not code
              centerName: centerName || undefined,
              division: undefined,
              divisionName: undefined,
              team: undefined,
              teamName: undefined,
              group: undefined,
              groupName: undefined
            })
          }}
          renderItem={(item: OrganizationNode) => ({
            label: item.name,
            value: item.code
          })}
        />

        {/* Division/Direct Teams Column - Shows if center selected */}
        {selectedCenter && (
          <ColumnPane
            title="담당"
            items={(() => {
              const items = [...divisions]
              // Add center direct teams option if there are teams directly under center
              if (centerDirectTeams.length > 0) {
                items.push({ code: 'center_direct', name: '센터 직속', display_order: 999 })
              }
              return items
            })()}
            selectedValue={selectedDivision}
            onSelect={(division) => {
              setSelectedDivision(division)
              setSelectedTeam(null)
              setSelectedGroup(null)
              setSelectedEmployee(null)
              // Update organization path when division is selected
              const centerName = centers.find(c => c.code === selectedCenter)?.name
              const divisionName = division === 'center_direct' ? '센터 직속' : divisions.find(d => d.code === division)?.name
              setOrganizationPath({
                center: centerName || undefined,  // Use name, not code
                centerName: centerName || undefined,
                division: divisionName || undefined,  // Use name, not code
                divisionName: divisionName || undefined,
                team: undefined,
                teamName: undefined,
                group: undefined,
                groupName: undefined
              })
            }}
            renderItem={(item: any) => ({
              label: item.name,
              value: item.code
            })}
          />
        )}

        {/* Team Column - Shows if division selected */}
        {selectedDivision && (
          <ColumnPane
            title="팀"
            items={(() => {
              // If 'center_direct' is selected, show center direct teams
              if (selectedDivision === 'center_direct') {
                return centerDirectTeams
              }
              // Otherwise show teams under the selected division
              return teams.length > 0 ? teams : employees.length > 0 ? [{ code: 'direct', name: '직속 직원' }] : []
            })()}
            selectedValue={selectedTeam || (teams.length === 0 && employees.length > 0 ? 'direct' : null)}
            onSelect={(team) => {
              if (team === 'direct') {
                // Direct employees under division or center
                setSelectedTeam(null)
                setSelectedGroup(null)
              } else {
                setSelectedTeam(team)
                setSelectedGroup(null)
              }
              setSelectedEmployee(null)
              // Update organization path when team is selected
              const centerName = centers.find(c => c.code === selectedCenter)?.name
              const divisionName = selectedDivision === 'center_direct' ? '센터 직속' : divisions.find(d => d.code === selectedDivision)?.name
              const teamName = team === 'direct' ? undefined : (teams.find(t => t.code === team)?.name || centerDirectTeams.find(t => t.code === team)?.name)
              setOrganizationPath({
                center: centerName || undefined,  // Use name, not code
                centerName: centerName || undefined,
                division: divisionName || undefined,  // Use name, not code
                divisionName: divisionName || undefined,
                team: teamName || undefined,  // Use name, not code
                teamName: teamName || undefined,
                group: undefined,
                groupName: undefined
              })
            }}
            renderItem={(item: any) => ({
              label: item.name,
              value: item.code
            })}
          />
        )}

        {/* Group Column - Shows if team selected (optional) */}
        {selectedTeam && groups.length > 0 && (
          <ColumnPane
            title="그룹"
            items={groups}
            selectedValue={selectedGroup}
            onSelect={(group) => {
              setSelectedGroup(group)
              setSelectedEmployee(null)
              // Update organization path when group is selected
              const centerName = centers.find(c => c.code === selectedCenter)?.name
              const divisionName = selectedDivision === 'center_direct' ? '센터 직속' : divisions.find(d => d.code === selectedDivision)?.name
              const teamName = teams.find(t => t.code === selectedTeam)?.name || 
                (selectedDivision === 'center_direct' ? centerDirectTeams.find(t => t.code === selectedTeam)?.name : undefined)
              const groupName = groups.find(g => g.code === group)?.name
              setOrganizationPath({
                center: centerName || undefined,  // Use name, not code
                centerName: centerName || undefined,
                division: divisionName || undefined,  // Use name, not code
                divisionName: divisionName || undefined,
                team: teamName || undefined,  // Use name, not code
                teamName: teamName || undefined,
                group: groupName || undefined,  // Use name, not code
                groupName: groupName || undefined
              })
            }}
            renderItem={(item: OrganizationNode) => ({
              label: item.name,
              value: item.code
            })}
          />
        )}

        {/* Employee Column - Shows if any org level selected */}
        {selectedOrg && (
          <ColumnPane
            title={`직원 (${employees.length}명)`}
            items={employees}
            selectedValue={selectedEmployee?.employee_id}
            onSelect={(employeeId) => {
              const employee = employees.find(e => e.employee_id === employeeId)
              if (employee) {
                setSelectedEmployee(employee)
              }
            }}
            renderItem={(item: Employee) => ({
              label: `${item.name} (${item.employee_id})`,
              value: item.employee_id
            })}
          />
        )}
      </div>
    </div>
  )
}