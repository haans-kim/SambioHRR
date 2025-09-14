import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * AI 보정 계수 계산 함수
 * 시그모이드 함수를 사용하여 데이터 신뢰도에 따른 보정 계수를 계산
 * @param reliability - 데이터 신뢰도 (0-100)
 * @returns 보정 계수 (0.92-0.98)
 */
export function calculateAIAdjustmentFactor(reliability: number): number {
  // 신뢰도를 0-1 범위로 정규화
  const normalized = reliability / 100;

  // 시그모이드 변환으로 부드러운 곡선 생성
  // 중심점을 0.65로 설정하고, 급격한 기울기 적용
  const sigmoid = 1 / (1 + Math.exp(-12 * (normalized - 0.65)));

  // 92% ~ 98% 범위로 매핑 (최대 8% 감소, 최소 2% 감소)
  const adjustmentFactor = 0.92 + (sigmoid * 0.06);

  return adjustmentFactor;
}

/**
 * AI 보정된 근무시간 계산
 * @param workHours - 원본 근무추정시간
 * @param dataReliability - 데이터 신뢰도
 * @returns 보정된 근무시간
 */
export function calculateAdjustedWorkHours(workHours: number, dataReliability: number): number {
  const adjustmentFactor = calculateAIAdjustmentFactor(dataReliability);
  return workHours * adjustmentFactor;
}

/**
 * 탄력근무제 보정 계수
 * 3근4휴, 4근3휴 패턴을 반영하여 실제 근무일 기준으로 환산
 */
export const FLEXIBLE_WORK_ADJUSTMENT_FACTOR = 14 / 20; // 0.7

/**
 * 탄력근무제 보정 적용
 * @param value - 원본 값 (일간 또는 주간 근무시간)
 * @param isFlexibleWork - 탄력근무제 여부
 * @returns 보정된 값
 */
export function applyFlexibleWorkAdjustment(value: number, isFlexibleWork: boolean): number {
  return isFlexibleWork ? value * FLEXIBLE_WORK_ADJUSTMENT_FACTOR : value;
}

/**
 * 복합 보정 적용 (AI 보정 + 탄력근무제 보정)
 * @param workHours - 원본 근무시간
 * @param dataReliability - 데이터 신뢰도 (0-100)
 * @param isFlexibleWork - 탄력근무제 여부
 * @returns 최종 보정된 근무시간
 */
export function calculateFullyAdjustedWorkHours(
  workHours: number, 
  dataReliability: number, 
  isFlexibleWork: boolean
): number {
  // 먼저 AI 보정 적용
  let adjustedHours = calculateAdjustedWorkHours(workHours, dataReliability);
  // 그 다음 탄력근무제 보정 적용
  adjustedHours = applyFlexibleWorkAdjustment(adjustedHours, isFlexibleWork);
  return adjustedHours;
}