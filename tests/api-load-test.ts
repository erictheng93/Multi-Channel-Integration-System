#!/usr/bin/env node

/**
 * API 負載測試腳本
 * 測試 API 在高併發情況下的表現
 */

interface LoadTestConfig {
  baseUrl: string;
  concurrency: number;
  duration: number; // 秒
  endpoints: string[];
  authToken?: string;
}

interface LoadTestResult {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errors: string[];
}

class LoadTester {
  private config: LoadTestConfig;
  private results: Map<string, LoadTestResult> = new Map();
  private isRunning = false;

  constructor(config: LoadTestConfig) {
    this.config = config;
  }

  // 執行單個請求
  private async makeRequest(endpoint: string): Promise<{ success: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (this.config.authToken) {
        headers['Authorization'] = `Bearer ${this.config.authToken}`;
      }

      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000)
      });

      const responseTime = Date.now() - startTime;
      return {
        success: response.ok,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}`
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        responseTime,
        error: error.message
      };
    }
  }

  // 為單個端點執行負載測試
  private async testEndpoint(endpoint: string): Promise<void> {
    const result: LoadTestResult = {
      endpoint,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errors: []
    };

    const responseTimes: number[] = [];
    const startTime = Date.now();
    const endTime = startTime + (this.config.duration * 1000);

    console.log(`🚀 開始測試端點: ${endpoint}`);

    while (this.isRunning && Date.now() < endTime) {
      // 創建併發請求
      const promises = Array(this.config.concurrency).fill(null).map(() => 
        this.makeRequest(endpoint)
      );

      const results = await Promise.all(promises);

      // 處理結果
      for (const requestResult of results) {
        result.totalRequests++;
        responseTimes.push(requestResult.responseTime);

        if (requestResult.success) {
          result.successfulRequests++;
        } else {
          result.failedRequests++;
          if (requestResult.error && !result.errors.includes(requestResult.error)) {
            result.errors.push(requestResult.error);
          }
        }

        result.minResponseTime = Math.min(result.minResponseTime, requestResult.responseTime);
        result.maxResponseTime = Math.max(result.maxResponseTime, requestResult.responseTime);
      }

      // 短暫延遲以避免過度負載
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // 計算統計數據
    const totalTime = (Date.now() - startTime) / 1000;
    result.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    result.requestsPerSecond = result.totalRequests / totalTime;

    if (result.minResponseTime === Infinity) {
      result.minResponseTime = 0;
    }

    this.results.set(endpoint, result);
    console.log(`✅ 完成測試端點: ${endpoint} (${result.totalRequests} 請求)`);
  }

  // 執行所有負載測試
  async runLoadTest(): Promise<void> {
    console.log('🚀 開始 API 負載測試...\n');
    console.log(`測試目標: ${this.config.baseUrl}`);
    console.log(`併發數: ${this.config.concurrency}`);
    console.log(`持續時間: ${this.config.duration} 秒`);
    console.log(`測試端點: ${this.config.endpoints.join(', ')}\n`);

    this.isRunning = true;

    // 並行測試所有端點
    const testPromises = this.config.endpoints.map(endpoint => 
      this.testEndpoint(endpoint)
    );

    await Promise.all(testPromises);

    this.isRunning = false;
    this.printResults();
  }

  // 打印測試結果
  private printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 負載測試結果');
    console.log('='.repeat(80));

    let totalRequests = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;

    for (const [endpoint, result] of this.results) {
      console.log(`\n🔗 端點: ${endpoint}`);
      console.log(`   總請求數: ${result.totalRequests}`);
      console.log(`   成功請求: ${result.successfulRequests}`);
      console.log(`   失敗請求: ${result.failedRequests}`);
      console.log(`   成功率: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%`);
      console.log(`   平均響應時間: ${result.averageResponseTime.toFixed(0)}ms`);
      console.log(`   最快響應: ${result.minResponseTime}ms`);
      console.log(`   最慢響應: ${result.maxResponseTime}ms`);
      console.log(`   每秒請求數: ${result.requestsPerSecond.toFixed(1)} RPS`);

      if (result.errors.length > 0) {
        console.log(`   錯誤類型: ${result.errors.join(', ')}`);
      }

      totalRequests += result.totalRequests;
      totalSuccessful += result.successfulRequests;
      totalFailed += result.failedRequests;
    }

    console.log('\n' + '='.repeat(80));
    console.log('📈 總體統計');
    console.log('='.repeat(80));
    console.log(`總請求數: ${totalRequests}`);
    console.log(`總成功數: ${totalSuccessful}`);
    console.log(`總失敗數: ${totalFailed}`);
    console.log(`整體成功率: ${((totalSuccessful / totalRequests) * 100).toFixed(1)}%`);
    console.log('='.repeat(80));
  }

  // 生成負載測試報告
  generateReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      results: Object.fromEntries(this.results)
    };

    return JSON.stringify(report, null, 2);
  }
}

// 主函數
async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || 'http://localhost:8787';
  const concurrency = parseInt(args[1]) || 5;
  const duration = parseInt(args[2]) || 30;

  const config: LoadTestConfig = {
    baseUrl,
    concurrency,
    duration,
    endpoints: [
      '/',
      '/api/health',
      '/api/conversations',
      '/api/customers'
    ]
  };

  const tester = new LoadTester(config);
  
  try {
    await tester.runLoadTest();
    
    // 生成報告文件
    const report = tester.generateReport();
    const fs = await import('fs');
    const { join } = await import('path');
    const reportPath = join(process.cwd(), 'load-test-report.json');
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 負載測試報告已保存到: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ 負載測試執行失敗:', error);
    process.exit(1);
  }
}

// 如果直接執行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { LoadTester, LoadTestConfig, LoadTestResult };