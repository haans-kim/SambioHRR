import { precomputeMonthlyStats, precomputeGroupStats } from '@/lib/db/queries/precompute-stats';

const months = ['2025-07', '2025-08', '2025-09', '2025-10'];

months.forEach(month => {
  console.log(`\n=== Computing stats for ${month} ===`);
  try {
    precomputeMonthlyStats(month);
    precomputeGroupStats(month);
    console.log(`✅ Successfully computed stats for ${month}`);
  } catch (error: any) {
    console.error(`❌ Error computing stats for ${month}:`, error.message);
  }
});

console.log('\n=== All statistics recomputed ===');
console.log('Please restart the server or clear the cache.');
