// Connection validation middleware - validates real-time connection parameters

import { Context, Next } from 'hono';
import type { Bindings } from '@/types';
import { errorResponse, badRequestResponse } from '@/utils/api-response';
import { getRealtimeAuth } from '@modules/realtime/middleware/realtime-auth';

// 連接驗證配置
interface ConnectionValidationConfig {
  maxConnectionsPerUser: number;
  validateConversationId: boolean;
  validateUserAgent: boolean;
  enableRateLimiting: boolean;
  rateLimitWindow: number; // 秒
  rateLimitRequests: number;
  requiredHeaders: string[];
  allowedOrigins?: string[];
}

const defaultConfig: ConnectionValidationConfig = {
  maxConnectionsPerUser: 5,
  validateConversationId: true,
  validateUserAgent: true,
  enableRateLimiting: true,
  rateLimitWindow: 60,
  rateLimitRequests: 10,
  requiredHeaders: ['User-Agent']
};

// 速率限制記錄
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// 連接驗證中間件
export const connectionValidation = (config: Partial<ConnectionValidationConfig> = {}) => {
  const validationConfig = { ...defaultConfig, ...config };

  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    try {
      const auth = getRealtimeAuth(c);
      if (!auth) {
        return errorResponse(c, 'Authentication required for connection validation', 401);
      }

      // 1. 驗證必要的 Headers
      if (validationConfig.requiredHeaders.length > 0) {
        const missingHeaders = [];
        for (const header of validationConfig.requiredHeaders) {
          if (!c.req.header(header)) {
            missingHeaders.push(header);
          }
        }

        if (missingHeaders.length > 0) {
          return badRequestResponse(c, `Missing required headers: ${missingHeaders.join(', ')}`);
        }
      }

      // 2. User-Agent 驗證
      if (validationConfig.validateUserAgent) {
        const userAgent = c.req.header('User-Agent');
        if (!userAgent || userAgent.trim().length < 10) {
          return badRequestResponse(c, 'Invalid or missing User-Agent header');
        }

        // 檢查可疑的 User-Agent
        const suspiciousPatterns = [
          /bot/i,
          /crawler/i,
          /spider/i,
          /scraper/i
        ];

        if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
          console.warn(`⚠️ [Connection Validation] 可疑的 User-Agent: ${userAgent}`, {
            userId: auth.userId,
            ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')
          });
        }
      }

      // 3. Origin 驗證
      if (validationConfig.allowedOrigins && validationConfig.allowedOrigins.length > 0) {
        const origin = c.req.header('Origin');
        if (origin && !validationConfig.allowedOrigins.includes(origin)) {
          return badRequestResponse(c, 'Origin not allowed');
        }
      }

      // 4. 對話 ID 驗證
      if (validationConfig.validateConversationId) {
        const conversationId = c.req.query('conversationId');
        if (conversationId) {
          const convId = parseInt(conversationId);
          if (isNaN(convId) || convId <= 0) {
            return badRequestResponse(c, 'Invalid conversation ID format');
          }

          // 檢查對話是否存在
          if (c.env.DB) {
            try {
              const conversation = await c.env.DB.prepare(
                'SELECT id FROM conversations WHERE id = ?'
              ).bind(convId).first();

              if (!conversation) {
                return badRequestResponse(c, 'Conversation not found');
              }
            } catch (error) {
              console.error('❌ [Connection Validation] 對話查詢失敗:', error);
              // 繼續處理，不因為資料庫錯誤而阻止連接
            }
          }
        }
      }

      // 5. 速率限制檢查
      if (validationConfig.enableRateLimiting) {
        const clientKey = `${auth.userId}-${c.req.header('CF-Connecting-IP') || 'unknown'}`;
        const now = Date.now();
        const windowStart = now - (validationConfig.rateLimitWindow * 1000);

        let rateLimit = rateLimitStore.get(clientKey);
        if (!rateLimit || rateLimit.resetTime < now) {
          // 重置或創建新的速率限制記錄
          rateLimit = {
            count: 0,
            resetTime: now + (validationConfig.rateLimitWindow * 1000)
          };
          rateLimitStore.set(clientKey, rateLimit);
        }

        rateLimit.count++;

        if (rateLimit.count > validationConfig.rateLimitRequests) {
          console.warn(`⚠️ [Connection Validation] 速率限制觸發:`, {
            userId: auth.userId,
            clientKey,
            count: rateLimit.count,
            limit: validationConfig.rateLimitRequests
          });

          c.header('Retry-After', Math.ceil((rateLimit.resetTime - now) / 1000).toString());
          return errorResponse(c, 'Rate limit exceeded', 429);
        }

        // 清理過期的速率限制記錄
        if (rateLimitStore.size > 1000) {
          for (const [key, value] of rateLimitStore) {
            if (value.resetTime < now) {
              rateLimitStore.delete(key);
            }
          }
        }
      }

      // 6. 用戶連接數檢查
      if (validationConfig.maxConnectionsPerUser > 0) {
        const userConnectionCount = await getCurrentUserConnections(auth.userId, c.env);
        if (userConnectionCount >= validationConfig.maxConnectionsPerUser) {
          return errorResponse(c,
            `Maximum connections per user exceeded (${validationConfig.maxConnectionsPerUser})`,
            429
          );
        }
      }

      // 7. 設置驗證信息到 context
      c.set('connectionValidation', {
        userAgent: c.req.header('User-Agent'),
        origin: c.req.header('Origin'),
        ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        timestamp: new Date().toISOString(),
        conversationId: c.req.query('conversationId')
      });

      console.log(`✅ [Connection Validation] 驗證通過:`, {
        userId: auth.userId,
        userAgent: c.req.header('User-Agent'),
        conversationId: c.req.query('conversationId'),
        ip: c.req.header('CF-Connecting-IP')
      });

      await next();

    } catch (error) {
      console.error('❌ [Connection Validation] 驗證中間件錯誤:', error);
      return errorResponse(c, 'Connection validation error', 500);
    }
  };
};

// 獲取用戶當前連接數
async function getCurrentUserConnections(userId: number, env: Bindings): Promise<number> {
  if (!env.SESSIONS) {
    return 0;
  }

  try {
    // Get connection stats from KV
    const statsKey = 'realtime_connection_stats';
    const statsData = await env.SESSIONS.get(statsKey);

    if (statsData) {
      const stats = JSON.parse(statsData);
      return stats.connectionsByUser?.[userId] || 0;
    }

    return 0;
  } catch (error) {
    console.error('❌ [Connection Validation] 獲取連接數失敗:', error);
    return 0;
  }
}

// Event sending connection validation
export const eventSendValidation = connectionValidation({
  maxConnectionsPerUser: 0, // 不限制事件發送的連接數
  validateConversationId: false,
  validateUserAgent: false,
  enableRateLimiting: true,
  rateLimitWindow: 60,
  rateLimitRequests: 100, // 事件發送可以更頻繁
  requiredHeaders: []
});

// 管理端點的連接驗證
export const managementValidation = connectionValidation({
  maxConnectionsPerUser: 2,
  validateConversationId: false,
  validateUserAgent: true,
  enableRateLimiting: true,
  rateLimitWindow: 60,
  rateLimitRequests: 30,
  requiredHeaders: ['User-Agent']
});

// 從 context 獲取連接驗證信息
export function getConnectionValidation(c: Context): any {
  return c.get('connectionValidation') || null;
}

// 清理速率限制記錄的工具函數
export function cleanupRateLimitStore(): number {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, value] of rateLimitStore) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
      cleanedCount++;
    }
  }

  return cleanedCount;
}

// 獲取速率限制統計
export function getRateLimitStats(): {
  totalEntries: number;
  activeEntries: number;
  topUsers: Array<{ key: string; count: number; resetTime: number }>;
} {
  const now = Date.now();
  const activeEntries: Array<{ key: string; count: number; resetTime: number }> = [];

  for (const [key, value] of rateLimitStore) {
    if (value.resetTime > now) {
      activeEntries.push({ key, count: value.count, resetTime: value.resetTime });
    }
  }

  // 按請求數排序
  activeEntries.sort((a, b) => b.count - a.count);

  return {
    totalEntries: rateLimitStore.size,
    activeEntries: activeEntries.length,
    topUsers: activeEntries.slice(0, 10) // 返回前10個最活躍的用戶
  };
}