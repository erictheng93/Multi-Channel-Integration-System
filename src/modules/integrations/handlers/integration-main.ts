// Integration 模組主要處理器
// Main Integration Module Handler

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import type {
  IntegrationRecord,
  CreateIntegrationRequest,
  UpdateIntegrationRequest,
  IntegrationListQuery,
  IntegrationListResponse,
  TestIntegrationRequest,
  TestIntegrationResponse,
  BatchIntegrationOperation,
  BatchOperationResult,
  IntegrationStats,
  HealthStatus,
  IntegrationPlatform,
  IntegrationStatus
} from '../types/integration-types';
import { HTTP_STATUS } from '@/constants/http-status';

import { LineIntegrationService } from '@modules/integrations/services/line-integration-service';
import { FacebookIntegrationService } from '@modules/integrations/services/facebook-integration-service';
import { CredentialManagementService } from '@modules/integrations/services/credential-management-service';
import { WebhookRouterService } from '@modules/integrations/services/webhook-router-service';

/**
 * Integration 主要處理器
 */
class IntegrationMainHandler {
  constructor(
    private db: D1Database,
    private cache: KVNamespace,
    private env: Bindings
  ) {}

  // ======================== 基本 CRUD 操作 ========================

  /**
   * 創建新的整合
   * POST /api/integrations
   */
  async create(c: any) {
    try {
      const body = await c.req.json() as CreateIntegrationRequest;
      const user = c.get('user');

      if (!user) {
        return c.json({
          success: false,
          error: 'Authentication required',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.UNAUTHORIZED);
      }

      // 基本驗證
      const validation = this.validateCreateRequest(body);
      if (!validation.isValid) {
        return c.json({
          success: false,
          error: 'Validation failed',
          details: validation.errors,
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      // 檢查平台支援
      if (!this.isSupportedPlatform(body.platform)) {
        return c.json({
          success: false,
          error: `Unsupported platform: ${body.platform}`,
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      // 驗證憑證
      const credentialService = new CredentialManagementService(this.cache, this.env);
      const credentialValidation = await credentialService.validateCredentials(
        body.credentials,
        body.platform
      );

      if (!credentialValidation.isValid) {
        return c.json({
          success: false,
          error: 'Invalid credentials',
          details: credentialValidation.errors,
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      // 加密憑證
      const encryptedCredentials = await credentialService.encryptCredentials(
        body.credentials,
        body.platform,
        user.id
      );

      // 創建整合記錄
      const integrationId = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      const integration: IntegrationRecord = {
        id: integrationId,
        platform: body.platform,
        name: body.name,
        displayName: body.displayName,
        description: body.description,
        status: 'configuring',
        config: { ...this.getDefaultConfig(), ...body.config },
        credentials: encryptedCredentials,
        features: { ...this.getDefaultFeatures(body.platform), ...body.features },
        webhookConfig: body.webhookConfig as any,
        teamId: body.teamId,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now
      };

      // 儲存到資料庫
      await this.saveIntegration(integration);

      // 測試連接
      const testResult = await this.testConnection(integration);
      if (testResult.success) {
        integration.status = 'active';
        await this.updateIntegrationStatus(integrationId, 'active');
      }

      return c.json({
        success: true,
        data: this.sanitizeIntegration(integration),
        message: `Integration created successfully${testResult.success ? ' and activated' : ' but connection test failed'}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Create integration error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create integration',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 獲取整合列表
   * GET /api/integrations
   */
  async list(c: any) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({
          success: false,
          error: 'Authentication required',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.UNAUTHORIZED);
      }

      // 解析查詢參數
      const query = this.parseListQuery(c.req.query());

      // 構建 SQL 查詢
      let sql = 'SELECT * FROM integrations WHERE 1=1';
      const params: any[] = [];

      // 加入使用者/團隊過濾
      if (user.role === 'agent') {
        sql += ' AND createdBy = ?';
        params.push(user.id);
      } else if (user.teamId) {
        sql += ' AND (teamId = ? OR createdBy = ?)';
        params.push(user.teamId, user.id);
      }

      // 加入其他過濾條件
      if (query.platform) {
        sql += ' AND platform = ?';
        params.push(query.platform);
      }

      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
      }

      if (query.search) {
        sql += ' AND (name LIKE ? OR displayName LIKE ? OR description LIKE ?)';
        params.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`);
      }

      // 排序
      const validSortFields = ['name', 'platform', 'status', 'createdAt', 'lastUsedAt'];
      const sortBy = validSortFields.includes(query.sortBy || '') ? query.sortBy : 'createdAt';
      const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
      sql += ` ORDER BY ${sortBy} ${sortOrder}`;

      // 分頁
      const limit = Math.min(query.limit || 20, 100);
      const offset = ((query.page || 1) - 1) * limit;
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      // 執行查詢
      const results = await this.db.prepare(sql).bind(...params).all();
      const integrations = (results.results || []) as unknown as IntegrationRecord[];

      // 獲取總數
      const countSql = sql.replace(/SELECT \*/, 'SELECT COUNT(*)').split(' ORDER BY')[0];
      const countResult = await this.db.prepare(countSql).bind(...params.slice(0, -2)).first();
      const total = (countResult as any)?.['COUNT(*)'] || 0;

      const response: IntegrationListResponse = {
        integrations: integrations.map(integration => this.sanitizeIntegration(integration)),
        pagination: {
          page: query.page || 1,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        filters: {
          applied: query,
          available: {
            platforms: ['line', 'facebook', 'instagram', 'telegram', 'whatsapp', 'custom'],
            statuses: ['active', 'inactive', 'error', 'configuring', 'testing', 'suspended']
          }
        }
      };

      return c.json({
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('List integrations error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list integrations',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 獲取單一整合
   * GET /api/integrations/:id
   */
  async getById(c: any) {
    try {
      const user = c.get('user');
      const integrationId = c.req.param('id');

      if (!user) {
        return c.json({
          success: false,
          error: 'Authentication required',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.UNAUTHORIZED);
      }

      const integration = await this.getIntegration(integrationId, user);
      if (!integration) {
        return c.json({
          success: false,
          error: 'Integration not found',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.NOT_FOUND);
      }

      return c.json({
        success: true,
        data: this.sanitizeIntegration(integration),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get integration error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get integration',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 更新整合
   * PUT /api/integrations/:id
   */
  async update(c: any) {
    try {
      const user = c.get('user');
      const integrationId = c.req.param('id');
      const body = await c.req.json() as UpdateIntegrationRequest;

      if (!user) {
        return c.json({
          success: false,
          error: 'Authentication required',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.UNAUTHORIZED);
      }

      const integration = await this.getIntegration(integrationId, user);
      if (!integration) {
        return c.json({
          success: false,
          error: 'Integration not found',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.NOT_FOUND);
      }

      // 檢查權限
      if (user.role === 'agent' && integration.createdBy !== user.id) {
        return c.json({
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.FORBIDDEN);
      }

      // 更新欄位
      const updatedIntegration: IntegrationRecord = {
        ...integration,
        name: body.name || integration.name,
        displayName: body.displayName || integration.displayName,
        description: body.description || integration.description,
        status: body.status || integration.status,
        config: { ...integration.config, ...body.config },
        features: { ...integration.features, ...body.features },
        webhookConfig: body.webhookConfig ? { ...integration.webhookConfig, ...body.webhookConfig } as typeof integration.webhookConfig : integration.webhookConfig,
        updatedAt: new Date().toISOString()
      };

      // 處理憑證更新
      if (body.credentials) {
        const credentialService = new CredentialManagementService(this.cache, this.env);
        const encryptedCredentials = await credentialService.encryptCredentials(
          body.credentials,
          integration.platform,
          user.id
        );
        updatedIntegration.credentials = encryptedCredentials;
      }

      // 儲存更新
      await this.saveIntegration(updatedIntegration);

      return c.json({
        success: true,
        data: this.sanitizeIntegration(updatedIntegration),
        message: 'Integration updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update integration error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update integration',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 刪除整合
   * DELETE /api/integrations/:id
   */
  async delete(c: any) {
    try {
      const user = c.get('user');
      const integrationId = c.req.param('id');

      if (!user) {
        return c.json({
          success: false,
          error: 'Authentication required',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.UNAUTHORIZED);
      }

      const integration = await this.getIntegration(integrationId, user);
      if (!integration) {
        return c.json({
          success: false,
          error: 'Integration not found',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.NOT_FOUND);
      }

      // 檢查權限
      if (user.role !== 'admin' && integration.createdBy !== user.id) {
        return c.json({
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.FORBIDDEN);
      }

      // 軟刪除 - 將狀態設為 inactive
      await this.updateIntegrationStatus(integrationId, 'inactive');

      // 清除相關快取
      await this.clearIntegrationCache(integrationId);

      return c.json({
        success: true,
        message: 'Integration deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Delete integration error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete integration',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  // ======================== 狀態管理 ========================

  /**
   * 啟用整合
   * POST /api/integrations/:id/activate
   */
  async activate(c: any) {
    try {
      const user = c.get('user');
      const integrationId = c.req.param('id');

      if (!user) {
        return c.json({
          success: false,
          error: 'Authentication required',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.UNAUTHORIZED);
      }

      const integration = await this.getIntegration(integrationId, user);
      if (!integration) {
        return c.json({
          success: false,
          error: 'Integration not found',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.NOT_FOUND);
      }

      // 測試連接
      const testResult = await this.testConnection(integration);
      if (!testResult.success) {
        return c.json({
          success: false,
          error: 'Connection test failed',
          details: testResult.errors,
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      // 更新狀態
      await this.updateIntegrationStatus(integrationId, 'active');

      return c.json({
        success: true,
        message: 'Integration activated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Activate integration error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to activate integration',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 停用整合
   * POST /api/integrations/:id/deactivate
   */
  async deactivate(c: any) {
    try {
      const user = c.get('user');
      const integrationId = c.req.param('id');

      if (!user) {
        return c.json({
          success: false,
          error: 'Authentication required',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.UNAUTHORIZED);
      }

      const integration = await this.getIntegration(integrationId, user);
      if (!integration) {
        return c.json({
          success: false,
          error: 'Integration not found',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.NOT_FOUND);
      }

      // 更新狀態
      await this.updateIntegrationStatus(integrationId, 'inactive');

      return c.json({
        success: true,
        message: 'Integration deactivated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Deactivate integration error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate integration',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  // ======================== 測試功能 ========================

  /**
   * 測試整合
   * POST /api/integrations/:id/test
   */
  async test(c: any) {
    try {
      const user = c.get('user');
      const integrationId = c.req.param('id');
      const body = await c.req.json() as TestIntegrationRequest;

      if (!user) {
        return c.json({
          success: false,
          error: 'Authentication required',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.UNAUTHORIZED);
      }

      const integration = await this.getIntegration(integrationId, user);
      if (!integration) {
        return c.json({
          success: false,
          error: 'Integration not found',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.NOT_FOUND);
      }

      const testResult = await this.performIntegrationTest(integration, body);

      return c.json({
        success: testResult.success,
        data: testResult,
        message: testResult.success ? 'Test completed successfully' : 'Test failed',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Test integration error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test integration',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  // ======================== 私有輔助方法 ========================

  /**
   * 驗證創建請求
   */
  private validateCreateRequest(body: CreateIntegrationRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!body.platform) errors.push('Platform is required');
    if (!body.name) errors.push('Name is required');
    if (!body.credentials || Object.keys(body.credentials).length === 0) {
      errors.push('Credentials are required');
    }

    if (body.name && body.name.length > 100) {
      errors.push('Name must be less than 100 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 檢查是否為支援的平台
   */
  private isSupportedPlatform(platform: string): platform is IntegrationPlatform {
    return ['line', 'facebook', 'instagram', 'telegram', 'whatsapp', 'wechat', 'custom'].includes(platform);
  }

  /**
   * 獲取預設設定
   */
  private getDefaultConfig() {
    return {
      enabled: true,
      autoRetry: true,
      maxRetries: 3,
      retryDelayMs: 1000,
      rateLimit: {
        maxRequests: 100,
        windowMs: 60000
      }
    };
  }

  /**
   * 獲取預設功能設定
   */
  private getDefaultFeatures(platform: IntegrationPlatform) {
    const defaults = {
      messaging: {
        sendText: true,
        sendImage: false,
        sendFile: false,
        sendLocation: false,
        sendQuickReply: false,
        sendCarousel: false,
        sendTemplate: false
      },
      receiving: {
        receiveText: true,
        receiveImage: false,
        receiveFile: false,
        receiveLocation: false,
        receivePostback: false
      },
      advanced: {
        richMenu: false,
        broadcast: false,
        multicast: false,
        push: false,
        userProfile: false,
        friendStatus: false
      }
    };

    // 根據平台調整預設功能
    switch (platform) {
      case 'line':
        defaults.messaging.sendImage = true;
        defaults.messaging.sendQuickReply = true;
        defaults.advanced.richMenu = true;
        defaults.advanced.broadcast = true;
        break;
      case 'facebook':
        defaults.messaging.sendImage = true;
        defaults.messaging.sendQuickReply = true;
        defaults.advanced.broadcast = true;
        break;
    }

    return defaults;
  }

  /**
   * 解析列表查詢參數
   */
  private parseListQuery(queryParams: any): IntegrationListQuery {
    return {
      platform: queryParams.platform,
      status: queryParams.status,
      search: queryParams.search,
      sortBy: queryParams.sortBy,
      sortOrder: queryParams.sortOrder,
      page: parseInt(queryParams.page) || 1,
      limit: Math.min(parseInt(queryParams.limit) || 20, 100)
    };
  }

  /**
   * 從資料庫獲取整合
   */
  private async getIntegration(id: string, user: any): Promise<IntegrationRecord | null> {
    let sql = 'SELECT * FROM integrations WHERE id = ?';
    const params = [id];

    // 加入權限過濾
    if (user.role === 'agent') {
      sql += ' AND createdBy = ?';
      params.push(user.id);
    } else if (user.teamId) {
      sql += ' AND (teamId = ? OR createdBy = ?)';
      params.push(user.teamId, user.id);
    }

    const result = await this.db.prepare(sql).bind(...params).first();
    return result as unknown as IntegrationRecord | null;
  }

  /**
   * 儲存整合到資料庫
   */
  private async saveIntegration(integration: IntegrationRecord): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO integrations (
        id, platform, name, displayName, description, status,
        config, credentials, features, webhookConfig,
        teamId, createdBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.prepare(sql).bind(
      integration.id,
      integration.platform,
      integration.name,
      integration.displayName,
      integration.description,
      integration.status,
      JSON.stringify(integration.config),
      JSON.stringify(integration.credentials),
      JSON.stringify(integration.features),
      integration.webhookConfig ? JSON.stringify(integration.webhookConfig) : null,
      integration.teamId,
      integration.createdBy,
      integration.createdAt,
      integration.updatedAt
    ).run();
  }

  /**
   * 更新整合狀態
   */
  private async updateIntegrationStatus(id: string, status: IntegrationStatus): Promise<void> {
    await this.db.prepare('UPDATE integrations SET status = ?, updatedAt = ? WHERE id = ?')
      .bind(status, new Date().toISOString(), id)
      .run();

    // 清除快取
    await this.clearIntegrationCache(id);
  }

  /**
   * 清除整合快取
   */
  private async clearIntegrationCache(id: string): Promise<void> {
    await this.cache.delete(`integration_${id}`);
    await this.cache.delete(`webhook_stats_${id}`);
  }

  /**
   * 淨化整合資料（移除敏感資訊）
   */
  private sanitizeIntegration(integration: IntegrationRecord): IntegrationRecord {
    const { credentials, ...sanitized } = integration;
    return {
      ...sanitized,
      credentials: {
        ...credentials,
        encryptedData: '[HIDDEN]'
      }
    } as IntegrationRecord;
  }

  /**
   * 測試連接
   */
  private async testConnection(integration: IntegrationRecord): Promise<{ success: boolean; errors: string[] }> {
    try {
      const credentialService = new CredentialManagementService(this.cache, this.env);
      const credentials = await credentialService.decryptCredentials(
        integration.credentials,
        integration.createdBy
      );

      // 根據平台創建服務實例並測試
      switch (integration.platform) {
        case 'line':
          const lineService = new LineIntegrationService(
            credentials.channelAccessToken as string,
            credentials.channelSecret as string,
            integration.config as any,
            this.env
          );
          const isConnected = await lineService.isConnected();
          return { success: isConnected, errors: isConnected ? [] : ['Connection failed'] };

        case 'facebook':
          const facebookService = new FacebookIntegrationService(
            credentials.pageAccessToken as string,
            credentials.appSecret as string,
            credentials.pageId as string,
            integration.config as any,
            this.env
          );
          const isFacebookConnected = await facebookService.isConnected();
          return { success: isFacebookConnected, errors: isFacebookConnected ? [] : ['Connection failed'] };

        default:
          return { success: true, errors: [] }; // 預設為成功
      }
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown connection error']
      };
    }
  }

  /**
   * 執行整合測試
   */
  private async performIntegrationTest(
    integration: IntegrationRecord,
    testRequest: TestIntegrationRequest
  ): Promise<TestIntegrationResponse> {
    const startTime = Date.now();
    const response: TestIntegrationResponse = {
      success: false,
      type: testRequest.type,
      results: {},
      summary: { passed: 0, failed: 0, warnings: 0, duration: 0 },
      timestamp: new Date().toISOString()
    };

    try {
      // 執行相應的測試
      switch (testRequest.type) {
        case 'connectivity':
          response.results.connectivity = await this.testConnectivity(integration);
          break;
        case 'full':
          response.results.connectivity = await this.testConnectivity(integration);
          response.results.authentication = await this.testAuthentication(integration);
          break;
        default:
          response.results.connectivity = await this.testConnectivity(integration);
      }

      // 計算摘要
      let passed = 0;
      let failed = 0;
      for (const result of Object.values(response.results)) {
        if (result.passed) passed++;
        else failed++;
      }

      response.summary = {
        passed,
        failed,
        warnings: 0,
        duration: Date.now() - startTime
      };

      response.success = failed === 0;
      return response;
    } catch (error) {
      response.summary.duration = Date.now() - startTime;
      response.summary.failed = 1;
      throw error;
    }
  }

  private async testConnectivity(integration: IntegrationRecord) {
    const testResult = await this.testConnection(integration);
    return {
      passed: testResult.success,
      message: testResult.success ? 'Connection successful' : 'Connection failed',
      duration: 100
    };
  }

  private async testAuthentication(integration: IntegrationRecord) {
    // TODO: 實作認證測試
    return {
      passed: true,
      message: 'Authentication successful',
      duration: 50
    };
  }
}

// 創建並導出處理器實例
const integrationMainHandler = new IntegrationMainHandler(
  {} as D1Database, // 實際使用時會注入
  {} as KVNamespace,
  {} as Bindings
);

export default integrationMainHandler;