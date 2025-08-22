#!/usr/bin/env node

/**
 * LINE OA 雙向連接測試工具
 * 測試 LINE OA 與系統的完整連接狀態
 */

interface LineConnectionTestConfig {
  webhookUrl: string;
  lineChannelAccessToken?: string;
  lineChannelSecret?: string;
  timeout: number;
}

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  details?: any;
  responseTime?: number;
}

class LineConnectionTester {
  private config: LineConnectionTestConfig;
  private results: TestResult[] = [];

  constructor(config: LineConnectionTestConfig) {
    this.config = config;
  }

  // 測試 1: Webhook 端點可達性
  async testWebhookReachability(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔗 測試 Webhook 端點可達性...');
      
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-signature': 'test-signature'
        },
        body: JSON.stringify({
          events: []
        }),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      const responseTime = Date.now() - startTime;
      const responseText = await response.text();

      if (response.ok) {
        return {
          test: 'webhook-reachability',
          success: true,
          message: `Webhook 端點可達 (${response.status})`,
          responseTime,
          details: {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseText
          }
        };
      } else {
        return {
          test: 'webhook-reachability',
          success: false,
          message: `Webhook 端點返回錯誤 (${response.status})`,
          responseTime,
          details: {
            status: response.status,
            body: responseText
          }
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        test: 'webhook-reachability',
        success: false,
        message: `Webhook 端點無法連接: ${error.message}`,
        responseTime,
        details: { error: error.message }
      };
    }
  }

  // 測試 2: 模擬 LINE Webhook 事件
  async testWebhookEventProcessing(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log('📨 測試 Webhook 事件處理...');
      
      const testEvent = {
        events: [
          {
            type: 'message',
            message: {
              type: 'text',
              text: 'LINE 連接測試訊息',
              id: 'test-message-' + Date.now()
            },
            source: {
              userId: 'test-user-' + Date.now()
            },
            replyToken: 'test-reply-token-' + Date.now(),
            timestamp: Date.now()
          }
        ],
        destination: 'test-destination'
      };

      // 生成測試簽名（如果有 channel secret）
      let signature = 'test-signature';
      if (this.config.lineChannelSecret) {
        signature = await this.generateLineSignature(
          JSON.stringify(testEvent), 
          this.config.lineChannelSecret
        );
      }

      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-signature': signature
        },
        body: JSON.stringify(testEvent),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      const responseTime = Date.now() - startTime;
      const responseText = await response.text();

      if (response.ok) {
        return {
          test: 'webhook-event-processing',
          success: true,
          message: `Webhook 事件處理成功 (${response.status})`,
          responseTime,
          details: {
            status: response.status,
            body: responseText,
            testEvent
          }
        };
      } else {
        return {
          test: 'webhook-event-processing',
          success: false,
          message: `Webhook 事件處理失敗 (${response.status})`,
          responseTime,
          details: {
            status: response.status,
            body: responseText,
            testEvent
          }
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        test: 'webhook-event-processing',
        success: false,
        message: `Webhook 事件處理錯誤: ${error.message}`,
        responseTime,
        details: { error: error.message }
      };
    }
  }

  // 測試 3: LINE API 連接（如果有 access token）
  async testLineApiConnection(): Promise<TestResult> {
    if (!this.config.lineChannelAccessToken) {
      return {
        test: 'line-api-connection',
        success: false,
        message: '跳過 LINE API 測試 - 未提供 Channel Access Token',
        details: { reason: 'no-access-token' }
      };
    }

    const startTime = Date.now();
    
    try {
      console.log('🔑 測試 LINE API 連接...');
      
      // 測試 LINE API - 獲取 bot 資訊
      const response = await fetch('https://api.line.me/v2/bot/info', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.lineChannelAccessToken}`
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      const responseTime = Date.now() - startTime;
      const responseData = await response.json();

      if (response.ok) {
        return {
          test: 'line-api-connection',
          success: true,
          message: `LINE API 連接成功 - Bot: ${responseData.displayName}`,
          responseTime,
          details: {
            botInfo: responseData,
            status: response.status
          }
        };
      } else {
        return {
          test: 'line-api-connection',
          success: false,
          message: `LINE API 連接失敗 (${response.status})`,
          responseTime,
          details: {
            status: response.status,
            error: responseData
          }
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        test: 'line-api-connection',
        success: false,
        message: `LINE API 連接錯誤: ${error.message}`,
        responseTime,
        details: { error: error.message }
      };
    }
  }

  // 測試 4: 測試推送訊息功能（需要真實的 user ID）
  async testPushMessage(userId?: string): Promise<TestResult> {
    if (!this.config.lineChannelAccessToken) {
      return {
        test: 'push-message',
        success: false,
        message: '跳過推送訊息測試 - 未提供 Channel Access Token',
        details: { reason: 'no-access-token' }
      };
    }

    if (!userId) {
      return {
        test: 'push-message',
        success: false,
        message: '跳過推送訊息測試 - 未提供測試用戶 ID',
        details: { reason: 'no-user-id' }
      };
    }

    const startTime = Date.now();
    
    try {
      console.log('📤 測試推送訊息功能...');
      
      const pushMessage = {
        to: userId,
        messages: [
          {
            type: 'text',
            text: `LINE 連接測試 - ${new Date().toLocaleString('zh-TW')}`
          }
        ]
      };

      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.lineChannelAccessToken}`
        },
        body: JSON.stringify(pushMessage),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      const responseTime = Date.now() - startTime;
      const responseText = await response.text();

      if (response.ok) {
        return {
          test: 'push-message',
          success: true,
          message: `推送訊息成功發送到用戶 ${userId.slice(0, 8)}...`,
          responseTime,
          details: {
            status: response.status,
            userId: userId.slice(0, 8) + '...',
            message: pushMessage.messages[0].text
          }
        };
      } else {
        return {
          test: 'push-message',
          success: false,
          message: `推送訊息失敗 (${response.status})`,
          responseTime,
          details: {
            status: response.status,
            error: responseText,
            userId: userId.slice(0, 8) + '...'
          }
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        test: 'push-message',
        success: false,
        message: `推送訊息錯誤: ${error.message}`,
        responseTime,
        details: { error: error.message }
      };
    }
  }

  // 測試 5: 檢查系統 API 健康狀態
  async testSystemHealth(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log('🏥 測試系統健康狀態...');
      
      const baseUrl = this.config.webhookUrl.replace('/api/webhook', '');
      const healthUrl = `${baseUrl}/api/health`;
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeout)
      });

      const responseTime = Date.now() - startTime;
      const responseData = await response.json();

      if (response.ok) {
        return {
          test: 'system-health',
          success: true,
          message: `系統健康狀態正常`,
          responseTime,
          details: {
            status: response.status,
            health: responseData
          }
        };
      } else {
        return {
          test: 'system-health',
          success: false,
          message: `系統健康檢查失敗 (${response.status})`,
          responseTime,
          details: {
            status: response.status,
            error: responseData
          }
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        test: 'system-health',
        success: false,
        message: `系統健康檢查錯誤: ${error.message}`,
        responseTime,
        details: { error: error.message }
      };
    }
  }

  // 生成 LINE 簽名
  private async generateLineSignature(body: string, secret: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
      return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    } catch (error) {
      console.warn('無法生成 LINE 簽名，使用測試簽名');
      return 'test-signature';
    }
  }

  // 執行所有測試
  async runAllTests(testUserId?: string): Promise<void> {
    console.log('🚀 開始 LINE OA 雙向連接測試...\n');
    console.log(`Webhook URL: ${this.config.webhookUrl}`);
    console.log(`超時設定: ${this.config.timeout}ms`);
    console.log(`LINE Channel Access Token: ${this.config.lineChannelAccessToken ? '已設定' : '未設定'}`);
    console.log(`LINE Channel Secret: ${this.config.lineChannelSecret ? '已設定' : '未設定'}`);
    if (testUserId) {
      console.log(`測試用戶 ID: ${testUserId.slice(0, 8)}...`);
    }
    console.log('');

    // 執行所有測試
    const tests = [
      () => this.testSystemHealth(),
      () => this.testWebhookReachability(),
      () => this.testWebhookEventProcessing(),
      () => this.testLineApiConnection(),
      () => this.testPushMessage(testUserId)
    ];

    for (const test of tests) {
      const result = await test();
      this.results.push(result);
      
      if (result.success) {
        console.log(`✅ ${result.message} (${result.responseTime || 0}ms)`);
      } else {
        console.log(`❌ ${result.message} (${result.responseTime || 0}ms)`);
      }
    }

    this.printSummary();
  }

  // 打印測試摘要
  private printSummary(): void {
    const successful = this.results.filter(r => r.success).length;
    const total = this.results.length;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 LINE OA 連接測試摘要');
    console.log('='.repeat(80));
    console.log(`總測試數: ${total}`);
    console.log(`成功: ${successful}`);
    console.log(`失敗: ${total - successful}`);
    console.log(`成功率: ${((successful / total) * 100).toFixed(1)}%`);

    // 詳細結果
    console.log('\n📋 測試詳情:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.test}: ${result.message}`);
    });

    // 連接狀態評估
    console.log('\n🔍 連接狀態評估:');
    
    const webhookTest = this.results.find(r => r.test === 'webhook-reachability');
    const eventTest = this.results.find(r => r.test === 'webhook-event-processing');
    const apiTest = this.results.find(r => r.test === 'line-api-connection');
    const pushTest = this.results.find(r => r.test === 'push-message');

    if (webhookTest?.success && eventTest?.success) {
      console.log('   📥 接收訊息: ✅ 正常 - 可以接收來自 LINE 的訊息');
    } else {
      console.log('   📥 接收訊息: ❌ 異常 - 無法正常接收 LINE 訊息');
    }

    if (apiTest?.success) {
      console.log('   📤 發送訊息: ✅ 正常 - 可以發送訊息到 LINE');
      if (pushTest?.success) {
        console.log('   📤 推送測試: ✅ 成功 - 推送訊息功能正常');
      } else if (pushTest && !pushTest.success && pushTest.details?.reason !== 'no-user-id') {
        console.log('   📤 推送測試: ❌ 失敗 - 推送訊息功能異常');
      } else {
        console.log('   📤 推送測試: ⏭️ 跳過 - 未提供測試用戶 ID');
      }
    } else if (apiTest && !apiTest.success && apiTest.details?.reason !== 'no-access-token') {
      console.log('   📤 發送訊息: ❌ 異常 - 無法發送訊息到 LINE');
    } else {
      console.log('   📤 發送訊息: ⏭️ 跳過 - 未提供 Channel Access Token');
    }

    // 建議
    console.log('\n💡 建議:');
    if (!webhookTest?.success) {
      console.log('   • 檢查 Webhook URL 是否正確設定');
      console.log('   • 確認網域 DNS 設定正確');
      console.log('   • 檢查 Cloudflare Worker 部署狀態');
    }
    
    if (!eventTest?.success && webhookTest?.success) {
      console.log('   • 檢查 LINE Channel Secret 設定');
      console.log('   • 確認簽名驗證邏輯正確');
    }
    
    if (!apiTest?.success && this.config.lineChannelAccessToken) {
      console.log('   • 檢查 LINE Channel Access Token 是否有效');
      console.log('   • 確認 LINE Bot 設定正確');
    }

    if (!this.config.lineChannelAccessToken) {
      console.log('   • 設定 LINE Channel Access Token 以測試發送功能');
    }

    if (!this.config.lineChannelSecret) {
      console.log('   • 設定 LINE Channel Secret 以進行簽名驗證');
    }

    console.log('='.repeat(80));
  }

  // 生成測試報告
  generateReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      config: {
        webhookUrl: this.config.webhookUrl,
        hasAccessToken: !!this.config.lineChannelAccessToken,
        hasChannelSecret: !!this.config.lineChannelSecret,
        timeout: this.config.timeout
      },
      summary: {
        total: this.results.length,
        successful: this.results.filter(r => r.success).length,
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
  
  // 從命令行參數或環境變數獲取配置
  const webhookUrl = args[0] || process.env.WEBHOOK_URL || 'https://multi-channel.imfinethankyouandyou.com/api/webhook';
  const lineChannelAccessToken = args[1] || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const lineChannelSecret = args[2] || process.env.LINE_CHANNEL_SECRET;
  const testUserId = args[3] || process.env.TEST_USER_ID;
  const timeout = parseInt(args[4]) || 15000;

  const config: LineConnectionTestConfig = {
    webhookUrl,
    lineChannelAccessToken,
    lineChannelSecret,
    timeout
  };

  const tester = new LineConnectionTester(config);
  
  try {
    await tester.runAllTests(testUserId);
    
    // 生成報告文件
    const report = tester.generateReport();
    const fs = await import('fs');
    const { join } = await import('path');
    const reportPath = join(process.cwd(), 'line-connection-test-report.json');
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 測試報告已保存到: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ LINE 連接測試執行失敗:', error);
    process.exit(1);
  }
}

// 如果直接執行此腳本
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].includes('test-line-connection.ts')) {
  main().catch(console.error);
}

export { LineConnectionTester, LineConnectionTestConfig, TestResult };