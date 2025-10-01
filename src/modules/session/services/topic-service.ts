// Topic Service for Session Module
// 會話主題檢測與分析服務

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { conversationSessions, messages } from '../../../db/schema';
import { DEFAULT_SESSION_CONFIG } from '@modules/session/types/session-types';

/**
 * 主題檢測結果
 */
export interface TopicDetectionResult {
  topic: string | null;
  confidence: number; // 0-1
  keywords: string[];
  category?: string | undefined;
}

/**
 * 主題變化檢測結果
 */
export interface TopicChangeDetection {
  hasChanged: boolean;
  oldTopic?: string;
  newTopic?: string;
  confidence: number;
  reason: string;
}

/**
 * 主題服務類
 */
export class TopicService {
  private db: DrizzleD1Database;
  private config: typeof DEFAULT_SESSION_CONFIG;

  constructor(database: any, config?: Partial<typeof DEFAULT_SESSION_CONFIG>) {
    this.db = drizzle(database);
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config };
  }

  /**
   * 從訊息內容提取主題
   */
  async extractTopic(messageContent: string): Promise<TopicDetectionResult> {
    const content = messageContent.toLowerCase().trim();

    if (!content) {
      return {
        topic: null,
        confidence: 0,
        keywords: []
      };
    }

    // 常見主題關鍵詞映射
    const topicKeywords = {
      '產品諮詢': {
        keywords: ['產品', '功能', '特色', '介紹', '規格', 'product', 'feature', 'specification'],
        category: 'inquiry'
      },
      '技術支援': {
        keywords: ['問題', '錯誤', '故障', '不能', '無法', '修復', 'error', 'bug', 'issue', 'fix', 'problem'],
        category: 'support'
      },
      '訂單查詢': {
        keywords: ['訂單', '購買', '付款', '配送', '出貨', 'order', 'payment', 'delivery', 'shipping'],
        category: 'order'
      },
      '帳戶問題': {
        keywords: ['帳戶', '登入', '密碼', '註冊', '會員', 'account', 'login', 'password', 'register'],
        category: 'account'
      },
      '投訴建議': {
        keywords: ['投訴', '建議', '不滿', '改善', '反饋', 'complaint', 'feedback', 'suggestion', 'improve'],
        category: 'feedback'
      },
      '價格詢問': {
        keywords: ['價格', '費用', '成本', '多少錢', '價錢', 'price', 'cost', 'fee', 'how much'],
        category: 'pricing'
      },
      '使用說明': {
        keywords: ['怎麼用', '如何使用', '教學', '步驟', 'how to', 'tutorial', 'guide', 'instruction'],
        category: 'tutorial'
      },
      '一般諮詢': {
        keywords: ['你好', '哈囉', '請問', '想了解', 'hello', 'hi', 'question', 'ask'],
        category: 'general'
      }
    };

    let bestMatch = {
      topic: null as string | null,
      confidence: 0,
      keywords: [] as string[],
      category: undefined as string | undefined
    };

    // 檢查每個主題類別
    for (const [topic, data] of Object.entries(topicKeywords)) {
      const matchedKeywords = data.keywords.filter(keyword =>
        content.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        // 計算信心度：匹配關鍵詞數量 / 總關鍵詞數量
        const confidence = Math.min(matchedKeywords.length / data.keywords.length * 2, 1);

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            topic,
            confidence,
            keywords: matchedKeywords,
            category: data.category
          };
        }
      }
    }

    // 如果沒有明確匹配，嘗試基本語義分析
    if (!bestMatch.topic) {
      const semanticTopic = await this.performSemanticAnalysis(content);
      if (semanticTopic) {
        bestMatch = {
          topic: semanticTopic.topic,
          confidence: semanticTopic.confidence,
          keywords: semanticTopic.keywords,
          category: semanticTopic.category
        };
      }
    }

    return bestMatch;
  }

  /**
   * 檢測主題是否發生變化
   */
  async detectTopicChange(
    sessionId: string,
    newMessageContent: string,
    senderType: 'customer' | 'agent' | 'system'
  ): Promise<TopicChangeDetection> {
    // 只檢測客戶訊息的主題變化
    if (senderType !== 'customer') {
      return {
        hasChanged: false,
        confidence: 0,
        reason: 'Only customer messages are analyzed for topic changes'
      };
    }

    // 檢查關鍵詞觸發
    const hasTopicChangeKeyword = this.config.topicChangeKeywords.some(keyword =>
      newMessageContent.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasTopicChangeKeyword) {
      const newTopicResult = await this.extractTopic(newMessageContent);
      return {
        hasChanged: true,
        newTopic: newTopicResult.topic || 'unknown',
        confidence: 0.8,
        reason: 'Topic change keyword detected'
      };
    }

    // 獲取會話中最近的客戶訊息
    const recentMessages = await this.db
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
      return {
        hasChanged: false,
        confidence: 0,
        reason: 'No recent messages to compare'
      };
    }

    // 分析新訊息主題
    const newTopicResult = await this.extractTopic(newMessageContent);
    if (!newTopicResult.topic) {
      return {
        hasChanged: false,
        confidence: 0,
        reason: 'Could not determine topic of new message'
      };
    }

    // 分析最近訊息的主題
    const recentTopics = await Promise.all(
      recentMessages.map(msg => this.extractTopic(msg.content))
    );

    const recentTopicNames = recentTopics
      .filter(result => result.topic && result.confidence > 0.3)
      .map(result => result.topic);

    // 檢查新主題是否與最近的主題不同
    const topicChanged = recentTopicNames.length > 0 &&
                        !recentTopicNames.includes(newTopicResult.topic);

    if (topicChanged) {
      return {
        hasChanged: true,
        oldTopic: recentTopicNames[0] || 'unknown',
        newTopic: newTopicResult.topic || 'unknown',
        confidence: Math.min(newTopicResult.confidence + 0.2, 1),
        reason: 'Semantic topic analysis detected change'
      };
    }

    return {
      hasChanged: false,
      oldTopic: recentTopicNames[0] || 'unknown',
      newTopic: newTopicResult.topic || 'unknown',
      confidence: 0.1,
      reason: 'No significant topic change detected'
    };
  }

  /**
   * 獲取會話主題統計
   */
  async getTopicStatistics(conversationId?: string): Promise<{
    totalTopics: number;
    topicDistribution: Array<{ topic: string; count: number; percentage: number }>;
    mostCommonTopic: string | null;
    topicsBySession: Array<{ sessionId: string; topic: string | null; messageCount: number }>;
  }> {
    let whereCondition = undefined;
    if (conversationId) {
      whereCondition = eq(conversationSessions.conversationId, conversationId);
    }

    // 獲取所有會話主題
    const sessions = await this.db
      .select({
        sessionId: conversationSessions.id,
        topic: conversationSessions.topic,
        messageCount: conversationSessions.messageCount
      })
      .from(conversationSessions)
      .where(whereCondition)
      .all();

    // 統計主題分佈
    const topicCounts = new Map<string, number>();
    sessions.forEach(session => {
      if (session.topic) {
        topicCounts.set(session.topic, (topicCounts.get(session.topic) || 0) + 1);
      }
    });

    const totalSessions = sessions.length;
    const totalTopics = topicCounts.size;

    // 轉換為陣列並計算百分比
    const topicDistribution = Array.from(topicCounts.entries())
      .map(([topic, count]) => ({
        topic,
        count,
        percentage: Math.round((count / totalSessions) * 100 * 100) / 100
      }))
      .sort((a, b) => b.count - a.count);

    // 找出最常見的主題
    const mostCommonTopic = topicDistribution.length > 0 ? topicDistribution[0]?.topic || null : null;

    return {
      totalTopics,
      topicDistribution,
      mostCommonTopic,
      topicsBySession: sessions.map(s => ({
        sessionId: s.sessionId,
        topic: s.topic,
        messageCount: s.messageCount || 0
      }))
    };
  }

  /**
   * 更新會話主題
   */
  async updateSessionTopic(sessionId: string, topic: string | null): Promise<boolean> {
    try {
      await this.db
        .update(conversationSessions)
        .set({
          topic
        })
        .where(eq(conversationSessions.id, sessionId));

      return true;
    } catch (error) {
      console.error('Failed to update session topic:', error);
      return false;
    }
  }

  /**
   * 簡單語義分析 (可以後續擴展為 AI 服務)
   */
  private async performSemanticAnalysis(content: string): Promise<TopicDetectionResult | null> {
    // 基於長度和特定模式的簡單分析
    const wordCount = content.split(/\s+/).length;

    // 問號多 = 可能是詢問
    const questionMarks = (content.match(/[?？]/g) || []).length;
    if (questionMarks > 0 && wordCount < 20) {
      return {
        topic: '一般諮詢',
        confidence: 0.4,
        keywords: ['question'],
        category: 'general'
      };
    }

    // 感嘆號多 = 可能是抱怨
    const exclamationMarks = (content.match(/[!！]/g) || []).length;
    if (exclamationMarks > 1) {
      return {
        topic: '投訴建議',
        confidence: 0.3,
        keywords: ['emotion'],
        category: 'feedback'
      };
    }

    // 數字多 = 可能是訂單相關
    const numbers = (content.match(/\d/g) || []).length;
    if (numbers > 3) {
      return {
        topic: '訂單查詢',
        confidence: 0.3,
        keywords: ['numbers'],
        category: 'order'
      };
    }

    return null;
  }

  /**
   * 獲取主題建議
   */
  async suggestTopics(messageContent: string, limit: number = 3): Promise<TopicDetectionResult[]> {
    const mainTopic = await this.extractTopic(messageContent);
    const suggestions = [mainTopic];

    // 可以添加更多智能建議邏輯
    // 這裡先返回主要檢測結果
    return suggestions.filter(s => s.topic !== null).slice(0, limit);
  }
}