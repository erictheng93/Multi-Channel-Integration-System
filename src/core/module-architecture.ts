// 模組化架構系統 - 支持未來擴展的核心框架
import type { Context } from 'hono';
import type { Bindings } from '../types';

// 模組元數據接口
export interface ModuleMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  dependencies: string[];
  optionalDependencies?: string[];
  exports: string[];
  config?: Record<string, any>;
  healthCheck?: string;
  apiPrefix?: string;
}

// 模組生命週期接口
export interface ModuleLifecycle {
  onInitialize?(context: ModuleContext): Promise<void> | void;
  onStart?(context: ModuleContext): Promise<void> | void;
  onStop?(context: ModuleContext): Promise<void> | void;
  onDestroy?(context: ModuleContext): Promise<void> | void;
  onHealthCheck?(context: ModuleContext): Promise<HealthStatus> | HealthStatus;
}

// 模組上下文
export interface ModuleContext {
  module: ModuleMetadata;
  dependencies: Map<string, any>;
  services: ServiceRegistry;
  config: Record<string, any>;
  logger: ModuleLogger;
  events: ModuleEventEmitter;
}

// 健康狀態
export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  details?: Record<string, any>;
}

// 模組狀態
export enum ModuleState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

// 服務註冊器
export interface ServiceRegistry {
  register<T>(name: string, service: T): void;
  get<T>(name: string): T | undefined;
  has(name: string): boolean;
  remove(name: string): boolean;
  getAll(): Map<string, any>;
}

// 模組日誌接口
export interface ModuleLogger {
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: any): void;
  debug(message: string, data?: any): void;
}

// 模組事件發送器
export interface ModuleEventEmitter {
  emit(event: string, data?: any): void;
  on(event: string, listener: (data?: any) => void): void;
  off(event: string, listener: (data?: any) => void): void;
  once(event: string, listener: (data?: any) => void): void;
}

// 模組實例接口
export interface ModuleInstance {
  metadata: ModuleMetadata;
  lifecycle: ModuleLifecycle;
  context: ModuleContext;
  state: ModuleState;
  exports: Record<string, any>;
  health: HealthStatus;
  lastHealthCheck: Date;
}

// 模組加載器配置
export interface ModuleLoaderConfig {
  moduleDirectory: string;
  autoLoad: boolean;
  enableHotReload: boolean;
  healthCheckInterval: number;
  dependencyTimeout: number;
  circularDependencyCheck: boolean;
}

// 依賴解析器
export class DependencyResolver {
  private dependencies = new Map<string, string[]>();
  private resolved = new Set<string>();
  private resolving = new Set<string>();

  /**
   * 添加模組依賴
   */
  addDependency(module: string, dependencies: string[]): void {
    this.dependencies.set(module, dependencies);
  }

  /**
   * 解析依賴順序
   */
  resolve(): string[] {
    this.resolved.clear();
    this.resolving.clear();

    const result: string[] = [];

    for (const module of this.dependencies.keys()) {
      this.resolveDependency(module, result);
    }

    return result;
  }

  /**
   * 遞歸解析單個模組依賴
   */
  private resolveDependency(module: string, result: string[]): void {
    if (this.resolved.has(module)) {
      return;
    }

    if (this.resolving.has(module)) {
      throw new Error(`Circular dependency detected: ${module}`);
    }

    this.resolving.add(module);

    const dependencies = this.dependencies.get(module) || [];
    for (const dep of dependencies) {
      this.resolveDependency(dep, result);
    }

    this.resolving.delete(module);
    this.resolved.add(module);
    result.push(module);
  }

  /**
   * 檢查循環依賴
   */
  hasCircularDependency(): boolean {
    try {
      this.resolve();
      return false;
    } catch (error) {
      return error instanceof Error && error.message.includes('Circular dependency');
    }
  }
}

// 服務註冊器實現
export class ServiceRegistryImpl implements ServiceRegistry {
  private services = new Map<string, any>();

  register<T>(name: string, service: T): void {
    if (this.services.has(name)) {
      throw new Error(`Service '${name}' already registered`);
    }
    this.services.set(name, service);
  }

  get<T>(name: string): T | undefined {
    return this.services.get(name) as T | undefined;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  remove(name: string): boolean {
    return this.services.delete(name);
  }

  getAll(): Map<string, any> {
    return new Map(this.services);
  }
}

// 模組日誌實現
export class ModuleLoggerImpl implements ModuleLogger {
  constructor(private moduleName: string) {}

  info(message: string, data?: any): void {
    console.log(`[${this.moduleName}] ℹ️ ${message}`, data || '');
  }

  warn(message: string, data?: any): void {
    console.warn(`[${this.moduleName}] ⚠️ ${message}`, data || '');
  }

  error(message: string, error?: any): void {
    console.error(`[${this.moduleName}] ❌ ${message}`, error || '');
  }

  debug(message: string, data?: any): void {
    console.debug(`[${this.moduleName}] 🐛 ${message}`, data || '');
  }
}

// 模組事件發送器實現
export class ModuleEventEmitterImpl implements ModuleEventEmitter {
  private listeners = new Map<string, Array<(data?: any) => void>>();

  emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event) || [];
    for (const listener of eventListeners) {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }
  }

  on(event: string, listener: (data?: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: (data?: any) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  once(event: string, listener: (data?: any) => void): void {
    const onceListener = (data?: any) => {
      listener(data);
      this.off(event, onceListener);
    };
    this.on(event, onceListener);
  }
}

// 模組加載器
export class ModuleLoader {
  private modules = new Map<string, ModuleInstance>();
  private dependencyResolver = new DependencyResolver();
  private config: ModuleLoaderConfig;
  private healthCheckTimer?: number;

  constructor(config: Partial<ModuleLoaderConfig> = {}) {
    this.config = {
      moduleDirectory: './modules',
      autoLoad: true,
      enableHotReload: false,
      healthCheckInterval: 30000,
      dependencyTimeout: 10000,
      circularDependencyCheck: true,
      ...config
    };

    // 健康監控將在 initialize() 完成後啟動，避免全局作用域異步操作
    // if (this.config.healthCheckInterval > 0) {
    //   this.startHealthMonitoring();
    // }
  }

  /**
   * 註冊模組
   */
  async registerModule(
    metadata: ModuleMetadata,
    lifecycle: ModuleLifecycle,
    exports: Record<string, any> = {}
  ): Promise<void> {
    const moduleName = metadata.name;

    if (this.modules.has(moduleName)) {
      throw new Error(`Module '${moduleName}' already registered`);
    }

    // 檢查循環依賴
    if (this.config.circularDependencyCheck) {
      this.dependencyResolver.addDependency(moduleName, metadata.dependencies);
      if (this.dependencyResolver.hasCircularDependency()) {
        throw new Error(`Circular dependency detected for module '${moduleName}'`);
      }
    }

    // 創建模組上下文
    const context: ModuleContext = {
      module: metadata,
      dependencies: new Map(),
      services: new ServiceRegistryImpl(),
      config: metadata.config || {},
      logger: new ModuleLoggerImpl(moduleName),
      events: new ModuleEventEmitterImpl()
    };

    // 創建模組實例
    const instance: ModuleInstance = {
      metadata,
      lifecycle,
      context,
      state: ModuleState.LOADED,
      exports,
      health: { status: 'healthy', message: 'Module loaded' },
      lastHealthCheck: new Date()
    };

    this.modules.set(moduleName, instance);
    context.logger.info(`Module '${moduleName}' registered successfully`);
  }

  /**
   * 初始化所有模組
   */
  async initializeModules(): Promise<void> {
    const loadOrder = this.dependencyResolver.resolve();

    for (const moduleName of loadOrder) {
      await this.initializeModule(moduleName);
    }

    // 所有模組初始化完成後，啟動健康監控
    if (this.config.healthCheckInterval > 0) {
      this.startHealthMonitoring();
    }
  }

  /**
   * 初始化單個模組
   */
  async initializeModule(moduleName: string): Promise<void> {
    const instance = this.modules.get(moduleName);
    if (!instance) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    if (instance.state !== ModuleState.LOADED) {
      return;
    }

    try {
      instance.state = ModuleState.INITIALIZING;
      instance.context.logger.info('Initializing module...');

      // 注入依賴
      await this.injectDependencies(instance);

      // 執行初始化
      if (instance.lifecycle.onInitialize) {
        await instance.lifecycle.onInitialize(instance.context);
      }

      instance.state = ModuleState.INITIALIZED;
      instance.context.logger.info('Module initialized successfully');

    } catch (error) {
      instance.state = ModuleState.ERROR;
      instance.context.logger.error('Module initialization failed', error);
      throw error;
    }
  }

  /**
   * 啟動所有模組
   */
  async startModules(): Promise<void> {
    const loadOrder = this.dependencyResolver.resolve();

    for (const moduleName of loadOrder) {
      await this.startModule(moduleName);
    }
  }

  /**
   * 啟動單個模組
   */
  async startModule(moduleName: string): Promise<void> {
    const instance = this.modules.get(moduleName);
    if (!instance) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    if (instance.state !== ModuleState.INITIALIZED) {
      await this.initializeModule(moduleName);
    }

    try {
      instance.state = ModuleState.STARTING;
      instance.context.logger.info('Starting module...');

      if (instance.lifecycle.onStart) {
        await instance.lifecycle.onStart(instance.context);
      }

      instance.state = ModuleState.RUNNING;
      instance.context.logger.info('Module started successfully');

    } catch (error) {
      instance.state = ModuleState.ERROR;
      instance.context.logger.error('Module start failed', error);
      throw error;
    }
  }

  /**
   * 停止模組
   */
  async stopModule(moduleName: string): Promise<void> {
    const instance = this.modules.get(moduleName);
    if (!instance) {
      return;
    }

    try {
      instance.state = ModuleState.STOPPING;
      instance.context.logger.info('Stopping module...');

      if (instance.lifecycle.onStop) {
        await instance.lifecycle.onStop(instance.context);
      }

      instance.state = ModuleState.STOPPED;
      instance.context.logger.info('Module stopped successfully');

    } catch (error) {
      instance.state = ModuleState.ERROR;
      instance.context.logger.error('Module stop failed', error);
      throw error;
    }
  }

  /**
   * 注入依賴
   */
  private async injectDependencies(instance: ModuleInstance): Promise<void> {
    for (const depName of instance.metadata.dependencies) {
      const depInstance = this.modules.get(depName);
      if (!depInstance) {
        throw new Error(`Dependency '${depName}' not found for module '${instance.metadata.name}'`);
      }

      if (depInstance.state !== ModuleState.RUNNING && depInstance.state !== ModuleState.INITIALIZED) {
        throw new Error(`Dependency '${depName}' is not ready (state: ${depInstance.state})`);
      }

      instance.context.dependencies.set(depName, depInstance.exports);
    }
  }

  /**
   * 獲取模組實例
   */
  getModule(moduleName: string): ModuleInstance | undefined {
    return this.modules.get(moduleName);
  }

  /**
   * 獲取所有模組
   */
  getAllModules(): Map<string, ModuleInstance> {
    return new Map(this.modules);
  }

  /**
   * 獲取模組狀態統計
   */
  getModuleStats(): Record<string, any> {
    const stats = {
      total: this.modules.size,
      byState: {} as Record<string, number>
    };

    for (const instance of this.modules.values()) {
      stats.byState[instance.state] = (stats.byState[instance.state] || 0) + 1;
    }

    return stats;
  }

  /**
   * 開始健康監控
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval) as any;
  }

  /**
   * 執行健康檢查
   */
  private async performHealthChecks(): Promise<void> {
    for (const [name, instance] of this.modules) {
      if (instance.state === ModuleState.RUNNING && instance.lifecycle.onHealthCheck) {
        try {
          instance.health = await instance.lifecycle.onHealthCheck(instance.context);
          instance.lastHealthCheck = new Date();
        } catch (error) {
          instance.health = {
            status: 'critical',
            message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
          instance.context.logger.error('Health check failed', error);
        }
      }
    }
  }

  /**
   * 關閉模組加載器
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    const modules = Array.from(this.modules.keys()).reverse();
    for (const moduleName of modules) {
      await this.stopModule(moduleName);
    }

    this.modules.clear();
  }
}

// 全域模組加載器實例
export const globalModuleLoader = new ModuleLoader({
  healthCheckInterval: 30000,
  circularDependencyCheck: true,
  autoLoad: true
});