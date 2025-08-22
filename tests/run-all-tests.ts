#!/usr/bin/env tsx
// 執行所有測試的主腳本
import { runActivityLogTests } from './integration/activity-log.test';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function runAllTests(): Promise<void> {
  console.log('🚀 開始執行所有測試...\n');
  
  const results: TestResult[] = [];
  
  // 執行活動記錄整合測試
  console.log('📋 執行活動記錄整合測試...');
  try {
    const activityLogPassed = await runActivityLogTests();
    results.push({
      name: '活動記錄整合測試',
      passed: activityLogPassed
    });
  } catch (error) {
    results.push({
      name: '活動記錄整合測試',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  // 可以在這裡添加更多測試...
  
  // 輸出測試結果
  console.log('\n📊 測試結果總結:');
  console.log('='.repeat(50));
  
  let totalTests = 0;
  let passedTests = 0;
  
  for (const result of results) {
    totalTests++;
    if (result.passed) {
      passedTests++;
      console.log(`✅ ${result.name}: 通過`);
    } else {
      console.log(`❌ ${result.name}: 失敗`);
      if (result.error) {
        console.log(`   錯誤: ${result.error}`);
      }
    }
  }
  
  console.log('='.repeat(50));
  console.log(`📈 總計: ${passedTests}/${totalTests} 測試通過`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有測試都通過了！');
    process.exit(0);
  } else {
    console.log('💥 部分測試失敗，請檢查上述錯誤');
    process.exit(1);
  }
}

// 執行測試
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('❌ 測試執行失敗:', error);
    process.exit(1);
  });
}

export { runAllTests };