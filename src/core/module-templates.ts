// 模組模板和標準系統 - 標準化新模組開發
import type { ModuleMetadata, ModuleLifecycle, ModuleContext, HealthStatus } from './module-architecture';
import type { Hono } from 'hono';
import type { Bindings } from '../types';

// 模組類型枚舉
export enum ModuleType {
  API_HANDLER = 'api-handler',
  SERVICE = 'service',
  INTEGRATION = 'integration',
  MIDDLEWARE = 'middleware',
  UTILITY = 'utility',
  DATABASE = 'database',
  NOTIFICATION = 'notification',
  ANALYTICS = 'analytics',
  SECURITY = 'security'
}

// 模組模板接口
export interface ModuleTemplate {
  type: ModuleType;
  name: string;
  description: string;
  files: ModuleFileTemplate[];
  dependencies: string[];
  testFiles: ModuleFileTemplate[];
  documentation: string;
}

// 模組檔案模板
export interface ModuleFileTemplate {
  path: string;
  content: string;
  type: 'typescript' | 'javascript' | 'json' | 'markdown';
}

// 標準模組基礎類別
export abstract class BaseModule implements ModuleLifecycle {
  protected abstract metadata: ModuleMetadata;
  protected context?: ModuleContext;

  async onInitialize(context: ModuleContext): Promise<void> {
    this.context = context;
    context.logger.info(`Initializing ${this.metadata.name} module`);
    await this.initializeModule();
  }

  async onStart(context: ModuleContext): Promise<void> {
    context.logger.info(`Starting ${this.metadata.name} module`);
    await this.startModule();
  }

  async onStop(context: ModuleContext): Promise<void> {
    context.logger.info(`Stopping ${this.metadata.name} module`);
    await this.stopModule();
  }

  async onDestroy(context: ModuleContext): Promise<void> {
    context.logger.info(`Destroying ${this.metadata.name} module`);
    await this.destroyModule();
  }

  async onHealthCheck(context: ModuleContext): Promise<HealthStatus> {
    try {
      const isHealthy = await this.performHealthCheck();
      return {
        status: isHealthy ? 'healthy' : 'warning',
        message: isHealthy ? 'Module is healthy' : 'Module has issues',
        details: await this.getHealthDetails()
      };
    } catch (error) {
      return {
        status: 'critical',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : error }
      };
    }
  }

  // 抽象方法 - 子類必須實現
  protected abstract initializeModule(): Promise<void>;
  protected abstract startModule(): Promise<void>;
  protected abstract stopModule(): Promise<void>;
  protected abstract destroyModule(): Promise<void>;
  protected abstract performHealthCheck(): Promise<boolean>;
  protected abstract getHealthDetails(): Promise<Record<string, any>>;

  // 便利方法
  protected getService<T>(name: string): T | undefined {
    return this.context?.services.get<T>(name);
  }

  protected getDependency<T>(name: string): T | undefined {
    return this.context?.dependencies.get(name) as T | undefined;
  }

  protected getConfig<T>(key: string, defaultValue?: T): T {
    return this.context?.config[key] ?? defaultValue;
  }
}

// API處理器模組基礎類別
export abstract class BaseApiModule extends BaseModule {
  protected app?: Hono<{ Bindings: Bindings }>;

  protected async initializeModule(): Promise<void> {
    const { Hono } = await import('hono');
    this.app = new Hono<{ Bindings: Bindings }>();
    await this.setupRoutes();
    await this.setupMiddleware();
  }

  protected async startModule(): Promise<void> {
    // API模組通常不需要特殊的啟動邏輯
  }

  protected async stopModule(): Promise<void> {
    // 清理連接和資源
  }

  protected async destroyModule(): Promise<void> {
    this.app = undefined;
  }

  protected async performHealthCheck(): Promise<boolean> {
    return this.app !== undefined;
  }

  protected async getHealthDetails(): Promise<Record<string, any>> {
    return {
      hasApp: this.app !== undefined,
      routes: this.getRouteInfo()
    };
  }

  // 抽象方法
  protected abstract setupRoutes(): Promise<void>;
  protected abstract setupMiddleware(): Promise<void>;

  // 便利方法
  protected getRouteInfo(): string[] {
    // 這裡可以添加路由信息提取邏輯
    return [];
  }

  // 導出 Hono 應用
  getApp(): Hono<{ Bindings: Bindings }> | undefined {
    return this.app;
  }
}

// 服務模組基礎類別
export abstract class BaseServiceModule extends BaseModule {
  protected service?: any;

  protected async initializeModule(): Promise<void> {
    this.service = await this.createService();
    await this.configureService();
  }

  protected async startModule(): Promise<void> {
    if (this.service && typeof this.service.start === 'function') {
      await this.service.start();
    }
  }

  protected async stopModule(): Promise<void> {
    if (this.service && typeof this.service.stop === 'function') {
      await this.service.stop();
    }
  }

  protected async destroyModule(): Promise<void> {
    if (this.service && typeof this.service.destroy === 'function') {
      await this.service.destroy();
    }
    this.service = undefined;
  }

  protected async performHealthCheck(): Promise<boolean> {
    if (this.service && typeof this.service.isHealthy === 'function') {
      return await this.service.isHealthy();
    }
    return this.service !== undefined;
  }

  protected async getHealthDetails(): Promise<Record<string, any>> {
    return {
      hasService: this.service !== undefined,
      serviceType: this.service?.constructor?.name || 'unknown'
    };
  }

  // 抽象方法
  protected abstract createService(): Promise<any>;
  protected abstract configureService(): Promise<void>;

  // 獲取服務實例
  getService(): any {
    return this.service;
  }
}

// 模組模板工廠
export class ModuleTemplateFactory {
  private templates = new Map<ModuleType, ModuleTemplate>();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * 獲取模組模板
   */
  getTemplate(type: ModuleType): ModuleTemplate | undefined {
    return this.templates.get(type);
  }

  /**
   * 創建新模組
   */
  createModule(type: ModuleType, name: string, options: {
    description?: string;
    dependencies?: string[];
    apiPrefix?: string;
    author?: string;
  } = {}): { files: ModuleFileTemplate[]; metadata: ModuleMetadata } {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`Template for module type '${type}' not found`);
    }

    const metadata: ModuleMetadata = {
      name,
      version: '1.0.0',
      description: options.description || `${name} module`,
      author: options.author,
      dependencies: options.dependencies || [],
      exports: [],
      apiPrefix: options.apiPrefix
    };

    const files = template.files.map(fileTemplate => ({
      ...fileTemplate,
      content: this.replacePlaceholders(fileTemplate.content, {
        MODULE_NAME: name,
        MODULE_DESCRIPTION: metadata.description,
        MODULE_VERSION: metadata.version,
        MODULE_AUTHOR: metadata.author || 'Unknown',
        API_PREFIX: options.apiPrefix || `/api/${name.toLowerCase()}`,
        DEPENDENCIES: metadata.dependencies.map(dep => `'${dep}'`).join(', ')
      })
    }));

    return { files, metadata };
  }

  /**
   * 初始化預設模板
   */
  private initializeTemplates(): void {
    // API處理器模組模板
    this.templates.set(ModuleType.API_HANDLER, {
      type: ModuleType.API_HANDLER,
      name: 'API Handler Module',
      description: 'Standard API handler module with routing and middleware',
      dependencies: [],
      files: [
        {
          path: 'src/modules/{{MODULE_NAME}}/index.ts',
          type: 'typescript',
          content: `// {{MODULE_NAME}} 模組 - {{MODULE_DESCRIPTION}}
import { BaseApiModule } from '../../core/module-templates';
import type { ModuleMetadata } from '../../core/module-architecture';
import type { Context } from 'hono';
import type { Bindings } from '../../types';

export class {{MODULE_NAME}}Module extends BaseApiModule {
  protected metadata: ModuleMetadata = {
    name: '{{MODULE_NAME}}',
    version: '{{MODULE_VERSION}}',
    description: '{{MODULE_DESCRIPTION}}',
    author: '{{MODULE_AUTHOR}}',
    dependencies: [{{DEPENDENCIES}}],
    exports: ['app'],
    apiPrefix: '{{API_PREFIX}}'
  };

  protected async setupRoutes(): Promise<void> {
    if (!this.app) return;

    // GET /{{API_PREFIX}}/health
    this.app.get('/health', async (c: Context<{ Bindings: Bindings }>) => {
      return c.json({
        status: 'healthy',
        module: '{{MODULE_NAME}}',
        timestamp: new Date().toISOString()
      });
    });

    // 在這裡添加更多路由
    // this.app.get('/', this.handleGetItems.bind(this));
    // this.app.post('/', this.handleCreateItem.bind(this));
    // this.app.put('/:id', this.handleUpdateItem.bind(this));
    // this.app.delete('/:id', this.handleDeleteItem.bind(this));
  }

  protected async setupMiddleware(): Promise<void> {
    if (!this.app) return;

    // 在這裡添加中間件
    // this.app.use('*', authMiddleware);
  }

  // 示例處理器方法
  private async handleGetItems(c: Context<{ Bindings: Bindings }>) {
    try {
      // 實現獲取項目邏輯
      return c.json({
        success: true,
        data: [],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to get items',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
}

// 導出模組實例
export const {{MODULE_NAME}}ModuleInstance = new {{MODULE_NAME}}Module();
export default {{MODULE_NAME}}ModuleInstance;`
        },
        {
          path: 'src/modules/{{MODULE_NAME}}/types.ts',
          type: 'typescript',
          content: `// {{MODULE_NAME}} 模組類型定義
export interface {{MODULE_NAME}}Item {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface {{MODULE_NAME}}CreateRequest {
  name: string;
  description?: string;
}

export interface {{MODULE_NAME}}UpdateRequest extends Partial<{{MODULE_NAME}}CreateRequest> {
  id: string;
}

export interface {{MODULE_NAME}}Response {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}`
        }
      ],
      testFiles: [
        {
          path: 'tests/unit/modules/{{MODULE_NAME}}/{{MODULE_NAME}}.test.ts',
          type: 'typescript',
          content: `// {{MODULE_NAME}} 模組測試
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { {{MODULE_NAME}}ModuleInstance } from '@modules/{{MODULE_NAME}}';
import { globalModuleLoader } from '@/core/module-architecture';

describe('{{MODULE_NAME}} Module', () => {
  beforeEach(async () => {
    // 註冊模組
    await globalModuleLoader.registerModule(
      {{MODULE_NAME}}ModuleInstance.metadata,
      {{MODULE_NAME}}ModuleInstance,
      { app: {{MODULE_NAME}}ModuleInstance.getApp() }
    );

    // 初始化模組
    await globalModuleLoader.initializeModule('{{MODULE_NAME}}');
    await globalModuleLoader.startModule('{{MODULE_NAME}}');
  });

  afterEach(async () => {
    await globalModuleLoader.stopModule('{{MODULE_NAME}}');
  });

  it('should initialize successfully', () => {
    const module = globalModuleLoader.getModule('{{MODULE_NAME}}');
    expect(module).toBeDefined();
    expect(module?.state).toBe('running');
  });

  it('should pass health check', async () => {
    const module = globalModuleLoader.getModule('{{MODULE_NAME}}');
    expect(module).toBeDefined();

    if (module?.lifecycle.onHealthCheck) {
      const health = await module.lifecycle.onHealthCheck(module.context);
      expect(health.status).toBe('healthy');
    }
  });

  it('should handle API requests', async () => {
    const module = globalModuleLoader.getModule('{{MODULE_NAME}}');
    const app = module?.exports.app;

    expect(app).toBeDefined();
    // 在這裡添加 API 測試
  });
});`
        }
      ],
      documentation: `# {{MODULE_NAME}} Module

{{MODULE_DESCRIPTION}}

## API Endpoints

### Health Check
\`GET {{API_PREFIX}}/health\`

Returns the health status of the module.

## Configuration

Add configuration options here.

## Dependencies

${this.templates.get(ModuleType.API_HANDLER)?.dependencies.join(', ') || 'None'}

## Usage Example

\`\`\`typescript
import { {{MODULE_NAME}}ModuleInstance } from './modules/{{MODULE_NAME}}';
\`\`\`
`
    });

    // 服務模組模板
    this.templates.set(ModuleType.SERVICE, {
      type: ModuleType.SERVICE,
      name: 'Service Module',
      description: 'Standard service module with lifecycle management',
      dependencies: [],
      files: [
        {
          path: 'src/modules/{{MODULE_NAME}}/{{MODULE_NAME}}-service.ts',
          type: 'typescript',
          content: `// {{MODULE_NAME}} 服務模組
import { BaseServiceModule } from '../../core/module-templates';
import type { ModuleMetadata } from '../../core/module-architecture';

export class {{MODULE_NAME}}Service {
  private isRunning = false;

  async start(): Promise<void> {
    this.isRunning = true;
    console.log('{{MODULE_NAME}} service started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('{{MODULE_NAME}} service stopped');
  }

  async destroy(): Promise<void> {
    this.isRunning = false;
    console.log('{{MODULE_NAME}} service destroyed');
  }

  async isHealthy(): Promise<boolean> {
    return this.isRunning;
  }

  // 在這裡添加服務方法
}

export class {{MODULE_NAME}}ServiceModule extends BaseServiceModule {
  protected metadata: ModuleMetadata = {
    name: '{{MODULE_NAME}}Service',
    version: '{{MODULE_VERSION}}',
    description: '{{MODULE_DESCRIPTION}}',
    author: '{{MODULE_AUTHOR}}',
    dependencies: [{{DEPENDENCIES}}],
    exports: ['service']
  };

  protected async createService(): Promise<{{MODULE_NAME}}Service> {
    return new {{MODULE_NAME}}Service();
  }

  protected async configureService(): Promise<void> {
    // 配置服務
  }
}

export const {{MODULE_NAME}}ServiceModuleInstance = new {{MODULE_NAME}}ServiceModule();
export default {{MODULE_NAME}}ServiceModuleInstance;`
        }
      ],
      testFiles: [],
      documentation: ''
    });
  }

  /**
   * 替換模板中的佔位符
   */
  private replacePlaceholders(content: string, placeholders: Record<string, string>): string {
    let result = content;
    for (const [key, value] of Object.entries(placeholders)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }
}

// 全域模組模板工廠
export const moduleTemplateFactory = new ModuleTemplateFactory();