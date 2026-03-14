// 統一路由註冊系統 - 減少維護負擔的核心架構
import type { Hono } from 'hono';
import type { Bindings } from '../types';
import { nowISO } from '@/utils/timestamp'

// 路由模組定義
export interface RouteModule {
  name: string;
  path: string;
  handler: any;
  description: string;
  version: string;
  enabled: boolean;
  dependencies?: string[];
  healthCheck?: string;
}

// 路由組定義
export interface RouteGroup {
  name: string;
  prefix: string;
  modules: RouteModule[];
  middleware?: any[];
  description: string;
}

// 統一路由註冊器
export class RouteRegistry {
  private groups: Map<string, RouteGroup> = new Map();
  private registeredRoutes: Map<string, RouteModule> = new Map();
  private app: Hono<{ Bindings: Bindings }>;

  constructor(app: Hono<{ Bindings: Bindings }>) {
    this.app = app;
  }

  /**
   * 註冊路由組
   */
  registerGroup(group: RouteGroup): void {
    console.log(` Registering route group: ${group.name}`);

    this.groups.set(group.name, group);

    // 註冊組中的所有模組
    for (const module of group.modules) {
      if (module.enabled) {
        this.registerModule(group, module);
      } else {
        console.log(` Skipping disabled module: ${module.name}`);
      }
    }
  }

  /**
   * 註冊單一路由模組
   */
  private registerModule(group: RouteGroup, module: RouteModule): void {
    const fullPath = `${group.prefix}${module.path}`;

    try {
      // 檢查依賴
      if (module.dependencies) {
        for (const dep of module.dependencies) {
          if (!this.registeredRoutes.has(dep)) {
            console.warn(` Dependency '${dep}' not found for module '${module.name}'`);
          }
        }
      }

      // 註冊路由
      this.app.route(fullPath, module.handler);

      // 記錄註冊狀態
      this.registeredRoutes.set(module.name, module);

      console.log(` Registered: ${module.name} -> ${fullPath}`);

      // 註冊健康檢查端點（如果提供）
      if (module.healthCheck) {
        this.app.get(`${fullPath}${module.healthCheck}`, (c) => {
          return c.json({
            module: module.name,
            status: 'healthy',
            version: module.version,
            timestamp: nowISO()
          });
        });
      }

    } catch (error) {
      console.error(` Failed to register ${module.name}:`, error);
      throw new Error(`Route registration failed: ${module.name}`);
    }
  }

  /**
   * 獲取所有已註冊的路由
   */
  getRegisteredRoutes(): RouteModule[] {
    return Array.from(this.registeredRoutes.values());
  }

  /**
   * 獲取路由組
   */
  getGroups(): RouteGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * 生成路由文檔
   */
  generateRouteDocs(): any {
    const docs = {
      generated: nowISO(),
      totalGroups: this.groups.size,
      totalRoutes: this.registeredRoutes.size,
      groups: Array.from(this.groups.values()).map(group => ({
        name: group.name,
        prefix: group.prefix,
        description: group.description,
        modules: group.modules.map(module => ({
          name: module.name,
          path: `${group.prefix}${module.path}`,
          description: module.description,
          version: module.version,
          enabled: module.enabled,
          healthCheck: module.healthCheck ? `${group.prefix}${module.path}${module.healthCheck}` : null
        }))
      })),
      routes: Array.from(this.registeredRoutes.values()).map(route => ({
        name: route.name,
        description: route.description,
        version: route.version,
        dependencies: route.dependencies || []
      }))
    };

    return docs;
  }

  /**
   * 驗證路由配置
   */
  validateConfiguration(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // 檢查循環依賴
    for (const [name, module] of this.registeredRoutes.entries()) {
      if (module.dependencies) {
        const visited = new Set<string>();
        if (this.hasCircularDependency(name, module.dependencies, visited)) {
          issues.push(`Circular dependency detected for module: ${name}`);
        }
      }
    }

    // 檢查路徑衝突
    const paths = new Set<string>();
    for (const group of this.groups.values()) {
      for (const module of group.modules) {
        const fullPath = `${group.prefix}${module.path}`;
        if (paths.has(fullPath)) {
          issues.push(`Path conflict detected: ${fullPath}`);
        }
        paths.add(fullPath);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * 檢查循環依賴
   */
  private hasCircularDependency(current: string, dependencies: string[], visited: Set<string>): boolean {
    if (visited.has(current)) {
      return true;
    }

    visited.add(current);

    for (const dep of dependencies) {
      const depModule = this.registeredRoutes.get(dep);
      if (depModule && depModule.dependencies) {
        if (this.hasCircularDependency(dep, depModule.dependencies, new Set(visited))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 生成路由健康檢查端點
   */
  registerHealthEndpoint(): void {
    this.app.get('/api/system/routes', (c) => {
      const validation = this.validateConfiguration();
      const docs = this.generateRouteDocs();

      return c.json({
        success: validation.valid,
        message: validation.valid ? 'All routes healthy' : 'Route configuration issues detected',
        data: {
          validation,
          documentation: docs,
          summary: {
            totalGroups: docs.totalGroups,
            totalRoutes: docs.totalRoutes,
            enabledRoutes: Array.from(this.registeredRoutes.values()).filter(r => r.enabled).length,
            disabledRoutes: Array.from(this.registeredRoutes.values()).filter(r => !r.enabled).length
          }
        },
        timestamp: nowISO()
      });
    });

    console.log(' Route registry health endpoint registered at /api/system/routes');
  }

  /**
   * 動態啟用/禁用路由模組
   */
  toggleModule(moduleName: string, enabled: boolean): boolean {
    const module = this.registeredRoutes.get(moduleName);
    if (!module) {
      return false;
    }

    module.enabled = enabled;
    console.log(` Module ${moduleName} ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  /**
   * 獲取統計信息
   */
  getStats(): any {
    const totalModules = Array.from(this.groups.values()).reduce((sum, group) => sum + group.modules.length, 0);
    const enabledModules = Array.from(this.registeredRoutes.values()).filter(r => r.enabled).length;

    return {
      groups: this.groups.size,
      totalModules,
      registeredModules: this.registeredRoutes.size,
      enabledModules,
      disabledModules: totalModules - enabledModules,
      healthyModules: enabledModules, // 簡化：假設所有啟用的模組都健康
      registrationRate: Math.round((this.registeredRoutes.size / totalModules) * 100),
      enabledRate: Math.round((enabledModules / totalModules) * 100)
    };
  }
}

// 創建路由模組的輔助函數
export function createRouteModule(config: {
  name: string;
  path: string;
  handler: any;
  description: string;
  version?: string;
  enabled?: boolean;
  dependencies?: string[];
  healthCheck?: string;
}): RouteModule {
  return {
    version: '1.0.0',
    enabled: true,
    healthCheck: '/health',
    ...config
  };
}

// 創建路由組的輔助函數
export function createRouteGroup(config: {
  name: string;
  prefix: string;
  modules: RouteModule[];
  description: string;
  middleware?: any[];
}): RouteGroup {
  return {
    middleware: [],
    ...config
  };
}