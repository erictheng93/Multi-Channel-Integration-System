// Layout Service - 響應式佈局服務
// 提供自適應佈局計算、斷點管理和設備適配功能

import type {
  DashboardWidget,
  WidgetPosition,
  ResponsiveBreakpoints,
  LayoutConfig
} from '../types/dashboard-types';
// DataProcessingError imported for future use
// import { DataProcessingError } from '@modules/analytics/types/analytics-types';

/**
 * 設備類型枚舉
 */
export enum DeviceType {
  Mobile = 'mobile', // < 768px
  Tablet = 'tablet', // 768px - 1024px
  Desktop = 'desktop', // 1024px - 1440px
  LargeDesktop = 'large'  // > 1440px
}

/**
 * 佈局模式
 */
export enum LayoutMode {
  Grid = 'grid',
  Flex = 'flex',
  Absolute = 'absolute',
  Responsive = 'responsive'
}

/**
 * 響應式配置
 */
interface ResponsiveConfig {
  breakpoints: ResponsiveBreakpoints;
  columns: Record<DeviceType, number>;
  margins: Record<DeviceType, number>;
  gaps: Record<DeviceType, number>;
  minWidgetSizes: Record<DeviceType, { width: number; height: number }>;
}

/**
 * 佈局優化選項
 */
interface LayoutOptimizationOptions {
  allowReorder?: boolean;
  allowResize?: boolean;
  preserveAspectRatio?: boolean;
  prioritizeImportantWidgets?: boolean;
  compactMode?: boolean;
}

/**
 * 碰撞檢測結果
 */
interface CollisionResult {
  hasCollision: boolean;
  conflicts: Array<{
    widget1: string;
    widget2: string;
    overlap: { x: number; y: number; width: number; height: number };
  }>;
}

/**
 * 默認響應式配置
 */
const DEFAULT_RESPONSIVE_CONFIG: ResponsiveConfig = {
  breakpoints: {
    mobile: 768,
    tablet: 1024,
    desktop: 1440,
    large: Infinity
  },
  columns: {
    [DeviceType.Mobile]: 1,
    [DeviceType.Tablet]: 8,
    [DeviceType.Desktop]: 12,
    [DeviceType.LargeDesktop]: 16
  },
  margins: {
    [DeviceType.Mobile]: 8,
    [DeviceType.Tablet]: 12,
    [DeviceType.Desktop]: 16,
    [DeviceType.LargeDesktop]: 20
  },
  gaps: {
    [DeviceType.Mobile]: 8,
    [DeviceType.Tablet]: 12,
    [DeviceType.Desktop]: 16,
    [DeviceType.LargeDesktop]: 20
  },
  minWidgetSizes: {
    [DeviceType.Mobile]: { width: 1, height: 1 },
    [DeviceType.Tablet]: { width: 2, height: 2 },
    [DeviceType.Desktop]: { width: 2, height: 2 },
    [DeviceType.LargeDesktop]: { width: 2, height: 2 }
  }
};

/**
 * 佈局服務類
 */
export class LayoutService {
  private config: ResponsiveConfig;

  constructor(config: Partial<ResponsiveConfig> = {}) {
    this.config = { ...DEFAULT_RESPONSIVE_CONFIG, ...config };
  }

  /**
   * 根據屏幕寬度確定設備類型
   */
  getDeviceType(screenWidth: number): DeviceType {
    if (screenWidth < this.config.breakpoints.mobile) {
      return DeviceType.Mobile;
    } else if (screenWidth < this.config.breakpoints.tablet) {
      return DeviceType.Tablet;
    } else if (screenWidth < this.config.breakpoints.desktop) {
      return DeviceType.Desktop;
    } else {
      return DeviceType.LargeDesktop;
    }
  }

  /**
   * 為特定設備類型調整小工具佈局
   */
  adaptLayoutForDevice(
    widgets: DashboardWidget[],
    deviceType: DeviceType,
    _containerWidth?: number
  ): DashboardWidget[] {
    const columns = this.config.columns[deviceType];
    const minSize = this.config.minWidgetSizes[deviceType];

    let adaptedWidgets = widgets.map(widget => {
      const adaptedWidget = { ...widget };

      // 調整位置和大小
      adaptedWidget.position = this.adaptWidgetPosition(
        widget.position,
        deviceType,
        columns,
        minSize
      );

      // 移動設備的特殊處理
      if (deviceType === DeviceType.Mobile) {
        adaptedWidget.position = this.adaptForMobile(adaptedWidget.position, columns);
      }

      return adaptedWidget;
    });

    // 解決碰撞
    adaptedWidgets = this.resolveCollisions(adaptedWidgets, columns);

    // 優化佈局
    adaptedWidgets = this.optimizeLayout(adaptedWidgets, columns);

    return adaptedWidgets;
  }

  /**
   * 調整單個小工具位置
   */
  private adaptWidgetPosition(
    position: WidgetPosition,
    _deviceType: DeviceType,
    columns: number,
    minSize: { width: number; height: number }
  ): WidgetPosition {
    return {
      x: Math.max(0, Math.min(position.x, columns - minSize.width)),
      y: position.y,
      width: Math.max(minSize.width, Math.min(position.width, columns - position.x)),
      height: Math.max(minSize.height, position.height)
    };
  }

  /**
   * 移動設備專用適配
   */
  private adaptForMobile(position: WidgetPosition, columns: number): WidgetPosition {
    return {
      x: 0,
      y: position.y,
      width: columns,
      height: position.height
    };
  }

  /**
   * 檢測小工具碰撞
   */
  detectCollisions(widgets: DashboardWidget[]): CollisionResult {
    const conflicts: CollisionResult['conflicts'] = [];

    for (let i = 0; i < widgets.length; i++) {
      for (let j = i + 1; j < widgets.length; j++) {
        const widget1 = widgets[i];
        const widget2 = widgets[j];

        const overlap = this.calculateOverlap(widget1.position, widget2.position);
        if (overlap) {
          conflicts.push({
            widget1: widget1.id,
            widget2: widget2.id,
            overlap
          });
        }
      }
    }

    return {
      hasCollision: conflicts.length > 0,
      conflicts
    };
  }

  /**
   * 計算兩個位置的重疊區域
   */
  private calculateOverlap(
    pos1: WidgetPosition,
    pos2: WidgetPosition
  ): { x: number; y: number; width: number; height: number } | null {
    const left1 = pos1.x;
    const right1 = pos1.x + pos1.width;
    const top1 = pos1.y;
    const bottom1 = pos1.y + pos1.height;

    const left2 = pos2.x;
    const right2 = pos2.x + pos2.width;
    const top2 = pos2.y;
    const bottom2 = pos2.y + pos2.height;

    const overlapLeft = Math.max(left1, left2);
    const overlapRight = Math.min(right1, right2);
    const overlapTop = Math.max(top1, top2);
    const overlapBottom = Math.min(bottom1, bottom2);

    if (overlapLeft < overlapRight && overlapTop < overlapBottom) {
      return {
        x: overlapLeft,
        y: overlapTop,
        width: overlapRight - overlapLeft,
        height: overlapBottom - overlapTop
      };
    }

    return null;
  }

  /**
   * 解決佈局碰撞
   */
  resolveCollisions(widgets: DashboardWidget[], columns: number): DashboardWidget[] {
    const resolvedWidgets = [...widgets];
    let hasCollisions = true;
    let attempts = 0;
    const maxAttempts = 10;

    while (hasCollisions && attempts < maxAttempts) {
      const collisionResult = this.detectCollisions(resolvedWidgets);
      hasCollisions = collisionResult.hasCollision;

      if (hasCollisions) {
        // 解決第一個碰撞
        const conflict = collisionResult.conflicts[0];
        const widget1Index = resolvedWidgets.findIndex(w => w.id === conflict.widget1);
        const widget2Index = resolvedWidgets.findIndex(w => w.id === conflict.widget2);

        if (widget1Index !== -1 && widget2Index !== -1) {
          // 移動第二個小工具到不衝突的位置
          const newPosition = this.findNonCollidingPosition(
            resolvedWidgets[widget2Index],
            resolvedWidgets.filter((_, index) => index !== widget2Index),
            columns
          );

          resolvedWidgets[widget2Index] = {
            ...resolvedWidgets[widget2Index],
            position: newPosition
          };
        }
      }

      attempts++;
    }

    return resolvedWidgets;
  }

  /**
   * 查找不發生碰撞的位置
   */
  private findNonCollidingPosition(
    widget: DashboardWidget,
    otherWidgets: DashboardWidget[],
    columns: number
  ): WidgetPosition {
    const { width, height } = widget.position;

    // 從上到下，從左到右搜索可用位置
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x <= columns - width; x++) {
        const testPosition: WidgetPosition = { x, y, width, height };

        const hasCollision = otherWidgets.some(otherWidget =>
          this.calculateOverlap(testPosition, otherWidget.position) !== null
        );

        if (!hasCollision) {
          return testPosition;
        }
      }
    }

    // 如果找不到，返回原位置（可能需要進一步處理）
    return widget.position;
  }

  /**
   * 優化佈局緊湊性
   */
  optimizeLayout(
    widgets: DashboardWidget[],
    columns: number,
    options: LayoutOptimizationOptions = {}
  ): DashboardWidget[] {
    const {
      allowReorder = true,
      compactMode = true
    } = options;

    let optimizedWidgets = [...widgets];

    if (allowReorder) {
      // 按 Y 座標和 X 座標排序
      optimizedWidgets.sort((a, b) => {
        if (a.position.y !== b.position.y) {
          return a.position.y - b.position.y;
        }
        return a.position.x - b.position.x;
      });
    }

    if (compactMode) {
      optimizedWidgets = this.compactLayout(optimizedWidgets, columns);
    }

    return optimizedWidgets;
  }

  /**
   * 緊湊佈局，減少空隙
   */
  private compactLayout(widgets: DashboardWidget[], columns: number): DashboardWidget[] {
    const compactedWidgets: DashboardWidget[] = [];
    const occupiedSpaces = new Set<string>();

    for (const widget of widgets) {
      const newPosition = this.findCompactPosition(
        widget.position,
        occupiedSpaces,
        columns
      );

      const compactedWidget = {
        ...widget,
        position: newPosition
      };

      compactedWidgets.push(compactedWidget);

      // 標記佔用的空間
      this.markOccupiedSpace(newPosition, occupiedSpaces);
    }

    return compactedWidgets;
  }

  /**
   * 查找緊湊位置
   */
  private findCompactPosition(
    originalPosition: WidgetPosition,
    occupiedSpaces: Set<string>,
    columns: number
  ): WidgetPosition {
    const { width, height } = originalPosition;

    // 嘗試向上移動
    for (let y = 0; y < originalPosition.y + 10; y++) {
      for (let x = 0; x <= columns - width; x++) {
        if (this.isSpaceAvailable({ x, y, width, height }, occupiedSpaces)) {
          return { x, y, width, height };
        }
      }
    }

    return originalPosition;
  }

  /**
   * 檢查空間是否可用
   */
  private isSpaceAvailable(
    position: WidgetPosition,
    occupiedSpaces: Set<string>
  ): boolean {
    for (let x = position.x; x < position.x + position.width; x++) {
      for (let y = position.y; y < position.y + position.height; y++) {
        if (occupiedSpaces.has(`${x},${y}`)) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 標記佔用空間
   */
  private markOccupiedSpace(position: WidgetPosition, occupiedSpaces: Set<string>): void {
    for (let x = position.x; x < position.x + position.width; x++) {
      for (let y = position.y; y < position.y + position.height; y++) {
        occupiedSpaces.add(`${x},${y}`);
      }
    }
  }

  /**
   * 生成響應式佈局配置
   */
  generateResponsiveLayout(
    baseWidgets: DashboardWidget[],
    containerWidths: Record<DeviceType, number>
  ): Record<DeviceType, DashboardWidget[]> {
    const responsiveLayouts: Record<DeviceType, DashboardWidget[]> = {} as any;

    Object.values(DeviceType).forEach(deviceType => {
      const containerWidth = containerWidths[deviceType];
      responsiveLayouts[deviceType] = this.adaptLayoutForDevice(
        baseWidgets,
        deviceType,
        containerWidth
      );
    });

    return responsiveLayouts;
  }

  /**
   * 計算佈局尺寸
   */
  calculateLayoutDimensions(
    widgets: DashboardWidget[],
    deviceType: DeviceType
  ): {
    totalWidth: number;
    totalHeight: number;
    usedColumns: number;
    usedRows: number;
  } {
    if (widgets.length === 0) {
      return { totalWidth: 0, totalHeight: 0, usedColumns: 0, usedRows: 0 };
    }

    const maxX = Math.max(...widgets.map(w => w.position.x + w.position.width));
    const maxY = Math.max(...widgets.map(w => w.position.y + w.position.height));

    const columns = this.config.columns[deviceType];
    const gap = this.config.gaps[deviceType];
    const margin = this.config.margins[deviceType];

    return {
      totalWidth: maxX * (100 / columns) + gap * (maxX - 1) + margin * 2,
      totalHeight: maxY * 100 + gap * (maxY - 1) + margin * 2, // 假設每行高度為100px
      usedColumns: maxX,
      usedRows: maxY
    };
  }

  /**
   * 驗證佈局配置
   */
  validateLayout(widgets: DashboardWidget[], deviceType: DeviceType): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const columns = this.config.columns[deviceType];
    const minSize = this.config.minWidgetSizes[deviceType];

    // 檢查每個小工具
    widgets.forEach(widget => {
      const pos = widget.position;

      // 檢查是否超出邊界
      if (pos.x + pos.width > columns) {
        errors.push(`Widget ${widget.id} exceeds container width`);
      }

      // 檢查最小尺寸
      if (pos.width < minSize.width || pos.height < minSize.height) {
        warnings.push(`Widget ${widget.id} is smaller than recommended minimum size`);
      }

      // 檢查負座標
      if (pos.x < 0 || pos.y < 0) {
        errors.push(`Widget ${widget.id} has negative coordinates`);
      }
    });

    // 檢查碰撞
    const collisionResult = this.detectCollisions(widgets);
    if (collisionResult.hasCollision) {
      collisionResult.conflicts.forEach(conflict => {
        errors.push(`Collision between widgets ${conflict.widget1} and ${conflict.widget2}`);
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 獲取推薦的佈局配置
   */
  getRecommendedLayoutConfig(
    widgets: DashboardWidget[],
    deviceType: DeviceType,
    containerWidth: number
  ): LayoutConfig {
    const columns = this.config.columns[deviceType];
    const gap = this.config.gaps[deviceType];
    const margin = this.config.margins[deviceType];

    const dimensions = this.calculateLayoutDimensions(widgets, deviceType);

    return {
      type: deviceType === DeviceType.Mobile ? 'flex' : 'grid',
      columns,
      gap,
      margin,
      containerWidth,
      containerHeight: dimensions.totalHeight,
      responsive: true,
      breakpoints: this.config.breakpoints
    };
  }

  /**
   * 更新響應式配置
   */
  updateResponsiveConfig(updates: Partial<ResponsiveConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 獲取當前響應式配置
   */
  getResponsiveConfig(): ResponsiveConfig {
    return { ...this.config };
  }
}

export default LayoutService;