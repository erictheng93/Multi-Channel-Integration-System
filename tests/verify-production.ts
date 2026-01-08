// é©—è??Ÿç”¢?°å??¨ç½²
const PRODUCTION_URL: string = 'https://your-api-domain.example.com';

interface HealthResponse {
  status: string;
  database: string;
  version?: string;
}

interface Message {
  sender_type: string;
  content: string;
  created_at: string;
}

interface StatsData {
  totalMessages: number;
  totalCustomers: number;
  totalConversations: number;
  recentMessages: Message[];
}

interface StatsResponse {
  success: boolean;
  data: StatsData;
}

interface WebhookEvent {
  type: string;
  timestamp: number;
  source: {
    type: string;
    userId: string;
  };
  replyToken: string;
  message: {
    id: string;
    type: string;
    text: string;
  };
}

interface WebhookPayload {
  destination: string;
  events: WebhookEvent[];
}

interface WebhookResponse {
  message: string;
}

async function verifyProduction(): Promise<void> {
  console.log('?? é©—è??Ÿç”¢?°å??¨ç½²');
  console.log('===================\n');

  try {
    // 1. ?¥åº·æª¢æŸ¥
    console.log('1. æª¢æŸ¥?¥åº·?€??..');
    const healthResponse = await fetch(`${PRODUCTION_URL}/health`);
    const healthData: HealthResponse = await healthResponse.json();
    
    if (healthData.status === 'healthy' && healthData.database === 'connected') {
      console.log('???¥åº·æª¢æŸ¥?šé?');
      console.log(`   ?€?? ${healthData.status}`);
      console.log(`   è³‡æ?åº? ${healthData.database}`);
      console.log(`   ?ˆæœ¬: ${healthData.version}\n`);
    } else {
      console.log('???¥åº·æª¢æŸ¥å¤±æ?');
      console.log(healthData);
      return;
    }

    // 2. æª¢æŸ¥çµ±è?è³‡æ?
    console.log('2. æª¢æŸ¥è³‡æ?çµ±è?...');
    const statsResponse = await fetch(`${PRODUCTION_URL}/api/stats`);
    const statsData: StatsResponse = await statsResponse.json();
    
    if (statsData.success) {
      console.log('??çµ±è?è³‡æ?æ­?¸¸');
      console.log(`   ç¸½è??¯æ•¸: ${statsData.data.totalMessages}`);
      console.log(`   ç¸½å®¢?¶æ•¸: ${statsData.data.totalCustomers}`);
      console.log(`   ç¸½å?è©±æ•¸: ${statsData.data.totalConversations}\n`);
    } else {
      console.log('??çµ±è?è³‡æ??°å¸¸');
      console.log(statsData);
      return;
    }

    // 3. æ¸¬è©¦ Webhook ç«¯é?
    console.log('3. æ¸¬è©¦ Webhook ç«¯é?...');
    const testPayload: WebhookPayload = {
      destination: 'production-test',
      events: [
        {
          type: 'message',
          timestamp: Date.now(),
          source: {
            type: 'user',
            userId: 'production-test-user'
          },
          replyToken: 'production-test-token',
          message: {
            id: 'production-test-msg-' + Date.now(),
            type: 'text',
            text: '?Ÿç”¢?°å?æ¸¬è©¦è¨Šæ¯ - ' + new Date().toLocaleString()
          }
        }
      ]
    };

    const webhookResponse = await fetch(`${PRODUCTION_URL}/api/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'production-test-signature'
      },
      body: JSON.stringify(testPayload)
    });

    const webhookResult: WebhookResponse = await webhookResponse.json();
    
    if (webhookResponse.ok && webhookResult.message === 'OK') {
      console.log('??Webhook ç«¯é?æ­?¸¸');
      console.log(`   ?æ?: ${webhookResult.message}\n`);
    } else {
      console.log('??Webhook ç«¯é??°å¸¸');
      console.log(webhookResult);
      return;
    }

    // 4. ç­‰å?ä¸¦å?æ¬¡æª¢?¥çµ±è¨?    console.log('4. ç­‰å?è³‡æ??•ç?ä¸¦é??°æª¢??..');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const finalStatsResponse = await fetch(`${PRODUCTION_URL}/api/stats`);
    const finalStatsData: StatsResponse = await finalStatsResponse.json();
    
    if (finalStatsData.success) {
      console.log('???€çµ‚çµ±è¨ˆè???);
      console.log(`   ç¸½è??¯æ•¸: ${finalStatsData.data.totalMessages}`);
      console.log(`   ç¸½å®¢?¶æ•¸: ${finalStatsData.data.totalCustomers}`);
      console.log(`   ç¸½å?è©±æ•¸: ${finalStatsData.data.totalConversations}\n`);
      
      if (finalStatsData.data.recentMessages.length > 0) {
        console.log('?? ?€è¿‘ç?è¨Šæ¯:');
        finalStatsData.data.recentMessages.slice(0, 3).forEach((msg: Message, index: number) => {
          console.log(`   ${index + 1}. [${msg.sender_type}] ${msg.content}`);
          console.log(`      ?‚é?: ${msg.created_at}`);
        });
      }
    }

    console.log('\n?? ?Ÿç”¢?°å??¨ç½²é©—è?å®Œæ?ï¼?);
    console.log('\n?? ?¨ç½²?€?‹ç¸½çµ?');
    console.log('??Cloudflare Worker ?¨ç½²?å?');
    console.log('??D1 è³‡æ?åº«é€?¥æ­?¸¸');
    console.log('??è³‡æ?åº?Schema æ­?¢ºè¼‰å…¥');
    console.log('??ç¨®å?è³‡æ?æ­?¢ºè¼‰å…¥');
    console.log('??Webhook ç«¯é?æ­?¸¸?‹ä?');
    console.log('??è³‡æ??ä??–å??½æ­£å¸?);
    console.log('??LINE Bot å·²æ??™å°±ç·?);
    
    console.log('\n?? ?Ÿç”¢?°å? URL:');
    console.log(`   ä¸»é?: ${PRODUCTION_URL}`);
    console.log(`   ?¥åº·æª¢æŸ¥: ${PRODUCTION_URL}/health`);
    console.log(`   çµ±è?è³‡æ?: ${PRODUCTION_URL}/api/stats`);
    console.log(`   Webhook: ${PRODUCTION_URL}/api/webhook`);

  } catch (error: any) {
    console.error('??é©—è??ç?ä¸­ç™¼?ŸéŒ¯èª?', error.message);
    console.log('\n?”§ è«‹æª¢??');
    console.log('1. Cloudflare Worker ?¯å¦æ­?¢º?¨ç½²');
    console.log('2. D1 è³‡æ?åº«æ˜¯?¦æ­£ç¢ºè¨­ç½?);
    console.log('3. Secrets ?¯å¦æ­?¢º?ç½®');
    console.log('4. ç¶²è·¯??¥?¯å¦æ­?¸¸');
  }
}

// ?·è?é©—è?
verifyProduction();