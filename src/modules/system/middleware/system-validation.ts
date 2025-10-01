// System 模組資料驗證中間件
// System data validation middleware

import { Context, Next } from 'hono';
import type { Bindings } from '@/types';
import type { SystemSettingsUpdate } from '@modules/system/types/system-types';

// ======================== 基礎驗證中間件 ========================

/**
 * 驗證備份ID格式
 */
export async function validateBackupId(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const backupId = c.req.param('backupId');

    if (!backupId) {
      return c.json({
        success: false,
        error: 'Backup ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 驗證 UUID 格式 (基本)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(backupId)) {
      return c.json({
        success: false,
        error: 'Invalid backup ID format',
        timestamp: new Date().toISOString()
      }, 400);
    }

    return await next();
  } catch (error) {
    console.error('Error validating backup ID:', error);
    return c.json({
      success: false,
      error: 'Backup ID validation failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 驗證訊息ID格式
 */
export async function validateMessageId(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const messageId = c.req.param('messageId');

    if (!messageId) {
      return c.json({
        success: false,
        error: 'Message ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 驗證 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(messageId)) {
      return c.json({
        success: false,
        error: 'Invalid message ID format',
        timestamp: new Date().toISOString()
      }, 400);
    }

    return await next();
  } catch (error) {
    console.error('Error validating message ID:', error);
    return c.json({
      success: false,
      error: 'Message ID validation failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 驗證對話ID格式
 */
export async function validateConversationId(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const conversationId = c.req.param('conversationId');

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 驗證 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(conversationId)) {
      return c.json({
        success: false,
        error: 'Invalid conversation ID format',
        timestamp: new Date().toISOString()
      }, 400);
    }

    return await next();
  } catch (error) {
    console.error('Error validating conversation ID:', error);
    return c.json({
      success: false,
      error: 'Conversation ID validation failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// ======================== 系統設置驗證 ========================

/**
 * 驗證系統設置更新資料
 */
export async function validateSystemSettingsUpdate(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    let settingsData: SystemSettingsUpdate;

    try {
      settingsData = await c.req.json();
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid JSON data',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const errors: string[] = [];

    // 驗證 general 設置
    if (settingsData.general) {
      const { systemName, contactEmail, timezone, language } = settingsData.general;

      if (systemName !== undefined) {
        if (typeof systemName !== 'string' || systemName.length < 1 || systemName.length > 100) {
          errors.push('systemName must be a string between 1 and 100 characters');
        }
      }

      if (contactEmail !== undefined) {
        if (typeof contactEmail !== 'string' || !isValidEmail(contactEmail)) {
          errors.push('contactEmail must be a valid email address');
        }
      }

      if (timezone !== undefined) {
        if (typeof timezone !== 'string' || !isValidTimezone(timezone)) {
          errors.push('timezone must be a valid timezone string');
        }
      }

      if (language !== undefined) {
        if (typeof language !== 'string' || !['en', 'zh-TW', 'zh-CN', 'ja'].includes(language)) {
          errors.push('language must be one of: en, zh-TW, zh-CN, ja');
        }
      }
    }

    // 驗證 integrations 設置
    if (settingsData.integrations) {
      if (settingsData.integrations.line) {
        const line = settingsData.integrations.line;

        if (line.channelId !== undefined) {
          if (typeof line.channelId !== 'string' || line.channelId.length === 0) {
            errors.push('LINE channelId must be a non-empty string');
          }
        }

        if (line.channelSecret !== undefined) {
          if (typeof line.channelSecret !== 'string' || line.channelSecret.length === 0) {
            errors.push('LINE channelSecret must be a non-empty string');
          }
        }

        if (line.accessToken !== undefined) {
          if (typeof line.accessToken !== 'string' || line.accessToken.length === 0) {
            errors.push('LINE accessToken must be a non-empty string');
          }
        }

        if (line.status !== undefined) {
          if (!['connected', 'disconnected', 'error'].includes(line.status)) {
            errors.push('LINE status must be one of: connected, disconnected, error');
          }
        }
      }

      if (settingsData.integrations.facebook) {
        const facebook = settingsData.integrations.facebook;

        if (facebook.appId !== undefined) {
          if (typeof facebook.appId !== 'string' || facebook.appId.length === 0) {
            errors.push('Facebook appId must be a non-empty string');
          }
        }

        if (facebook.appSecret !== undefined) {
          if (typeof facebook.appSecret !== 'string' || facebook.appSecret.length === 0) {
            errors.push('Facebook appSecret must be a non-empty string');
          }
        }

        if (facebook.pageId !== undefined) {
          if (typeof facebook.pageId !== 'string' || facebook.pageId.length === 0) {
            errors.push('Facebook pageId must be a non-empty string');
          }
        }

        if (facebook.pageToken !== undefined) {
          if (typeof facebook.pageToken !== 'string' || facebook.pageToken.length === 0) {
            errors.push('Facebook pageToken must be a non-empty string');
          }
        }

        if (facebook.status !== undefined) {
          if (!['connected', 'disconnected', 'error'].includes(facebook.status)) {
            errors.push('Facebook status must be one of: connected, disconnected, error');
          }
        }
      }
    }

    // 驗證 advanced 設置
    if (settingsData.advanced) {
      const {
        messageQueueSize,
        messageTimeout,
        cacheExpiry,
        sessionExpiry,
        enableRateLimit,
        enableLogging,
        enableMetrics
      } = settingsData.advanced;

      if (messageQueueSize !== undefined) {
        if (typeof messageQueueSize !== 'number' || messageQueueSize < 1 || messageQueueSize > 10000) {
          errors.push('messageQueueSize must be a number between 1 and 10000');
        }
      }

      if (messageTimeout !== undefined) {
        if (typeof messageTimeout !== 'number' || messageTimeout < 1000 || messageTimeout > 300000) {
          errors.push('messageTimeout must be a number between 1000 and 300000 (milliseconds)');
        }
      }

      if (cacheExpiry !== undefined) {
        if (typeof cacheExpiry !== 'number' || cacheExpiry < 60 || cacheExpiry > 86400) {
          errors.push('cacheExpiry must be a number between 60 and 86400 (seconds)');
        }
      }

      if (sessionExpiry !== undefined) {
        if (typeof sessionExpiry !== 'number' || sessionExpiry < 300 || sessionExpiry > 604800) {
          errors.push('sessionExpiry must be a number between 300 and 604800 (seconds)');
        }
      }

      if (enableRateLimit !== undefined) {
        if (typeof enableRateLimit !== 'boolean') {
          errors.push('enableRateLimit must be a boolean');
        }
      }

      if (enableLogging !== undefined) {
        if (typeof enableLogging !== 'boolean') {
          errors.push('enableLogging must be a boolean');
        }
      }

      if (enableMetrics !== undefined) {
        if (typeof enableMetrics !== 'boolean') {
          errors.push('enableMetrics must be a boolean');
        }
      }
    }

    // 至少要有一個可更新的欄位
    if (!settingsData.general && !settingsData.integrations && !settingsData.advanced) {
      errors.push('At least one setting category (general, integrations, advanced) must be provided');
    }

    if (errors.length > 0) {
      return c.json({
        success: false,
        error: 'Settings validation failed',
        details: errors,
        timestamp: new Date().toISOString()
      }, 400);
    }

    return await next();
  } catch (error) {
    console.error('Error validating system settings update:', error);
    return c.json({
      success: false,
      error: 'Settings validation failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// ======================== 平台參數驗證 ========================

/**
 * 驗證平台參數
 */
export async function validatePlatformParameter(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const platform = c.req.param('platform');

    if (!platform) {
      return c.json({
        success: false,
        error: 'Platform parameter is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const supportedPlatforms = ['line', 'facebook'];
    if (!supportedPlatforms.includes(platform)) {
      return c.json({
        success: false,
        error: `Invalid platform. Must be one of: ${supportedPlatforms.join(', ')}`,
        timestamp: new Date().toISOString()
      }, 400);
    }

    return await next();
  } catch (error) {
    console.error('Error validating platform parameter:', error);
    return c.json({
      success: false,
      error: 'Platform parameter validation failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// ======================== 請求限制驗證 ========================

/**
 * 驗證請求頻率限制
 */
export async function validateRateLimit(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const userPayload = c.get('jwtPayload');
    if (!userPayload) {
      return await next();
    }

    const userId = userPayload.userId;
    const endpoint = new URL(c.req.url).pathname;
    const cacheKey = `rate_limit:${userId}:${endpoint}`;

    // 檢查緩存中的請求次數
    const cache = c.env.CACHE || c.env.KV;
    const currentCount = await cache.get(cacheKey);
    const count = currentCount ? parseInt(currentCount) : 0;

    // 根據不同端點設置不同的限制
    const limits: Record<string, { max: number; window: number }> = {
      'POST /api/system/restart': { max: 1, window: 3600 }, // 1 hour
      'POST /api/system/backup': { max: 5, window: 3600 },  // 1 hour
      'POST /api/system/cache/clear': { max: 10, window: 300 }, // 5 minutes
      'PUT /api/system/settings': { max: 20, window: 300 }, // 5 minutes
      'default': { max: 100, window: 60 } // 1 minute
    };

    const method = c.req.method;
    const limitKey = `${method} ${endpoint}`;
    const limit = limits[limitKey] || limits['default'];

    if (!limit) {
      // Fallback if for some reason default is not defined
      return await next();
    }

    if (count >= limit.max) {
      return c.json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: limit.window,
        timestamp: new Date().toISOString()
      }, 429);
    }

    // 更新請求次數
    await cache.put(cacheKey, (count + 1).toString(), { expirationTtl: limit.window });

    return await next();
  } catch (error) {
    console.error('Error in rate limit validation:', error);
    // 不影響主要流程，繼續執行
    return await next();
  }
}

// ======================== 請求內容驗證 ========================

/**
 * 驗證請求體大小
 */
export async function validateRequestSize(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const contentLength = c.req.header('content-length');

    if (contentLength) {
      const size = parseInt(contentLength);
      const maxSize = 1024 * 1024; // 1MB

      if (size > maxSize) {
        return c.json({
          success: false,
          error: 'Request body too large',
          maxSize: maxSize,
          timestamp: new Date().toISOString()
        }, 413);
      }
    }

    return await next();
  } catch (error) {
    console.error('Error validating request size:', error);
    return c.json({
      success: false,
      error: 'Request size validation failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// ======================== 工具函數 ========================

/**
 * 驗證電子郵件格式
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 驗證時區格式
 */
function isValidTimezone(timezone: string): boolean {
  try {
    // 使用 Intl.DateTimeFormat 來驗證時區
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * 清理和驗證字串輸入
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    .trim()
    .replace(/[<>\"'&]/g, '') // 移除潛在的 XSS 字符
    .substring(0, maxLength);
}

/**
 * 驗證數字範圍
 */
export function validateNumberRange(value: number, min: number, max: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
}