/**
 * å®Œæ•´?„å®¢?¶è??™æ”¶?†æ?ç¨‹æ¸¬è©? * ?™å€‹è…³?¬æ¨¡?¬å??´ç? LINE è¨Šæ¯?•ç?æµç?
 */

interface StepData {
  step: number;
  title: string;
  description: string;
  data: any;
}

console.log('?§ª LINE Bot å®¢æˆ¶è³‡æ??¶é?æµç?æ¸¬è©¦\n');

// æ¨¡æ“¬æµç?æ­¥é?
const steps: StepData[] = [
  {
    step: 1,
    title: '?“± å®¢æˆ¶?¼é€è??¯åˆ° LINE',
    description: 'å®¢æˆ¶??LINE ä¸­ç™¼?è??¯çµ¦ä½ ç? Bot',
    data: {
      lineUserId: 'U1234567890abcdef1234567890abcdef1',
      message: 'ä½ å¥½ï¼Œæ??³ä?è§???‘ç??å?',
      timestamp: new Date().toISOString()
    }
  },
  {
    step: 2,
    title: '?? LINE å¹³å°?¼é€?Webhook',
    description: 'LINE å¹³å°å°‡è??¯ä?ä»¶ç™¼?åˆ°ä½ ç? Worker',
    data: {
      webhook_url: 'https://your-api-domain.example.com/api/webhook',
      event_type: 'message',
      message_type: 'text'
    }
  },
  {
    step: 3,
    title: '?? ?²å??¨æˆ¶è³‡æ?',
    description: 'Worker èª¿ç”¨ LINE Profile API ?²å??¨æˆ¶è©³ç´°è³‡è?',
    data: {
      api_call: 'GET https://api.line.me/v2/bot/profile/{userId}',
      response: {
        userId: 'U1234567890abcdef1234567890abcdef1',
        displayName: 'å¼µå???,
        pictureUrl: 'https://profile.line-scdn.net/xxx',
        statusMessage: 'ä»Šå¤©å¤©æ°£?Ÿå¥½'
      }
    }
  },
  {
    step: 4,
    title: '?’¾ ?²å?å®¢æˆ¶è³‡æ???D1',
    description: 'å°‡å®¢?¶è?è¨Šå„²å­˜åˆ° Cloudflare D1 è³‡æ?åº?,
    data: {
      table: 'customers',
      action: 'INSERT or UPDATE',
      fields: {
        platform: 'line',
        platform_user_id: 'U1234567890abcdef1234567890abcdef1',
        display_name: 'å¼µå???,
        avatar_url: 'https://profile.line-scdn.net/xxx',
        metadata: {
          statusMessage: 'ä»Šå¤©å¤©æ°£?Ÿå¥½',
          lastProfileUpdate: new Date().toISOString(),
          messageCount: 1
        }
      }
    }
  },
  {
    step: 5,
    title: '?’¬ å»ºç??–æ›´?°å?è©?,
    description: '??conversations è¡¨ä¸­å»ºç??–æ›´?°å?è©±è???,
    data: {
      table: 'conversations',
      fields: {
        customer_id: 1,
        status: 'active',
        last_message_at: new Date().toISOString()
      }
    }
  },
  {
    step: 6,
    title: '?? ?²å?è¨Šæ¯',
    description: 'å°‡è??¯å…§å®¹å„²å­˜åˆ° messages è¡?,
    data: {
      table: 'messages',
      fields: {
        conversation_id: 1,
        sender_type: 'customer',
        content: 'ä½ å¥½ï¼Œæ??³ä?è§???‘ç??å?',
        message_type: 'text',
        direction: 'inbound'
      }
    }
  },
  {
    step: 7,
    title: '?? ?Ÿæ?ä¸¦ç™¼?å?è¦?,
    description: 'Bot ?Ÿæ??è?ä¸¦ç™¼?å? LINE å¹³å°',
    data: {
      reply: '?¨å¥½ï¼å?é«˜è??ºæ‚¨?å?ï¼Œè??æ?ä»€éº¼å¯ä»¥å¹«?©æ‚¨?„å?ï¼?,
      api_call: 'POST https://api.line.me/v2/bot/message/reply'
    }
  },
  {
    step: 8,
    title: '?’¾ ?²å??è?è¨Šæ¯',
    description: 'å°?Bot ?„å?è¦†ä??²å??°è??™åº«',
    data: {
      table: 'messages',
      fields: {
        conversation_id: 1,
        sender_type: 'agent',
        content: '?¨å¥½ï¼å?é«˜è??ºæ‚¨?å?ï¼Œè??æ?ä»€éº¼å¯ä»¥å¹«?©æ‚¨?„å?ï¼?,
        direction: 'outbound',
        reply_to_message_id: 'original_message_id'
      }
    }
  }
];

// é¡¯ç¤ºæµç?æ­¥é?
steps.forEach(({ step, title, description, data }) => {
  console.log(`${title}`);
  console.log(`   ${description}`);
  console.log(`   è³‡æ?: ${JSON.stringify(data, null, 6)}`);
  console.log('');
});

console.log('?¯ å®Œæ?å¾Œä??¯ä»¥?é?ä»¥ä??¹å??¥è©¢å®¢æˆ¶è³‡æ?:\n');

console.log('?? API ?¥è©¢ç¯„ä?:');
console.log('1. ?¥è©¢?€?‰å®¢??');
console.log('   GET /api/customers\n');

console.log('2. ?¥è©¢?¹å? LINE ?¨æˆ¶:');
console.log('   GET /api/customers/platform/line/U1234567890abcdef1234567890abcdef1\n');

console.log('3. ?¥è©¢ç³»çµ±çµ±è?:');
console.log('   GET /api/stats\n');

console.log('4. ?¥è©¢å®¢æˆ¶?„å?è©±è???');
console.log('   GET /api/customers/1 (?ƒå??«å?è©±å?è¡?\n');

console.log('?’¡ æ¸¬è©¦å»ºè­°:');
console.log('1. ä½¿ç”¨ test-webhook.ps1 ??test-webhook.sh ?¼é€æ¸¬è©¦è???);
console.log('2. ä½¿ç”¨ query-customers.ts ?¥è©¢?²å??„å®¢?¶è???);
console.log('3. æª¢æŸ¥ D1 è³‡æ?åº«ä¸­??customers è¡?);
console.log('4. ??§ Worker ?„æ—¥èªŒè¼¸??);

console.log('\n??å®¢æˆ¶è³‡æ??¶é??Ÿèƒ½å·²å??´å¯¦?¾ï?');