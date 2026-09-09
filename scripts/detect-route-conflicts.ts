#!/usr/bin/env tsx
// Route Conflict Detector - 路由衝突檢測工具
// 在開發時自動檢測並報告路由衝突

import { readFileSync } from 'fs';
import { join } from 'path';

interface RouteInfo {
  method: string;
  path: string;
  file: string;
  line: number;
  module: string; // Module identifier to prevent cross-module false positives
}

/**
 * 從文件路徑提取模組識別符
 * 用於區分不同模組的路由，避免跨模組誤報
 *
 * 對於子應用模式（如 modules/teams/handlers/members.ts），
 * 將其標記為獨立的子模組以避免誤報
 */
function getModuleIdentifier(filePath: string): string {
  // 標準化路徑分隔符
  const normalizedPath = filePath.replace(/\\/g, '/');

  // 情況 1: src/modules/xxx/handlers/yyy.ts - 子應用處理器（NOT index.ts）
  const subHandlerMatch = normalizedPath.match(/src\/modules\/([^\/]+)\/handlers\/([^\/]+)\.ts/);
  if (subHandlerMatch && subHandlerMatch[2] !== 'index') {
    // 標記為獨立子模組，避免與同模組的其他子應用衝突
    return `modules/${subHandlerMatch[1]}/sub:${subHandlerMatch[2]}`;
  }

  // 情況 2: src/modules/xxx - 提取模組名稱（包括 index.ts）
  const moduleMatch = normalizedPath.match(/src\/modules\/([^\/]+)/);
  if (moduleMatch) {
    return `modules/${moduleMatch[1]}`;
  }

  // 情況 3: src/handlers/xxx - 提取處理器名稱
  const handlerMatch = normalizedPath.match(/src\/handlers\/([^\/]+)\.ts/);
  if (handlerMatch) {
    return `handlers/${handlerMatch[1]}`;
  }

  // 情況 4: src/index.ts - 主入口文件（所有路由都在這裡匯總，需要特別注意）
  if (normalizedPath.includes('src/index.ts')) {
    return 'main-entry';
  }

  // 默認：使用完整路徑作為模組標識符
  return normalizedPath;
}

/**
 * 從文件中提取路由定義
 */
/** Context accessors that look like route registrations but are not. */
const NON_ROUTE_RECEIVERS = new Set(['c', 'ctx', 'context', 'env', 'req', 'request', 'headers', 'params', 'map', 'cache', 'storage']);

function extractRoutes(filePath: string): RouteInfo[] {
  const content = readFileSync(filePath, 'utf-8');
  const routes: RouteInfo[] = [];

  // 匹配 handler.get(), handler.post(), app.route() 等
  // 支持任何變數名稱: app, membersHandler, teamHandlers, router 等
  // 匹配模式: variableName.method('path', ...
  //
  // Scanned over the WHOLE file, not line by line. `\s` matches newlines, so a
  // multi-line registration is matched too:
  //
  //   reportsApp.get(
  //     '/:id',
  //     middleware,
  //     handler
  //   )
  //
  // The previous line-by-line scan required the path literal to sit on the same
  // line as `.get(` and therefore missed 37 routes across 3 files - including a
  // real `/stats` vs `/:id` shadowing that was live in production.
  //
  // The lookbehind pins the match to an identifier boundary and rejects a
  // receiver reached through a property access, so `c.req.get('/x',` cannot
  // masquerade as a route on `req`.
  const routeRegex = /(?<![\w$.])([\w$]+)\.(get|post|put|delete|patch|route)\s*\(\s*['"`]([/][^'"`]*)['"`]\s*,/g;

  const moduleId = getModuleIdentifier(filePath);

  // Line starts, so a match offset can be turned into a line number without
  // rescanning the file for every match.
  const lineStarts: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      lineStarts.push(i + 1);
    }
  }
  const lineOf = (offset: number): number => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if ((lineStarts[mid] ?? 0) <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return low + 1;
  };

  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const receiver = match[1];
    const method = match[2]?.toUpperCase() || 'UNKNOWN';
    const path = match[3];

    if (receiver && NON_ROUTE_RECEIVERS.has(receiver)) {
      continue;
    }

    if (method && path) {
      routes.push({
        method,
        path,
        file: filePath,
        line: lineOf(match.index),
        module: moduleId
      });
    }
  }

  return routes;
}

/**
 * Was `a` registered before `b`?
 *
 * Within one file, source order is registration order. Across files in the same
 * module the order depends on import/mount order, which this script cannot see,
 * so an overlap there is reported too - a human has to confirm which one wins.
 */
function registeredBefore(a: RouteInfo, b: RouteInfo): boolean {
  if (a.file === b.file) {
    return a.line < b.line;
  }
  return true;
}

/**
 * 檢查兩個路由是否可能衝突
 */
function checkConflict(route1: RouteInfo, route2: RouteInfo): boolean {
  // Hono 的 .route() 方法支持多次掛載到同一路徑（會合併路由）
  // 所以 ROUTE 方法的重複不應該被視為衝突
  if (route1.method === 'ROUTE' && route2.method === 'ROUTE') {
    // 相同路徑的多次 .route() 調用是合法的（路由合併）
    if (route1.path === route2.path) {
      return false; // 不是衝突
    }
  }

  // 不同 HTTP 方法不會衝突
  if (route1.method !== route2.method && route1.method !== 'ROUTE' && route2.method !== 'ROUTE') {
    return false;
  }

  const path1 = route1.path;
  const path2 = route2.path;

  // 完全相同
  if (path1 === path2) return true;

  const segments1 = path1.split('/').filter(s => s.length > 0);
  const segments2 = path2.split('/').filter(s => s.length > 0);

  // In Hono, exact HTTP method routes (get/post/put/delete/patch) only match
  // paths with the exact same number of segments. A shorter route CANNOT
  // intercept a longer path. Only .route() (prefix mounting) and wildcards (*)
  // can match across different segment counts.
  if (segments1.length !== segments2.length) {
    const hasWildcard = segments1.some(s => s === '*') || segments2.some(s => s === '*');
    const isRoute = route1.method === 'ROUTE' || route2.method === 'ROUTE';
    if (!hasWildcard && !isRoute) {
      return false; // Different segment counts = no conflict in Hono exact matching
    }
  }

  // 同段數：先註冊的參數段會吃掉後註冊的具體段
  //
  // This is the single most common Hono trap, and the check below could not see
  // it: it only reported a conflict when route1 was strictly SHORTER than
  // route2, so `/:id` vs `/stats` (both one segment) always passed. That exact
  // pair was live in production - GET /api/reports/stats matched `/:id` with
  // id="stats" and returned 400 "Invalid report ID format".
  //
  // Only the harmful direction is flagged: route1 holding a parameter where
  // route2 holds a literal. The reverse (literal first, parameter later) is the
  // correct ordering and must stay quiet, or the guard becomes noise.
  if (segments1.length === segments2.length) {
    let shadows = false;
    for (let i = 0; i < segments1.length; i++) {
      const seg1 = segments1[i] ?? '';
      const seg2 = segments2[i] ?? '';

      if (seg1 === seg2) {
        continue;
      }

      const seg1IsParam = seg1.startsWith(':') || seg1 === '*';
      const seg2IsParam = seg2.startsWith(':') || seg2 === '*';

      if (seg1IsParam && !seg2IsParam) {
        shadows = true;
        continue;
      }

      // Literal-vs-different-literal, or literal shadowed by a later parameter:
      // the paths either do not overlap or already resolve in the right order.
      shadows = false;
      break;
    }

    if (shadows && registeredBefore(route1, route2)) {
      return true;
    }
  }

  // 檢查參數化路由是否會攔截具體路由 (same segment count or wildcard/route prefix)
  if (segments1.length <= segments2.length) {
    let matches = true;
    for (let i = 0; i < segments1.length; i++) {
      const seg1 = segments1[i];
      const seg2 = segments2[i];

      // 參數段匹配任何具體段
      if (seg1.startsWith(':') || seg1 === '*') {
        continue;
      }

      // 具體段必須完全匹配
      if (seg1 !== seg2) {
        matches = false;
        break;
      }
    }

    if (matches && segments1.length < segments2.length) {
      // route1 更短且匹配，可能攔截 route2 (only reachable for .route() or wildcards)
      return true;
    }
  }

  return false;
}

/**
 * 計算路由優先級分數（越高越具體）
 */
function calculatePriority(path: string): number {
  const segments = path.split('/').filter(s => s.length > 0);
  let score = 0;

  segments.forEach((segment, index) => {
    if (segment.startsWith(':')) {
      score += 1; // 參數段
    } else if (segment === '*') {
      score += 0; // 通配符段
    } else {
      score += 10 * (segments.length - index); // 具體段
    }
  });

  return score;
}

/**
 * 主檢測函數
 */
async function detectConflicts() {
  console.log(' Route Conflict Detector\n');
  console.log('Scanning for route definitions...\n');

  // 掃描所有處理器文件
  // 包括：
  // 1. 文件名包含 handler 的文件: *handler*.ts
  // 2. handlers 目錄下的所有 .ts 文件: **/handlers/*.ts
  // 3. handler 目錄下的所有 .ts 文件: **/handler/*.ts
  const ignorePatterns = ['.test.ts', '.spec.ts', 'node_modules', '.d.ts'];
  const scanPattern = async (pattern: string) =>
    Array.fromAsync(new Bun.Glob(pattern).scan('.'));
  const [a, b, c] = await Promise.all([
    scanPattern('src/**/*handler*.ts'),
    scanPattern('src/**/handlers/*.ts'),
    scanPattern('src/**/handler/*.ts'),
  ]);
  const handlerFiles = [...new Set([...a, ...b, ...c])]
    .filter(f => !ignorePatterns.some(p => f.includes(p)));

  console.log(`Found ${handlerFiles.length} handler files\n`);

  // 提取所有路由
  const allRoutes: RouteInfo[] = [];
  handlerFiles.forEach(file => {
    const routes = extractRoutes(file);
    allRoutes.push(...routes);
  });

  console.log(`Extracted ${allRoutes.length} route definitions\n`);

  // 統計各模組的路由數量
  const moduleStats = new Map<string, number>();
  allRoutes.forEach(route => {
    moduleStats.set(route.module, (moduleStats.get(route.module) || 0) + 1);
  });

  console.log(' Module Distribution:');
  console.log('─'.repeat(100));
  Array.from(moduleStats.entries())
    .sort((a, b) => b[1] - a[1]) // 按路由數量排序
    .forEach(([module, count]) => {
      console.log(` ${module.padEnd(40)} ${count} routes`);
    });
  console.log('');

  // 檢測衝突
  const conflicts: Array<{
    route1: RouteInfo;
    route2: RouteInfo;
    severity: 'high' | 'medium' | 'low';
  }> = [];

  for (let i = 0; i < allRoutes.length; i++) {
    for (let j = i + 1; j < allRoutes.length; j++) {
      const route1 = allRoutes[i];
      const route2 = allRoutes[j];

      // 修復：只檢查同一模組內的路由衝突，避免跨模組誤報
      // 例如：modules/system 的 /health 不會與 handlers/websocket-main 的 /health 衝突
      if (route1.module !== route2.module) {
        continue; // 跳過不同模組的路由比較
      }

      if (checkConflict(route1, route2)) {
        // 判斷嚴重程度
        let severity: 'high' | 'medium' | 'low' = 'low';

        if (route1.path === route2.path) {
          severity = 'high'; // 完全相同
        } else if (route1.path.includes(':') || route2.path.includes(':')) {
          severity = 'medium'; // 參數化路由衝突
        }

        conflicts.push({ route1, route2, severity });
      }
    }
  }

  // 輸出報告
  console.log('═'.repeat(100));
  console.log(' CONFLICT DETECTION REPORT');
  console.log('═'.repeat(100));
  console.log('');

  if (conflicts.length === 0) {
    console.log(' No route conflicts detected!');
  } else {
    console.log(`  Found ${conflicts.length} potential conflicts:\n`);

    // 按嚴重程度分組
    const highSeverity = conflicts.filter(c => c.severity === 'high');
    const mediumSeverity = conflicts.filter(c => c.severity === 'medium');
    const lowSeverity = conflicts.filter(c => c.severity === 'low');

    if (highSeverity.length > 0) {
      console.log(' HIGH SEVERITY (Duplicate routes):');
      console.log('─'.repeat(100));
      highSeverity.forEach(({ route1, route2 }) => {
        console.log(` ${route1.method} ${route1.path}`);
        console.log(` Module: ${route1.module}`);
        console.log(` ${route1.file}:${route1.line}`);
        console.log(` ${route2.file}:${route2.line}`);
        console.log('');
      });
    }

    if (mediumSeverity.length > 0) {
      console.log(' MEDIUM SEVERITY (Parameterized route conflicts):');
      console.log('─'.repeat(100));
      mediumSeverity.forEach(({ route1, route2 }) => {
        const priority1 = calculatePriority(route1.path);
        const priority2 = calculatePriority(route2.path);

        console.log(` "${route1.path}" may intercept "${route2.path}"`);
        console.log(` Module: ${route1.module}`);
        console.log(` Priority scores: ${priority1} vs ${priority2}`);
        console.log(` ${route1.file}:${route1.line}`);
        console.log(` ${route2.file}:${route2.line}`);

        if (priority1 < priority2) {
          console.log(` Suggestion: Register "${route2.path}" before "${route1.path}"`);
        }
        console.log('');
      });
    }

    if (lowSeverity.length > 0) {
      console.log(' LOW SEVERITY (Potential issues):');
      console.log('─'.repeat(100));
      lowSeverity.forEach(({ route1, route2 }) => {
        console.log(` "${route1.path}" and "${route2.path}"`);
        console.log(` Module: ${route1.module}`);
        console.log(` ${route1.file}:${route1.line}`);
        console.log(` ${route2.file}:${route2.line}`);
        console.log('');
      });
    }
  }

  console.log('═'.repeat(100));

  // 返回退出碼
  //
  // MEDIUM blocks as well as HIGH. A parameterised route shadowing a literal is
  // not a "potential issue" - it makes the shadowed endpoint permanently
  // unreachable, which is how GET /api/reports/stats and /scheduled sat broken
  // in production while this script printed them and exited 0.
  //
  // LOW stays advisory.
  const blocking = conflicts.filter(c => c.severity === 'high' || c.severity === 'medium');
  if (blocking.length > 0) {
    console.log('');
    console.log(` ${blocking.length} blocking conflict(s). A parameterised route registered before a`);
    console.log(' literal one makes the literal unreachable - reorder the registrations so the');
    console.log(' more specific path comes first.');
    process.exit(1);
  }
}

// 執行檢測
detectConflicts().catch(error => {
  console.error('Error during conflict detection:', error);
  process.exit(1);
});
