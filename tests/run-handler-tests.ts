#!/usr/bin/env tsx
// Handler-based 架構測試運行器

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
}

class HandlerTestRunner {
  private testSuites: TestSuite[] = [];
  private startTime: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Handler-based 架構測試套件');
    console.log('=====================================\n');

    const handlerTests = [
      'delayed-message-main',
      'auth-main',
      'team-main'
    ];

    for (const testName of handlerTests) {
      await this.runTestSuite(testName);
    }

    this.printSummary();
  }

  private async runTestSuite(testName: string): Promise<void> {
    const testFile = path.join(__dirname, 'unit', 'handlers', `${testName}.test.ts`);
    
    if (!existsSync(testFile)) {
      console.log(`⚠️  測試文件不存在: ${testName}.test.ts`);
      return;
    }

    console.log(`🔍 運行測試套件: ${testName}`);
    console.log('-'.repeat(50));

    const suiteStartTime = Date.now();
    let testSuite: TestSuite = {
      name: testName,
      tests: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration: 0
    };

    try {
      // 運行 vitest 測試
      const result = execSync(
        `npx vitest run ${testFile} --reporter=json`,
        { 
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        }
      );

      // 解析測試結果
      const testResults = this.parseVitestOutput(result);
      testSuite = { ...testSuite, ...testResults };
      
      console.log(`✅ ${testSuite.passedTests} 通過`);
      if (testSuite.failedTests > 0) {
        console.log(`❌ ${testSuite.failedTests} 失敗`);
      }
      if (testSuite.skippedTests > 0) {
        console.log(`⏭️  ${testSuite.skippedTests} 跳過`);
      }

    } catch (error: any) {
      console.log(`❌ 測試套件執行失敗: ${error.message}`);
      testSuite.failedTests = 1;
      testSuite.totalTests = 1;
    }

    testSuite.duration = Date.now() - suiteStartTime;
    this.testSuites.push(testSuite);
    console.log(`⏱️  耗時: ${testSuite.duration}ms\n`);
  }

  private parseVitestOutput(output: string): Partial<TestSuite> {
    try {
      const lines = output.split('\n').filter(line => line.trim());
      const jsonLine = lines.find(line => line.startsWith('{'));
      
      if (!jsonLine) {
        return { totalTests: 0, passedTests: 0, failedTests: 0, skippedTests: 0 };
      }

      const result = JSON.parse(jsonLine);
      
      return {
        totalTests: result.numTotalTests || 0,
        passedTests: result.numPassedTests || 0,
        failedTests: result.numFailedTests || 0,
        skippedTests: result.numPendingTests || 0
      };
    } catch (error) {
      // 如果無法解析 JSON，嘗試從文本輸出中提取信息
      const passedMatch = output.match(/(\d+) passed/);
      const failedMatch = output.match(/(\d+) failed/);
      const skippedMatch = output.match(/(\d+) skipped/);

      return {
        totalTests: (passedMatch ? parseInt(passedMatch[1]) : 0) + 
                   (failedMatch ? parseInt(failedMatch[1]) : 0) + 
                   (skippedMatch ? parseInt(skippedMatch[1]) : 0),
        passedTests: passedMatch ? parseInt(passedMatch[1]) : 0,
        failedTests: failedMatch ? parseInt(failedMatch[1]) : 0,
        skippedTests: skippedMatch ? parseInt(skippedMatch[1]) : 0
      };
    }
  }

  private printSummary(): void {
    const totalDuration = Date.now() - this.startTime;
    const totalTests = this.testSuites.reduce((sum, suite) => sum + suite.totalTests, 0);
    const totalPassed = this.testSuites.reduce((sum, suite) => sum + suite.passedTests, 0);
    const totalFailed = this.testSuites.reduce((sum, suite) => sum + suite.failedTests, 0);
    const totalSkipped = this.testSuites.reduce((sum, suite) => sum + suite.skippedTests, 0);

    console.log('📊 測試總結');
    console.log('=====================================');
    console.log(`總測試數: ${totalTests}`);
    console.log(`✅ 通過: ${totalPassed}`);
    console.log(`❌ 失敗: ${totalFailed}`);
    console.log(`⏭️  跳過: ${totalSkipped}`);
    console.log(`⏱️  總耗時: ${totalDuration}ms`);
    console.log('');

    // 詳細的套件結果
    console.log('📋 詳細結果');
    console.log('-------------------------------------');
    this.testSuites.forEach(suite => {
      const status = suite.failedTests > 0 ? '❌' : '✅';
      console.log(`${status} ${suite.name}: ${suite.passedTests}/${suite.totalTests} (${suite.duration}ms)`);
    });

    console.log('');

    // 建議
    if (totalFailed > 0) {
      console.log('🔧 建議');
      console.log('-------------------------------------');
      console.log('- 檢查失敗的測試並修復相關問題');
      console.log('- 確保所有 mock 設置正確');
      console.log('- 驗證 handler 實現與測試期望一致');
    } else {
      console.log('🎉 所有測試通過！Handler-based 架構運行正常。');
    }

    console.log('');
    console.log('📚 相關文件');
    console.log('-------------------------------------');
    console.log('- 重構總結: REFACTORING_SUMMARY.md');
    console.log('- Handler 文件: src/handlers/*-main.ts');
    console.log('- 測試文件: tests/unit/handlers/*-main.test.ts');
  }
}

// 主執行函數
async function main() {
  const runner = new HandlerTestRunner();
  await runner.runAllTests();
}

// 如果直接執行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { HandlerTestRunner };