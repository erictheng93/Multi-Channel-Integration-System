// Smart Route Registry - 智能路由註冊系統
// 自動處理路由順序，防止衝突

import type { Hono } from 'hono';

/**
 * 路由優先級枚舉
 */
export enum RoutePriority {
  STATIC = 1, // 靜態路由（最高優先級）: /health, /info
  SPECIFIC = 2, // 具體路由: /members, /invitations
  PARAMETERIZED = 3, // 參數化路由: /:id
  WILDCARD = 4 // 通配符路由（最低優先級）: /*
}

/**
 * 路由定義
 */
export interface RouteDefinition {
  path: string;
  handler: any;
  priority?: RoutePriority;
  description?: string;
}

/**
 * 路由分析結果
 */
interface RouteAnalysis {
  path: string;
  priority: RoutePriority;
  hasParams: boolean;
  hasWildcard: boolean;
  segmentCount: number;
  specificity: number;
}

/**
 * 智能路由註冊器
 *
 * 特性：
 * 1. 自動分析路由優先級
 * 2. 自動排序路由註冊順序
 * 3. 檢測潛在衝突
 * 4. 生成詳細報告
 */
export class SmartRouteRegistry {
  private routes: Map<string, RouteDefinition> = new Map();
  private app: Hono<any>;
  private registered: Set<string> = new Set();

  constructor(app: Hono<any>) {
    this.app = app;
  }

  /**
   * 添加路由定義
   */
  add(routeDef: RouteDefinition): this {
    // 自動分析優先級（如果未指定）
    if (routeDef.priority === undefined) {
      routeDef.priority = this.analyzeRoutePriority(routeDef.path);
    }

    const key = `${routeDef.path}`;

    if (this.routes.has(key)) {
      console.warn(` Route already defined: ${routeDef.path}`);
    }

    this.routes.set(key, routeDef);
    return this;
  }

  /**
   * 批量添加路由
   */
  addMany(routes: RouteDefinition[]): this {
    routes.forEach(route => this.add(route));
    return this;
  }

  /**
   * 註冊所有路由（自動排序）
   */
  register(): {
    registered: number;
    conflicts: string[];
    report: string;
  } {
    console.log('\n Smart Route Registry - Starting registration...\n');

    // 1. 轉換為數組並分析
    const routesWithAnalysis = Array.from(this.routes.values()).map(route => ({
      route,
      analysis: this.analyzeRoute(route.path)
    }));

    // 2. 智能排序
    const sortedRoutes = this.sortRoutes(routesWithAnalysis);

    // 3. 檢測衝突
    const conflicts = this.detectConflicts(sortedRoutes);

    // 4. 註冊路由
    let registered = 0;
    sortedRoutes.forEach(({ route, analysis }) => {
      try {
        this.app.route(route.path, route.handler);
        this.registered.add(route.path);
        registered++;

        console.log(
          ` [P${route.priority}] ${route.path.padEnd(30)} ` +
          `(specificity: ${analysis.specificity})` +
          (route.description ? ` - ${route.description}` : '')
        );
      } catch (error) {
        console.error(` Failed to register: ${route.path}`, error);
      }
    });

    // 5. 生成報告
    const report = this.generateReport(sortedRoutes, conflicts);

    console.log('\n' + report);

    return { registered, conflicts, report };
  }

  /**
   * 分析路由優先級
   */
  private analyzeRoutePriority(path: string): RoutePriority {
    // 靜態路由（無參數）
    if (!path.includes(':') && !path.includes('*')) {
      // 根路徑
      if (path === '/' || path === '') {
        return RoutePriority.PARAMETERIZED;
      }
      // 具體靜態路由
      return RoutePriority.STATIC;
    }

    // 通配符路由
    if (path.includes('*')) {
      return RoutePriority.WILDCARD;
    }

    // 參數化路由
    if (path.includes(':')) {
      // 如果只有根路徑是參數化的，優先級更低
      if (path === '/:id' || path === '/:id/') {
        return RoutePriority.PARAMETERIZED;
      }
      // 有具體前綴的參數化路由，優先級稍高
      return RoutePriority.SPECIFIC;
    }

    return RoutePriority.SPECIFIC;
  }

  /**
   * 詳細分析路由
   */
  private analyzeRoute(path: string): RouteAnalysis {
    const segments = path.split('/').filter(s => s.length > 0);
    const hasParams = path.includes(':');
    const hasWildcard = path.includes('*');

    // 計算具體性分數（越高越具體）
    let specificity = 0;
    segments.forEach((segment, index) => {
      if (segment.startsWith(':')) {
        specificity += 1; // 參數段
      } else if (segment === '*') {
        specificity += 0; // 通配符段
      } else {
        specificity += 10 * (segments.length - index); // 具體段（越靠前越重要）
      }
    });

    const priority = this.analyzeRoutePriority(path);

    return {
      path,
      priority,
      hasParams,
      hasWildcard,
      segmentCount: segments.length,
      specificity
    };
  }

  /**
   * 智能排序路由
   */
  private sortRoutes(
    routesWithAnalysis: Array<{ route: RouteDefinition; analysis: RouteAnalysis }>
  ): Array<{ route: RouteDefinition; analysis: RouteAnalysis }> {
    return routesWithAnalysis.sort((a, b) => {
      // 1. 首先按優先級排序
      if (a.route.priority !== b.route.priority) {
        return a.route.priority! - b.route.priority!;
      }

      // 2. 同優先級，按具體性排序（越具體越優先）
      if (a.analysis.specificity !== b.analysis.specificity) {
        return b.analysis.specificity - a.analysis.specificity;
      }

      // 3. 同具體性，按段數排序（越多越具體）
      if (a.analysis.segmentCount !== b.analysis.segmentCount) {
        return b.analysis.segmentCount - a.analysis.segmentCount;
      }

      // 4. 最後按字母順序
      return a.route.path.localeCompare(b.route.path);
    });
  }

  /**
   * 檢測潛在路由衝突
   */
  private detectConflicts(
    sortedRoutes: Array<{ route: RouteDefinition; analysis: RouteAnalysis }>
  ): string[] {
    const conflicts: string[] = [];
    const paths = sortedRoutes.map(r => r.route.path);

    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const path1 = paths[i];
        const path2 = paths[j];

        // 檢查是否可能衝突
        if (this.mayConflict(path1, path2)) {
          conflicts.push(` Potential conflict: "${path1}" may intercept "${path2}"`);
        }
      }
    }

    return conflicts;
  }

  /**
   * 判斷兩個路由是否可能衝突
   */
  private mayConflict(path1: string, path2: string): boolean {
    // 如果路徑相同，肯定衝突
    if (path1 === path2) return true;

    const segments1 = path1.split('/').filter(s => s.length > 0);
    const segments2 = path2.split('/').filter(s => s.length > 0);

    // 段數不同，檢查是否有一個可以匹配另一個
    const minLength = Math.min(segments1.length, segments2.length);

    for (let i = 0; i < minLength; i++) {
      const seg1 = segments1[i];
      const seg2 = segments2[i];

      // 如果有參數或通配符，可能衝突
      if (seg1.startsWith(':') || seg1 === '*') {
        // path1 的參數段可以匹配 path2 的具體段
        if (i === segments1.length - 1 && segments2.length > segments1.length) {
          return true; // path1 更短但有參數，可能攔截 path2
        }
      }

      // 如果具體段不匹配，不會衝突
      if (!seg1.startsWith(':') && !seg2.startsWith(':') && seg1 !== seg2) {
        return false;
      }
    }

    return false;
  }

  /**
   * 生成註冊報告
   */
  private generateReport(
    sortedRoutes: Array<{ route: RouteDefinition; analysis: RouteAnalysis }>,
    conflicts: string[]
  ): string {
    const lines: string[] = [];

    lines.push(' Smart Route Registry Report');
    lines.push('═'.repeat(80));
    lines.push('');

    // 統計
    lines.push(`Total routes: ${sortedRoutes.length}`);
    lines.push(`Registered: ${this.registered.size}`);
    lines.push(`Conflicts detected: ${conflicts.length}`);
    lines.push('');

    // 按優先級分組
    const grouped = new Map<RoutePriority, typeof sortedRoutes>();
    sortedRoutes.forEach(item => {
      const priority = item.route.priority!;
      if (!grouped.has(priority)) {
        grouped.set(priority, []);
      }
      grouped.get(priority)!.push(item);
    });

    lines.push('Route Groups by Priority:');
    lines.push('─'.repeat(80));
    grouped.forEach((routes, priority) => {
      const priorityName = RoutePriority[priority];
      lines.push(`  [${priority}] ${priorityName}: ${routes.length} routes`);
    });
    lines.push('');

    // 衝突警告
    if (conflicts.length > 0) {
      lines.push('  WARNINGS - Potential Conflicts:');
      lines.push('─'.repeat(80));
      conflicts.forEach(conflict => lines.push(`  ${conflict}`));
      lines.push('');
    }

    lines.push('═'.repeat(80));

    return lines.join('\n');
  }

  /**
   * 獲取已註冊的路由列表
   */
  getRegisteredRoutes(): string[] {
    return Array.from(this.registered);
  }

  /**
   * 清空路由定義
   */
  clear(): void {
    this.routes.clear();
    this.registered.clear();
  }
}

/**
 * 便捷工廠函數
 */
export function createSmartRegistry(app: Hono<any>): SmartRouteRegistry {
  return new SmartRouteRegistry(app);
}
