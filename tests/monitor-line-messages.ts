// ?³æ???§ LINE è¨Šæ¯?•ç?
const PRODUCTION_URL: string = 'https://your-api-domain.example.com';

let lastMessageCount: number = 0;
let lastCustomerCount: number = 0;
let lastConversationCount: number = 0;

interface Message {
  sender_type: string;
  content: string;
  created_at: string;
  platform?: string;
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

async function getStats(): Promise<StatsData | null> {
  try {
    const response = await fetch(`${PRODUCTION_URL}/api/stats`);
    const data: StatsResponse = await response.json();
    return data.success ? data.data : null;
  } catch (error: any) {
    console.error('?²å?çµ±è?å¤±æ?:', error.message);
    return null;
  }
}

async function monitorMessages(): Promise<void> {
  console.log('?? ?‹å???§ LINE è¨Šæ¯?•ç?');
  console.log('============================');
  console.log('?“± è«‹åœ¨ä½ ç??‹æ?ä¸Šç™¼??"Hello World" çµ?LINE Bot');
  console.log('????§ä¸?.. (??Ctrl+C ?œæ­¢)\n');

  // ?²å??å??€??  const initialStats = await getStats();
  if (initialStats) {
    lastMessageCount = initialStats.totalMessages;
    lastCustomerCount = initialStats.totalCustomers;
    lastConversationCount = initialStats.totalConversations;
    
    console.log('?? ?å??€??');
    console.log(`   ç¸½è??¯æ•¸: ${lastMessageCount}`);
    console.log(`   ç¸½å®¢?¶æ•¸: ${lastCustomerCount}`);
    console.log(`   ç¸½å?è©±æ•¸: ${lastConversationCount}\n`);
  }

  // ?‹å???§
  const interval = setInterval(async () => {
    const currentStats = await getStats();
    
    if (!currentStats) {
      return;
    }

    // æª¢æŸ¥?¯å¦?‰æ–°?„è???    const messageChanged = currentStats.totalMessages !== lastMessageCount;
    const customerChanged = currentStats.totalCustomers !== lastCustomerCount;
    const conversationChanged = currentStats.totalConversations !== lastConversationCount;

    if (messageChanged || customerChanged || conversationChanged) {
      const timestamp = new Date().toLocaleString();
      console.log(`?? [${timestamp}] æª¢æ¸¬?°è???`);
      
      if (messageChanged) {
        const newMessages = currentStats.totalMessages - lastMessageCount;
        console.log(`   ?“¨ ?°è??? +${newMessages} (ç¸½è?: ${currentStats.totalMessages})`);
        lastMessageCount = currentStats.totalMessages;
      }
      
      if (customerChanged) {
        const newCustomers = currentStats.totalCustomers - lastCustomerCount;
        console.log(`   ?‘¤ ?°å®¢?? +${newCustomers} (ç¸½è?: ${currentStats.totalCustomers})`);
        lastCustomerCount = currentStats.totalCustomers;
      }
      
      if (conversationChanged) {
        const newConversations = currentStats.totalConversations - lastConversationCount;
        console.log(`   ?’¬ ?°å?è©? +${newConversations} (ç¸½è?: ${currentStats.totalConversations})`);
        lastConversationCount = currentStats.totalConversations;
      }

      // é¡¯ç¤º?€?°ç?è¨Šæ¯
      if (currentStats.recentMessages && currentStats.recentMessages.length > 0) {
        console.log('\n?? ?€?°è???');
        currentStats.recentMessages.slice(0, 3).forEach((msg: Message, index: number) => {
          const time = new Date(msg.created_at).toLocaleString();
          console.log(`   ${index + 1}. [${msg.sender_type}] ${msg.content}`);
          console.log(`      ?‚é?: ${time}`);
          console.log(`      å¹³å°: ${msg.platform || 'N/A'}`);
        });
      }
      
      console.log('\n' + '='.repeat(50) + '\n');
    } else {
      // é¡¯ç¤ºç­‰å??€??      process.stdout.write('.');
    }
  }, 2000); // æ¯?ç§’æª¢?¥ä?æ¬?
  // ?•ç? Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n\n?? ??§å·²å?æ­?);
    console.log('?? ?€çµ‚çµ±è¨?');
    console.log(`   ç¸½è??¯æ•¸: ${lastMessageCount}`);
    console.log(`   ç¸½å®¢?¶æ•¸: ${lastCustomerCount}`);
    console.log(`   ç¸½å?è©±æ•¸: ${lastConversationCount}`);
    process.exit(0);
  });
}

// ?‹å???§
monitorMessages();