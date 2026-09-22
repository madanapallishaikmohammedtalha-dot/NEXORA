/**
 * NEXORA Test Suite Runner
 * Runs all unit and integration tests across data layer, validation,
 * planner engine, and AI provider abstraction.
 */
import { runDataLayerTests } from './dataLayerTests';

console.log('====================================================');
console.log('               NEXORA TEST SUITE                    ');
console.log('====================================================\n');

const suiteReport = runDataLayerTests();

// Group results by suite
const grouped: Record<string, typeof suiteReport.results> = {};
for (const res of suiteReport.results) {
  if (!grouped[res.suite]) {
    grouped[res.suite] = [];
  }
  grouped[res.suite].push(res);
}

for (const [suiteName, tests] of Object.entries(grouped)) {
  const passedCount = tests.filter((t) => t.passed).length;
  const totalCount = tests.length;
  const statusIcon = passedCount === totalCount ? '✓' : '✗';
  console.log(`${statusIcon} [${suiteName}] (${passedCount}/${totalCount} passed)`);
  for (const t of tests) {
    if (t.passed) {
      console.log(`   ✓ ${t.name}`);
    } else {
      console.error(`   ✗ ${t.name}: ${t.error || 'Failed'}`);
    }
  }
  console.log('');
}

console.log('----------------------------------------------------');
console.log(`TOTAL: ${suiteReport.total} | PASSED: ${suiteReport.passed} | FAILED: ${suiteReport.failed}`);
console.log('----------------------------------------------------');

if (suiteReport.failed > 0) {
  console.error('\nTests failed.');
  process.exit(1);
} else {
  console.log('\nAll tests passed successfully.');
  process.exit(0);
}
