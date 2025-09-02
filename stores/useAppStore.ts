import { create } from 'zustand'

interface OrganizationPath {
  center?: string
  centerName?: string
  division?: string
  divisionName?: string
  team?: string
  teamName?: string
  group?: string
  groupName?: string
}

interface Employee {
  employee_id: string
  name: string
  department?: string
  position?: string
  team?: string
  group?: string
}

interface AppStore {
  organizationPath: OrganizationPath
  setOrganizationPath: (path: OrganizationPath) => void
  clearOrganizationPath: () => void
  
  selectedEmployee: Employee | null
  setEmployee: (employee: Employee | null) => void
  
  selectedDate: Date
  setDate: (date: Date) => void
}

const useAppStore = create<AppStore>((set) => ({
  organizationPath: {},
  setOrganizationPath: (path) => set({ organizationPath: path }),
  clearOrganizationPath: () => set({ organizationPath: {} }),
  
  selectedEmployee: null,
  setEmployee: (employee) => set({ selectedEmployee: employee }),
  
  selectedDate: new Date('2025-06-30'),  // Default to a date with data
  setDate: (date) => set({ selectedDate: date }),
}))

export default useAppStore