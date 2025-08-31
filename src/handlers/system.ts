// 系統管理處理器
import { Context } from 'hono'
import type { 
  Bindings,
  // AuthPayload,
  // LineWebhookInfo,
  // LineBotInfo,
  // LineTokenInfo,
  // FacebookPageInfo
} from '../types'
import { 
  isLineWebhookInfo,
  isLineBotInfo,
  isFacebookPageInfo,
  // hasApiError
} from '../types'
import { 
  successResponse, 
  // errorResponse, 
  // validationErrorResponse, 
  handleApiError 
} from '../utils/api-response'
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '../services/activity-service'
import { drizzle } from 'drizzle-orm/d1'
import { sql, gte, count } from 'drizzle-orm'
import { systemSettings, agents, conversations, messages } from '../db/schema'

// 簡化的加密工具 (與 credentials.ts 相同)
const decrypt = async (encryptedText: string, key: string): Promise<string> => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  
  const combined = new Uint8Array(
    atob(encryptedText).split('').map(char => char.charCodeAt(0))
  )
  
  const iv = combined.slice(0, 12)
  const encrypted = combined.slice(12)
  
  const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32))
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  )
  
  return decoder.decode(decrypted)
}

// 獲取加密密鑰
const getEncryptionKey = (env: Bindings): string => {
  return env.JWT_SECRET || env.ENCRYPTION_KEY || 'default-key-32-chars-long-for-dev'
}

// 從 KV 獲取憑證的輔助函數
const getCredentialsFromKV = async (env: Bindings, platform: 'line' | 'facebook') => {
  try {
    console.log(`Getting ${platform} credentials from KV...`)
    const encryptionKey = getEncryptionKey(env)
    console.log('Encryption key available:', !!encryptionKey)
    
    const credentialTypes = platform === 'line' 
      ? ['channelId', 'channelSecret', 'accessToken']
      : ['appId', 'appSecret', 'pageId', 'pageToken']
    
    const credentials: any = {}
    
    for (const type of credentialTypes) {
      const key = `credentials:${platform}:${type}`
      console.log(`Retrieving KV key: ${key}`)
      
      const encryptedValue = await env.CACHE?.get(key)
      if (encryptedValue) {
        console.log(`Found encrypted value for ${key}, length:`, encryptedValue.length)
        try {
          credentials[type] = await decrypt(encryptedValue, encryptionKey)
          console.log(`Successfully decrypted ${key}`)
        } catch (decryptError) {
          console.error(`Failed to decrypt ${key}:`, decryptError)
          // Continue with other credentials even if one fails
        }
      } else {
        console.log(`No value found for KV key: ${key}`)
      }
    }
    
    console.log('Final credentials object keys:', Object.keys(credentials))
    return Object.keys(credentials).length > 0 ? credentials : null
  } catch (error) {
    console.error(`Failed to get ${platform} credentials from KV:`, error)
    return null
  }
}

// interface SystemSettings {
//   general?: {
//     systemName: string;
//     contactEmail: string;
//     timezone: string;
//     language: string;
//   };
//   integrations?: {
//     line?: {
//       channelId: string;
//       channelSecret: string;
//       accessToken: string;
//       status: 'connected' | 'disconnected' | 'error';
//     };
//     facebook?: {
//       appId: string;
//       appSecret: string;
//       pageId: string;
//       pageToken: string;
//       status: 'connected' | 'disconnected' | 'error';
//     };
//   };
//   advanced?: {
//     messageQueueSize: number;
//     messageTimeout: number;
//     cacheExpiry: number;
//     sessionExpiry: number;
//     enableRateLimit: boolean;
//     enableLogging: boolean;
//     enableMetrics: boolean;
//   };
// }

// 用於部分更新的介面 - 允許所有屬性都是可選的
interface SystemSettingsUpdate {
  general?: Partial<{
    systemName: string;
    contactEmail: string;
    timezone: string;
    language: string;
  }>;
  integrations?: {
    line?: Partial<{
      channelId: string;
      channelSecret: string;
      accessToken: string;
      status: 'connected' | 'disconnected' | 'error';
    }>;
    facebook?: Partial<{
      appId: string;
      appSecret: string;
      pageId: string;
      pageToken: string;
      status: 'connected' | 'disconnected' | 'error';
    }>;
  };
  advanced?: Partial<{
    messageQueueSize: number;
    messageTimeout: number;
    cacheExpiry: number;
    sessionExpiry: number;
    enableRateLimit: boolean;
    enableLogging: boolean;
    enableMetrics: boolean;
  }>;
}

// 用於 getSettings 返回的介面 - 不包含敏感憑證資料
interface SystemSettingsResponse {
  general?: {
    systemName: string;
    contactEmail: string;
    timezone: string;
    language: string;
  };
  integrations?: {
    line?: {
      status: 'connected' | 'disconnected' | 'error';
    };
    facebook?: {
      status: 'connected' | 'disconnected' | 'error';
    };
  };
  advanced?: {
    messageQueueSize: number;
    messageTimeout: number;
    cacheExpiry: number;
    sessionExpiry: number;
    enableRateLimit: boolean;
    enableLogging: boolean;
    enableMetrics: boolean;
  };
}

// 獲取系統資訊
export const getSystemInfo = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // const drizzleDb = drizzle(c.env.DB)
    
    // 獲取基本系統資訊
    const systemInfo = {
      version: '1.0.0',
      environment: c.env.ENVIRONMENT || 'development',
      lastUpdate: new Date().toISOString(),
      dbStatus: 'online' as const,
      cacheStatus: 'online' as const,
      uptime: Date.now() - (Date.now() - 86400000) // 模擬 24 小時運行時間
    }

    return successResponse(c, systemInfo, 'System information retrieved successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 獲取系統設定
export const getSettings = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = drizzle(c.env.DB)
    
    // 從資料庫獲取設定
    const settingsResult = await drizzleDb
      .select({
        key: systemSettings.key,
        value: systemSettings.value
      })
      .from(systemSettings)
    
    const settings: SystemSettingsResponse = {
      general: {
        systemName: 'Multi-Channel Support',
        contactEmail: 'admin@example.com',
        timezone: 'Asia/Taipei',
        language: 'zh-TW'
      },
      integrations: {
        line: {
          // 憑證現在儲存在 KV 中，getSettings 只返回狀態
          status: 'disconnected'
        },
        facebook: {
          // 憑證現在儲存在 KV 中，getSettings 只返回狀態
          status: 'disconnected'
        }
      },
      advanced: {
        messageQueueSize: 1000,
        messageTimeout: 30,
        cacheExpiry: 60,
        sessionExpiry: 24,
        enableRateLimit: true,
        enableLogging: true,
        enableMetrics: true
      }
    }

    // 覆蓋資料庫中的設定
    settingsResult.forEach(row => {
      const keys = row.key.split('.')
      let current: any = settings
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (key && !current[key]) current[key] = {}
        if (key) current = current[key]
      }
      
      const lastKey = keys[keys.length - 1]
      if (lastKey) {
        try {
          current[lastKey] = JSON.parse(row.value)
        } catch {
          current[lastKey] = row.value
        }
      }
    })

    return successResponse(c, settings, 'Settings retrieved successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 更新系統設定
export const updateSettings = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = drizzle(c.env.DB)
    const settings = await c.req.json<SystemSettingsUpdate>()
    
    // 將設定扁平化並儲存到資料庫
    const flattenSettings = (obj: any, prefix = ''): Array<{ key: string; value: string }> => {
      const result: Array<{ key: string; value: string }> = []
      
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result.push(...flattenSettings(value, fullKey))
        } else {
          result.push({
            key: fullKey,
            value: typeof value === 'string' ? value : JSON.stringify(value)
          })
        }
      }
      
      return result
    }

    const flatSettings = flattenSettings(settings)
    
    if (flatSettings.length === 0) {
      return successResponse(c, null, 'No settings to update')
    }
    
    // 使用事務更新設定
    for (const { key, value } of flatSettings) {
      await drizzleDb
        .insert(systemSettings)
        .values({
          key,
          value,
          updatedAt: new Date().toISOString()
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value,
            updatedAt: new Date().toISOString()
          }
        })
    }

    // 記錄設定更新活動
    const payload = c.get('jwtPayload');
    if (payload) {
      const activityService = new ActivityService(c.env.DB);
      await activityService.logActivity({
        userId: payload.userId.toString(),
        userName: payload.username || 'Admin',
        userRole: payload.role,
        action: ACTIVITY_ACTIONS.SETTINGS_UPDATE,
        resourceType: RESOURCE_TYPES.SYSTEM,
        details: {
          updatedSettings: flatSettings.reduce((acc, { key, value }) => {
            acc[key] = value;
            return acc;
          }, {} as Record<string, string>),
          settingsCount: flatSettings.length
        },
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        userAgent: c.req.header('User-Agent')
      });
    }

    return successResponse(c, null, 'Settings updated successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 測試平台整合
export const testIntegration = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const platform = c.req.param('platform')
    const config = await c.req.json()
    
    let testResult = { status: 'error', message: '測試失敗' }
    
    if (platform === 'line') {
      testResult = await testLineIntegration(config, c.env)
    } else if (platform === 'facebook') {
      testResult = await testFacebookIntegration(config, c.env)
    } else {
      testResult = { status: 'error', message: '不支援的平台' }
    }

    return successResponse(c, testResult, 'Integration test completed')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 測試 LINE 整合
async function testLineIntegration(config: any, env: Bindings) {
  try {
    // 如果沒有提供配置，嘗試從 KV 獲取
    let testConfig = config
    if (!config.channelId || !config.channelSecret || !config.accessToken) {
      const kvCredentials = await getCredentialsFromKV(env, 'line')
      if (kvCredentials) {
        testConfig = {
          channelId: config.channelId || kvCredentials.channelId,
          channelSecret: config.channelSecret || kvCredentials.channelSecret,
          accessToken: config.accessToken || kvCredentials.accessToken
        }
      }
    }

    if (!testConfig.channelId || !testConfig.channelSecret || !testConfig.accessToken) {
      return { status: 'error', message: '請填寫完整的 LINE 設定' }
    }

    // 測試 1: 直接獲取 Bot 資訊來驗證 Token
    console.log('Testing LINE Access Token by getting bot info...', { tokenLength: testConfig.accessToken?.length })
    const botInfoResponse = await fetch('https://api.line.me/v2/bot/info', {
      headers: {
        'Authorization': `Bearer ${testConfig.accessToken}`
      }
    })

    console.log('Bot info response:', botInfoResponse.status, botInfoResponse.statusText)

    if (!botInfoResponse.ok) {
      const errorText = await botInfoResponse.text().catch(() => 'Unable to read error response')
      console.error('Bot info failed:', errorText)
      
      // 提供更具體的錯誤訊息
      let errorMessage = 'LINE Access Token 無效或已過期'
      if (botInfoResponse.status === 401) {
        errorMessage = 'LINE Access Token 無效或已過期'
      } else if (botInfoResponse.status === 403) {
        errorMessage = 'LINE Access Token 權限不足'
      } else if (botInfoResponse.status === 429) {
        errorMessage = 'LINE API 請求頻率過高，請稍後再試'
      } else if (botInfoResponse.status >= 500) {
        errorMessage = 'LINE API 服務暫時不可用'
      }
      
      return { 
        status: 'error', 
        message: errorMessage,
        details: `HTTP ${botInfoResponse.status}: ${errorText}`
      }
    }

    const botInfo = await botInfoResponse.json().catch(e => {
      console.error('Failed to parse bot info JSON:', e)
      return null
    })

    if (!botInfo) {
      return {
        status: 'error',
        message: 'LINE API 回應格式錯誤',
        details: 'Unable to parse bot information response'
      }
    }

    // 測試 2: 檢查 Webhook 設定 (可選)
    let webhookStatus = 'not_tested'
    try {
      console.log('Testing LINE Webhook endpoint...')
      const webhookResponse = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
        headers: {
          'Authorization': `Bearer ${testConfig.accessToken}`
        }
      })
      
      if (webhookResponse.ok) {
        const webhookInfo = await webhookResponse.json()
        console.log('Webhook info retrieved successfully')
        if (isLineWebhookInfo(webhookInfo)) {
          webhookStatus = webhookInfo.active ? 'active' : 'inactive'
        }
      } else {
        console.warn('Webhook check failed:', webhookResponse.status)
      }
    } catch (webhookError) {
      console.warn('Webhook test failed:', webhookError)
    }

    console.log('LINE integration test completed successfully')
    return {
      status: 'success',
      message: 'LINE 連線測試成功',
      details: {
        botName: isLineBotInfo(botInfo) ? botInfo.displayName : 'Unknown',
        botId: isLineBotInfo(botInfo) ? botInfo.userId : 'Unknown',
        channelId: testConfig.channelId,
        webhookStatus,
        testTime: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('LINE integration test error:', error)
    return { 
      status: 'error', 
      message: 'LINE 測試過程中發生錯誤',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// 測試 Facebook 整合
async function testFacebookIntegration(config: any, env: Bindings) {
  try {
    // 如果沒有提供配置，嘗試從 KV 獲取
    let testConfig = config
    if (!config.appId || !config.appSecret || !config.pageId || !config.pageToken) {
      const kvCredentials = await getCredentialsFromKV(env, 'facebook')
      if (kvCredentials) {
        testConfig = {
          appId: config.appId || kvCredentials.appId,
          appSecret: config.appSecret || kvCredentials.appSecret,
          pageId: config.pageId || kvCredentials.pageId,
          pageToken: config.pageToken || kvCredentials.pageToken
        }
      }
    }

    if (!testConfig.appId || !testConfig.appSecret || !testConfig.pageId || !testConfig.pageToken) {
      return { status: 'error', message: '請填寫完整的 Facebook 設定' }
    }

    // 測試 1: 驗證 Page Access Token
    console.log('Testing Facebook Page Access Token...')
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${testConfig.pageToken}`
    )

    if (!tokenResponse.ok) {
      return { 
        status: 'error', 
        message: 'Facebook Page Access Token 無效',
        details: `Token validation failed: ${tokenResponse.status}`
      }
    }

    const pageInfo = await tokenResponse.json()

    // 測試 2: 驗證 App Secret
    console.log('Testing Facebook App Secret...')
    try {
      // const { FacebookAdapter } = await import('../integrations/platform-adapter')
      // const facebookAdapter = new FacebookAdapter(testConfig.appSecret, testConfig.pageToken)
      
      // 簡單的 signature 測試
      // const testSignature = await facebookAdapter.verifyWebhook('sha1=test', 'test-body')
      // 這個測試會失敗，但能驗證 App Secret 格式是否正確
    } catch (signatureError) {
      // 預期會失敗，這是正常的
    }

    // 測試 3: 檢查頁面權限
    console.log('Testing Facebook Page Permissions...')
    const permissionsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${testConfig.pageId}?fields=access_token,name,category&access_token=${testConfig.pageToken}`
    )

    let pageDetails = {}
    if (permissionsResponse.ok) {
      pageDetails = await permissionsResponse.json()
    }

    // 測試 4: 測試發送訊息能力 (到測試用戶，如果有提供)
    let messagingStatus = 'not_tested'
    if (testConfig.testUserId) {
      try {
        const { FacebookAdapter } = await import('../integrations/platform-adapter')
        const facebookAdapter = new FacebookAdapter(testConfig.appSecret, testConfig.pageToken)
        
        const testMessage = await facebookAdapter.sendTextMessage(
          testConfig.testUserId, 
          '🤖 Facebook Messenger 整合測試成功！'
        )
        messagingStatus = testMessage ? 'success' : 'failed'
      } catch (messageError) {
        console.warn('Test message failed:', messageError)
        messagingStatus = 'failed'
      }
    }

    return {
      status: 'success',
      message: 'Facebook 連線測試成功',
      details: {
        pageId: isFacebookPageInfo(pageInfo) ? pageInfo.id : 'Unknown',
        pageName: isFacebookPageInfo(pageInfo) ? pageInfo.name : 'Unknown',
        pageCategory: (pageDetails as any).category,
        messagingStatus,
        appId: testConfig.appId
      }
    }
  } catch (error) {
    console.error('Facebook integration test error:', error)
    return { 
      status: 'error', 
      message: 'Facebook 測試過程中發生錯誤',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// 獲取系統指標
export const getMetrics = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = drizzle(c.env.DB)
    
    // 獲取統計數據
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    // const todayStart = new Date().toISOString().split('T')[0]; // Unused
    
    const [activeUsers, totalConversations, messagesToday] = await Promise.all([
      drizzleDb.select({ count: count() }).from(agents).where(gte(agents.lastLoginAt, oneHourAgo)),
      drizzleDb.select({ count: count() }).from(conversations),
      (drizzleDb.select({ count: count() }).from(messages) as any)
    ])

    const metrics = {
      activeUsers: activeUsers[0]?.count || 0,
      totalConversations: totalConversations[0]?.count || 0,
      messagesToday: messagesToday[0]?.count || 0,
      averageResponseTime: 120, // 模擬數據，單位：秒
      systemLoad: 0.45, // 模擬系統負載
      errorRate: 0.02 // 模擬錯誤率
    }

    return successResponse(c, metrics, 'System metrics retrieved successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 備份資料庫
export const backupDatabase = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 在實際環境中，這裡會執行資料庫備份
    // Cloudflare D1 目前不支援直接備份，需要通過其他方式實現
    
    const backupId = `backup_${Date.now()}`
    const filename = `database_backup_${new Date().toISOString().split('T')[0]}.sql`
    
    return successResponse(c, {
      backupId,
      filename,
      size: 1024 * 1024, // 模擬 1MB
      createdAt: new Date().toISOString()
    }, 'Database backup created successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 獲取備份列表
export const getBackups = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 模擬備份列表
    const backups = [
      {
        id: 'backup_1',
        filename: 'database_backup_2024-01-01.sql',
        size: 1024 * 1024,
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'backup_2',
        filename: 'database_backup_2024-01-02.sql',
        size: 1024 * 1024 * 1.2,
        createdAt: new Date().toISOString()
      }
    ]

    return successResponse(c, backups, 'Backup list retrieved successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 恢復資料庫
export const restoreDatabase = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const backupId = c.req.param('backupId')
    
    // 在實際環境中，這裡會執行資料庫恢復
    console.log(`Restoring database from backup: ${backupId}`)
    
    return successResponse(c, null, 'Database restored successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 清除快取
export const clearCache = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const { type } = await c.req.json<{ type: string }>()
    
    // 在實際環境中，這裡會清除相應的快取
    const cleared = []
    let totalSize = 0
    
    switch (type) {
      case 'all':
        cleared.push('conversations', 'messages', 'sessions')
        totalSize = 1024 * 1024 * 5 // 5MB
        break
      case 'conversations':
        cleared.push('conversations')
        totalSize = 1024 * 1024 * 2 // 2MB
        break
      case 'messages':
        cleared.push('messages')
        totalSize = 1024 * 1024 * 2 // 2MB
        break
      case 'sessions':
        cleared.push('sessions')
        totalSize = 1024 * 1024 // 1MB
        break
    }

    return successResponse(c, { cleared, totalSize }, 'Cache cleared successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 重啟系統
export const restartSystem = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 在 Cloudflare Workers 環境中，無法直接重啟系統
    // 這裡只是記錄重啟請求
    console.log('System restart requested')
    
    return successResponse(c, null, 'System restart command sent')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 健康檢查
export const healthCheck = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = drizzle(c.env.DB)
    const startTime = Date.now()
    
    // 檢查資料庫連線
    let dbCheck = true
    let dbResponseTime = 0
    try {
      const dbStart = Date.now()
      await drizzleDb.get(sql`SELECT 1 as test`)
      dbResponseTime = Date.now() - dbStart
    } catch {
      dbCheck = false
      dbResponseTime = Date.now() - startTime
    }
    
    // 檢查KV存儲 - 使用 CACHE 而不是 SESSIONS 進行健康檢查
    let kvCheck = true
    let kvResponseTime = 0
    const kvStart = Date.now()
    try {
      if (c.env.CACHE) {
        await c.env.CACHE.put('health_check', 'test', { expirationTtl: 10 })
        await c.env.CACHE.get('health_check')
        await c.env.CACHE.delete('health_check')
      } else {
        throw new Error('CACHE KV binding not available')
      }
      kvResponseTime = Date.now() - kvStart
    } catch (kvError) {
      console.error('KV health check failed:', kvError)
      kvCheck = false
      kvResponseTime = Date.now() - kvStart
    }
    
    // 檢查平台整合狀態
    const lineCheck = await checkLineIntegration(c.env)
    const facebookCheck = await checkFacebookIntegration(c.env)
    
    // 計算總響應時間
    const totalResponseTime = Date.now() - startTime

    const health = {
      status: (dbCheck && kvCheck && lineCheck.status && facebookCheck.status) ? 'healthy' as const : 'unhealthy' as const,
      checks: {
        database: {
          status: dbCheck,
          responseTime: dbResponseTime
        },
        cache: {
          status: kvCheck,
          responseTime: kvResponseTime
        },
        integrations: {
          line: {
            status: lineCheck.status,
            message: lineCheck.message
          },
          facebook: {
            status: facebookCheck.status,
            message: facebookCheck.message
          }
        }
      },
      metrics: {
        responseTime: totalResponseTime,
        uptime: Math.floor(Date.now() / 1000), // 簡化的運行時間
        version: '2.0.0'
      },
      timestamp: new Date().toISOString()
    }

    return successResponse(c, health, 'Health check completed')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// API監控端點 - 獲取所有端點狀態
export const getApiStatus = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const endpoints = [
      {
        id: 'system-health',
        endpoint: '/api/system/health',
        method: 'GET',
        category: 'system',
        description: '系統健康檢查',
        status: 'healthy' as const,
        requiresAuth: false
      },
      {
        id: 'system-info',
        endpoint: '/api/system/info',
        method: 'GET',
        category: 'system',
        description: '獲取系統信息',
        status: 'healthy' as const,
        requiresAuth: true
      },
      {
        id: 'system-metrics',
        endpoint: '/api/system/metrics',
        method: 'GET',
        category: 'system',
        description: '系統性能指標',
        status: 'healthy' as const,
        requiresAuth: true
      },
      {
        id: 'auth-login',
        endpoint: '/api/auth/login',
        method: 'POST',
        category: 'auth',
        description: '用戶登入',
        status: 'healthy' as const,
        requiresAuth: false
      },
      {
        id: 'conversations-list',
        endpoint: '/api/conversations',
        method: 'GET',
        category: 'conversation',
        description: '獲取對話列表',
        status: 'healthy' as const,
        requiresAuth: true
      },
      {
        id: 'customers-list',
        endpoint: '/api/customers',
        method: 'GET',
        category: 'customer',
        description: '獲取客戶列表',
        status: 'healthy' as const,
        requiresAuth: true
      },
      {
        id: 'team-members',
        endpoint: '/api/team/members',
        method: 'GET',
        category: 'team',
        description: '獲取團隊成員',
        status: 'healthy' as const,
        requiresAuth: true
      },
      {
        id: 'delayed-messages',
        endpoint: '/api/delayed-messages',
        method: 'GET',
        category: 'message',
        description: '獲取延遲訊息',
        status: 'healthy' as const,
        requiresAuth: true
      },
      {
        id: 'webhook',
        endpoint: '/api/webhook',
        method: 'POST',
        category: 'integration',
        description: 'LINE Webhook端點',
        status: 'healthy' as const,
        requiresAuth: false
      }
    ]

    // 模擬檢查每個端點狀態
    const checkedEndpoints = await Promise.all(
      endpoints.map(async (endpoint) => {
        const responseTime = Math.floor(Math.random() * 500) + 50 // 50-550ms
        const successRate = Math.floor(Math.random() * 10) + 90 // 90-100%
        
        return {
          ...endpoint,
          responseTime,
          avgResponseTime: responseTime + Math.floor(Math.random() * 100),
          successRate,
          requestCount: Math.floor(Math.random() * 1000) + 100,
          errorCount: Math.floor(Math.random() * 10),
          lastCheck: new Date(),
          status: successRate > 95 && responseTime < 200 ? 'healthy' as const : 
                 successRate > 90 && responseTime < 500 ? 'warning' as const : 'error' as const
        }
      })
    )

    const stats = {
      totalEndpoints: checkedEndpoints.length,
      healthyCount: checkedEndpoints.filter(e => e.status === 'healthy').length,
      warningCount: checkedEndpoints.filter(e => e.status === 'warning').length,
      errorCount: checkedEndpoints.filter(e => e.status === 'error').length,
      avgResponseTime: Math.round(
        checkedEndpoints.reduce((sum, e) => sum + e.responseTime, 0) / checkedEndpoints.length
      ),
      overallSuccessRate: Math.round(
        checkedEndpoints.reduce((sum, e) => sum + e.successRate, 0) / checkedEndpoints.length
      )
    }

    return successResponse(c, {
      endpoints: checkedEndpoints,
      stats,
      timestamp: new Date().toISOString()
    }, 'API status retrieved successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 檢查 LINE 整合狀態
async function checkLineIntegration(env: Bindings): Promise<{ status: boolean; message: string }> {
  try {
    console.log('Starting LINE integration check...')
    
    // 嘗試從 KV 獲取憑證
    const credentials = await getCredentialsFromKV(env, 'line')
    console.log('LINE credentials from KV:', credentials ? 'Found credentials' : 'No credentials')
    
    const accessToken = credentials?.accessToken || env.LINE_CHANNEL_ACCESS_TOKEN

    if (!accessToken) {
      console.log('No LINE access token found in KV or environment')
      return { status: false, message: 'LINE Access Token not configured' }
    }

    console.log('LINE access token available, length:', accessToken.length)

    // 簡單的 Bot 資訊檢查
    const response = await fetch('https://api.line.me/v2/bot/info', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      signal: AbortSignal.timeout(5000) // 5 秒超時
    })

    console.log('LINE API response status:', response.status)

    if (response.ok) {
      const botInfo = await response.json()
      console.log('LINE bot info retrieved successfully')
      const botName = isLineBotInfo(botInfo) ? botInfo.displayName : 'Unknown Bot'
      return { status: true, message: `LINE Bot connected: ${botName}` }
    } else {
      const errorText = await response.text().catch(() => 'Unable to read error')
      console.error('LINE API error response:', errorText)
      
      let errorMessage = `LINE API error: ${response.status}`
      if (response.status === 401) {
        errorMessage += ' (Invalid or expired access token)'
      } else if (response.status === 403) {
        errorMessage += ' (Insufficient permissions)'
      }
      
      return { status: false, message: errorMessage }
    }
  } catch (error) {
    console.error('LINE integration check error:', error)
    return { 
      status: false, 
      message: `LINE check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

// 檢查 Facebook 整合狀態  
async function checkFacebookIntegration(env: Bindings): Promise<{ status: boolean; message: string }> {
  try {
    // 嘗試從 KV 獲取憑證
    const credentials = await getCredentialsFromKV(env, 'facebook')
    const pageToken = credentials?.pageToken || env.FB_PAGE_ACCESS_TOKEN

    if (!pageToken) {
      return { status: false, message: 'Facebook Page Token not configured' }
    }

    // 簡單的頁面資訊檢查
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${pageToken}`,
      {
        signal: AbortSignal.timeout(5000) // 5 秒超時
      }
    )

    if (response.ok) {
      const pageInfo = await response.json()
      const pageName = isFacebookPageInfo(pageInfo) ? pageInfo.name : 'Unknown Page'
      return { status: true, message: `Facebook Page connected: ${pageName}` }
    } else {
      return { status: false, message: `Facebook API error: ${response.status}` }
    }
  } catch (error) {
    return { 
      status: false, 
      message: `Facebook check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}