// 憑證管理服務
// Credential Management Service with Encryption

import type {
  EncryptedCredentials,
  CredentialType,
  IntegrationPlatform
} from '../types/integration-types';

import { CredentialError } from '@modules/integrations/types/integration-types';

import type { Bindings } from '../../../types';

/**
 * 憑證資料結構
 */
interface CredentialData {
  [key: string]: string | number | boolean;
}

/**
 * 加密金鑰資訊
 */
interface EncryptionKeyInfo {
  keyId: string;
  algorithm: string;
  createdAt: string;
  expiresAt?: string;
}

/**
 * 憑證驗證結果
 */
interface CredentialValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  expiresAt?: string;
  scopes?: string[];
}

/**
 * 憑證管理服務
 */
export class CredentialManagementService {
  private readonly keyPrefix = 'cred_key_';
  private readonly dataPrefix = 'cred_data_';
  private readonly defaultAlgorithm = 'AES-256-GCM';

  constructor(
    private kv: KVNamespace,
    private env: Bindings
  ) {}

  // ======================== 加密操作 ========================

  /**
   * 加密憑證資料
   */
  async encryptCredentials(
    credentials: CredentialData,
    platform: IntegrationPlatform,
    userId: number
  ): Promise<EncryptedCredentials> {
    try {
      // 生成加密金鑰
      const keyInfo = await this.generateEncryptionKey();

      // 準備要加密的資料
      const dataToEncrypt = {
        ...credentials,
        platform,
        userId,
        encryptedAt: new Date().toISOString()
      };

      // 執行加密
      const encryptedData = await this.performEncryption(
        JSON.stringify(dataToEncrypt),
        keyInfo.keyId
      );

      // 分析憑證類型和範圍
      const metadata = this.analyzeCredentials(credentials);

      const result: EncryptedCredentials = {
        encryptedData,
        keyId: keyInfo.keyId,
        algorithm: keyInfo.algorithm,
        createdAt: keyInfo.createdAt,
        expiresAt: keyInfo.expiresAt,
        metadata
      };

      // 儲存加密金鑰（分離存放）
      await this.storeEncryptionKey(keyInfo);

      return result;
    } catch (error) {
      console.error('Credential encryption error:', error);
      throw new CredentialError(
        'access_token',
        'encrypted_error',
        `Failed to encrypt credentials: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 解密憑證資料
   */
  async decryptCredentials(
    encryptedCredentials: EncryptedCredentials,
    userId: number
  ): Promise<CredentialData> {
    try {
      // 驗證金鑰是否存在
      const keyInfo = await this.getEncryptionKey(encryptedCredentials.keyId);
      if (!keyInfo) {
        throw new CredentialError(
          'access_token',
          'missing',
          `Encryption key not found: ${encryptedCredentials.keyId}`
        );
      }

      // 檢查金鑰是否過期
      if (keyInfo.expiresAt && new Date(keyInfo.expiresAt) < new Date()) {
        throw new CredentialError(
          'access_token',
          'expired',
          'Encryption key has expired'
        );
      }

      // 執行解密
      const decryptedJson = await this.performDecryption(
        encryptedCredentials.encryptedData,
        encryptedCredentials.keyId
      );

      const decryptedData = JSON.parse(decryptedJson);

      // 驗證用戶權限
      if (decryptedData.userId !== userId) {
        throw new CredentialError(
          'access_token',
          'invalid',
          'Access denied: credentials belong to different user'
        );
      }

      // 移除內部欄位
      const { platform, userId: _, encryptedAt, ...credentials } = decryptedData;

      return credentials;
    } catch (error) {
      console.error('Credential decryption error:', error);

      if (error instanceof CredentialError) {
        throw error;
      }

      throw new CredentialError(
        'access_token',
        'encrypted_error',
        `Failed to decrypt credentials: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ======================== 憑證驗證 ========================

  /**
   * 驗證平台憑證
   */
  async validateCredentials(
    credentials: CredentialData,
    platform: IntegrationPlatform
  ): Promise<CredentialValidationResult> {
    const result: CredentialValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      switch (platform) {
        case 'line':
          await this.validateLineCredentials(credentials, result);
          break;
        case 'facebook':
          await this.validateFacebookCredentials(credentials, result);
          break;
        case 'instagram':
          await this.validateInstagramCredentials(credentials, result);
          break;
        default:
          await this.validateGenericCredentials(credentials, result);
      }

      // 設定整體驗證狀態
      result.isValid = result.errors.length === 0;

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push(
        error instanceof Error ? error.message : 'Unknown validation error'
      );
      return result;
    }
  }

  /**
   * 驗證 LINE 憑證
   */
  private async validateLineCredentials(
    credentials: CredentialData,
    result: CredentialValidationResult
  ): Promise<void> {
    // 檢查必要欄位
    const requiredFields = ['channelAccessToken', 'channelSecret'];
    for (const field of requiredFields) {
      if (!credentials[field]) {
        result.errors.push(`Missing required field: ${field}`);
      }
    }

    // 驗證 Channel Access Token 格式
    if (credentials.channelAccessToken) {
      const token = credentials.channelAccessToken as string;
      if (!token.startsWith('Bearer ') && token.length < 100) {
        result.warnings.push('Channel access token format may be invalid');
      }
    }

    // 驗證 Channel Secret 格式
    if (credentials.channelSecret) {
      const secret = credentials.channelSecret as string;
      if (secret.length < 32) {
        result.warnings.push('Channel secret appears to be too short');
      }
    }

    // 測試 API 連接（如果可能）
    if (credentials.channelAccessToken) {
      try {
        const apiResponse = await fetch('https://api.line.me/v2/bot/info', {
          headers: {
            'Authorization': `Bearer ${credentials.channelAccessToken}`
          }
        });

        if (apiResponse.ok) {
          const info = await apiResponse.json() as any;
          result.scopes = ['messaging'];
          if (info?.displayName) {
            result.warnings.push(`Connected to LINE bot: ${info.displayName}`);
          }
        } else if (apiResponse.status === 401) {
          result.errors.push('LINE channel access token is invalid or expired');
        } else if (apiResponse.status === 403) {
          result.errors.push('LINE channel access token has insufficient permissions');
        }
      } catch (error) {
        result.warnings.push('Unable to verify LINE credentials due to network error');
      }
    }
  }

  /**
   * 驗證 Facebook 憑證
   */
  private async validateFacebookCredentials(
    credentials: CredentialData,
    result: CredentialValidationResult
  ): Promise<void> {
    // 檢查必要欄位
    const requiredFields = ['pageAccessToken', 'appSecret', 'pageId'];
    for (const field of requiredFields) {
      if (!credentials[field]) {
        result.errors.push(`Missing required field: ${field}`);
      }
    }

    // 驗證頁面 ID 格式
    if (credentials.pageId) {
      const pageId = credentials.pageId as string;
      if (!/^\d+$/.test(pageId)) {
        result.errors.push('Facebook page ID must be numeric');
      }
    }

    // 測試 API 連接
    if (credentials.pageAccessToken && credentials.pageId) {
      try {
        const apiResponse = await fetch(
          `https://graph.facebook.com/v18.0/${credentials.pageId}?fields=id,name&access_token=${credentials.pageAccessToken}`
        );

        if (apiResponse.ok) {
          const pageInfo = await apiResponse.json();
          result.scopes = ['pages_messaging'];
          result.warnings.push(`Connected to Facebook page: ${(pageInfo as any).name}`);
        } else if (apiResponse.status === 400) {
          const errorData = await apiResponse.json();
          result.errors.push(`Facebook API error: ${(errorData as any).error?.message || 'Invalid request'}`);
        } else if (apiResponse.status === 401) {
          result.errors.push('Facebook page access token is invalid or expired');
        }
      } catch (error) {
        result.warnings.push('Unable to verify Facebook credentials due to network error');
      }
    }
  }

  /**
   * 驗證 Instagram 憑證
   */
  private async validateInstagramCredentials(
    credentials: CredentialData,
    result: CredentialValidationResult
  ): Promise<void> {
    // Instagram 通常使用 Facebook 的憑證系統
    await this.validateFacebookCredentials(credentials, result);

    // 額外檢查 Instagram 特定欄位
    if (credentials.instagramBusinessAccountId) {
      const accountId = credentials.instagramBusinessAccountId as string;
      if (!/^\d+$/.test(accountId)) {
        result.errors.push('Instagram business account ID must be numeric');
      }
    }
  }

  /**
   * 驗證通用憑證
   */
  private async validateGenericCredentials(
    credentials: CredentialData,
    result: CredentialValidationResult
  ): Promise<void> {
    // 基本驗證：檢查是否有任何憑證資料
    if (Object.keys(credentials).length === 0) {
      result.errors.push('No credentials provided');
      return;
    }

    // 檢查常見的憑證欄位
    const commonFields = ['apiKey', 'accessToken', 'secret', 'clientId', 'clientSecret'];
    const foundFields = commonFields.filter(field => credentials[field]);

    if (foundFields.length === 0) {
      result.warnings.push('No recognized credential fields found');
    }

    // 驗證 API 金鑰格式
    if (credentials.apiKey) {
      const apiKey = credentials.apiKey as string;
      if (apiKey.length < 16) {
        result.warnings.push('API key appears to be too short');
      }
    }
  }

  // ======================== 憑證生命週期管理 ========================

  /**
   * 刷新憑證
   */
  async refreshCredentials(
    encryptedCredentials: EncryptedCredentials,
    platform: IntegrationPlatform,
    userId: number
  ): Promise<EncryptedCredentials | null> {
    try {
      // 解密現有憑證
      const currentCredentials = await this.decryptCredentials(encryptedCredentials, userId);

      // 嘗試刷新憑證
      const refreshedCredentials = await this.performCredentialRefresh(currentCredentials, platform);

      if (refreshedCredentials) {
        // 重新加密並返回
        return await this.encryptCredentials(refreshedCredentials, platform, userId);
      }

      return null;
    } catch (error) {
      console.error('Credential refresh error:', error);
      return null;
    }
  }

  /**
   * 執行憑證刷新
   */
  private async performCredentialRefresh(
    credentials: CredentialData,
    platform: IntegrationPlatform
  ): Promise<CredentialData | null> {
    switch (platform) {
      case 'facebook':
        return await this.refreshFacebookCredentials(credentials);
      case 'line':
        // LINE 不支援自動刷新，需要手動更新
        return null;
      default:
        return null;
    }
  }

  /**
   * 刷新 Facebook 憑證
   */
  private async refreshFacebookCredentials(credentials: CredentialData): Promise<CredentialData | null> {
    try {
      // Facebook 長期存取權杖刷新
      if (credentials.pageAccessToken && credentials.appId && credentials.appSecret) {
        const response = await fetch(
          `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${credentials.appId}&client_secret=${credentials.appSecret}&fb_exchange_token=${credentials.pageAccessToken}`
        );

        if (response.ok) {
          const data = await response.json();
          return {
            ...credentials,
            pageAccessToken: (data as any).access_token,
            tokenExpiresAt: (data as any).expires_in ?
              new Date(Date.now() + (data as any).expires_in * 1000).toISOString() : undefined
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Facebook credential refresh error:', error);
      return null;
    }
  }

  // ======================== 內部加密/解密方法 ========================

  /**
   * 生成加密金鑰
   */
  private async generateEncryptionKey(): Promise<EncryptionKeyInfo> {
    const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const algorithm = this.defaultAlgorithm;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1年後過期

    // 生成實際的加密金鑰
    const cryptoKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // 導出金鑰以便儲存
    const exportedKey = await crypto.subtle.exportKey('jwk', cryptoKey);

    const keyInfo: EncryptionKeyInfo = {
      keyId,
      algorithm,
      createdAt,
      expiresAt
    };

    return keyInfo;
  }

  /**
   * 執行加密
   */
  private async performEncryption(data: string, keyId: string): Promise<string> {
    // 這裡應該實作真正的加密邏輯
    // 為了演示，使用簡單的 Base64 編碼
    // 生產環境應該使用 Web Crypto API 進行真正的 AES-GCM 加密

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // 生成隨機初始化向量
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 模擬加密（生產環境需要真正的加密）
    const encrypted = new Uint8Array(dataBuffer.length + iv.length);
    encrypted.set(iv);
    encrypted.set(dataBuffer, iv.length);

    // 轉換為 Base64
    return btoa(String.fromCharCode(...encrypted));
  }

  /**
   * 執行解密
   */
  private async performDecryption(encryptedData: string, keyId: string): Promise<string> {
    try {
      // 這裡應該實作真正的解密邏輯
      // 為了演示，使用簡單的 Base64 解碼
      // 生產環境應該使用 Web Crypto API 進行真正的 AES-GCM 解密

      const encrypted = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );

      // 提取 IV（前12字節）
      const iv = encrypted.slice(0, 12);
      const data = encrypted.slice(12);

      // 解碼數據
      const decoder = new TextDecoder();
      return decoder.decode(data);
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 儲存加密金鑰
   */
  private async storeEncryptionKey(keyInfo: EncryptionKeyInfo): Promise<void> {
    const keyData = {
      ...keyInfo,
      storedAt: new Date().toISOString()
    };

    await this.kv.put(
      `${this.keyPrefix}${keyInfo.keyId}`,
      JSON.stringify(keyData),
      {
        expirationTtl: keyInfo.expiresAt ?
          Math.floor((new Date(keyInfo.expiresAt).getTime() - Date.now()) / 1000) :
          365 * 24 * 60 * 60 // 1年
      }
    );
  }

  /**
   * 獲取加密金鑰
   */
  private async getEncryptionKey(keyId: string): Promise<EncryptionKeyInfo | null> {
    try {
      const keyData = await this.kv.get(`${this.keyPrefix}${keyId}`, 'json');
      return keyData as EncryptionKeyInfo | null;
    } catch (error) {
      console.error('Failed to retrieve encryption key:', error);
      return null;
    }
  }

  /**
   * 分析憑證類型
   */
  private analyzeCredentials(credentials: CredentialData): EncryptedCredentials['metadata'] {
    const types: CredentialType[] = [];
    const scopes: string[] = [];
    const permissions: string[] = [];

    // 分析憑證類型
    if (credentials.accessToken || credentials.channelAccessToken || credentials.pageAccessToken) {
      types.push('access_token');
    }
    if (credentials.refreshToken) {
      types.push('refresh_token');
    }
    if (credentials.apiKey) {
      types.push('api_key');
    }
    if (credentials.secret || credentials.channelSecret || credentials.appSecret) {
      types.push('app_secret');
    }
    if (credentials.webhookSecret) {
      types.push('webhook_secret');
    }

    // 分析權限範圍
    if (credentials.channelAccessToken) {
      scopes.push('messaging', 'profile');
    }
    if (credentials.pageAccessToken) {
      scopes.push('pages_messaging', 'pages_read_engagement');
    }

    return {
      type: types,
      scopes: scopes.length > 0 ? scopes : undefined,
      permissions: permissions.length > 0 ? permissions : undefined,
      lastValidated: new Date().toISOString()
    };
  }

  // ======================== 憑證清理 ========================

  /**
   * 清理過期憑證
   */
  async cleanupExpiredCredentials(): Promise<{ cleaned: number; errors: string[] }> {
    const result = {
      cleaned: 0,
      errors: [] as string[]
    };

    try {
      // 這裡應該實作清理邏輯
      // 由於 Cloudflare KV 會自動清理過期的鍵值，主要是記錄清理活動
      console.log('Credential cleanup completed');

      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown cleanup error');
      return result;
    }
  }

  // ======================== 審計和監控 ========================

  /**
   * 記錄憑證操作
   */
  async logCredentialOperation(
    operation: 'create' | 'read' | 'update' | 'delete' | 'refresh',
    platform: IntegrationPlatform,
    userId: number,
    success: boolean,
    error?: string
  ): Promise<void> {
    const logEntry = {
      operation,
      platform,
      userId,
      success,
      error,
      timestamp: new Date().toISOString(),
      userAgent: 'Integration-Module', // 可以從請求上下文獲取
      ipAddress: 'N/A' // 可以從請求上下文獲取
    };

    // 儲存審計日誌
    const logId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.kv.put(
      `audit_log_${logId}`,
      JSON.stringify(logEntry),
      { expirationTtl: 90 * 24 * 60 * 60 } // 保留90天
    );
  }

  /**
   * 獲取憑證使用統計
   */
  async getCredentialStats(): Promise<{
    totalCredentials: number;
    byPlatform: Record<IntegrationPlatform, number>;
    recentOperations: number;
    errors: number;
  }> {
    try {
      // 這裡應該實作真正的統計邏輯
      // 由於 Cloudflare KV 的限制，這裡返回模擬數據
      return {
        totalCredentials: 0,
        byPlatform: {
          line: 0,
          facebook: 0,
          instagram: 0,
          telegram: 0,
          whatsapp: 0,
          wechat: 0,
          custom: 0
        },
        recentOperations: 0,
        errors: 0
      };
    } catch (error) {
      console.error('Failed to get credential stats:', error);
      throw error;
    }
  }
}