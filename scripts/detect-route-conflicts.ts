#!/usr/bin/env tsx
// Route Conflict Detector - 路由衝突檢測工具
// 在開發時自動檢測並報告路由衝突

import { glob } from 'glob';
import { readFileSync } from 'fs';
import { join } from 'path';

interface RouteInfo {
  method: string;
  path: string;
  file: string;
  line: number;
}

/**
 * 從文件中提取路由定義
 */
function extractRoutes(filePath: string): RouteInfo[] {
  const content = readFileSync(filePath, 'utf-8');
  const routes: RouteInfo[] = [];
  const lines = content.split('\n');

  // 匹配 handler.get(), handler.post(), app.route() 等
  // 支持任何變數名稱: app, membersHandler, teamHandlers, router 等
  // 排除 c.get(), env.get() 等上下文方法調用 - 通過檢查後面是否有逗號
  // 匹配模式: variableName.method('path', ...
  const routeRegex = /(?!c\.|env\.|ctx\.)(\w+)\.(get|post|put|delete|patch|route)\s*\(\s*['"`]([/][^'"`]*)['"`]\s*,/g;

  lines.forEach((line, index) => {
    let match;
    // Reset regex state for each line
    routeRegex.lastIndex = 0;

    while ((match = routeRegex.exec(line)) !== null) {
      // match[1] = variable name, match[2] = method, match[3] = path
      const method = match[2]?.toUpperCase() || 'UNKNOWN';
      const path = match[3];

      if (method && path) {
        routes.push({
          method,
          path,
          file: filePath,
          line: index + 1
        });
      }
    }
  });

  return routes;
}

/**
 * 檢查兩個路由是否可能衝突
 */
function checkConflict(route1: RouteInfo, route2: RouteInfo): boolean {
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

  // 檢查參數化路由是否會攔截具體路由
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
      // route1 更短且匹配，可能攔截 route2
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
  console.log('🔍 Route Conflict Detector\n');
  console.log('Scanning for route definitions...\n');

  // 掃描所有處理器文件
  // 包括：
  // 1. 文件名包含 handler 的文件: *handler*.ts
  // 2. handlers 目錄下的所有 .ts 文件: **/handlers/*.ts
  // 3. handler 目錄下的所有 .ts 文件: **/handler/*.ts
  const handlerFiles = await glob('src/**/{*handler*.ts,handlers/*.ts,handler/*.ts}', {
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/*.d.ts']
  });

  console.log(`Found ${handlerFiles.length} handler files\n`);

  // 提取所有路由
  const allRoutes: RouteInfo[] = [];
  handlerFiles.forEach(file => {
    const routes = extractRoutes(file);
    allRoutes.push(...routes);
  });

  console.log(`Extracted ${allRoutes.length} route definitions\n`);

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
  console.log('📊 CONFLICT DETECTION REPORT');
  console.log('═'.repeat(100));
  console.log('');

  if (conflicts.length === 0) {
    console.log('✅ No route conflicts detected!');
  } else {
    console.log(`⚠️  Found ${conflicts.length} potential conflicts:\n`);

    // 按嚴重程度分組
    const highSeverity = conflicts.filter(c => c.severity === 'high');
    const mediumSeverity = conflicts.filter(c => c.severity === 'medium');
    const lowSeverity = conflicts.filter(c => c.severity === 'low');

    if (highSeverity.length > 0) {
      console.log('🔴 HIGH SEVERITY (Duplicate routes):');
      console.log('─'.repeat(100));
      highSeverity.forEach(({ route1, route2 }) => {
        console.log(`  ❌ ${route1.method} ${route1.path}`);
        console.log(`     📍 ${route1.file}:${route1.line}`);
        console.log(`     📍 ${route2.file}:${route2.line}`);
        console.log('');
      });
    }

    if (mediumSeverity.length > 0) {
      console.log('🟡 MEDIUM SEVERITY (Parameterized route conflicts):');
      console.log('─'.repeat(100));
      mediumSeverity.forEach(({ route1, route2 }) => {
        const priority1 = calculatePriority(route1.path);
        const priority2 = calculatePriority(route2.path);

        console.log(`  ⚠️  "${route1.path}" may intercept "${route2.path}"`);
        console.log(`     Priority scores: ${priority1} vs ${priority2}`);
        console.log(`     📍 ${route1.file}:${route1.line}`);
        console.log(`     📍 ${route2.file}:${route2.line}`);

        if (priority1 < priority2) {
          console.log(`     💡 Suggestion: Register "${route2.path}" before "${route1.path}"`);
        }
        console.log('');
      });
    }

    if (lowSeverity.length > 0) {
      console.log('🟢 LOW SEVERITY (Potential issues):');
      console.log('─'.repeat(100));
      lowSeverity.forEach(({ route1, route2 }) => {
        console.log(`  ℹ️  "${route1.path}" and "${route2.path}"`);
        console.log(`     📍 ${route1.file}:${route1.line}`);
        console.log(`     📍 ${route2.file}:${route2.line}`);
        console.log('');
      });
    }
  }

  console.log('═'.repeat(100));

  // 返回退出碼
  if (conflicts.filter(c => c.severity === 'high').length > 0) {
    process.exit(1); // 高嚴重度衝突，失敗
  }
}

// 執行檢測
detectConflicts().catch(error => {
  console.error('Error during conflict detection:', error);
  process.exit(1);
});
