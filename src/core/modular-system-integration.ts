// 模組化系統整合 - 統一入口和管理介面
import { globalModuleLoader, globalModuleLifecycleManager } from './module-discovery';
import { moduleTemplateFactory, ModuleType } from './module-templates';
import { routeGroups, routeConfigStats } from './route-config';
import { globalErrorHandler } from './error-handler';
import { automatedHealthMonitoring } from '../services/automated-health-monitoring';
import type { ModuleMetadata, ModuleLifecycle } from './module-architecture';
import type { Context } from 'hono';
import type { Bindings } from '../types';

// 模組化系統配置
export interface ModularSystemConfig {
  autoInitialize: boolean;
  enableHealthMonitoring: boolean;
  enableHotReload: boolean;
  enableErrorHandling: boolean;
  moduleRegistryEnabled: boolean;
  performanceMonitoring: boolean;
}

// 系統初始化結果
export interface SystemInitializationResult {
  success: boolean;
  timestamp: string;
  modules: {
    discovered: number;
    registered: number;
    failed: number;
    running: number;
  };
  routes: {
    groups: number;
    modules: number;
    endpoints: number;
  };
  health: {
    status: 'healthy' | 'warning' | 'critical';
    monitoring: boolean;
    errorHandling: boolean;
  };
  errors: string[];
  warnings: string[];
}

// 模組化系統主管理器
export class ModularSystemManager {
  private config: ModularSystemConfig;
  private isInitialized = false;
  private initializationResult?: SystemInitializationResult;

  constructor(config: Partial<ModularSystemConfig> = {}) {
    this.config = {
      autoInitialize: true,
      enableHealthMonitoring: true,
      enableHotReload: false,
      enableErrorHandling: true,
      moduleRegistryEnabled: true,
      performanceMonitoring: true,
      ...config
    };
  }

  /**
   * 初始化整個模組化系統
   */
  async initialize(): Promise<SystemInitializationResult> {
    console.log(' Initializing Modular Architecture System...');
    const startTime = nowMs();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. 初始化模組系統
      const moduleResult = await this.initializeModuleSystem();
      if (moduleResult.failed > 0) {
        warnings.push(...moduleResult.errors);
      }

      // 2. 準備健康監控（但不在初始化時啟動，避免全局作用域異步操作）
      let healthMonitoring = false;
      if (this.config.enableHealthMonitoring) {
        try {
          // 健康監控已配置，但需要在 Worker 的 fetch handler 中按需啟動
          healthMonitoring = true;
          console.log(' Health monitoring configured (will start on first request)');
        } catch (error) {
          errors.push(`Health monitoring setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 3. 設置錯誤處理
      let errorHandling = false;
      if (this.config.enableErrorHandling) {
        try {
          // 錯誤處理器已在全域可用
          errorHandling = true;
          console.log(' Error handling configured');
        } catch (error) {
          errors.push(`Error handling setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 4. 驗證路由配置
      const routeValidation = this.validateRouteConfiguration();
      if (!routeValidation.valid) {
        warnings.push(...routeValidation.issues);
      }

      // 5. 執行系統健康檢查
      const systemHealth = await this.performSystemHealthCheck();

      const initTime = Date.now() - startTime;
      console.log(` Modular system initialized in ${initTime}ms`);

      this.initializationResult = {
        success: errors.length === 0,
        timestamp: nowISO(),
        modules: {
          discovered: moduleResult.discovered,
          registered: moduleResult.registered,
          failed: moduleResult.failed,
          running: globalModuleLoader.getModuleStats().byState.running || 0
        },
        routes: {
          groups: routeGroups.length,
          modules: routeConfigStats.totalModules,
          endpoints: this.calculateTotalEndpoints()
        },
        health: {
          status: systemHealth.overall,
          monitoring: healthMonitoring,
          errorHandling
        },
        errors,
        warnings
      };

      this.isInitialized = true;
      return this.initializationResult;

    } catch (error) {
      const failureResult: SystemInitializationResult = {
        success: false,
        timestamp: nowISO(),
        modules: { discovered: 0, registered: 0, failed: 0, running: 0 },
        routes: { groups: 0, modules: 0, endpoints: 0 },
        health: { status: 'critical', monitoring: false, errorHandling: false },
        errors: [`System initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      };

      this.initializationResult = failureResult;
      throw error;
    }
  }

  /**
   * 初始化模組系統
   */
  private async initializeModuleSystem(): Promise<{
    discovered: number;
    registered: number;
    failed: number;
    errors: string[];
  }> {
    return await globalModuleLifecycleManager.initializeModuleSystem();
  }

  /**
   * 驗證路由配置
   */
  private validateRouteConfiguration(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // 檢查路由組
    if (routeGroups.length === 0) {
      issues.push('No route groups defined');
    }

    // 檢查重複的路由前綴
    const prefixes = new Set<string>();
    for (const group of routeGroups) {
      if (prefixes.has(group.prefix)) {
        issues.push(`Duplicate route prefix: ${group.prefix}`);
      }
      prefixes.add(group.prefix);

      // 檢查組內模組
      if (group.modules.length === 0) {
        issues.push(`Route group '${group.name}' has no modules`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * 計算總端點數量
   */
  private calculateTotalEndpoints(): number {
    // 這裡可以實現更精確的端點計算邏輯
    return routeConfigStats.totalModules * 5; // 估算每個模組平均5個端點
  }

  /**
   * 執行系統健康檢查
   */
  private async performSystemHealthCheck(): Promise<{
    overall: 'healthy' | 'warning' | 'critical';
    modules: Array<{ name: string; status: string; health: any }>;
    summary: any;
  }> {
    return await globalModuleLifecycleManager.performSystemHealthCheck();
  }

  /**
   * 獲取系統狀態
   */
  getSystemStatus(): {
    initialized: boolean;
    uptime: number;
    modules: any;
    routes: any;
    health: any;
    performance: any;
  } {
    const startTime = this.initializationResult?.timestamp ?
      new Date(this.initializationResult.timestamp).getTime() : nowMs();

    return {
      initialized: this.isInitialized,
      uptime: Date.now() - startTime,
      modules: globalModuleLoader.getModuleStats(),
      routes: routeConfigStats,
      health: automatedHealthMonitoring.getMonitoringStats(),
      performance: this.getPerformanceMetrics()
    };
  }

  /**
   * 獲取性能指標
   */
  private getPerformanceMetrics(): any {
    if (!this.config.performanceMonitoring) {
      return { enabled: false };
    }

    return {
      enabled: true,
      moduleCount: globalModuleLoader.getAllModules().size,
      routeGroups: routeGroups.length,
      healthCheckInterval: 30000,
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * 獲取記憶體使用情況（模擬）
   */
  private getMemoryUsage(): any {
    // 在 Cloudflare Workers 環境中，記憶體監控有限
    return {
      modules: globalModuleLoader.getAllModules().size * 0.1, // MB 估算
      routes: routeGroups.length * 0.05,
      total: 'N/A (Cloudflare Workers)'
    };
  }

  /**
   * 創建新模組
   */
  async createModule(
    type: ModuleType,
    name: string,
    options: {
      description?: string;
      dependencies?: string[];
      apiPrefix?: string;
      author?: string;
    } = {}
  ): Promise<{
    success: boolean;
    files: Array<{ path: string; content: string }>;
    metadata: ModuleMetadata;
    error?: string;
  }> {
    try {
      const { files, metadata } = moduleTemplateFactory.createModule(type, name, options);

      return {
        success: true,
        files: files.map(f => ({ path: f.path, content: f.content })),
        metadata
      };
    } catch (error) {
      return {
        success: false,
        files: [],
        metadata: {
          name,
          version: '0.0.0',
          description: 'Failed to create',
          dependencies: [],
          exports: []
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 動態註冊模組
   */
  async registerModule(
    metadata: ModuleMetadata,
    lifecycle: ModuleLifecycle,
    exports: Record<string, any> = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await globalModuleLoader.registerModule(metadata, lifecycle, exports);
      await globalModuleLoader.initializeModule(metadata.name);
      await globalModuleLoader.startModule(metadata.name);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 卸載模組
   */
  async unregisterModule(moduleName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await globalModuleLoader.stopModule(moduleName);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 獲取初始化結果
   */
  getInitializationResult(): SystemInitializationResult | undefined {
    return this.initializationResult;
  }

  /**
   * 關閉系統
   */
  async shutdown(): Promise<void> {
    console.log(' Shutting down modular system...');

    try {
      // 停止健康監控
      automatedHealthMonitoring.stop();

      // 關閉模組加載器
      await globalModuleLoader.shutdown();

      this.isInitialized = false;
      console.log(' Modular system shutdown complete');
    } catch (error) {
      console.error(' Error during shutdown:', error);
      throw error;
    }
  }
}

// 模組化系統 API 處理器
export class ModularSystemApiHandler {
  constructor(private systemManager: ModularSystemManager) {}

  /**
   * 獲取系統狀態 API
   */
  async getSystemStatus(c: Context<{ Bindings: Bindings }>) {
    try {
      const status = this.systemManager.getSystemStatus();
      return c.json({
        success: true,
        data: status,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }

  /**
   * 獲取模組清單 API
   */
  async getModules(c: Context<{ Bindings: Bindings }>) {
    try {
      const modules = Array.from(globalModuleLoader.getAllModules().entries()).map(([name, instance]) => ({
        name,
        version: instance.metadata.version,
        description: instance.metadata.description,
        state: instance.state,
        health: instance.health,
        dependencies: instance.metadata.dependencies,
        lastHealthCheck: instance.lastHealthCheck
      }));

      return c.json({
        success: true,
        data: modules,
        total: modules.length,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }

  /**
   * 創建新模組 API
   */
  async createModule(c: Context<{ Bindings: Bindings }>) {
    try {
      const { type, name, options } = await c.req.json();

      if (!type || !name) {
        return c.json({
          success: false,
          error: 'Missing required fields: type, name',
          timestamp: nowISO()
        }, 400);
      }

      const result = await this.systemManager.createModule(type, name, options);
      return c.json({
        success: result.success,
        data: result.success ? { files: result.files, metadata: result.metadata } : undefined,
        error: result.error,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }

  /**
   * 模組健康檢查 API
   */
  async getModuleHealth(c: Context<{ Bindings: Bindings }>) {
    try {
      const health = await globalModuleLifecycleManager.performSystemHealthCheck();
      return c.json({
        success: true,
        data: health,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
}

// 全域模組化系統管理器實例
export const globalModularSystemManager = new ModularSystemManager({
  autoInitialize: true,
  enableHealthMonitoring: true,
  enableErrorHandling: true,
  moduleRegistryEnabled: true,
  performanceMonitoring: true
});

// 導出 API 處理器
export const modularSystemApiHandler = new ModularSystemApiHandler(globalModularSystemManager);
// ==================== Hono Router Wrapper ====================
import { Hono } from 'hono';
import { nowISO, nowMs } from '@/utils/timestamp'

/**
 * Modular System Router - Hono wrapper for modular system API handlers
 * Provides a unified router interface for modular system management endpoints
 */
export const modularSystemRouter = new Hono<{ Bindings: Bindings }>();

// Health check endpoint
modularSystemRouter.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    module: 'modular-system',
    version: '1.0.0',
    timestamp: nowISO()
  });
});

// System status endpoint
modularSystemRouter.get('/status', (c) => modularSystemApiHandler.getSystemStatus(c));

// Modules list endpoint
modularSystemRouter.get('/modules', (c) => modularSystemApiHandler.getModules(c));

// Create module endpoint
modularSystemRouter.post('/modules', (c) => modularSystemApiHandler.createModule(c));

// Module health check endpoint
modularSystemRouter.get('/modules/health', (c) => modularSystemApiHandler.getModuleHealth(c));

// Default export for route registry
export default modularSystemRouter;
