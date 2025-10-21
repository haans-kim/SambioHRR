#!/usr/bin/env tsx
// @ts-nocheck
/**
 * 1-6월 전체 데이터 재분석 스크립트
 * - Ground Rule Metrics를 confidence_score로 사용
 * - 휴가/연차/출장 데이터 통합
 * - T1 기반 비업무 이동 제외
 * - Sigmoid 함수로 90-95% 보정
 */

import Database from 'better-sqlite3';
import { EnhancedWorkHourCalculator } from '../lib/analytics/EnhancedWorkHourCalculator';
import type { TimelineEntry, TagEvent } from '../types/analytics';
import { ActivityState, TagCode } from '../types/analytics';

const db = new Database('sambio_human.db');
db.pragma('journal_mode = DELETE');

// Sigmoid 함수 기반 업무시간 보정 (90-95% 범위)
function calculateAdjustedWorkHours(workHours: number, groundRuleConfidence: number): number {
  const normalized = groundRuleConfidence / 100;
  const sigmoid = 1 / (1 + Math.exp(-12 * (normalized - 0.65)));
  const adjustmentFactor = 0.90 + sigmoid * 0.05; // 90% ~ 95% 범위
  return workHours * adjustmentFactor;
}

// 분석 대상 직원 조회
function getTargetEmployees(startDate: string, endDate: string) {
  const query = `
    SELECT DISTINCT
      c.사번 as employee_id,
      e.team_name,
      e.center_name,
      e.group_name,
      e.job_grade,
      c.WORKSCHDTYPNM as work_schedule_type
    FROM claim_data c
    JOIN employees e ON e.employee_id = CAST(c.사번 AS TEXT)
    WHERE c.근무일 BETWEEN ? AND ?
      AND (c.실제근무시간 > 0 OR c.휴가_연차 > 0)
      AND e.center_name NOT IN ('경영진단팀', '대표이사', '이사회', '자문역/고문')
    GROUP BY c.사번
  `;

  return db.prepare(query).all(startDate, endDate);
}

// 직원의 일별 데이터 조회
function getEmployeeDailyData(employeeId: string, date: string) {
  // claim_data에서 휴가/연차/출장 정보 조회
  const claimQuery = `
    SELECT
      실제근무시간 as work_hours,
      휴가_연차 as leave_hours,
      근태코드 as leave_code,
      근태명 as leave_name,
      CASE
        WHEN 근태코드 IN ('GB', 'JA') THEN 실제근무시간
        ELSE 0
      END as business_trip_hours
    FROM claim_data
    WHERE 사번 = ? AND DATE(근무일) = ?
  `;

  const claimData = db.prepare(claimQuery).get(employeeId, date) as any;

  // tag_data 조회
  const tagQuery = `
    SELECT
      tag_code,
      tag_time,
      activity_code,
      reader_id
    FROM tag_data
    WHERE employee_id = ? AND DATE(tag_time) = ?
    ORDER BY tag_time
  `;

  const tags = db.prepare(tagQuery).all(employeeId, date) as TagEvent[];

  return { claimData, tags };
}

// Ground Rule Metrics 계산 및 저장
async function analyzeAndSave(employeeInfo: any, date: string) {
  const { claimData, tags } = getEmployeeDailyData(employeeInfo.employee_id, date);

  if (!claimData && tags.length === 0) {
    return null;
  }

  // EnhancedWorkHourCalculator로 분석
  const calculator = new EnhancedWorkHourCalculator();

  // Timeline 생성 (tag_data 기반)
  const timeline: TimelineEntry[] = tags.map((tag, index) => ({
    timestamp: new Date(tag.tag_time),
    tagCode: tag.tag_code as TagCode,
    activityCode: tag.activity_code,
    state: ActivityState.UNKNOWN,
    duration: 0,
    confidence: 0
  }));

  // Ground Rules가 적용된 메트릭 계산
  const metrics = calculator.calculateEnhancedMetrics(
    timeline,
    {
      employeeId: parseInt(employeeInfo.employee_id),
      teamName: employeeInfo.team_name || '',
      workScheduleType: employeeInfo.work_schedule_type || ''
    },
    date
  );

  // Ground Rule confidence 가져오기
  const groundRuleConfidence = metrics.groundRulesMetrics?.groundRulesConfidence || 50;

  // T1 비업무 이동 제외한 실제 작업시간 계산
  const actualWorkHours = metrics.workTime - (metrics.groundRulesMetrics?.t1NonWorkMovement || 0);

  // Sigmoid 함수로 보정된 작업시간 계산
  const adjustedWorkHours = calculateAdjustedWorkHours(actualWorkHours / 60, groundRuleConfidence);

  // daily_analysis_results에 저장/업데이트
  const upsertQuery = `
    INSERT INTO daily_analysis_results (
      employee_id,
      analysis_date,
      center_name,
      group_name,
      team_name,
      total_hours,
      actual_work_hours,
      claimed_work_hours,
      efficiency_ratio,
      work_minutes,
      focused_work_minutes,
      meeting_minutes,
      meal_minutes,
      movement_minutes,
      rest_minutes,
      confidence_score,  -- Ground Rule confidence를 여기에 저장
      ground_rules_confidence,
      ground_rules_work_hours,
      work_movement_minutes,
      non_work_movement_minutes,
      anomaly_score,
      leave_hours,
      business_trip_hours,
      leave_type,
      job_grade
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(employee_id, analysis_date) DO UPDATE SET
      actual_work_hours = excluded.actual_work_hours,
      claimed_work_hours = excluded.claimed_work_hours,
      efficiency_ratio = excluded.efficiency_ratio,
      confidence_score = excluded.confidence_score,
      ground_rules_confidence = excluded.ground_rules_confidence,
      ground_rules_work_hours = excluded.ground_rules_work_hours,
      work_movement_minutes = excluded.work_movement_minutes,
      non_work_movement_minutes = excluded.non_work_movement_minutes,
      anomaly_score = excluded.anomaly_score,
      leave_hours = excluded.leave_hours,
      business_trip_hours = excluded.business_trip_hours,
      leave_type = excluded.leave_type,
      updated_at = CURRENT_TIMESTAMP
  `;

  const efficiencyRatio = claimData?.work_hours > 0
    ? (adjustedWorkHours / claimData.work_hours) * 100
    : 0;

  db.prepare(upsertQuery).run(
    employeeInfo.employee_id,
    date,
    employeeInfo.center_name,
    employeeInfo.group_name,
    employeeInfo.team_name,
    metrics.totalTime,
    adjustedWorkHours,
    claimData?.work_hours || 0,
    efficiencyRatio,
    metrics.workTime,
    metrics.focusTime,
    metrics.meetingTime,
    metrics.mealTime,
    metrics.transitTime,
    metrics.restTime,
    groundRuleConfidence,  // confidence_score에 Ground Rule confidence 저장
    groundRuleConfidence,
    metrics.groundRulesMetrics?.groundRulesWorkTime || 0,
    metrics.groundRulesMetrics?.t1WorkMovement || 0,
    metrics.groundRulesMetrics?.t1NonWorkMovement || 0,
    metrics.groundRulesMetrics?.anomalyScore || 0,
    claimData?.leave_hours || 0,
    claimData?.business_trip_hours || 0,
    claimData?.leave_name || null,
    employeeInfo.job_grade
  );

  return {
    employeeId: employeeInfo.employee_id,
    date,
    groundRuleConfidence,
    adjustedWorkHours
  };
}

// 메인 실행 함수
async function main() {
  console.log('🚀 1-6월 전체 데이터 재분석 시작');
  console.log('📊 Ground Rule Metrics 기반 confidence_score 업데이트');
  console.log('🔄 휴가/연차/출장 데이터 통합');
  console.log('📉 Sigmoid 함수 90-95% 보정 적용\n');

  const months = [
    { month: '2025-01', start: '2025-01-01', end: '2025-01-31' },
    { month: '2025-02', start: '2025-02-01', end: '2025-02-28' },
    { month: '2025-03', start: '2025-03-01', end: '2025-03-31' },
    { month: '2025-04', start: '2025-04-01', end: '2025-04-30' },
    { month: '2025-05', start: '2025-05-01', end: '2025-05-31' },
    { month: '2025-06', start: '2025-06-01', end: '2025-06-30' }
  ];

  let totalProcessed = 0;
  let totalErrors = 0;

  for (const { month, start, end } of months) {
    console.log(`\n📅 ${month} 처리 시작`);

    const employees = getTargetEmployees(start, end);
    console.log(`  직원 수: ${employees.length}명`);

    let monthProcessed = 0;
    let monthErrors = 0;

    // 각 직원별로 처리
    for (const employee of employees) {
      // 해당 월의 모든 날짜 처리
      const dateQuery = `
        SELECT DISTINCT DATE(근무일) as work_date
        FROM claim_data
        WHERE 사번 = ? AND 근무일 BETWEEN ? AND ?
        ORDER BY work_date
      `;

      const dates = db.prepare(dateQuery).all(employee.employee_id, start, end) as any[];

      for (const { work_date } of dates) {
        try {
          const result = await analyzeAndSave(employee, work_date);
          if (result) {
            monthProcessed++;
            if (monthProcessed % 100 === 0) {
              process.stdout.write(`\r  처리중: ${monthProcessed}건`);
            }
          }
        } catch (error) {
          monthErrors++;
          console.error(`\n  ❌ 오류: ${employee.employee_id} / ${work_date}`, error);
        }
      }
    }

    console.log(`\n  ✅ ${month} 완료: ${monthProcessed}건 처리, ${monthErrors}건 오류`);
    totalProcessed += monthProcessed;
    totalErrors += monthErrors;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`🎯 전체 재분석 완료`);
  console.log(`  총 처리: ${totalProcessed}건`);
  console.log(`  총 오류: ${totalErrors}건`);

  // 검증
  const verifyQuery = `
    SELECT
      DATE(analysis_date, 'start of month') as month,
      COUNT(*) as total_records,
      COUNT(CASE WHEN confidence_score > 0 THEN 1 END) as with_confidence,
      ROUND(AVG(confidence_score), 1) as avg_confidence,
      ROUND(AVG(leave_hours), 1) as avg_leave_hours,
      ROUND(AVG(business_trip_hours), 1) as avg_trip_hours
    FROM daily_analysis_results
    WHERE analysis_date BETWEEN '2025-01-01' AND '2025-06-30'
    GROUP BY DATE(analysis_date, 'start of month')
    ORDER BY month
  `;

  console.log('\n📊 월별 검증 결과:');
  const results = db.prepare(verifyQuery).all();
  console.table(results);
}

// 실행
main().catch(console.error).finally(() => {
  db.close();
  process.exit(0);
});