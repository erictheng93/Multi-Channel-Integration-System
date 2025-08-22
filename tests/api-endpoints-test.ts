#!/usr/bin/env node

/**
 * 完整的 API 端點測試腳本
 * 測試所有 API 端點是否正常工作
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// 測試配置
interface TestConfig {
  baseUrl: string;
  authToken?: string | null;
  timeout: number;
}

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  error?: string;
  responseTime: number;
}

interface ApiEndpoint {
  path: string;
  method: string;
  description: string;
  requiresAuth: boolean;
  expectedStatus: number;
  testData?: any;
  headers?: Record<string, string>;
}

class ApiTester {
  private config: TestConfig;
  private results: TestResult[] = [];

  constructor(config: TestConfig) {
    this.config = config;
  }

  // 定義所有 API 端點
  private getEndpoints(): ApiEndpoint[] {
    return [
      // ==================== 基礎路由 ====================
      {
        path: '/',
        method: 'GET',
        description: '根路由健康檢查',
        requiresAuth: false,
        expectedStatus: 200
      },
      {
        path: '/api/health',
        method: 'GET',
        description: '系統健康檢查',
        requiresAuth: false,
        expectedStatus: 200
      },
      {
        path: '/api/stats',
        method: 'GET',
        description: '系統統計資訊',
        requiresAuth: true,
        expectedStatus: 200
      },

      // ==================== 認證相關 ====================
      {
        path: '/api/auth/login',
        method: 'POST',
        description: '用戶登入',
        requiresAuth: false,
        expectedStatus: 200,
        testData: {
          username: 'test@example.com',
          password: 'testpassword'
        }
      },
      {
        path: '/api/auth/register',
        method: 'POST',
        description: '用戶註冊',
        requiresAuth: false,
        expectedStatus: 201,
        testData: {
          username: 'newuser@example.com',
          password: 'newpassword',
          role: 'agent'
        }
      },
      {
        path: '/api/auth/me',
        method: 'GET',
        description: '獲取當前用戶資訊',
        requiresAuth: true,
        expectedStatus: 200
      },
      {
        path: '/api/auth/logout',
        method: 'POST',
        description: '用戶登出',
        requiresAuth: true,
        expectedStatus: 200
      },

      // ==================== 團隊管理 ====================
      {
        path: '/api/teams',
        method: 'GET',
        description: '獲取團隊列表',
        requiresAuth: true,
        expectedStatus: 200
      },
      {
        path: '/api/teams',
        method: 'POST',
        description: '創建新團隊',
        requiresAuth: true,
        expectedStatus: 201,
        testData: {
          name: 'Test Team',
          description: 'A test team'
        }
      },

      // ==================== 對話管理 ====================
      {
        path: '/api/conversations',
        method: 'GET',
        description: '獲取對話列表',
        requiresAuth: true,
        expectedStatus: 200
      },
      {
        path: '/api/conversations/pending',
        method: 'GET',
        description: '獲取待處理對話',
        requiresAuth: true,
        expectedStatus: 200
      },
      {
        path: '/api/conversations/assigned',
        method: 'GET',
        description: '獲取已分配對話',
        requiresAuth: true,
        expectedStatus: 200
      },

      // ==================== 客戶管理 ====================
      {
        path: '/api/customers',
        method: 'GET',
        description: '獲取客戶列表',
        requiresAuth: true,
        expectedStatus: 200
      },
      {
        path: '/api/customers/search',
        method: 'GET',
        description: '搜索客戶',
        requiresAuth: true,
        expectedStatus: 200
      },

      // ==================== 延遲訊息 ====================
      {
        path: '/api/delayed-messages',
        method: 'GET',
        description: '獲取延遲訊息列表',
        requiresAuth: true,
        expectedStatus: 200
      },
      {
        path: '/api/delayed-messages',
        method: 'POST',
        description: '創建延遲訊息',
        requiresAuth: true,
        expectedStatus: 201,
        testData: {
          content: 'Test delayed message',
          scheduledAt: new Date(Date.now() + 60000).toISOString(),
          conversationId: 'test-conversation-id'
        }
      },

      // ==================== QR Code ====================
      {
        path: '/api/qr-codes',
        method: 'GET',
        description: '獲取 QR Code 列表',
        requiresAuth: true,
        expectedStatus: 200
      },
      {
        path: '/api/qr-codes',
        method: 'POST',
        description: '創建 QR Code',
        requiresAuth: true,
        expectedStatus: 201,
        testData: {
          name: 'Test QR Code',
          type: 'join'
        }
      },

      // ==================== 會話管理 ====================
      {
        path: '/api/sessions',
        method: 'GET',
        description: '獲取會話列表',
        requiresAuth: true,
        expectedStatus: 200
      },

      // ==================== Webhook (測試用) ====================
      {
        path: '/api/webhook',
        method: 'POST',
        description: 'LINE Webhook 端點',
        requiresAuth: false,
        expectedStatus: 200,
        testData: {
          events: []
        },
        headers: {
          'x-line-signature': 'test-signature'
        }
      }
    ];
  }

  // 執行單個端點測試
  private async testEndpoint(endpoint: ApiEndpoint): Promise<TestResult> {
    const startTime = Date.now();
    const url = `${this.config.baseUrl}${endpoint.path}`;
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...endpoint.headers
      };

      // 如果需要認證，添加 Authorization header
      if (endpoint.requiresAuth && this.config.authToken) {
        headers['Authorization'] = `Bearer ${this.config.authToken}`;
      }

      const options: RequestInit = {
        method: endpoint.method,
        headers,
        signal: AbortSignal.timeout(this.config.timeout)
      };

      // 如果有測試資料，添加到請求體
      if (endpoint.testData && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        options.body = JSON.stringify(endpoint.testData);
      }

      const response = await fetch(url, options);
      const responseTime = Date.now() - startTime;

      const success = response.status === endpoint.expectedStatus || 
                     (response.status >= 200 && response.status < 300);

      return {
        endpoint: endpoint.path,
        method: endpoint.method,
        status: response.status,
        success,
        responseTime,
        error: success ? undefined : `Expected ${endpoint.expectedStatus}, got ${response.status}`
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        endpoint: endpoint.path,
        method: endpoint.method,
        status: 0,
        success: false,
        responseTime,
        error: error.message
      };
    }
  }

  // 嘗試獲取認證 token
  private async getAuthToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'admin@example.com',
          password: 'admin123'
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.token || data.accessToken || null;
      }
    } catch (error) {
      console.warn('無法獲取認證 token，將跳過需要認證的端點');
    }
    return null;
  }

  // 執行所有測試
  async runAllTests(): Promise<void> {
    console.log('🚀 開始 API 端點測試...\n');
    console.log(`測試目標: ${this.config.baseUrl}`);
    console.log(`超時設定: ${this.config.timeout}ms\n`);

    // 嘗試獲取認證 token
    console.log('🔐 嘗試獲取認證 token...');
    this.config.authToken = await this.getAuthToken();
    if (this.config.authToken) {
      console.log('✅ 成功獲取認證 token');
    } else {
      console.log('⚠️  無法獲取認證 token，將跳過需要認證的端點');
    }
    console.log('');

    const endpoints = this.getEndpoints();
    let testCount = 0;
    let successCount = 0;

    for (const endpoint of endpoints) {
      // 如果端點需要認證但沒有 token，跳過測試
      if (endpoint.requiresAuth && !this.config.authToken) {
        console.log(`⏭️  跳過 ${endpoint.method} ${endpoint.path} (需要認證)`);
        continue;
      }

      testCount++;
      console.log(`🧪 測試 ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);
      
      const result = await this.testEndpoint(endpoint);
      this.results.push(result);

      if (result.success) {
        successCount++;
        console.log(`   ✅ 成功 (${result.status}) - ${result.responseTime}ms`);
      } else {
        console.log(`   ❌ 失敗 (${result.status}) - ${result.error} - ${result.responseTime}ms`);
      }
    }

    this.printSummary(testCount, successCount);
  }

  // 打印測試摘要
  private printSummary(testCount: number, successCount: number): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 測試摘要');
    console.log('='.repeat(60));
    console.log(`總測試數: ${testCount}`);
    console.log(`成功: ${successCount}`);
    console.log(`失敗: ${testCount - successCount}`);
    console.log(`成功率: ${((successCount / testCount) * 100).toFixed(1)}%`);
    
    // 顯示失敗的測試
    const failures = this.results.filter(r => !r.success);
    if (failures.length > 0) {
      console.log('\n❌ 失敗的端點:');
      failures.forEach(failure => {
        console.log(`   ${failure.method} ${failure.endpoint}: ${failure.error}`);
      });
    }

    // 顯示響應時間統計
    const responseTimes = this.results.map(r => r.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);

    console.log('\n⏱️  響應時間統計:');
    console.log(`   平均: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`   最快: ${minResponseTime}ms`);
    console.log(`   最慢: ${maxResponseTime}ms`);

    console.log('\n' + '='.repeat(60));
  }

  // 生成測試報告
  generateReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      summary: {
        total: this.results.length,
        success: this.results.filter(r => r.success).length,
        failed: this.results.filter(r => !r.success).length
      },
      results: this.results
    };

    return JSON.stringify(report, null, 2);
  }
}

// 主函數
async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || 'http://localhost:8787';
  const timeout = parseInt(args[1]) || 10000;

  const config: TestConfig = {
    baseUrl,
    timeout
  };

  const tester = new ApiTester(config);
  
  try {
    await tester.runAllTests();
    
    // 生成報告文件
    const report = tester.generateReport();
    const fs = await import('fs');
    const reportPath = join(process.cwd(), 'api-test-report.json');
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 測試報告已保存到: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ 測試執行失敗:', error);
    process.exit(1);
  }
}

// 如果直接執行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ApiTester, TestConfig, TestResult, ApiEndpoint };