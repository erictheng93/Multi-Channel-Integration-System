import type { ConversationSession, SessionBoundaryDetection, SessionConfig } from '../types/session-types';
import { SessionNotFoundError, DEFAULT_SESSION_CONFIG } from '../types/session-types';

export type GetSessionCallback = (sessionId: string) => Promise<ConversationSession | null>;

export class SessionBoundaryService {
  private config: SessionConfig;
  constructor(config?: Partial<SessionConfig>) { this.config = { ...DEFAULT_SESSION_CONFIG, ...config }; }
  setConfig(config: SessionConfig): void { this.config = config; }

  async detectSessionBoundary(currentSession: ConversationSession | null, messageContent: string, senderType: 'customer' | 'agent' | 'system'): Promise<SessionBoundaryDetection> {
    if (!currentSession) return { shouldCreateNew: true, reason: 'first_session', confidence: 1.0 };
    const lastActivity = new Date(currentSession.lastActivity);
    const now = new Date();
    const timeDiffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
    if (timeDiffMinutes > this.config.timeGapThreshold) return { shouldCreateNew: true, reason: 'time_gap', confidence: 0.9, metadata: { timeDiffMinutes } };
    if (currentSession.messageCount >= this.config.maxMessagesPerSession) return { shouldCreateNew: true, reason: 'message_limit', confidence: 0.8, metadata: { currentMessageCount: currentSession.messageCount } };
    const sessionStart = new Date(currentSession.startTime);
    const sessionDurationHours = (now.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
    if (sessionDurationHours > this.config.maxSessionDuration) return { shouldCreateNew: true, reason: 'duration_limit', confidence: 0.7, metadata: { sessionDurationHours } };
    if (senderType === 'customer' && this.config.enableTopicDetection) {
      const hasTopicChange = this.config.topicChangeKeywords.some(keyword => messageContent.toLowerCase().includes(keyword.toLowerCase()));
      if (hasTopicChange) {
        const suggestedTopic = await this.extractTopic(messageContent);
        return { shouldCreateNew: true, reason: 'topic_change', confidence: 0.6, suggestedTopic: suggestedTopic || 'unknown', metadata: { detectedKeywords: this.config.topicChangeKeywords.filter(k => messageContent.toLowerCase().includes(k)) } };
      }
    }
    return { shouldCreateNew: false, reason: 'manual', confidence: 0.1 };
  }

  async extractTopic(messageContent: string): Promise<string | null> {
    const content = messageContent.toLowerCase();
    const topicKeywords = [
      { topic: '技術支援', keywords: ['錯誤', '故障', '不能', '無法', 'error', 'bug', 'issue'], priority: 5 },
      { topic: '投訴建議', keywords: ['投訴', '建議', '不滿', '改善', 'complaint', 'feedback', 'suggestion'], priority: 4 },
      { topic: '訂單查詢', keywords: ['訂單', '購買', '付款', '配送', 'order', 'payment', 'delivery'], priority: 3 },
      { topic: '帳戶問題', keywords: ['帳戶', '登入', '密碼', '註冊', 'account', 'login', 'password'], priority: 3 },
      { topic: '產品諮詢', keywords: ['產品', '功能', '特色', '介紹', 'product', 'feature'], priority: 2 },
      { topic: '一般諮詢', keywords: ['你好', '哈囉', '請問', 'hello', 'hi'], priority: 1 }
    ];
    const matches: { topic: string; priority: number; matchCount: number }[] = [];
    for (const { topic, keywords, priority } of topicKeywords) {
      const matchCount = keywords.filter(keyword => content.includes(keyword)).length;
      if (matchCount > 0) matches.push({ topic, priority, matchCount });
    }
    if (matches.length === 0) return null;
    matches.sort((a, b) => b.priority !== a.priority ? b.priority - a.priority : b.matchCount - a.matchCount);
    return matches[0].topic;
  }

  async analyzeSessionHealth(sessionId: string, getSession: GetSessionCallback): Promise<{ healthy: boolean; issues: string[]; suggestions: string[] }> {
    const session = await getSession(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    const issues: string[] = [];
    const suggestions: string[] = [];
    if (session.isActive) {
      const now = new Date();
      const startTime = new Date(session.startTime);
      const durationHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      if (durationHours > 48) { issues.push('會話持續時間過長'); suggestions.push('考慮關閉此會話並開始新會話'); }
    }
    if (session.messageCount > 100) { issues.push('會話訊息數量過多'); suggestions.push('考慮分割會話以提高管理效率'); }
    const lastActivity = new Date(session.lastActivity);
    const now = new Date();
    const inactiveMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
    if (session.isActive && inactiveMinutes > this.config.inactiveThreshold) { issues.push('會話長時間無活動'); suggestions.push('考慮主動聯繫客戶或關閉會話'); }
    return { healthy: issues.length === 0, issues, suggestions };
  }
}
