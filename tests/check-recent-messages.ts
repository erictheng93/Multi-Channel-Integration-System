// æª¢æŸ¥?€è¿‘ç?è¨Šæ¯
const PRODUCTION_URL: string = 'https://your-api-domain.example.com';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_type: string;
  platform?: string;
  conversation_id: string;
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

async function checkRecentMessages(): Promise<void> {
  try {
    console.log('?? æª¢æŸ¥?€è¿‘ç? LINE è¨Šæ¯');
    console.log('========================\n');

    const response = await fetch(`${PRODUCTION_URL}/api/stats`);
    const data: StatsResponse = await response.json();

    if (!data.success) {
      console.log('???²å?è³‡æ?å¤±æ?');
      return;
    }

    const stats: StatsData = data.data;
    
    console.log('?? ?¶å?çµ±è?:');
    console.log(`   ç¸½è??¯æ•¸: ${stats.totalMessages}`);
    console.log(`   ç¸½å®¢?¶æ•¸: ${stats.totalCustomers}`);
    console.log(`   ç¸½å?è©±æ•¸: ${stats.totalConversations}\n`);

    console.log('?’¬ ?€è¿‘ç?è¨Šæ¯ (?‰æ??“æ?åº?:');
    console.log('=' .repeat(60));

    if (stats.recentMessages && stats.recentMessages.length > 0) {
      stats.recentMessages.forEach((msg: Message, index: number) => {
        const time = new Date(msg.created_at).toLocaleString();
        const senderIcon = msg.sender_type === 'customer' ? '?‘¤' : '??';
        const directionIcon = msg.sender_type === 'customer' ? '?“¥' : '?“¤';
        
        console.log(`${index + 1}. ${senderIcon} [${msg.sender_type.toUpperCase()}] ${directionIcon}`);
        console.log(`   ?§å®¹: "${msg.content}"`);
        console.log(`   ?‚é?: ${time}`);
        console.log(`   å¹³å°: ${msg.platform || 'N/A'}`);
        console.log(`   è¨Šæ¯ID: ${msg.id}`);
        console.log(`   å°è©±ID: ${msg.conversation_id}`);
        console.log('');
      });
    } else {
      console.log('   æ²’æ??¾åˆ°è¨Šæ¯');
    }

    // æª¢æŸ¥?¯å¦?‰å?è¦†è???    const customerMessages = stats.recentMessages.filter(msg => msg.sender_type === 'customer');
    const agentMessages = stats.recentMessages.filter(msg => msg.sender_type === 'agent');
    
    console.log('?? è¨Šæ¯é¡å?çµ±è?:');
    console.log(`   å®¢æˆ¶è¨Šæ¯: ${customerMessages.length}`);
    console.log(`   ç³»çµ±?è?: ${agentMessages.length}`);
    
    if (agentMessages.length === 0) {
      console.log('\n? ï?  æ³¨æ?: æ²’æ?æª¢æ¸¬?°ç³»çµ±å?è¦†è???);
      console.log('   ?¯èƒ½?„å???');
      console.log('   1. Reply Token å·²é???(LINE Reply Token ?ªèƒ½ä½¿ç”¨ä¸€æ¬?');
      console.log('   2. ç°½å?é©—è?å¤±æ?');
      console.log('   3. LINE API ?¼å«å¤±æ?');
    } else {
      console.log('\n??ç³»çµ±æ­?¸¸?è?è¨Šæ¯');
    }

  } catch (error: any) {
    console.error('??æª¢æŸ¥è¨Šæ¯?‚ç™¼?ŸéŒ¯èª?', error.message);
  }
}

// ?·è?æª¢æŸ¥
checkRecentMessages();