// 模組自動發現和註冊系統 - 與現有路由系統整合
import { globalModuleLoader } from './module-architecture';
import type { ModuleMetadata, ModuleLifecycle } from './module-architecture';
import type { RouteGroup } from './route-registry';
import { routeGroups } from './route-config';

// 重新導出 globalModuleLoader 以供其他模組使用
export { globalModuleLoader };

// 模組發現配置
export interface ModuleDiscoveryConfig {
  modulePaths: string[];
  autoRegister: boolean;
  enableHotReload: boolean;
  excludePatterns: string[];
  requiredExports: string[];
}

// 模組掃描結果
export interface DiscoveredModule {
  path: string;
  metadata: ModuleMetadata;
  lifecycle: ModuleLifecycle;
  exports: Record<string, any>;
  isValid: boolean;
  errors: string[];
}

// 模組註冊狀態
export interface ModuleRegistrationStatus {
  module: string;
  success: boolean;
  error?: string;
  route?: string;
  dependencies: string[];
  registeredAt: Date;
}

// 模組發現器
export class ModuleDiscovery {
  private config: ModuleDiscoveryConfig;
  private discoveredModules = new Map<string, DiscoveredModule>();
  private registrationStatus = new Map<string, ModuleRegistrationStatus>();

  constructor(config: Partial<ModuleDiscoveryConfig> = {}) {
    this.config = {
      modulePaths: ['./src/modules', './src/handlers'],
      autoRegister: true,
      enableHotReload: false,
      excludePatterns: ['*.test.ts', '*.spec.ts', 'node_modules'],
      requiredExports: ['default'],
      ...config
    };
  }

  /**
   * 掃描並發現所有模組
   */
  async discoverModules(): Promise<DiscoveredModule[]> {
    const modules: DiscoveredModule[] = [];

    for (const modulePath of this.config.modulePaths) {
      const foundModules = await this.scanPath(modulePath);
      modules.push(...foundModules);
    }

    // 更新發現的模組快取
    this.discoveredModules.clear();
    for (const module of modules) {
      this.discoveredModules.set(module.metadata.name, module);
    }

    return modules;
  }

  /**
   * 自動註冊發現的模組
   */
  async autoRegisterModules(): Promise<ModuleRegistrationStatus[]> {
    const modules = await this.discoverModules();
    const statuses: ModuleRegistrationStatus[] = [];

    for (const module of modules) {
      if (!module.isValid) {
        continue;
      }

      try {
        const status = await this.registerModule(module);
        statuses.push(status);
      } catch (error) {
        const status: ModuleRegistrationStatus = {
          module: module.metadata.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          dependencies: module.metadata.dependencies,
          registeredAt: new Date()
        };
        statuses.push(status);
        this.registrationStatus.set(module.metadata.name, status);
      }
    }

    return statuses;
  }

  /**
   * 註冊單個模組
   */
  async registerModule(discoveredModule: DiscoveredModule): Promise<ModuleRegistrationStatus> {
    const { metadata, lifecycle, exports } = discoveredModule;

    try {
      // 檢查模組是否已註冊
      const existingModule = globalModuleLoader.getModule(metadata.name);
      if (existingModule) {
        throw new Error(`Module '${metadata.name}' already registered`);
      }

      // 註冊到模組加載器
      await globalModuleLoader.registerModule(metadata, lifecycle, exports);

      // 初始化並啟動模組
      await globalModuleLoader.initializeModule(metadata.name);
      await globalModuleLoader.startModule(metadata.name);

      // 整合到路由系統
      let routePath = '';
      if (exports.app && metadata.apiPrefix) {
        routePath = await this.integrateWithRouteSystem(metadata, exports.app);
      }

      const status: ModuleRegistrationStatus = {
        module: metadata.name,
        success: true,
        route: routePath,
        dependencies: metadata.dependencies,
        registeredAt: new Date()
      };

      this.registrationStatus.set(metadata.name, status);
      return status;

    } catch (error) {
      const status: ModuleRegistrationStatus = {
        module: metadata.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        dependencies: metadata.dependencies,
        registeredAt: new Date()
      };

      this.registrationStatus.set(metadata.name, status);
      throw error;
    }
  }

  /**
   * 整合到現有路由系統
   */
  private async integrateWithRouteSystem(metadata: ModuleMetadata, app: any): Promise<string> {
    // 根據模組類型選擇合適的路由組
    const targetGroup = this.findAppropriateRouteGroup(metadata);

    if (targetGroup) {
      // 動態添加模組到路由組
      const routeModule = {
        name: metadata.name,
        path: metadata.apiPrefix || `/api/${metadata.name.toLowerCase()}`,
        handler: app,
        description: metadata.description,
        version: metadata.version,
        enabled: true,
        dependencies: metadata.dependencies,
        healthCheck: '/health'
      };

      targetGroup.modules.push(routeModule);
      return routeModule.path;
    }

    return '';
  }

  /**
   * 根據模組元數據選擇合適的路由組
   */
  private findAppropriateRouteGroup(metadata: ModuleMetadata): RouteGroup | undefined {
    // 根據模組名稱和依賴關係推斷最佳路由組
    const moduleName = metadata.name.toLowerCase();

    if (moduleName.includes('auth') || moduleName.includes('security')) {
      return routeGroups.find(g => g.name === 'Core API');
    }

    if (moduleName.includes('conversation') || moduleName.includes('message')) {
      return routeGroups.find(g => g.name === 'Business Logic');
    }

    if (moduleName.includes('team') || moduleName.includes('agent')) {
      return routeGroups.find(g => g.name === 'Team Collaboration');
    }

    if (moduleName.includes('notification') || moduleName.includes('integration')) {
      return routeGroups.find(g => g.name === 'Platform Integration');
    }

    if (moduleName.includes('monitor') || moduleName.includes('analytics')) {
      return routeGroups.find(g => g.name === 'Monitoring & Analytics');
    }

    // 預設使用 Platform Integration 組
    return routeGroups.find(g => g.name === 'Platform Integration');
  }

  /**
   * 掃描指定路徑的模組
   */
  private async scanPath(_basePath: string): Promise<DiscoveredModule[]> {
    const modules: DiscoveredModule[] = [];

    // 由於我們在 Cloudflare Workers 環境中，這裡使用模擬的文件掃描
    // 在實際部署中，這將需要預先編譯的模組清單
    const knownModules = this.getKnownModules();

    for (const moduleInfo of knownModules) {
      try {
        const discovered = await this.validateModule(moduleInfo);
        if (discovered) {
          modules.push(discovered);
        }
      } catch (error) {
        console.warn(`Failed to load module from ${moduleInfo.path}:`, error);
      }
    }

    return modules;
  }

  /**
   * 獲取已知模組清單（在實際環境中，這將從建構時生成的清單讀取）
   */
  private getKnownModules(): Array<{ path: string; name: string }> {
    return [
      { path: './modules/teams/handlers/index', name: 'teams' },
      { path: './modules/conversations/handlers/conversation-main', name: 'conversations' },
      { path: './modules/system/handlers/system-main', name: 'system' },
      { path: './modules/customer/handlers/customer-main', name: 'customers' },
      { path: './modules/notifications/handlers/notification-router', name: 'notifications' },
      { path: './modules/messaging/handlers/messaging/index', name: 'messaging' },
      { path: './modules/delayed-message/handlers/delayed-message-buffer', name: 'delayed-messages' }
    ];
  }

  /**
   * 驗證模組結構
   */
  private async validateModule(moduleInfo: { path: string; name: string }): Promise<DiscoveredModule | undefined> {
    const errors: string[] = [];

    try {
      // 模擬模組驗證 - 在實際環境中會動態導入模組
      const mockMetadata: ModuleMetadata = {
        name: moduleInfo.name,
        version: '1.0.0',
        description: `Auto-discovered ${moduleInfo.name} module`,
        dependencies: [],
        exports: ['default']
      };

      const mockLifecycle: ModuleLifecycle = {
        async onInitialize() {},
        async onStart() {},
        async onStop() {},
        async onHealthCheck() {
          return { status: 'healthy', message: 'Module is healthy' };
        }
      };

      const mockExports: Record<string, unknown> = {
        default: null // 實際的處理器會在這裡
      };

      // 檢查必需的導出
      for (const requiredExport of this.config.requiredExports) {
        if (!(requiredExport in mockExports)) {
          errors.push(`Missing required export: ${requiredExport}`);
        }
      }

      return {
        path: moduleInfo.path,
        metadata: mockMetadata,
        lifecycle: mockLifecycle,
        exports: mockExports,
        isValid: errors.length === 0,
        errors
      };

    } catch (error) {
      errors.push(`Failed to load module: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        path: moduleInfo.path,
        metadata: {
          name: moduleInfo.name,
          version: '0.0.0',
          description: 'Invalid module',
          dependencies: [],
          exports: []
        },
        lifecycle: {},
        exports: {},
        isValid: false,
        errors
      };
    }
  }

  /**
   * 獲取註冊狀態統計
   */
  getRegistrationStats(): {
    total: number;
    successful: number;
    failed: number;
    byStatus: Record<string, number>;
  } {
    const statuses = Array.from(this.registrationStatus.values());

    return {
      total: statuses.length,
      successful: statuses.filter(s => s.success).length,
      failed: statuses.filter(s => !s.success).length,
      byStatus: {
        registered: statuses.filter(s => s.success).length,
        failed: statuses.filter(s => !s.success).length
      }
    };
  }

  /**
   * 獲取所有註冊狀態
   */
  getAllRegistrationStatus(): ModuleRegistrationStatus[] {
    return Array.from(this.registrationStatus.values());
  }

  /**
   * 卸載模組
   */
  async unregisterModule(moduleName: string): Promise<void> {
    try {
      await globalModuleLoader.stopModule(moduleName);
      this.registrationStatus.delete(moduleName);
      this.discoveredModules.delete(moduleName);
    } catch (error) {
      throw new Error(`Failed to unregister module '${moduleName}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 重新載入模組（熱重載）
   */
  async reloadModule(moduleName: string): Promise<ModuleRegistrationStatus> {
    await this.unregisterModule(moduleName);

    const discovered = this.discoveredModules.get(moduleName);
    if (!discovered) {
      throw new Error(`Module '${moduleName}' not found in discovery cache`);
    }

    return await this.registerModule(discovered);
  }
}

// 模組生命週期管理器
export class ModuleLifecycleManager {
  private moduleDiscovery: ModuleDiscovery;

  constructor(config?: Partial<ModuleDiscoveryConfig>) {
    this.moduleDiscovery = new ModuleDiscovery(config);
  }

  /**
   * 初始化整個模組系統
   */
  async initializeModuleSystem(): Promise<{
    discovered: number;
    registered: number;
    failed: number;
    errors: string[];
  }> {
    console.log('🚀 Initializing modular architecture system...');

    try {
      // 發現模組
      const discovered = await this.moduleDiscovery.discoverModules();
      console.log(`📦 Discovered ${discovered.length} modules`);

      // 自動註冊模組
      const registrationResults = await this.moduleDiscovery.autoRegisterModules();

      const successful = registrationResults.filter(r => r.success);
      const failed = registrationResults.filter(r => !r.success);

      console.log(`✅ Successfully registered ${successful.length} modules`);
      if (failed.length > 0) {
        console.log(`❌ Failed to register ${failed.length} modules`);
        failed.forEach(f => console.log(`   - ${f.module}: ${f.error}`));
      }

      return {
        discovered: discovered.length,
        registered: successful.length,
        failed: failed.length,
        errors: failed.map(f => `${f.module}: ${f.error}`)
      };

    } catch (error) {
      console.error('❌ Failed to initialize module system:', error);
      throw error;
    }
  }

  /**
   * 獲取系統狀態
   */
  getSystemStatus(): {
    moduleLoader: any;
    discovery: any;
    routes: any;
  } {
    return {
      moduleLoader: globalModuleLoader.getModuleStats(),
      discovery: this.moduleDiscovery.getRegistrationStats(),
      routes: {
        groups: routeGroups.length,
        totalModules: routeGroups.reduce((sum, group) => sum + group.modules.length, 0)
      }
    };
  }

  /**
   * 健康檢查
   */
  async performSystemHealthCheck(): Promise<{
    overall: 'healthy' | 'warning' | 'critical';
    modules: Array<{ name: string; status: string; health: any }>;
    summary: any;
  }> {
    const modules = globalModuleLoader.getAllModules();
    const moduleHealths: Array<{ name: string; status: string; health: any }> = [];

    let healthyCount = 0;
    let warningCount = 0;
    let criticalCount = 0;

    for (const [name, instance] of modules) {
      const health = instance.health;
      moduleHealths.push({
        name,
        status: instance.state,
        health
      });

      switch (health.status) {
        case 'healthy': healthyCount++; break;
        case 'warning': warningCount++; break;
        case 'critical': criticalCount++; break;
      }
    }

    const overall = criticalCount > 0 ? 'critical' :
                   warningCount > 0 ? 'warning' : 'healthy';

    return {
      overall,
      modules: moduleHealths,
      summary: {
        total: modules.size,
        healthy: healthyCount,
        warning: warningCount,
        critical: criticalCount
      }
    };
  }
}

// 全域模組生命週期管理器
export const globalModuleLifecycleManager = new ModuleLifecycleManager({
  autoRegister: true,
  enableHotReload: false
});