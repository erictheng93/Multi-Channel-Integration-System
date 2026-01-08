#!/usr/bin/env node

/**
 * LINE OA ?™å???¥æ¸¬è©¦å·¥å…·
 * æ¸¬è©¦ LINE OA ?‡ç³»çµ±ç?å®Œæ•´??¥?€?? */

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

  // æ¸¬è©¦ 1: Webhook ç«¯é??¯é???  async testWebhookReachability(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log('?? æ¸¬è©¦ Webhook ç«¯é??¯é???..');
      
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
          message: `Webhook ç«¯é??¯é? (${response.status})`,
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
          message: `Webhook ç«¯é?è¿”å??¯èª¤ (${response.status})`,
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
        message: `Webhook ç«¯é??¡æ???¥: ${error.message}`,
        responseTime,
        details: { error: error.message }
      };
    }
  }

  // æ¸¬è©¦ 2: æ¨¡æ“¬ LINE Webhook äº‹ä»¶
  async testWebhookEventProcessing(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log('?“¨ æ¸¬è©¦ Webhook äº‹ä»¶?•ç?...');
      
      const testEvent = {
        events: [
          {
            type: 'message',
            message: {
              type: 'text',
              text: 'LINE ??¥æ¸¬è©¦è¨Šæ¯',
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

      // ?Ÿæ?æ¸¬è©¦ç°½å?ï¼ˆå??œæ? channel secretï¼?      let signature = 'test-signature';
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
          message: `Webhook äº‹ä»¶?•ç??å? (${response.status})`,
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
          message: `Webhook äº‹ä»¶?•ç?å¤±æ? (${response.status})`,
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
        message: `Webhook äº‹ä»¶?•ç??¯èª¤: ${error.message}`,
        responseTime,
        details: { error: error.message }
      };
    }
  }

  // æ¸¬è©¦ 3: LINE API ??¥ï¼ˆå??œæ? access tokenï¼?  async testLineApiConnection(): Promise<TestResult> {
    if (!this.config.lineChannelAccessToken) {
      return {
        test: 'line-api-connection',
        success: false,
        message: 'è·³é? LINE API æ¸¬è©¦ - ?ªæ?ä¾?Channel Access Token',
        details: { reason: 'no-access-token' }
      };
    }

    const startTime = Date.now();
    
    try {
      console.log('?? æ¸¬è©¦ LINE API ??¥...');
      
      // æ¸¬è©¦ LINE API - ?²å? bot è³‡è?
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
          message: `LINE API ??¥?å? - Bot: ${responseData.displayName}`,
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
          message: `LINE API ??¥å¤±æ? (${response.status})`,
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
        message: `LINE API ??¥?¯èª¤: ${error.message}`,
        responseTime,
        details: { error: error.message }
      };
    }
  }

  // æ¸¬è©¦ 4: æ¸¬è©¦?¨é€è??¯å??½ï??€è¦ç?å¯¦ç? user IDï¼?  async testPushMessage(userId?: string): Promise<TestResult> {
    if (!this.config.lineChannelAccessToken) {
      return {
        test: 'push-message',
        success: false,
        message: 'è·³é??¨é€è??¯æ¸¬è©?- ?ªæ?ä¾?Channel Access Token',
        details: { reason: 'no-access-token' }
      };
    }

    if (!userId) {
      return {
        test: 'push-message',
        success: false,
        message: 'è·³é??¨é€è??¯æ¸¬è©?- ?ªæ?ä¾›æ¸¬è©¦ç”¨??ID',
        details: { reason: 'no-user-id' }
      };
    }

    const startTime = Date.now();
    
    try {
      console.log('?“¤ æ¸¬è©¦?¨é€è??¯å???..');
      
      const pushMessage = {
        to: userId,
        messages: [
          {
            type: 'text',
            text: `LINE ??¥æ¸¬è©¦ - ${new Date().toLocaleString('zh-TW')}`
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
          message: `?¨é€è??¯æ??Ÿç™¼?åˆ°?¨æˆ¶ ${userId.slice(0, 8)}...`,
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
          message: `?¨é€è??¯å¤±??(${response.status})`,
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
        message: `?¨é€è??¯éŒ¯èª? ${error.message}`,
        responseTime,
        details: { error: error.message }
      };
    }
  }

  // æ¸¬è©¦ 5: æª¢æŸ¥ç³»çµ± API ?¥åº·?€??  async testSystemHealth(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log('?¥ æ¸¬è©¦ç³»çµ±?¥åº·?€??..');
      
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
          message: `ç³»çµ±?¥åº·?€?‹æ­£å¸¸`,
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
          message: `ç³»çµ±?¥åº·æª¢æŸ¥å¤±æ? (${response.status})`,
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
        message: `ç³»çµ±?¥åº·æª¢æŸ¥?¯èª¤: ${error.message}`,
        responseTime,
        details: { error: error.message }
      };
    }
  }

  // ?Ÿæ? LINE ç°½å?
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
      console.warn('?¡æ??Ÿæ? LINE ç°½å?ï¼Œä½¿?¨æ¸¬è©¦ç°½??);
      return 'test-signature';
    }
  }

  // ?·è??€?‰æ¸¬è©?  async runAllTests(testUserId?: string): Promise<void> {
    console.log('?? ?‹å? LINE OA ?™å???¥æ¸¬è©¦...\n');
    console.log(`Webhook URL: ${this.config.webhookUrl}`);
    console.log(`è¶…æ?è¨­å?: ${this.config.timeout}ms`);
    console.log(`LINE Channel Access Token: ${this.config.lineChannelAccessToken ? 'å·²è¨­å®? : '?ªè¨­å®?}`);
    console.log(`LINE Channel Secret: ${this.config.lineChannelSecret ? 'å·²è¨­å®? : '?ªè¨­å®?}`);
    if (testUserId) {
      console.log(`æ¸¬è©¦?¨æˆ¶ ID: ${testUserId.slice(0, 8)}...`);
    }
    console.log('');

    // ?·è??€?‰æ¸¬è©?    const tests = [
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
        console.log(`??${result.message} (${result.responseTime || 0}ms)`);
      } else {
        console.log(`??${result.message} (${result.responseTime || 0}ms)`);
      }
    }

    this.printSummary();
  }

  // ?“å°æ¸¬è©¦?˜è?
  private printSummary(): void {
    const successful = this.results.filter(r => r.success).length;
    const total = this.results.length;
    
    console.log('\n' + '='.repeat(80));
    console.log('?? LINE OA ??¥æ¸¬è©¦?˜è?');
    console.log('='.repeat(80));
    console.log(`ç¸½æ¸¬è©¦æ•¸: ${total}`);
    console.log(`?å?: ${successful}`);
    console.log(`å¤±æ?: ${total - successful}`);
    console.log(`?å??? ${((successful / total) * 100).toFixed(1)}%`);

    // è©³ç´°çµæ?
    console.log('\n?? æ¸¬è©¦è©³æ?:');
    this.results.forEach(result => {
      const status = result.success ? '?? : '??;
      console.log(`   ${status} ${result.test}: ${result.message}`);
    });

    // ??¥?€?‹è?ä¼?    console.log('\n?? ??¥?€?‹è?ä¼?');
    
    const webhookTest = this.results.find(r => r.test === 'webhook-reachability');
    const eventTest = this.results.find(r => r.test === 'webhook-event-processing');
    const apiTest = this.results.find(r => r.test === 'line-api-connection');
    const pushTest = this.results.find(r => r.test === 'push-message');

    if (webhookTest?.success && eventTest?.success) {
      console.log('   ?“¥ ?¥æ”¶è¨Šæ¯: ??æ­?¸¸ - ?¯ä»¥?¥æ”¶ä¾†è‡ª LINE ?„è???);
    } else {
      console.log('   ?“¥ ?¥æ”¶è¨Šæ¯: ???°å¸¸ - ?¡æ?æ­?¸¸?¥æ”¶ LINE è¨Šæ¯');
    }

    if (apiTest?.success) {
      console.log('   ?“¤ ?¼é€è??? ??æ­?¸¸ - ?¯ä»¥?¼é€è??¯åˆ° LINE');
      if (pushTest?.success) {
        console.log('   ?“¤ ?¨é€æ¸¬è©? ???å? - ?¨é€è??¯å??½æ­£å¸?);
      } else if (pushTest && !pushTest.success && pushTest.details?.reason !== 'no-user-id') {
        console.log('   ?“¤ ?¨é€æ¸¬è©? ??å¤±æ? - ?¨é€è??¯å??½ç•°å¸?);
      } else {
        console.log('   ?“¤ ?¨é€æ¸¬è©? ?­ï? è·³é? - ?ªæ?ä¾›æ¸¬è©¦ç”¨??ID');
      }
    } else if (apiTest && !apiTest.success && apiTest.details?.reason !== 'no-access-token') {
      console.log('   ?“¤ ?¼é€è??? ???°å¸¸ - ?¡æ??¼é€è??¯åˆ° LINE');
    } else {
      console.log('   ?“¤ ?¼é€è??? ?­ï? è·³é? - ?ªæ?ä¾?Channel Access Token');
    }

    // å»ºè­°
    console.log('\n?’¡ å»ºè­°:');
    if (!webhookTest?.success) {
      console.log('   ??æª¢æŸ¥ Webhook URL ?¯å¦æ­?¢ºè¨­å?');
      console.log('   ??ç¢ºè?ç¶²å? DNS è¨­å?æ­?¢º');
      console.log('   ??æª¢æŸ¥ Cloudflare Worker ?¨ç½²?€??);
    }
    
    if (!eventTest?.success && webhookTest?.success) {
      console.log('   ??æª¢æŸ¥ LINE Channel Secret è¨­å?');
      console.log('   ??ç¢ºè?ç°½å?é©—è??è¼¯æ­?¢º');
    }
    
    if (!apiTest?.success && this.config.lineChannelAccessToken) {
      console.log('   ??æª¢æŸ¥ LINE Channel Access Token ?¯å¦?‰æ?');
      console.log('   ??ç¢ºè? LINE Bot è¨­å?æ­?¢º');
    }

    if (!this.config.lineChannelAccessToken) {
      console.log('   ??è¨­å? LINE Channel Access Token ä»¥æ¸¬è©¦ç™¼?å???);
    }

    if (!this.config.lineChannelSecret) {
      console.log('   ??è¨­å? LINE Channel Secret ä»¥é€²è?ç°½å?é©—è?');
    }

    console.log('='.repeat(80));
  }

  // ?Ÿæ?æ¸¬è©¦?±å?
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

// ä¸»å‡½??async function main() {
  const args = process.argv.slice(2);
  
  // å¾å‘½ä»¤è??ƒæ•¸?–ç’°å¢ƒè??¸ç²?–é?ç½?  const webhookUrl = args[0] || process.env.WEBHOOK_URL || 'https://your-api-domain.example.com/api/webhook';
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
    
    // ?Ÿæ??±å??‡ä»¶
    const report = tester.generateReport();
    const fs = await import('fs');
    const { join } = await import('path');
    const reportPath = join(process.cwd(), 'line-connection-test-report.json');
    fs.writeFileSync(reportPath, report);
    console.log(`\n?? æ¸¬è©¦?±å?å·²ä?å­˜åˆ°: ${reportPath}`);
    
  } catch (error) {
    console.error('??LINE ??¥æ¸¬è©¦?·è?å¤±æ?:', error);
    process.exit(1);
  }
}

// å¦‚æ??´æ¥?·è?æ­¤è…³??if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].includes('test-line-connection.ts')) {
  main().catch(console.error);
}

export { LineConnectionTester, LineConnectionTestConfig, TestResult };