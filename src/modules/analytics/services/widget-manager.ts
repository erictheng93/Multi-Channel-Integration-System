// Widget Manager Service - 小工具管理服務
// 管理儀表板小工具的創建、配置和生命週期

import type { D1Database } from '@cloudflare/workers-types';
import type { Bindings } from '@/types';
import type {
  DashboardWidget,
  WidgetTemplate,
  WidgetValidation,
  WidgetPosition
} from '../types/dashboard-types';
import { AnalyticsError, DataProcessingError } from '@modules/analytics/types/analytics-types';
import { nowISO, nowMs } from '@/utils/timestamp'

/**
 * 小工具類型定義和驗證規則
 */
interface WidgetTypeDefinition {
  type: string;
  name: string;
  description: string;
  requiredFields: string[];
  optionalFields: string[];
  defaultConfig: Partial<DashboardWidget>;
  validation: WidgetValidation;
}

/**
 * 小工具管理器配置
 */
interface WidgetManagerOptions {
  enableValidation?: boolean;
  allowCustomWidgets?: boolean;
  maxWidgetSize?: { width: number; height: number };
  enableTemplates?: boolean;
}

const DEFAULT_OPTIONS: WidgetManagerOptions = {
  enableValidation: true,
  allowCustomWidgets: true,
  maxWidgetSize: { width: 12, height: 8 },
  enableTemplates: true
};

/**
 * 小工具管理器類
 */
export class WidgetManager {
  private widgetTypes = new Map<string, WidgetTypeDefinition>();
  private options: WidgetManagerOptions;

  constructor(
    _db: D1Database,
    private kv: Bindings['KV'],
    options: WidgetManagerOptions = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.initializeWidgetTypes();
  }

  /**
   * 初始化內建小工具類型
   */
  private initializeWidgetTypes(): void {
    // 指標小工具
    this.widgetTypes.set('metric', {
      type: 'metric',
      name: '指標卡片',
      description: '顯示單個數值指標',
      requiredFields: ['dataSource', 'metric'],
      optionalFields: ['unit', 'format', 'comparison'],
      defaultConfig: {
        type: 'metric',
        refreshInterval: 30000,
        realTime: true,
        position: { x: 0, y: 0, width: 3, height: 2 }
      },
      validation: {
        rules: [
          { field: 'metric', type: 'string', required: true },
          { field: 'dataSource', type: 'string', required: true, allowedValues: ['conversation', 'message', 'user', 'agent', 'system'] },
          { field: 'unit', type: 'string', required: false },
          { field: 'format', type: 'string', required: false, allowedValues: ['number', 'percentage', 'currency', 'duration'] }
        ]
      }
    });

    // 圖表小工具
    this.widgetTypes.set('chart', {
      type: 'chart',
      name: '圖表',
      description: '顯示數據圖表（線圖、柱圖、餅圖等）',
      requiredFields: ['dataSource', 'metrics', 'chartConfig'],
      optionalFields: ['filters', 'groupBy'],
      defaultConfig: {
        type: 'chart',
        refreshInterval: 60000,
        realTime: false,
        position: { x: 0, y: 0, width: 6, height: 4 },
        chartConfig: {
          type: 'line'
        }
      },
      validation: {
        rules: [
          { field: 'metrics', type: 'array', required: true },
          { field: 'dataSource', type: 'string', required: true, allowedValues: ['conversation', 'message', 'user', 'agent', 'system'] },
          { field: 'chartConfig.type', type: 'string', required: true, allowedValues: ['line', 'bar', 'pie', 'doughnut', 'radar', 'scatter'] }
        ]
      }
    });

    // 表格小工具
    this.widgetTypes.set('table', {
      type: 'table',
      name: '數據表格',
      description: '顯示結構化數據表格',
      requiredFields: ['dataSource', 'metrics'],
      optionalFields: ['tableConfig', 'filters'],
      defaultConfig: {
        type: 'table',
        refreshInterval: 300000, // 5分鐘
        realTime: false,
        position: { x: 0, y: 0, width: 8, height: 6 },
        tableConfig: {
          columns: [],
          pagination: { enabled: true, pageSize: 10, showSizeChanger: false, showQuickJumper: false, showTotal: true },
          sorting: { enabled: true, multiple: false },
          filtering: { enabled: true, mode: 'menu', operators: ['eq', 'ne', 'contains'] },
          selection: { enabled: false, mode: 'single', checkboxSelection: false, rowClick: false },
          export: { enabled: true, formats: ['csv', 'xlsx'], includeHeaders: true, includeSelection: false }
        }
      },
      validation: {
        rules: [
          { field: 'metrics', type: 'array', required: true },
          { field: 'dataSource', type: 'string', required: true, allowedValues: ['conversation', 'message', 'user', 'agent', 'system'] },
          { field: 'tableConfig.pageSize', type: 'number', required: false, min: 5, max: 100 }
        ]
      }
    });

    // 儀表小工具
    this.widgetTypes.set('gauge', {
      type: 'gauge',
      name: '儀表盤',
      description: '顯示進度或狀態的儀表盤',
      requiredFields: ['dataSource', 'metric'],
      optionalFields: ['gaugeConfig', 'unit'],
      defaultConfig: {
        type: 'gauge',
        refreshInterval: 30000,
        realTime: true,
        position: { x: 0, y: 0, width: 4, height: 4 },
        gaugeConfig: {
          min: 0,
          max: 100,
          showValue: true,
          showPointer: true,
          arcWidth: 20,
          thresholds: [
            { value: 80, color: '#22c55e' },
            { value: 60, color: '#eab308' },
            { value: 0, color: '#ef4444' }
          ]
        }
      },
      validation: {
        rules: [
          { field: 'metric', type: 'string', required: true },
          { field: 'dataSource', type: 'string', required: true, allowedValues: ['conversation', 'message', 'user', 'agent', 'system'] },
          { field: 'gaugeConfig.min', type: 'number', required: false },
          { field: 'gaugeConfig.max', type: 'number', required: false }
        ]
      }
    });

    // 進度條小工具
    this.widgetTypes.set('progress', {
      type: 'progress',
      name: '進度條',
      description: '顯示目標達成進度',
      requiredFields: ['dataSource', 'metric'],
      optionalFields: ['progressConfig', 'unit'],
      defaultConfig: {
        type: 'progress',
        refreshInterval: 60000,
        realTime: true,
        position: { x: 0, y: 0, width: 4, height: 2 },
        progressConfig: {
          target: 100,
          thresholds: [
            { value: 100, status: 'success' },
            { value: 75, status: 'warning' },
            { value: 0, status: 'danger' }
          ]
        }
      },
      validation: {
        rules: [
          { field: 'metric', type: 'string', required: true },
          { field: 'dataSource', type: 'string', required: true, allowedValues: ['conversation', 'message', 'user', 'agent', 'system'] },
          { field: 'progressConfig.target', type: 'number', required: false, min: 1 }
        ]
      }
    });

    // 狀態小工具
    this.widgetTypes.set('status', {
      type: 'status',
      name: '狀態指示器',
      description: '顯示系統或服務狀態',
      requiredFields: ['dataSource', 'metric'],
      optionalFields: ['statusConfig'],
      defaultConfig: {
        type: 'status',
        refreshInterval: 15000,
        realTime: true,
        position: { x: 0, y: 0, width: 3, height: 2 },
        statusConfig: {
          thresholds: [
            { min: 0, max: 50, status: 'danger' },
            { min: 51, max: 80, status: 'warning' },
            { min: 81, status: 'success' }
          ],
          messages: {
            success: '正常運行',
            warning: '需要關注',
            danger: '服務異常'
          }
        }
      },
      validation: {
        rules: [
          { field: 'metric', type: 'string', required: true },
          { field: 'dataSource', type: 'string', required: true, allowedValues: ['conversation', 'message', 'user', 'agent', 'system'] }
        ]
      }
    });
  }

  /**
   * 創建新的小工具
   */
  async createWidget(widgetConfig: Partial<DashboardWidget>): Promise<DashboardWidget> {
    try {
      if (!widgetConfig.type) {
        throw new AnalyticsError('Widget type is required', 'WIDGET_TYPE_REQUIRED', 400);
      }

      const widgetType = this.widgetTypes.get(widgetConfig.type);
      if (!widgetType) {
        throw new AnalyticsError(`Unknown widget type: ${widgetConfig.type}`, 'UNKNOWN_WIDGET_TYPE', 400);
      }

      // 合併默認配置
      const widget: DashboardWidget = {
        ...widgetType.defaultConfig,
        ...widgetConfig,
        id: widgetConfig.id || this.generateWidgetId(widgetConfig.type)
      } as DashboardWidget;

      // 驗證配置
      if (this.options.enableValidation) {
        await this.validateWidget(widget);
      }

      // 驗證位置和大小
      this.validateWidgetPosition(widget.position);

      return widget;

    } catch (error) {
      throw new AnalyticsError('Failed to create widget', 'WIDGET_CREATION_FAILED', 500, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 更新小工具配置
   */
  async updateWidget(widgetId: string, updates: Partial<DashboardWidget>): Promise<DashboardWidget> {
    try {
      // 首先獲取現有小工具（這裡需要從儀表板配置中獲取）
      // 簡化版本，直接應用更新
      const updatedWidget = {
        ...updates,
        id: widgetId,
        updatedAt: nowISO()
      } as DashboardWidget;

      if (this.options.enableValidation) {
        await this.validateWidget(updatedWidget);
      }

      return updatedWidget;

    } catch (error) {
      throw new AnalyticsError('Failed to update widget', 'WIDGET_UPDATE_FAILED', 500, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 驗證小工具配置
   */
  async validateWidget(widget: DashboardWidget): Promise<void> {
    const widgetType = this.widgetTypes.get(widget.type);
    if (!widgetType) {
      throw new AnalyticsError(`Unknown widget type: ${widget.type}`, 'UNKNOWN_WIDGET_TYPE', 400);
    }

    const validation = widgetType.validation;

    for (const rule of validation.rules) {
      const value = this.getNestedValue(widget, rule.field);

      // 檢查必填字段
      if (rule.required && (value === undefined || value === null)) {
        throw new DataProcessingError(`Required field missing: ${rule.field}`);
      }

      if (value !== undefined && value !== null) {
        // 類型檢查
        if (!this.validateType(value, rule.type)) {
          throw new DataProcessingError(`Invalid type for ${rule.field}: expected ${rule.type}`);
        }

        // 值域檢查
        if (rule.allowedValues && !rule.allowedValues.includes(value)) {
          throw new DataProcessingError(`Invalid value for ${rule.field}: must be one of ${rule.allowedValues.join(', ')}`);
        }

        // 數值範圍檢查
        if (rule.type === 'number') {
          if (rule.min !== undefined && value < rule.min) {
            throw new DataProcessingError(`Value for ${rule.field} must be at least ${rule.min}`);
          }
          if (rule.max !== undefined && value > rule.max) {
            throw new DataProcessingError(`Value for ${rule.field} must be at most ${rule.max}`);
          }
        }
      }
    }
  }

  /**
   * 驗證小工具位置
   */
  private validateWidgetPosition(position: WidgetPosition): void {
    if (position.width > this.options.maxWidgetSize!.width) {
      throw new DataProcessingError(`Widget width cannot exceed ${this.options.maxWidgetSize!.width}`);
    }

    if (position.height > this.options.maxWidgetSize!.height) {
      throw new DataProcessingError(`Widget height cannot exceed ${this.options.maxWidgetSize!.height}`);
    }

    if (position.width <= 0 || position.height <= 0) {
      throw new DataProcessingError('Widget width and height must be positive');
    }

    if (position.x < 0 || position.y < 0) {
      throw new DataProcessingError('Widget position coordinates must be non-negative');
    }
  }

  /**
   * 獲取可用的小工具類型
   */
  getAvailableWidgetTypes(): WidgetTypeDefinition[] {
    return Array.from(this.widgetTypes.values());
  }

  /**
   * 獲取特定類型的小工具定義
   */
  getWidgetTypeDefinition(type: string): WidgetTypeDefinition | undefined {
    return this.widgetTypes.get(type);
  }

  /**
   * 創建小工具模板
   */
  async createWidgetTemplate(template: WidgetTemplate): Promise<void> {
    try {
      const templateKey = `widget_template:${template.id}`;

      // 驗證模板配置
      if (this.options.enableValidation) {
        await this.validateWidget(template.config);
      }

      await this.kv.put(templateKey, JSON.stringify(template), {
        metadata: {
          type: 'widget_template',
          category: template.category,
          widgetType: template.config.type,
          createdAt: nowISO()
        }
      });

    } catch (error) {
      throw new AnalyticsError('Failed to create widget template', 'TEMPLATE_CREATION_FAILED', 500, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 獲取小工具模板
   */
  async getWidgetTemplates(category?: string, widgetType?: string): Promise<WidgetTemplate[]> {
    try {
      const listResult = await this.kv.list({ prefix: 'widget_template:' });
      const templates: WidgetTemplate[] = [];

      for (const key of listResult.keys) {
        const template = await this.kv.get(key.name, { type: 'json' }) as WidgetTemplate;

        const matchesCategory = !category || template.category === category;
        const matchesType = !widgetType || template.config.type === widgetType;

        if (matchesCategory && matchesType) {
          templates.push(template);
        }
      }

      return templates.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      throw new AnalyticsError('Failed to get widget templates', 'TEMPLATE_RETRIEVAL_FAILED', 500, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 從模板創建小工具
   */
  async createWidgetFromTemplate(templateId: string, customConfig?: Partial<DashboardWidget>): Promise<DashboardWidget> {
    try {
      const templateKey = `widget_template:${templateId}`;
      const template = await this.kv.get(templateKey, { type: 'json' }) as WidgetTemplate;

      if (!template) {
        throw new AnalyticsError(`Widget template not found: ${templateId}`, 'TEMPLATE_NOT_FOUND', 404);
      }

      const widget = await this.createWidget({
        ...template.config,
        ...customConfig,
        id: customConfig?.id || this.generateWidgetId(template.config.type)
      });

      return widget;

    } catch (error) {
      throw new AnalyticsError('Failed to create widget from template', 'TEMPLATE_WIDGET_CREATION_FAILED', 500, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 複製小工具
   */
  async cloneWidget(widget: DashboardWidget, newId?: string): Promise<DashboardWidget> {
    try {
      const clonedWidget: DashboardWidget = {
        ...widget,
        id: newId || this.generateWidgetId(widget.type),
        title: `${widget.title} (複製)`
      };

      // 調整位置避免重疊
      if (clonedWidget.position) {
        clonedWidget.position = {
          ...clonedWidget.position,
          x: clonedWidget.position.x + 1,
          y: clonedWidget.position.y + 1
        };
      }

      return clonedWidget;

    } catch (error) {
      throw new AnalyticsError('Failed to clone widget', 'WIDGET_CLONE_FAILED', 500, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 優化小工具佈局
   */
  optimizeLayout(widgets: DashboardWidget[], containerWidth: number = 12): DashboardWidget[] {
    // 按 Y 座標排序
    const sortedWidgets = [...widgets].sort((a, b) => {
      if (a.position.y === b.position.y) {
        return a.position.x - b.position.x;
      }
      return a.position.y - b.position.y;
    });

    const optimized: DashboardWidget[] = [];
    let currentRow = 0;
    let currentX = 0;

    for (const widget of sortedWidgets) {
      // 檢查是否需要換行
      if (currentX + widget.position.width > containerWidth) {
        currentRow += 1;
        currentX = 0;
      }

      optimized.push({
        ...widget,
        position: {
          ...widget.position,
          x: currentX,
          y: currentRow
        }
      });

      currentX += widget.position.width;
    }

    return optimized;
  }

  /**
   * 生成小工具 ID
   */
  private generateWidgetId(type: string): string {
    return `${type}_${nowMs()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 獲取嵌套對象的值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * 驗證數據類型
   */
  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }
}

export default WidgetManager;