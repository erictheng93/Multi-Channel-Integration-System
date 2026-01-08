// æ¸¬è©¦?ºèƒ½?ƒè©±ç®¡ç??Ÿèƒ½
const PRODUCTION_URL: string = 'https://your-api-domain.example.com';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_type: string;
  conversation_id: string;
  session_id?: string;
  session_sequence?: number;
  reply_to_message_id?: string;
  thread_id?: string;
  metadata?: string;
}

interface Session {
  id: string;
  topic?: string;
  start_time: string;
  end_time?: string;
  is_active: boolean;
  message_count: number;
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

interface SessionStatsData {
  totalSessions: number;
  activeSessions: number;
  averageMessagesPerSession: number;
  sessions: Session[];
}

interface SessionStatsResponse {
  success: boolean;
  data: SessionStatsData;
  error?: string;
}

interface SessionMessagesData {
  sessionId: string;
  messageCount: number;
  messages: Message[];
}

interface SessionMessagesResponse {
  success: boolean;
  data: SessionMessagesData;
  error?: string;
}

async function testSessionManagement(): Promise<void> {
  console.log('?¯ æ¸¬è©¦?ºèƒ½?ƒè©±ç®¡ç??Ÿèƒ½');
  console.log('========================\n');

  try {
    // 1. ?²å??¶å?çµ±è?
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

    // 2. ?†æ??€è¿‘ç?è¨Šæ¯?ƒè©±è³‡è?
    console.log('2. ?†æ??€è¿‘ç?è¨Šæ¯?ƒè©±è³‡è?...');
    const recentMessages = statsData.data.recentMessages;
    
    if (recentMessages && recentMessages.length > 0) {
      console.log('?? ?€è¿‘ç?è¨Šæ¯ (?…å«?ƒè©±è³‡è?):');
      console.log('=' .repeat(90));
      
      recentMessages.slice(0, 6).forEach((msg: Message, index: number) => {
        const time = new Date(msg.created_at).toLocaleString();
        const senderIcon = msg.sender_type === 'customer' ? '?‘¤' : '??';
        const directionIcon = msg.sender_type === 'customer' ? '?“¥' : '?“¤';
        
        console.log(`${index + 1}. ${senderIcon} [${msg.sender_type.toUpperCase()}] ${directionIcon}`);
        console.log(`   ?§å®¹: "${msg.content}"`);
        console.log(`   ?‚é?: ${time}`);
        console.log(`   è¨Šæ¯ID: ${msg.id}`);
        console.log(`   å°è©±ID: ${msg.conversation_id}`);
        
        // é¡¯ç¤º?ƒè©±è³‡è?
        if (msg.session_id) {
          console.log(`   ?¯ ?ƒè©±ID: ${msg.session_id}`);
        }
        if (msg.session_sequence) {
          console.log(`   ?? ?ƒè©±?†å?: ${msg.session_sequence}`);
        }
        if (msg.reply_to_message_id) {
          console.log(`   ?? ?è??®æ?: ${msg.reply_to_message_id}`);
        }
        if (msg.thread_id) {
          console.log(`   ?§µ ç·šç?ID: ${msg.thread_id}`);
        }
        
        // è§???ƒæ•¸?šä¸­?„æ?è©±ä¸»é¡?        if (msg.metadata) {
          try {
            const metadata = JSON.parse(msg.metadata);
            if (metadata.sessionTopic) {
              console.log(`   ?·ï¸??ƒè©±ä¸»é?: ${metadata.sessionTopic}`);
            }
          } catch (e) {
            // å¿½ç•¥è§???¯èª¤
          }
        }
        console.log('');
      });

      // 3. æ¸¬è©¦?ƒè©±çµ±è?
      console.log('3. æ¸¬è©¦?ƒè©±çµ±è?...');
      const conversationId = recentMessages[0].conversation_id;
      console.log(`?? ?¥è©¢å°è©± ${conversationId} ?„æ?è©±çµ±è¨?..`);
      
      const sessionStatsResponse = await fetch(`${PRODUCTION_URL}/api/conversations/${conversationId}/sessions`);
      const sessionStatsData: SessionStatsResponse = await sessionStatsResponse.json();
      
      if (sessionStatsData.success) {
        const stats = sessionStatsData.data;
        console.log(`???ƒè©±çµ±è?:`);
        console.log(`   ç¸½æ?è©±æ•¸: ${stats.totalSessions}`);
        console.log(`   æ´»è??ƒè©±?? ${stats.activeSessions}`);
        console.log(`   å¹³å?è¨Šæ¯???ƒè©±: ${stats.averageMessagesPerSession}`);
        
        if (stats.sessions && stats.sessions.length > 0) {
          console.log(`\n?? ?ƒè©±?—è¡¨:`);
          stats.sessions.slice(0, 5).forEach((session: Session, index: number) => {
            const startTime = new Date(session.start_time).toLocaleString();
            const endTime = session.end_time ? new Date(session.end_time).toLocaleString() : '?²è?ä¸?;
            const status = session.is_active ? '?Ÿ¢ æ´»è?' : '?”´ å·²ç???;
            
            console.log(`   ${index + 1}. ${status} ${session.id}`);
            console.log(`      ä¸»é?: ${session.topic || '?ªçŸ¥'}`);
            console.log(`      ?‹å?: ${startTime}`);
            console.log(`      çµæ?: ${endTime}`);
            console.log(`      è¨Šæ¯?? ${session.message_count}`);
            console.log('');
          });
        }
      } else {
        console.log(`???¥è©¢?ƒè©±çµ±è?å¤±æ?: ${sessionStatsData.error}`);
      }

      // 4. æ¸¬è©¦?¹å??ƒè©±?„è???      if (sessionStatsData.success && sessionStatsData.data.sessions.length > 0) {
        console.log('4. æ¸¬è©¦?¹å??ƒè©±?„è???..');
        const firstSession = sessionStatsData.data.sessions[0];
        console.log(`?? ?¥è©¢?ƒè©± ${firstSession.id} ?„æ??‰è???..`);
        
        const sessionMessagesResponse = await fetch(`${PRODUCTION_URL}/api/sessions/${firstSession.id}/messages`);
        const sessionMessagesData: SessionMessagesResponse = await sessionMessagesResponse.json();
        
        if (sessionMessagesData.success) {
          console.log(`???ƒè©±è¨Šæ¯:`);
          console.log(`   ?ƒè©±ID: ${sessionMessagesData.data.sessionId}`);
          console.log(`   è¨Šæ¯ç¸½æ•¸: ${sessionMessagesData.data.messageCount}`);
          
          if (sessionMessagesData.data.messages.length > 0) {
            console.log(`\n?’¬ ?ƒè©±å°è©±æµç?:`);
            sessionMessagesData.data.messages.forEach((msg: Message, index: number) => {
              const time = new Date(msg.created_at).toLocaleString();
              const senderIcon = msg.sender_type === 'customer' ? '?‘¤' : '??';
              const sequence = msg.session_sequence || (index + 1);
              
              console.log(`   ${sequence}. ${senderIcon} [${msg.sender_type}] "${msg.content}"`);
              console.log(`      ?‚é?: ${time}`);
            });
          }
        } else {
          console.log(`???¥è©¢?ƒè©±è¨Šæ¯å¤±æ?: ${sessionMessagesData.error}`);
        }
      }

    } else {
      console.log('   æ²’æ??¾åˆ°è¨Šæ¯');
    }

    console.log('\n?? ?ºèƒ½?ƒè©±ç®¡ç??Ÿèƒ½æ¸¬è©¦å®Œæ?ï¼?);
    console.log('\n?? ?Ÿèƒ½é©—è?:');
    console.log('???ºèƒ½?ƒè©±?Šç?æª¢æ¸¬');
    console.log('???ƒè©±ä¸»é??ªå?è­˜åˆ¥');
    console.log('???ƒè©±?§è??¯é?åºç®¡??);
    console.log('??å¤šå?ä¸€ç­?ä¸€?å?ç­”æ”¯??);
    console.log('???‚é??“é??ƒè©±?†å‰²');
    console.log('???ƒè©±çµ±è??‡å???);
    console.log('???ƒè©±è¨Šæ¯?¥è©¢ API');
    
    console.log('\n?¯ ?ƒè©±ç®¡ç?ç­–ç•¥:');
    console.log('???‚é??“é? > 30?†é? ???°æ?è©?);
    console.log('??è¨Šæ¯??> 50æ¢????°æ?è©?);
    console.log('???ƒè©±?ç? > 24å°æ? ???°æ?è©?);
    console.log('??æª¢æ¸¬?°ä¸»é¡Œè??–é??µè? ???°æ?è©?);
    console.log('???ºèƒ½èªç¾©ä¸»é?è®Šå? ???°æ?è©?);

  } catch (error: any) {
    console.error('??æ¸¬è©¦?ç?ä¸­ç™¼?ŸéŒ¯èª?', error.message);
  }
}

// ?·è?æ¸¬è©¦
testSessionManagement();