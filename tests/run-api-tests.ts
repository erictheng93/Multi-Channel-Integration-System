#!/usr/bin/env node

/**
 * API 測試統一執行腳本
 * 整合所有 API 測試類型的執行
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface TestSuite {
  name: string;
  description: string;
  script: string;
  args: string[];
  timeout: number;
}

class ApiTestRunner {
  private baseUrl: string;
  private verbose: boolean;

  constructor(baseUrl: string = 'http://localhost:8787', verbose: boolean = false) {
    this.baseUrl = baseUrl;
    this.verbose = verbose;
  }

  // 定義所有測試套件
  private getTestSuites(): TestSuite[] {
    return [
      {
        name: 'endpoints',
        description: 'API 端點功能測試',
        script: 'api-endpoints-test.ts',
        args: [this.baseUrl, '10000'],
        timeout: 60000
      },
      {
        name: 'integration',
        description: 'API 整合流程測試',
        script: 'api-integration-test.ts',
        args: [this.baseUrl, '15000'],
        timeout: 120000
      },
      {
        name: 'load',
        description: 'API 負載壓力測試',
        script: 'api-load-test.ts',
        args: [this.baseUrl, '5', '30'],
        timeout: 60000
      }
    ];
  }

  // 檢查服務是否可用
  private async checkServiceAvailability(): Promise<boolean> {
    try {
      console.log(`🔍 檢查服務可用性: ${this.baseUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(this.baseUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('✅ 服務可用');
        return true;
      } else {
        console.log(`❌ 服務回應異常: HTTP ${response.status}`);
        return false;
      }
    } catch (error: any) {
      console.log(`❌ 服務不可用: ${error.message}`);
      return false;
    }
  }

  // 執行單個測試套件
  private async runTestSuite(suite: TestSuite): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      console.log(`\n🧪 執行測試套件: ${suite.name}`);
      console.log(`   描述: ${suite.description}`);
      console.log(`   腳本: ${suite.script}`);
      
      const scriptPath = join(__dirname, suite.script);
      
      if (!existsSync(scriptPath)) {
        console.log(`❌ 測試腳本不存在: ${scriptPath}`);
        resolve({ success: false, output: `Script not found: ${scriptPath}` });
        return;
      }

      let output = '';
      const child = spawn('node', ['--loader', 'tsx', scriptPath, ...suite.args], {
        cwd: __dirname,
        stdio: this.verbose ? 'inherit' : 'pipe'
      });

      if (!this.verbose && child.stdout && child.stderr) {
        child.stdout.on('data', (data) => {
          output += data.toString();
        });

        child.stderr.on('data', (data) => {
          output += data.toString();
        });
      }

      // 設置超時
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        console.log(`⏰ 測試套件 ${suite.name} 超時`);
        resolve({ success: false, output: output + '\nTest timed out' });
      }, suite.timeout);

      child.on('close', (code) => {
        clearTimeout(timeout);
        const success = code === 0;
        
        if (success) {
          console.log(`✅ 測試套件 ${suite.name} 完成`);
        } else {
          console.log(`❌ 測試套件 ${suite.name} 失敗 (退出碼: ${code})`);
        }
        
        resolve({ success, output });
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        console.log(`❌ 測試套件 ${suite.name} 執行錯誤: ${error.message}`);
        resolve({ success: false, output: error.message });
      });
    });
  }

  // 執行所有測試
  async runAllTests(suiteNames?: string[]): Promise<void> {
    console.log('🚀 開始 API 測試執行...\n');
    console.log(`測試目標: ${this.baseUrl}`);
    console.log(`詳細輸出: ${this.verbose ? '啟用' : '停用'}`);

    // 檢查服務可用性
    const serviceAvailable = await this.checkServiceAvailability();
    if (!serviceAvailable) {
      console.log('\n❌ 服務不可用，無法執行測試');
      console.log('請確保服務正在運行，然後重試');
      process.exit(1);
    }

    const allSuites = this.getTestSuites();
    const suitesToRun = suiteNames 
      ? allSuites.filter(suite => suiteNames.includes(suite.name))
      : allSuites;

    if (suitesToRun.length === 0) {
      console.log('❌ 沒有找到要執行的測試套件');
      this.printAvailableSuites(allSuites);
      process.exit(1);
    }

    console.log(`\n📋 將執行 ${suitesToRun.length} 個測試套件:`);
    suitesToRun.forEach(suite => {
      console.log(`   - ${suite.name}: ${suite.description}`);
    });

    const results: Array<{ suite: string; success: boolean; output: string }> = [];
    let successCount = 0;

    // 依序執行測試套件
    for (const suite of suitesToRun) {
      const result = await this.runTestSuite(suite);
      results.push({
        suite: suite.name,
        success: result.success,
        output: result.output
      });

      if (result.success) {
        successCount++;
      }
    }

    this.printSummary(results, successCount);
    this.generateCombinedReport(results);

    // 如果有失敗的測試，以非零退出碼結束
    if (successCount < suitesToRun.length) {
      process.exit(1);
    }
  }

  // 打印可用的測試套件
  private printAvailableSuites(suites: TestSuite[]): void {
    console.log('\n可用的測試套件:');
    suites.forEach(suite => {
      console.log(`   ${suite.name}: ${suite.description}`);
    });
  }

  // 打印測試摘要
  private printSummary(results: Array<{ suite: string; success: boolean; output: string }>, successCount: number): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 API 測試總結');
    console.log('='.repeat(80));
    console.log(`總測試套件: ${results.length}`);
    console.log(`成功套件: ${successCount}`);
    console.log(`失敗套件: ${results.length - successCount}`);
    console.log(`成功率: ${((successCount / results.length) * 100).toFixed(1)}%`);

    console.log('\n📋 詳細結果:');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.suite}`);
    });

    // 顯示失敗的測試輸出
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0 && !this.verbose) {
      console.log('\n❌ 失敗測試的輸出:');
      failedResults.forEach(result => {
        console.log(`\n--- ${result.suite} ---`);
        console.log(result.output.slice(-1000)); // 只顯示最後 1000 字符
      });
    }

    console.log('='.repeat(80));
  }

  // 生成綜合報告
  private generateCombinedReport(results: Array<{ suite: string; success: boolean; output: string }>): void {
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      summary: {
        totalSuites: results.length,
        successfulSuites: results.filter(r => r.success).length,
        failedSuites: results.filter(r => !r.success).length
      },
      results: results.map(r => ({
        suite: r.suite,
        success: r.success,
        hasOutput: r.output.length > 0
      }))
    };

    try {
      const fs = require('fs');
      const reportPath = join(process.cwd(), 'api-test-summary.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 綜合測試報告已保存到: ${reportPath}`);
    } catch (error) {
      console.log(`⚠️  無法保存綜合報告: ${error}`);
    }
  }
}

// 主函數
async function main() {
  const args = process.argv.slice(2);
  
  // 解析命令行參數
  let baseUrl = 'http://localhost:8787';
  let verbose = false;
  let suiteNames: string[] = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--url' && i + 1 < args.length) {
      baseUrl = args[i + 1];
      i++;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      return;
    } else if (!arg.startsWith('--')) {
      suiteNames.push(arg);
    }
  }

  const runner = new ApiTestRunner(baseUrl, verbose);
  
  try {
    await runner.runAllTests(suiteNames.length > 0 ? suiteNames : undefined);
  } catch (error) {
    console.error('❌ 測試執行失敗:', error);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
API 測試執行器

用法:
  node run-api-tests.ts [選項] [測試套件...]

選項:
  --url <url>     指定測試目標 URL (預設: http://localhost:8787)
  --verbose, -v   顯示詳細輸出
  --help, -h      顯示此幫助訊息

測試套件:
  endpoints       API 端點功能測試
  integration     API 整合流程測試
  load           API 負載壓力測試

範例:
  node run-api-tests.ts                                    # 執行所有測試
  node run-api-tests.ts endpoints integration              # 只執行指定測試
  node run-api-tests.ts --url http://localhost:3000 -v    # 指定 URL 並顯示詳細輸出
`);
}

// 如果直接執行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ApiTestRunner };