// 憑證管理處理器
import { Context } from 'hono'
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '../types'
import { successResponse, handleApiError } from '../utils/api-response'
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '../modules/activities'

// 簡化的加密工具
const encrypt = async (text: string, key: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  
  const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32))
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  )
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  
  return btoa(String.fromCharCode(...combined))
}

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

// 憑證類型定義
interface Credential {
  platform: 'line' | 'facebook'
  type: 'channelId' | 'channelSecret' | 'accessToken' | 'appId' | 'appSecret' | 'pageId' | 'pageToken'
  value: string
}

// 獲取加密密鑰
const getEncryptionKey = (env: Bindings): string => {
  const key = env.JWT_SECRET || env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY or JWT_SECRET environment variable is not configured');
  }
  return key;
}

// 儲存憑證到 KV
export const storeCredential = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 驗證用戶權限 - 只有管理員可以管理憑證
    const payload = c.get('jwtPayload')
    if (!payload || payload.role !== 'admin') {
      return c.json({ success: false, message: '權限不足：需要管理員權限' }, HTTP_STATUS.FORBIDDEN)
    }

    const { platform, type, value } = await c.req.json<Credential>()
    
    if (!platform || !type || value === undefined) {
      return c.json({ success: false, message: '缺少必要參數' }, HTTP_STATUS.BAD_REQUEST)
    }

    // 驗證平台和類型
    const validPlatforms = ['line', 'facebook']
    const validTypes = ['channelId', 'channelSecret', 'accessToken', 'appId', 'appSecret', 'pageId', 'pageToken']
    
    if (!validPlatforms.includes(platform)) {
      return c.json({ success: false, message: '無效的平台類型' }, HTTP_STATUS.BAD_REQUEST)
    }
    
    if (!validTypes.includes(type)) {
      return c.json({ success: false, message: '無效的憑證類型' }, HTTP_STATUS.BAD_REQUEST)
    }

    // 清理輸入值
    const sanitizedValue = typeof value === 'string' ? value.trim() : ''
    const encryptionKey = getEncryptionKey(c.env)

    const key = `credentials:${platform}:${type}`
    
    // 如果值為空，則刪除憑證
    if (!sanitizedValue) {
      await c.env.CACHE?.delete(key)
    } else {
      // 加密並儲存
      const encryptedValue = await encrypt(sanitizedValue, encryptionKey)
      await c.env.CACHE?.put(key, encryptedValue)
    }

    // 記錄活動
    if (payload) {
      const activityService = new ActivityService(c.env.DB)
      await activityService.logActivity({
        userId: payload.userId.toString(),
        userName: payload.username || 'Admin',
        userRole: payload.role,
        action: sanitizedValue ? ACTIVITY_ACTIONS.SETTINGS_UPDATE : 'CREDENTIAL_DELETE',
        resourceType: RESOURCE_TYPES.SYSTEM,
        details: {
          platform,
          credentialType: type,
          action: sanitizedValue ? 'store' : 'delete'
        },
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        userAgent: c.req.header('User-Agent')
      })
    }

    const message = sanitizedValue ? '憑證已儲存' : '憑證已刪除'
    return successResponse(c, null, message)
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 獲取憑證（解密）
export const getCredential = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 驗證用戶權限 - 只有管理員可以查看憑證
    const payload = c.get('jwtPayload')
    if (!payload || payload.role !== 'admin') {
      return c.json({ success: false, message: '權限不足：需要管理員權限' }, HTTP_STATUS.FORBIDDEN)
    }

    const platform = c.req.param('platform') as 'line' | 'facebook'
    const type = c.req.param('type')
    
    if (!platform || !type) {
      return c.json({ success: false, message: '缺少必要參數' }, HTTP_STATUS.BAD_REQUEST)
    }

    // 驗證參數
    const validPlatforms = ['line', 'facebook']
    const validTypes = ['channelId', 'channelSecret', 'accessToken', 'appId', 'appSecret', 'pageId', 'pageToken']
    
    if (!validPlatforms.includes(platform) || !validTypes.includes(type)) {
      return c.json({ success: false, message: '無效的參數' }, HTTP_STATUS.BAD_REQUEST)
    }

    const key = `credentials:${platform}:${type}`
    const encryptedValue = await c.env.CACHE?.get(key)
    
    if (!encryptedValue) {
      return successResponse(c, { value: '' }, '憑證不存在')
    }

    const encryptionKey = getEncryptionKey(c.env)
    const decryptedValue = await decrypt(encryptedValue, encryptionKey)
    
    return successResponse(c, { value: decryptedValue }, '憑證獲取成功')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 獲取所有憑證（用於設定頁面）
export const getAllCredentials = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 驗證用戶權限 - 只有管理員可以查看所有憑證
    const payload = c.get('jwtPayload')
    if (!payload || payload.role !== 'admin') {
      return c.json({ success: false, message: '權限不足：需要管理員權限' }, HTTP_STATUS.FORBIDDEN)
    }

    const encryptionKey = getEncryptionKey(c.env)
    const credentials = {
      line: {
        channelId: '',
        channelSecret: '',
        accessToken: ''
      },
      facebook: {
        appId: '',
        appSecret: '',
        pageId: '',
        pageToken: ''
      }
    }

    // 獲取所有憑證
    const credentialKeys = [
      'credentials:line:channelId',
      'credentials:line:channelSecret', 
      'credentials:line:accessToken',
      'credentials:facebook:appId',
      'credentials:facebook:appSecret',
      'credentials:facebook:pageId',
      'credentials:facebook:pageToken'
    ]

    for (const key of credentialKeys) {
      const encryptedValue = await c.env.CACHE?.get(key)
      if (encryptedValue) {
        try {
          const [, platform, type] = key.split(':')
          const decryptedValue = await decrypt(encryptedValue, encryptionKey)
          
          if (platform === 'line' && type) {
            (credentials.line as any)[type] = decryptedValue
          } else if (platform === 'facebook' && type) {
            (credentials.facebook as any)[type] = decryptedValue
          }
        } catch (error) {
          console.warn(`Failed to decrypt ${key}:`, error)
        }
      }
    }

    return successResponse(c, credentials, '憑證獲取成功')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 清除平台所有憑證
export const clearPlatformCredentials = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 驗證用戶權限 - 只有管理員可以清除憑證
    const payload = c.get('jwtPayload')
    if (!payload || payload.role !== 'admin') {
      return c.json({ success: false, message: '權限不足：需要管理員權限' }, HTTP_STATUS.FORBIDDEN)
    }

    const platform = c.req.param('platform') as 'line' | 'facebook'
    
    if (!platform) {
      return c.json({ success: false, message: '缺少平台參數' }, HTTP_STATUS.BAD_REQUEST)
    }

    // 驗證平台參數
    const validPlatforms = ['line', 'facebook']
    if (!validPlatforms.includes(platform)) {
      return c.json({ success: false, message: '無效的平台參數' }, HTTP_STATUS.BAD_REQUEST)
    }

    const credentialTypes = platform === 'line' 
      ? ['channelId', 'channelSecret', 'accessToken']
      : ['appId', 'appSecret', 'pageId', 'pageToken']

    // 刪除所有相關憑證
    for (const type of credentialTypes) {
      const key = `credentials:${platform}:${type}`
      await c.env.CACHE?.delete(key)
    }

    // 記錄活動
    if (payload) {
      const activityService = new ActivityService(c.env.DB)
      await activityService.logActivity({
        userId: payload.userId.toString(),
        userName: payload.username || 'Admin',
        userRole: payload.role,
        action: 'CREDENTIALS_CLEAR',
        resourceType: RESOURCE_TYPES.SYSTEM,
        details: {
          platform,
          clearedCredentials: credentialTypes
        },
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        userAgent: c.req.header('User-Agent')
      })
    }

    return successResponse(c, null, `${platform.toUpperCase()} 憑證已全部清除`)
  } catch (error) {
    return handleApiError(error, c)
  }
}

// 備份憑證
export const backupCredentials = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 驗證用戶權限 - 只有管理員可以備份憑證
    const payload = c.get('jwtPayload')
    if (!payload || payload.role !== 'admin') {
      return c.json({ success: false, message: '權限不足：需要管理員權限' }, HTTP_STATUS.FORBIDDEN)
    }

    const backup: Record<string, string> = {}

    // 獲取所有憑證進行備份
    const credentialKeys = [
      'credentials:line:channelId',
      'credentials:line:channelSecret',
      'credentials:line:accessToken',
      'credentials:facebook:appId',
      'credentials:facebook:appSecret',
      'credentials:facebook:pageId',
      'credentials:facebook:pageToken'
    ]

    for (const key of credentialKeys) {
      const encryptedValue = await c.env.CACHE?.get(key)
      if (encryptedValue) {
        backup[key] = encryptedValue // 保持加密狀態備份
      }
    }

    const backupData = {
      timestamp: new Date().toISOString(),
      credentials: backup,
      version: '1.0'
    }

    // 記錄備份活動
    if (payload) {
      const activityService = new ActivityService(c.env.DB)
      await activityService.logActivity({
        userId: payload.userId.toString(),
        userName: payload.username || 'Admin',
        userRole: payload.role,
        action: 'CREDENTIALS_BACKUP',
        resourceType: RESOURCE_TYPES.SYSTEM,
        details: {
          backupVersion: backupData.version,
          credentialsCount: Object.keys(backup).length
        },
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        userAgent: c.req.header('User-Agent')
      })
    }

    return successResponse(c, backupData, '憑證備份完成')
  } catch (error) {
    return handleApiError(error, c)
  }
}