#!/usr/bin/env tsx
import { MemoryDataLoader } from '../lib/analytics/MemoryDataLoader'
import { MemoryCalculator } from '../lib/analytics/MemoryCalculator'
import * as path from 'path'

async function main() {
  // Test specific employee on 2025-07-01
  const testEmployeeId = 20110115
  const testDate = '2025-07-01'

  console.log(`🔍 Testing MemoryCalculator for employee ${testEmployeeId} on ${testDate}`)

  const analyticsDbPath = path.join(process.cwd(), 'sambio_analytics.db')
  const dataLoader = new MemoryDataLoader(analyticsDbPath)

  // Load data
  console.log('\n📊 Loading data...')
  const dataset = await dataLoader.loadAllData([testEmployeeId], testDate, testDate)

  console.log(`✅ Loaded:`)
  console.log(`   - Employees: ${dataset.employees.size}`)
  console.log(`   - Events: ${dataset.events.size}`)
  console.log(`   - Claim data: ${dataset.claimData.size}`)

  // Check events
  const employeeEvents = dataset.events.get(testEmployeeId)
  if (employeeEvents) {
    const dayEvents = employeeEvents.get(testDate)
    console.log(`\n📅 Events for ${testDate}: ${dayEvents?.length || 0}`)

    if (dayEvents && dayEvents.length > 0) {
      console.log('\n🏷️  First 5 events:')
      dayEvents.slice(0, 5).forEach(e => {
        console.log(`   ${e.timestamp.toISOString()} - ${e.tagCode} - ${e.tagLocation}`)
      })
    }
  }

  // Check claim data
  const employeeClaimData = dataset.claimData.get(testEmployeeId)
  if (employeeClaimData) {
    const dayClaimData = employeeClaimData.get(testDate)
    console.log(`\n💼 Claim data for ${testDate}:`, dayClaimData)
  }

  // Calculate
  console.log('\n⚡ Calculating metrics...')
  const calculator = new MemoryCalculator(dataset)
  const result = calculator.calculateEmployeeDay(testEmployeeId, testDate)

  console.log('\n📈 Calculation Result:')
  console.log(`   Employee: ${result.employeeName} (${result.employeeId})`)
  console.log(`   Date: ${result.date}`)
  console.log(`   Error: ${result.error || 'None'}`)

  if (result.metrics) {
    console.log(`\n⏱️  Metrics:`)
    console.log(`   - Total Time: ${result.metrics.totalTime} minutes`)
    console.log(`   - Work Time: ${result.metrics.workTime} minutes`)
    console.log(`   - Meeting Time: ${result.metrics.meetingTime} minutes`)
    console.log(`   - Meal Time: ${result.metrics.mealTime} minutes`)
    console.log(`   - Transit Time: ${result.metrics.transitTime} minutes`)
    console.log(`   - Rest Time: ${result.metrics.restTime} minutes`)
    console.log(`   - Reliability Score: ${result.metrics.reliabilityScore}`)

    if (result.metrics.groundRulesMetrics) {
      console.log(`\n🎯 Ground Rules Metrics:`)
      console.log(`   - Ground Rules Work Time: ${result.metrics.groundRulesMetrics.groundRulesWorkTime} minutes`)
      console.log(`   - Confidence: ${result.metrics.groundRulesMetrics.groundRulesConfidence}%`)
      console.log(`   - Anomaly Score: ${result.metrics.groundRulesMetrics.anomalyScore}`)
    }
  }

  console.log(`\n🔚 Test complete`)
}

main().catch(console.error)
