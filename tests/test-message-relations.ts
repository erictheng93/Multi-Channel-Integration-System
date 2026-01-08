// æ¸¬è©¦è¨Šæ¯?œè¯?Ÿèƒ½
const PRODUCTION_URL: string = 'https://your-api-domain.example.com';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_type: string;
  conversation_id: string;
  reply_to_message_id?: string;
  thread_id?: string;
  metadata?: string;
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

interface RepliesResponse {
  success: boolean;
  data: {
    count: number;
    replies: Message[];
  };
  error?: string;
}

interface MessageTreeResponse {
  success: boolean;
  data: {
    totalMessages: number;
    replyMap: Record<string, Message[]>;
  };
  error?: string;
}

async function testMessageRelations(): Promise<void> {
  console.log('?? æ¸¬è©¦è¨Šæ¯?œè¯?Ÿèƒ½');
  console.log('===================\n');

  try {
    // 1. ?²å??€?°ç?çµ±è?è³‡æ?
    console.log('1. ?²å??¶å?çµ±è?è³‡æ?...');
    const statsResponse = await fetch(`${PRODUCTION_URL}/api/stats`);
    const statsData: StatsResponse = await statsResponse.json();
    
    if (!statsData.success) {
      console.log('???²å?çµ±è?å¤±æ?');
      return;
    }

    console.log(`???¶å?çµ±è?:`);
    console.log(`   ç¸½è??¯æ•¸: ${statsData.data.totalMessages}`);
    console.log(`   ç¸½å®¢?¶æ•¸: ${statsData.data.totalCustomers}`);
    console.log(`   ç¸½å?è©±æ•¸: ${statsData.data.totalConversations}\n`);

    // 2. é¡¯ç¤º?€è¿‘ç?è¨Šæ¯?Šå…¶?œè¯
    console.log('2. ?†æ??€è¿‘ç?è¨Šæ¯?œè¯...');
    const recentMessages = statsData.data.recentMessages;
    
    if (recentMessages && recentMessages.length > 0) {
      console.log('?? ?€è¿‘ç?è¨Šæ¯ (?…å«?œè¯è³‡è?):');
      console.log('=' .repeat(80));
      
      recentMessages.slice(0, 8).forEach((msg: Message, index: number) => {
        const time = new Date(msg.created_at).toLocaleString();
        const senderIcon = msg.sender_type === 'customer' ? '?‘¤' : '??';
        const directionIcon = msg.sender_type === 'customer' ? '?“¥' : '?“¤';
        
        console.log(`${index + 1}. ${senderIcon} [${msg.sender_type.toUpperCase()}] ${directionIcon}`);
        console.log(`   ?§å®¹: "${msg.content}"`);
        console.log(`   ?‚é?: ${time}`);
        console.log(`   è¨Šæ¯ID: ${msg.id}`);
        console.log(`   å°è©±ID: ${msg.conversation_id}`);
        
        // é¡¯ç¤º?œè¯è³‡è?
        if (msg.reply_to_message_id) {
          console.log(`   ?? ?è??®æ?: ${msg.reply_to_message_id}`);
        }
        if (msg.thread_id) {
          console.log(`   ?§µ ç·šç?ID: ${msg.thread_id}`);
        }
        if (msg.metadata) {
          try {
            const metadata = JSON.parse(msg.metadata);
            console.log(`   ?? ?ƒæ•¸?? ${Object.keys(metadata).join(', ')}`);
          } catch (e) {
            console.log(`   ?? ?ƒæ•¸?? ${msg.metadata}`);
          }
        }
        console.log('');
      });

      // 3. æ¸¬è©¦è¨Šæ¯?è??¥è©¢
      console.log('3. æ¸¬è©¦è¨Šæ¯?è??¥è©¢...');
      const customerMessages = recentMessages.filter(msg => msg.sender_type === 'customer');
      
      if (customerMessages.length > 0) {
        const testMessageId = customerMessages[0].id;
        console.log(`?? ?¥è©¢è¨Šæ¯ ${testMessageId} ?„å?è¦?..`);
        
        const repliesResponse = await fetch(`${PRODUCTION_URL}/api/messages/${testMessageId}/replies`);
        const repliesData: RepliesResponse = await repliesResponse.json();
        
        if (repliesData.success) {
          console.log(`???¾åˆ° ${repliesData.data.count} ?‹å?è¦?`);
          repliesData.data.replies.forEach((reply: Message, index: number) => {
            console.log(`   ${index + 1}. [${reply.sender_type}] "${reply.content}"`);
            console.log(`      ?‚é?: ${new Date(reply.created_at).toLocaleString()}`);
          });
        } else {
          console.log(`???¥è©¢?è?å¤±æ?: ${repliesData.error}`);
        }
      }

      // 4. æ¸¬è©¦å°è©±è¨Šæ¯æ¨?      console.log('\n4. æ¸¬è©¦å°è©±è¨Šæ¯æ¨?..');
      const conversationId = recentMessages[0].conversation_id;
      console.log(`?Œ³ ?¥è©¢å°è©± ${conversationId} ?„è??¯æ¨¹...`);
      
      const treeResponse = await fetch(`${PRODUCTION_URL}/api/conversations/${conversationId}/message-tree`);
      const treeData: MessageTreeResponse = await treeResponse.json();
      
      if (treeData.success) {
        console.log(`??å°è©±è¨Šæ¯æ¨?`);
        console.log(`   ç¸½è??¯æ•¸: ${treeData.data.totalMessages}`);
        console.log(`   ?è??œè¯?? ${Object.keys(treeData.data.replyMap).length}`);
        
        // é¡¯ç¤º?è??œè¯
        Object.entries(treeData.data.replyMap).forEach(([originalId, replies]) => {
          console.log(`   ?? ${originalId} ??${replies.length} ?‹å?è¦†`);
          replies.forEach(reply => {
            console.log(`      ?”â? ${reply.id} [${reply.sender_type}]`);
          });
        });
      } else {
        console.log(`???¥è©¢è¨Šæ¯æ¨¹å¤±?? ${treeData.error}`);
      }

    } else {
      console.log('   æ²’æ??¾åˆ°è¨Šæ¯');
    }

    console.log('\n?? è¨Šæ¯?œè¯?Ÿèƒ½æ¸¬è©¦å®Œæ?ï¼?);
    console.log('\n?? ?Ÿèƒ½é©—è?:');
    console.log('???³å…¥è¨Šæ¯?ä??–ä?å­?);
    console.log('???è?è¨Šæ¯?ä??–ä?å­?);
    console.log('??è¨Šæ¯?œè¯ (reply_to_message_id)');
    console.log('??ç·šç??œè¯ (thread_id)');
    console.log('???ƒæ•¸?šä?å­?(metadata)');
    console.log('??è¨Šæ¯?è??¥è©¢ API');
    console.log('??å°è©±è¨Šæ¯æ¨?API');

  } catch (error: any) {
    console.error('??æ¸¬è©¦?ç?ä¸­ç™¼?ŸéŒ¯èª?', error.message);
  }
}

// ?·è?æ¸¬è©¦
testMessageRelations();