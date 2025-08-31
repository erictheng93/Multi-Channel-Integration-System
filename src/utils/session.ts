import type { Message, Platform } from '../types';
// ConversationSession type inferred from schema
import { drizzle } from 'drizzle-orm/d1';
import { conversationSessions, messages } from '../db/schema';
import { eq, and, desc, sql, count, avg } from 'drizzle-orm';

// 對話會話類型定義
interface ConversationSession {
  id: string;
  conversationId: string;
  sessionNumber: number;
  startedAt: string;
  endedAt?: string;
  messageCount: number;
  topic?: string;
  sentiment?: string;
  status: 'active' | 'ended' | 'paused';
  createdAt: string;
  updatedAt: string;
}

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
  conversationId: string,
  messageContent: string,
  senderType: 'customer' | 'agent' | 'system'
): Promise<any> {
  const now = new Date().toISOString();
  const drizzleDb = drizzle(db);
  
  // 1. 查找當前活躍的會話
  const activeSession = await drizzleDb
    .select()
    .from(conversationSessions)
    .where(
      and(
        eq(conversationSessions.conversationId, conversationId),
        eq(conversationSessions.isActive, true)
      )
    )
    .orderBy(desc(conversationSessions.lastActivity))
    .limit(1)
    .get();

  // 2. 判斷是否需要創建新會話
  const shouldCreateNewSession = await shouldStartNewSession(
    db, 
    activeSession as unknown as ConversationSession | null, 
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
    return await createNewSession(db, parseInt(conversationId), messageContent, now);
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

  const lastActivity = new Date((currentSession as any).lastActivity);
  const now = new Date(currentTime);
  const timeDiffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

  // 1. 時間間隔檢查
  if (timeDiffMinutes > SESSION_CONFIG.TIME_GAP_THRESHOLD) {
    console.log(`🕐 時間間隔過長 (${timeDiffMinutes.toFixed(1)}分鐘)，開始新會話`);
    return true;
  }

  // 2. 訊息數量檢查
  if ((currentSession.messageCount || 0) >= SESSION_CONFIG.MAX_MESSAGES_PER_SESSION) {
    console.log(`📊 會話訊息數達到上限 (${currentSession.messageCount || 0})，開始新會話`);
    return true;
  }

  // 3. 會話持續時間檢查
  const sessionStart = new Date((currentSession as any).startTime);
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
): Promise<any> {
  const sessionId = `session_${conversationId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const drizzleDb = drizzle(db);
  
  // 智能推測會話主題
  const topic = extractTopic(messageContent);
  
  const sessionData = {
    id: sessionId,
    conversationId: conversationId,
    sessionType: 'continuous' as const,
    topic: topic,
    startTime: currentTime,
    endTime: null,
    lastActivity: currentTime,
    messageCount: 0,
    isActive: true,
    createdAt: currentTime
  };

  try {
    await (drizzleDb as any)
      .insert(conversationSessions)
      .values(sessionData);
  } catch (error) {
    console.error('Failed to create session:', error);
  }

  console.log(`🆕 創建新會話: ${sessionId}, 主題: ${topic || '未知'}`);
  return sessionData;
}

/**
 * 更新會話活動時間和訊息計數
 */
async function updateSession(
  db: D1Database,
  sessionId: string,
  currentTime: string
): Promise<void> {
  const drizzleDb = drizzle(db);
  
  await drizzleDb
    .update(conversationSessions)
    .set({ 
      lastActivity: currentTime,
      messageCount: sql`${conversationSessions.messageCount} + 1`
    })
    .where(eq(conversationSessions.id, sessionId))
    .run();
}

/**
 * 獲取會話中的下一個順序編號
 */
export async function getNextSessionSequence(
  db: D1Database,
  sessionId: string
): Promise<number> {
  const drizzleDb = drizzle(db);
  
  const result = await drizzleDb
    .select({ 
      next_sequence: sql<number>`COALESCE(MAX(${messages.sessionSequence}), 0) + 1`
    })
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .get();
  
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
  const drizzleDb = drizzle(db);
  
  await drizzleDb
    .update(conversationSessions)
    .set({ 
      isActive: false, 
      endTime: currentTime 
    })
    .where(eq(conversationSessions.id, sessionId))
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
  const drizzleDb = drizzle(db);
  
  // 獲取會話中最近的幾條訊息
  const recentMessages = await drizzleDb
    .select({ content: messages.content })
    .from(messages)
    .where(and(
      eq(messages.sessionId, sessionId),
      eq(messages.senderType, 'customer')
    ))
    .orderBy(desc(messages.createdAt))
    .limit(3)
    .all();

  if (!recentMessages || recentMessages.length === 0) {
    return false;
  }

  const newTopic = extractTopic(newMessageContent);
  if (!newTopic) {
    return false;
  }

  // 檢查最近訊息的主題
  const recentTopics = recentMessages
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
  conversationId: string
): Promise<{
  totalSessions: number;
  activeSessions: number;
  averageMessagesPerSession: number;
  sessions: any[];
}> {
  const drizzleDb = drizzle(db);
  
  // 總會話數
  const totalResult = await drizzleDb
    .select({ count: count() })
    .from(conversationSessions)
    .where(eq(conversationSessions.conversationId, conversationId))
    .get();

  // 活躍會話數
  const activeResult = await drizzleDb
    .select({ count: count() })
    .from(conversationSessions)
    .where(and(
      eq(conversationSessions.conversationId, conversationId),
      eq(conversationSessions.isActive, true)
    ))
    .get();

  // 平均訊息數
  const avgResult = await drizzleDb
    .select({ avg: avg(conversationSessions.messageCount) })
    .from(conversationSessions)
    .where(eq(conversationSessions.conversationId, conversationId))
    .get();

  // 所有會話
  const sessions = await drizzleDb
    .select()
    .from(conversationSessions)
    .where(eq(conversationSessions.conversationId, conversationId))
    .orderBy(desc(conversationSessions.startTime))
    .all();

  return {
    totalSessions: totalResult?.count || 0,
    activeSessions: activeResult?.count || 0,
    averageMessagesPerSession: Math.round(Number(avgResult?.avg) || 0),
    sessions: sessions || []
  };
}

/**
 * 獲取會話中的所有訊息
 */
export async function getSessionMessages(
  db: D1Database,
  sessionId: string
): Promise<Message[]> {
  const drizzleDb = drizzle(db);
  
  const messageResults = await drizzleDb
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(desc(messages.sessionSequence), desc(messages.createdAt))
    .all();

  return ((messageResults || []).map(msg => ({
    id: msg.id,
    conversationId: msg.conversationId,
    senderType: msg.senderType as 'user' | 'agent',
    senderId: msg.agentSenderId || msg.customerSenderId?.toString() || 'unknown',
    content: msg.content,
    mediaUrl: msg.platformMessageId || undefined, // Use platform message ID as fallback
    mediaType: msg.messageType as 'text' | 'image' | 'video' | 'file',
    platform: 'line' as Platform, // Default platform
    createdAt: new Date(msg.createdAt || '').getTime() || Date.now()
  })) as any);
}