// Webhook 驗證器 - 整合路由和安全驗證
// Webhook Validator - Integration of Routing and Security Validation

import type { Bindings } from '../../../types';
import type { IntegrationPlatform } from '@modules/integrations/types/integration-types';
import { WebhookSecurityService, type SecurityValidationResult } from '@modules/integrations/services/webhook-security-service';
import { WebhookRouterService, type WebhookRouteResult } from '@modules/integrations/services/webhook-router-service';

/**
 * 完整的 Webhook 驗證結果
 */
export interface CompleteWebhookValidationResult {
  success: boolean;
  security: SecurityValidationResult;
  routing?: WebhookRouteResult;
  errors: string[];
  warnings: string[];
}

/**
 * Webhook 驗證器
 *
 * 整合 WebhookSecurityService 和 WebhookRouterService
 * 提供完整的 Webhook 驗證和路由功能
 */
export class WebhookValidator {
  private readonly securityService: WebhookSecurityService;
  private readonly routerService: WebhookRouterService;

  constructor(
    private env: Bindings,
    private db: D1Database,
    private cache: KVNamespace
  ) {
    this.securityService = new WebhookSecurityService(env, db, cache);
    this.routerService = new WebhookRouterService(env, db, cache);
  }

  /**
   * 驗證並路由 Webhook 請求
   *
   * 執行順序:
   * 1. 基礎路由匹配
   * 2. 完整安全驗證
   * 3. 事件處理
   */
  async validateAndRoute(
    path: string,
    method: string,
    headers: Record<string, string>,
    body: any,
    sourceIP?: string
  ): Promise<CompleteWebhookValidationResult> {
    const result: CompleteWebhookValidationResult = {
      success: false,
      security: {
        valid: false,
        errors: [],
        warnings: [],
        details: {}
      },
      errors: [],
      warnings: []
    };

    try {
      // Step 1: 基礎路由驗證 (快速失敗)
      const routeResult = await this.routerService.routeWebhook(
        path,
        method,
        headers,
        body,
        sourceIP
      );

      // 如果路由失敗，直接返回
      if (!routeResult.success || routeResult.errors.length > 0) {
        result.routing = routeResult;
        result.errors.push(...routeResult.errors);
        result.warnings.push(...routeResult.warnings);
        return result;
      }

      // Step 2: 提取平台和整合 ID
      const platform = this.extractPlatform(path, headers);
      const integrationId = this.extractIntegrationId(path);

      if (!platform || !integrationId) {
        result.errors.push('Cannot determine platform or integration ID');
        return result;
      }

      // Step 3: 完整安全驗證
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body);

      const securityResult = await this.securityService.validateWebhookSecurity(
        platform,
        integrationId,
        headers,
        bodyString,
        sourceIP
      );

      result.security = securityResult;

      // 如果安全驗證失敗，返回錯誤
      if (!securityResult.valid) {
        result.errors.push(...securityResult.errors);
        result.warnings.push(...securityResult.warnings);
        return result;
      }

      // Step 4: 所有驗證通過
      result.success = true;
      result.routing = routeResult;
      result.warnings.push(...securityResult.warnings);
      result.warnings.push(...routeResult.warnings);

      return result;

    } catch (error) {
      result.errors.push(
        `Webhook validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      console.error('[WebhookValidator] Validation error:', error);
      return result;
    }
  }

  /**
   * 快速簽章驗證 (僅驗證簽章，不執行其他檢查)
   */
  async quickSignatureCheck(
    platform: IntegrationPlatform,
    integrationId: string,
    headers: Record<string, string>,
    body: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body);

      const securityResult = await this.securityService.validateWebhookSecurity(
        platform,
        integrationId,
        headers,
        bodyString
      );

      return {
        valid: securityResult.details.signatureValid || false,
        error: securityResult.errors[0]
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 檢查速率限制
   */
  async checkRateLimit(integrationId: string, platform: IntegrationPlatform): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    resetAt: string;
  }> {
    // 直接使用 securityService 的內部方法
    // 這裡簡化為返回模擬數據
    return {
      allowed: true,
      current: 0,
      limit: 100,
      resetAt: new Date().toISOString()
    };
  }

  /**
   * 獲取安全統計
   */
  async getSecurityStats(integrationId?: string, hours: number = 24) {
    return this.securityService.getSecurityStats(integrationId, hours);
  }

  /**
   * 清除速率限制計數器 (管理員功能)
   */
  async clearRateLimit(integrationId: string): Promise<boolean> {
    return this.securityService.clearRateLimit(integrationId);
  }

  // ======================== 私有輔助方法 ========================

  /**
   * 從路徑提取平台類型
   */
  private extractPlatform(path: string, headers: Record<string, string>): IntegrationPlatform | null {
    // 從路徑提取: /api/integrations/webhooks/{platform}/{id}
    const pathMatch = path.match(/\/webhooks\/([^\/]+)\//);
    if (pathMatch) {
      return pathMatch[1] as IntegrationPlatform;
    }

    // 從標頭推斷
    if (headers['x-line-signature'] || headers['X-Line-Signature']) {
      return 'line';
    }

    if (headers['x-hub-signature-256'] || headers['X-Hub-Signature-256']) {
      return 'facebook'; // 或 instagram
    }

    return null;
  }

  /**
   * 從路徑提取整合 ID
   */
  private extractIntegrationId(path: string): string | null {
    // 從路徑提取: /api/integrations/webhooks/{platform}/{id}
    const pathMatch = path.match(/\/webhooks\/[^\/]+\/(.+)$/);
    return pathMatch ? pathMatch[1] : null;
  }
}

/**
 * 創建 Webhook 驗證器實例
 */
export function createWebhookValidator(
  env: Bindings,
  db: D1Database,
  cache: KVNamespace
): WebhookValidator {
  return new WebhookValidator(env, db, cache);
}