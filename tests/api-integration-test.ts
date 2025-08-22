#!/usr/bin/env node

/**
 * API 整合測試腳本
 * 測試完整的業務流程和端點間的整合
 */

interface IntegrationTestConfig {
  baseUrl: string;
  timeout: number;
}

interface TestStep {
  name: string;
  method: string;
  path: string;
  data?: any;
  headers?: Record<string, string>;
  expectedStatus: number;
  validate?: (response: any) => boolean;
  saveResponse?: string; // 保存響應中的某個字段到上下文
}

interface TestScenario {
  name: string;
  description: string;
  steps: TestStep[];
}

class IntegrationTester {
  private config: IntegrationTestConfig;
  private context: Record<string, any> = {};
  private results: Array<{ scenario: string; step: string; success: boolean; error?: string }> = [];

  constructor(config: IntegrationTestConfig) {
    this.config = config;
  }

  // 定義測試場景
  private getTestScenarios(): TestScenario[] {
    return [
      {
        name: 'user-authentication-flow',
        description: '用戶認證流程測試',
        steps: [
          {
            name: '用戶註冊',
            method: 'POST',
            path: '/api/auth/register',
            data: {
              username: 'integration-test@example.com',
              password: 'testpassword123',
              role: 'agent'
            },
            expectedStatus: 201,
            validate: (response) => response.success === true
          },
          {
            name: '用戶登入',
            method: 'POST',
            path: '/api/auth/login',
            data: {
              username: 'integration-test@example.com',
              password: 'testpassword123'
            },
            expectedStatus: 200,
            saveResponse: 'token',
            validate: (response) => !!response.token
          },
          {
            name: '獲取用戶資訊',
            method: 'GET',
            path: '/api/auth/me',
            expectedStatus: 200,
            validate: (response) => response.username === 'integration-test@example.com'
          },
          {
            name: '用戶登出',
            method: 'POST',
            path: '/api/auth/logout',
            expectedStatus: 200
          }
        ]
      },
      {
        name: 'conversation-management-flow',
        description: '對話管理流程測試',
        steps: [
          {
            name: '登入獲取 token',
            method: 'POST',
            path: '/api/auth/login',
            data: {
              username: 'integration-test@example.com',
              password: 'testpassword123'
            },
            expectedStatus: 200,
            saveResponse: 'token'
          },
          {
            name: '獲取對話列表',
            method: 'GET',
            path: '/api/conversations',
            expectedStatus: 200,
            validate: (response) => Array.isArray(response.conversations)
          },
          {
            name: '獲取待處理對話',
            method: 'GET',
            path: '/api/conversations/pending',
            expectedStatus: 200,
            validate: (response) => Array.isArray(response.conversations)
          },
          {
            name: '獲取已分配對話',
            method: 'GET',
            path: '/api/conversations/assigned',
            expectedStatus: 200,
            validate: (response) => Array.isArray(response.conversations)
          }
        ]
      },
      {
        name: 'customer-management-flow',
        description: '客戶管理流程測試',
        steps: [
          {
            name: '登入獲取 token',
            method: 'POST',
            path: '/api/auth/login',
            data: {
              username: 'integration-test@example.com',
              password: 'testpassword123'
            },
            expectedStatus: 200,
            saveResponse: 'token'
          },
          {
            name: '獲取客戶列表',
            method: 'GET',
            path: '/api/customers',
            expectedStatus: 200,
            validate: (response) => Array.isArray(response.customers)
          },
          {
            name: '搜索客戶',
            method: 'GET',
            path: '/api/customers/search?q=test',
            expectedStatus: 200,
            validate: (response) => Array.isArray(response.customers)
          }
        ]
      },
      {
        name: 'delayed-message-flow',
        description: '延遲訊息流程測試',
        steps: [
          {
            name: '登入獲取 token',
            method: 'POST',
            path: '/api/auth/login',
            data: {
              username: 'integration-test@example.com',
              password: 'testpassword123'
            },
            expectedStatus: 200,
            saveResponse: 'token'
          },
          {
            name: '創建延遲訊息',
            method: 'POST',
            path: '/api/delayed-messages',
            data: {
              content: 'Integration test delayed message',
              scheduledAt: new Date(Date.now() + 60000).toISOString(),
              conversationId: 'test-conversation-id'
            },
            expectedStatus: 201,
            saveResponse: 'id',
            validate: (response) => !!response.id
          },
          {
            name: '獲取延遲訊息列表',
            method: 'GET',
            path: '/api/delayed-messages',
            expectedStatus: 200,
            validate: (response) => Array.isArray(response.messages)
          },
          {
            name: '取消延遲訊息',
            method: 'DELETE',
            path: '/api/delayed-messages/{id}',
            expectedStatus: 200
          }
        ]
      },
      {
        name: 'qr-code-flow',
        description: 'QR Code 流程測試',
        steps: [
          {
            name: '登入獲取 token',
            method: 'POST',
            path: '/api/auth/login',
            data: {
              username: 'integration-test@example.com',
              password: 'testpassword123'
            },
            expectedStatus: 200,
            saveResponse: 'token'
          },
          {
            name: '創建 QR Code',
            method: 'POST',
            path: '/api/qr-codes',
            data: {
              name: 'Integration Test QR Code',
              type: 'join'
            },
            expectedStatus: 201,
            saveResponse: 'id',
            validate: (response) => !!response.id
          },
          {
            name: '獲取 QR Code 列表',
            method: 'GET',
            path: '/api/qr-codes',
            expectedStatus: 200,
            validate: (response) => Array.isArray(response.qrCodes)
          }
        ]
      },
      {
        name: 'webhook-flow',
        description: 'Webhook 流程測試',
        steps: [
          {
            name: '發送空事件到 Webhook',
            method: 'POST',
            path: '/api/webhook',
            data: {
              events: []
            },
            headers: {
              'x-line-signature': 'test-signature'
            },
            expectedStatus: 200,
            validate: (response) => response.message === 'No events received'
          },
          {
            name: '發送測試訊息事件',
            method: 'POST',
            path: '/api/webhook',
            data: {
              events: [
                {
                  type: 'message',
                  message: {
                    type: 'text',
                    text: 'Integration test message',
                    id: 'test-message-id'
                  },
                  source: {
                    userId: 'test-user-id'
                  },
                  replyToken: 'test-reply-token',
                  timestamp: Date.now()
                }
              ]
            },
            headers: {
              'x-line-signature': 'test-signature'
            },
            expectedStatus: 200,
            validate: (response) => response.message === 'OK'
          }
        ]
      }
    ];
  }

  // 執行單個測試步驟
  private async executeStep(step: TestStep): Promise<{ success: boolean; error?: string; response?: any }> {
    try {
      // 替換路徑中的變數
      let path = step.path;
      for (const [key, value] of Object.entries(this.context)) {
        path = path.replace(`{${key}}`, value);
      }

      const url = `${this.config.baseUrl}${path}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...step.headers
      };

      // 如果上下文中有 token，自動添加到 Authorization header
      if (this.context.token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${this.context.token}`;
      }

      const options: RequestInit = {
        method: step.method,
        headers,
        signal: AbortSignal.timeout(this.config.timeout)
      };

      if (step.data && ['POST', 'PUT', 'PATCH'].includes(step.method)) {
        options.body = JSON.stringify(step.data);
      }

      const response = await fetch(url, options);
      const responseData = await response.json().catch(() => ({}));

      // 檢查狀態碼
      if (response.status !== step.expectedStatus) {
        return {
          success: false,
          error: `Expected status ${step.expectedStatus}, got ${response.status}`,
          response: responseData
        };
      }

      // 執行自定義驗證
      if (step.validate && !step.validate(responseData)) {
        return {
          success: false,
          error: 'Custom validation failed',
          response: responseData
        };
      }

      // 保存響應數據到上下文
      if (step.saveResponse && responseData[step.saveResponse]) {
        this.context[step.saveResponse] = responseData[step.saveResponse];
      }

      return {
        success: true,
        response: responseData
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 執行測試場景
  private async executeScenario(scenario: TestScenario): Promise<boolean> {
    console.log(`\n🎬 執行場景: ${scenario.name}`);
    console.log(`   描述: ${scenario.description}`);
    
    let allStepsSuccessful = true;

    for (const step of scenario.steps) {
      console.log(`   🔄 執行步驟: ${step.name}`);
      
      const result = await this.executeStep(step);
      
      this.results.push({
        scenario: scenario.name,
        step: step.name,
        success: result.success,
        error: result.error
      });

      if (result.success) {
        console.log(`      ✅ 成功`);
      } else {
        console.log(`      ❌ 失敗: ${result.error}`);
        allStepsSuccessful = false;
        // 如果某個步驟失敗，可以選擇繼續或停止
        // break; // 取消註解以在第一個失敗時停止
      }
    }

    return allStepsSuccessful;
  }

  // 執行所有整合測試
  async runIntegrationTests(): Promise<void> {
    console.log('🚀 開始 API 整合測試...\n');
    console.log(`測試目標: ${this.config.baseUrl}`);
    console.log(`超時設定: ${this.config.timeout}ms`);

    const scenarios = this.getTestScenarios();
    let successfulScenarios = 0;

    for (const scenario of scenarios) {
      const success = await this.executeScenario(scenario);
      if (success) {
        successfulScenarios++;
      }
    }

    this.printSummary(scenarios.length, successfulScenarios);
  }

  // 打印測試摘要
  private printSummary(totalScenarios: number, successfulScenarios: number): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 整合測試摘要');
    console.log('='.repeat(80));
    console.log(`總場景數: ${totalScenarios}`);
    console.log(`成功場景: ${successfulScenarios}`);
    console.log(`失敗場景: ${totalScenarios - successfulScenarios}`);
    console.log(`成功率: ${((successfulScenarios / totalScenarios) * 100).toFixed(1)}%`);

    // 顯示詳細結果
    const failedResults = this.results.filter(r => !r.success);
    if (failedResults.length > 0) {
      console.log('\n❌ 失敗的步驟:');
      failedResults.forEach(result => {
        console.log(`   ${result.scenario} -> ${result.step}: ${result.error}`);
      });
    }

    // 按場景分組顯示結果
    console.log('\n📋 場景詳情:');
    const scenarioGroups = this.results.reduce((groups, result) => {
      if (!groups[result.scenario]) {
        groups[result.scenario] = [];
      }
      groups[result.scenario].push(result);
      return groups;
    }, {} as Record<string, typeof this.results>);

    for (const [scenarioName, results] of Object.entries(scenarioGroups)) {
      const successful = results.filter(r => r.success).length;
      const total = results.length;
      const status = successful === total ? '✅' : '❌';
      console.log(`   ${status} ${scenarioName}: ${successful}/${total} 步驟成功`);
    }

    console.log('='.repeat(80));
  }

  // 生成整合測試報告
  generateReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      context: this.context,
      results: this.results,
      summary: {
        totalSteps: this.results.length,
        successfulSteps: this.results.filter(r => r.success).length,
        failedSteps: this.results.filter(r => !r.success).length
      }
    };

    return JSON.stringify(report, null, 2);
  }
}

// 主函數
async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || 'http://localhost:8787';
  const timeout = parseInt(args[1]) || 15000;

  const config: IntegrationTestConfig = {
    baseUrl,
    timeout
  };

  const tester = new IntegrationTester(config);
  
  try {
    await tester.runIntegrationTests();
    
    // 生成報告文件
    const report = tester.generateReport();
    const fs = await import('fs');
    const { join } = await import('path');
    const reportPath = join(process.cwd(), 'integration-test-report.json');
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 整合測試報告已保存到: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ 整合測試執行失敗:', error);
    process.exit(1);
  }
}

// 如果直接執行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { IntegrationTester, IntegrationTestConfig, TestScenario, TestStep };