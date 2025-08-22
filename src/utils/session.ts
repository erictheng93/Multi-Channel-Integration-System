import type { ConversationSession, Message } from '../types';

/**
 * 對話會話管理服務
 * 負責智能識別和管理對話會話的邊界
 */

// 會話配置
const SESSION_CONFIG = {
  // 時間間隔超過此值則開始新會話 (分鐘)
  TIME_GAP_THRESHOLD: 30,
  // 單個會話最大訊息數
  MAX_MESSAGES_PER_SESSION: 50,
  // 會話最大持續時間 (小時)
  MAX_SESSION_DURATION: 24,
  // 主題變化檢測關鍵詞
  TOPIC_CHANGE_KEYWORDS: [
    '另外', '還有', '換個話題', '問個別的', '新問題', 
    'by the way', 'btw', 'another question', 'different topic'
  ]
};

/**
 * 獲取或創建對話會話
 */
export async function getOrCreateSession(
  db: D1Database,
  conversationId: number,
  messageContent: string,
  senderType: 'customer' | 'agent' | 'system'
): Promise<ConversationSession> {
  const now = new Date().toISOString();
  
  // 1. 查找當前活躍的會話
  const activeSession = await db
    .prepare(`
      SELECT * FROM conversation_sessions 
      WHERE conversation_id = ? AND is_active = TRUE 
      ORDER BY last_activity DESC 
      LIMIT 1
    `)
    .bind(conversationId)
    .first<ConversationSession>();

  // 2. 判斷是否需要創建新會話
  const shouldCreateNewSession = await shouldStartNewSession(
    db, 
    activeSession, 
    messageContent, 
    senderType, 
    now
  );

  if (!activeSession || shouldCreateNewSession) {
    // 關閉舊會話
    if (activeSession) {
      await closeSession(db, activeSession.id, now);
    }
    
    // 創建新會話
    return await createNewSession(db, conversationId, messageContent, now);
  }

  // 3. 更新現有會話
  await updateSession(db, activeSession.id, now);
  return activeSession;
}

/**
 * 判斷是否應該開始新會話
 */
async function shouldStartNewSession(
  db: D1Database,
  currentSession: ConversationSession | null,
  messageContent: string,
  senderType: 'customer' | 'agent' | 'system',
  currentTime: string
): Promise<boolean> {
  if (!currentSession) {
    return true; // 沒有活躍會話，創建新的
  }

  const lastActivity = new Date(currentSession.last_activity);
  const now = new Date(currentTime);
  const timeDiffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

  // 1. 時間間隔檢查
  if (timeDiffMinutes > SESSION_CONFIG.TIME_GAP_THRESHOLD) {
    console.log(`🕐 時間間隔過長 (${timeDiffMinutes.toFixed(1)}分鐘)，開始新會話`);
    return true;
  }

  // 2. 訊息數量檢查
  if (currentSession.message_count >= SESSION_CONFIG.MAX_MESSAGES_PER_SESSION) {
    console.log(`📊 會話訊息數達到上限 (${currentSession.message_count})，開始新會話`);
    return true;
  }

  // 3. 會話持續時間檢查
  const sessionStart = new Date(currentSession.start_time);
  const sessionDurationHours = (now.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
  if (sessionDurationHours > SESSION_CONFIG.MAX_SESSION_DURATION) {
    console.log(`⏰ 會話持續時間過長 (${sessionDurationHours.toFixed(1)}小時)，開始新會話`);
    return true;
  }

  // 4. 主題變化檢查 (僅對客戶訊息)
  if (senderType === 'customer') {
    const hasTopicChange = SESSION_CONFIG.TOPIC_CHANGE_KEYWORDS.some(keyword => 
      messageContent.toLowerCase().includes(keyword.toLowerCase())
    );
    if (hasTopicChange) {
      console.log(`🔄 檢測到主題變化關鍵詞，開始新會話`);
      return true;
    }
  }

  // 5. 智能語義檢查 (簡化版)
  if (senderType === 'customer' && await detectTopicChange(db, currentSession.id, messageContent)) {
    console.log(`🧠 檢測到語義主題變化，開始新會話`);
    return true;
  }

  return false; // 繼續當前會話
}

/**
 * 創建新會話
 */
async function createNewSession(
  db: D1Database,
  conversationId: number,
  messageContent: string,
  currentTime: string
): Promise<ConversationSession> {
  const sessionId = `session_${conversationId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // 智能推測會話主題
  const topic = extractTopic(messageContent);
  
  const sessionData = {
    id: sessionId,
    conversation_id: conversationId,
    session_type: 'continuous' as const,
    topic: topic,
    start_time: currentTime,
    last_activity: currentTime,
    message_count: 0,
    is_active: true,
    created_at: currentTime
  };

  await db
    .prepare(`
      INSERT INTO conversation_sessions (
        id, conversation_id, session_type, topic, start_time, 
        last_activity, message_count, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      sessionData.id,
      sessionData.conversation_id,
      sessionData.session_type,
      sessionData.topic,
      sessionData.start_time,
      sessionData.last_activity,
      sessionData.message_count,
      sessionData.is_active,
      sessionData.created_at
    )
    .run();

  console.log(`🆕 創建新會話: ${sessionId}, 主題: ${topic || '未知'}`);
  return {
    ...sessionData,
    topic: sessionData.topic || ''
  };
}

/**
 * 更新會話活動時間和訊息計數
 */
async function updateSession(
  db: D1Database,
  sessionId: string,
  currentTime: string
): Promise<void> {
  await db
    .prepare(`
      UPDATE conversation_sessions 
      SET last_activity = ?, message_count = message_count + 1 
      WHERE id = ?
    `)
    .bind(currentTime, sessionId)
    .run();
}

/**
 * 獲取會話中的下一個順序編號
 */
export async function getNextSessionSequence(
  db: D1Database,
  sessionId: string
): Promise<number> {
  const result = await db
    .prepare(`
      SELECT COALESCE(MAX(session_sequence), 0) + 1 as next_sequence
      FROM messages 
      WHERE session_id = ?
    `)
    .bind(sessionId)
    .first<{ next_sequence: number }>();
  
  return result?.next_sequence || 1;
}

/**
 * 關閉會話
 */
async function closeSession(
  db: D1Database,
  sessionId: string,
  currentTime: string
): Promise<void> {
  await db
    .prepare(`
      UPDATE conversation_sessions 
      SET is_active = FALSE, end_time = ? 
      WHERE id = ?
    `)
    .bind(currentTime, sessionId)
    .run();
  
  console.log(`🔚 關閉會話: ${sessionId}`);
}

/**
 * 簡單的主題提取
 */
function extractTopic(messageContent: string): string | null {
  const content = messageContent.toLowerCase();
  
  // 常見主題關鍵詞映射
  const topicKeywords = {
    '產品諮詢': ['產品', '功能', '特色', '介紹', 'product', 'feature'],
    '技術支援': ['問題', '錯誤', '故障', '不能', '無法', 'error', 'bug', 'issue'],
    '訂單查詢': ['訂單', '購買', '付款', '配送', 'order', 'payment', 'delivery'],
    '帳戶問題': ['帳戶', '登入', '密碼', '註冊', 'account', 'login', 'password'],
    '投訴建議': ['投訴', '建議', '不滿', '改善', 'complaint', 'feedback', 'suggestion'],
    '一般諮詢': ['你好', '哈囉', '請問', 'hello', 'hi', 'question']
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(keyword => content.includes(keyword))) {
      return topic;
    }
  }

  return null;
}

/**
 * 檢測主題變化 (簡化版語義分析)
 */
async function detectTopicChange(
  db: D1Database,
  sessionId: string,
  newMessageContent: string
): Promise<boolean> {
  // 獲取會話中最近的幾條訊息
  const recentMessages = await db
    .prepare(`
      SELECT content FROM messages 
      WHERE session_id = ? AND sender_type = 'customer'
      ORDER BY created_at DESC 
      LIMIT 3
    `)
    .bind(sessionId)
    .all<{ content: string }>();

  if (!recentMessages.results || recentMessages.results.length === 0) {
    return false;
  }

  const newTopic = extractTopic(newMessageContent);
  if (!newTopic) {
    return false;
  }

  // 檢查最近訊息的主題
  const recentTopics = recentMessages.results
    .map(msg => extractTopic(msg.content))
    .filter(topic => topic !== null);

  // 如果新主題與最近的主題都不同，則認為是主題變化
  return recentTopics.length > 0 && !recentTopics.includes(newTopic);
}

/**
 * 獲取會話統計
 */
export async function getSessionStats(
  db: D1Database,
  conversationId: number
): Promise<{
  totalSessions: number;
  activeSessions: number;
  averageMessagesPerSession: number;
  sessions: ConversationSession[];
}> {
  // 總會話數
  const totalResult = await db
    .prepare('SELECT COUNT(*) as count FROM conversation_sessions WHERE conversation_id = ?')
    .bind(conversationId)
    .first<{ count: number }>();

  // 活躍會話數
  const activeResult = await db
    .prepare('SELECT COUNT(*) as count FROM conversation_sessions WHERE conversation_id = ? AND is_active = TRUE')
    .bind(conversationId)
    .first<{ count: number }>();

  // 平均訊息數
  const avgResult = await db
    .prepare('SELECT AVG(message_count) as avg FROM conversation_sessions WHERE conversation_id = ?')
    .bind(conversationId)
    .first<{ avg: number }>();

  // 所有會話
  const sessions = await db
    .prepare(`
      SELECT * FROM conversation_sessions 
      WHERE conversation_id = ? 
      ORDER BY start_time DESC
    `)
    .bind(conversationId)
    .all<ConversationSession>();

  return {
    totalSessions: totalResult?.count || 0,
    activeSessions: activeResult?.count || 0,
    averageMessagesPerSession: Math.round(avgResult?.avg || 0),
    sessions: sessions.results || []
  };
}

/**
 * 獲取會話中的所有訊息
 */
export async function getSessionMessages(
  db: D1Database,
  sessionId: string
): Promise<Message[]> {
  const messages = await db
    .prepare(`
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY session_sequence ASC, created_at ASC
    `)
    .bind(sessionId)
    .all<Message>();

  return messages.results || [];
}