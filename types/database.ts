// Database table types

export interface Employee {
  employee_id: number
  name: string
  department: string
  position: string
  hire_date: string
  gender: string
  shift_type: string
  job_group?: 'PRODUCTION' | 'RESEARCH' | 'OFFICE' | 'MANAGEMENT'
}

export interface TagData {
  ENTE_DT: string
  사번: number
  NAME: string
  Tag_Code?: string
  Location: string
}

export interface MealData {
  취식일시: string
  사번: number
  성명: string
  식당명: string
  식대구분: string
  테이크아웃?: boolean
}

export interface KnoxPimsData {
  id: number
  employee_id: number
  meeting_id: string
  meeting_type: string
  start_time: string
  end_time: string
  created_at: string
}

export interface EquipmentData {
  Timestamp: string
  USERNO: number
  Event?: string
  Task?: string
  Source: 'EAM' | 'LAMS' | 'MES' | 'EQUIS' | 'MDM'
}

export interface ClaimData {
  근무일: string
  사번: number
  성명: string
  부서: string
  근무시간: number
}

export interface NonWorkTime {
  사번: number
  근무일자: string
  제외시간코드: string
  시작시간: string
  종료시간: string
  입력구분: string
  반영여부: string
}