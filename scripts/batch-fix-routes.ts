#!/usr/bin/env tsx
// Batch Route Fix Script - 批量修復路由順序
// 自動將模組轉換為使用智能路由註冊器

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * 要修復的模組列表（從分析結果得出）
 */
const MODULES_TO_FIX = [
  {
    name: 'handlers/notification-router',
    file: 'src/handlers/notification-router.ts',
    conflicts: 5
  },
  {
    name: 'handlers/messaging-main',
    file: 'src/handlers/messaging-main.ts',
    conflicts: 5
  },
  {
    name: 'handlers/customer-main',
    file: 'src/handlers/customer-main.ts',
    conflicts: 4
  },
  {
    name: 'handlers/activity',
    file: 'src/handlers/activity.ts',
    conflicts: 2
  },
  {
    name: 'handlers/user-experience-main',
    file: 'src/handlers/user-experience-main.ts',
    conflicts: 1
  },
  {
    name: 'handlers/conversation',
    file: 'src/handlers/conversation.ts',
    conflicts: 1
  },
  {
    name: 'modules/teams/handlers/team',
    file: 'src/modules/teams/handlers/team.ts',
    conflicts: 16
  },
  {
    name: 'modules/session/handlers/session',
    file: 'src/modules/session/handlers/session.ts',
    conflicts: 8
  },
  {
    name: 'modules/qrcode/handlers/index',
    file: 'src/modules/qrcode/handlers/index.ts',
    conflicts: 41
  }
];

interface RouteExtraction {
  varName: string;
  method: string;
  path: string;
  handler: string;
  fullLine: string;
  lineNumber: number;
}

/**
 * 從文件中提取路由定義
 */
function extractRoutesFromFile(filePath: string): RouteExtraction[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const routes: RouteExtraction[] = [];

  // 匹配 app.get(), app.post(), etc.
  const routeRegex = /^(\s*)([\w]+)\.(get|post|put|delete|patch|route)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(.+)/;

  lines.forEach((line, index) => {
    const match = line.match(routeRegex);
    if (match) {
      const [, indent, varName, method, path, handler] = match;

      // 跳過註釋行
      if (line.trim().startsWith('//')) return;

      routes.push({
        varName,
        method: method.toUpperCase(),
        path,
        handler: handler.trim(),
        fullLine: line,
        lineNumber: index + 1
      });
    }
  });

  return routes;
}

/**
 * 生成智能註冊器代碼
 */
function generateSmartRegistryCode(routes: RouteExtraction[], originalVarName: string): string {
  const code: string[] = [];

  code.push(`import { createSmartRegistry, RoutePriority } from '@/core/smart-route-registry';`);
  code.push('');
  code.push(`const registry = createSmartRegistry(${originalVarName});`);
  code.push('');
  code.push('// 添加所有路由（智能註冊器會自動排序）');
  code.push('registry.addMany([');

  routes.forEach((route, index) => {
    const priority = determinePriority(route.path);

    code.push('  {');
    code.push(` path: '${route.path}',`);
    code.push(` handler: ${route.handler.replace(/,?\s*$/, '')},  // 原: ${route.method}`);
    code.push(` priority: ${priority},`);
    code.push(` description: '${generateDescription(route)}'`);
    code.push(`  }${index < routes.length - 1 ? ',' : ''}`);
  });

  code.push(']);');
  code.push('');
  code.push('// 自動排序並註冊');
  code.push('const { registered, conflicts } = registry.register();');
  code.push('');
  code.push('if (conflicts.length > 0) {');
  code.push(`  console.warn(' Route conflicts detected! See registration report above.');`);
  code.push('}');

  return code.join('\n');
}

/**
 * 判斷路由優先級
 */
function determinePriority(path: string): string {
  // 靜態路由: /health, /info, /stats
  if (!path.includes(':') && !path.includes('*') && path.split('/').filter(Boolean).length === 1) {
    return 'RoutePriority.STATIC';
  }

  // 通配符路由: /*
  if (path.includes('*')) {
    return 'RoutePriority.WILDCARD';
  }

  // 參數化路由: /:id, /:id/members
  if (path.includes(':')) {
    return 'RoutePriority.PARAMETERIZED';
  }

  // 具體路由: /members, /invitations
  return 'RoutePriority.SPECIFIC';
}

/**
 * 生成路由描述
 */
function generateDescription(route: RouteExtraction): string {
  const { method, path } = route;

  if (path === '/') return `${method} root handler`;
  if (path === '/health') return 'Health check';
  if (path === '/info') return 'Module information';
  if (path.includes(':id')) return `${method} ${path} - ID-based operation`;

  const segments = path.split('/').filter(Boolean);
  return `${method} ${segments[segments.length - 1] || 'root'}`;
}

/**
 * 創建備份文件
 */
function createBackup(filePath: string): string {
  const backupPath = filePath.replace(/\.ts$/, '.backup.ts');
  const content = readFileSync(filePath, 'utf-8');
  writeFileSync(backupPath, content);
  console.log(` Backup created: ${backupPath}`);
  return backupPath;
}

/**
 * 應用智能註冊器到文件
 */
function applySmartRegistry(filePath: string, dryRun: boolean = false): void {
  console.log(`\n Processing: ${filePath}`);

  if (!existsSync(filePath)) {
    console.log(` File not found, skipping...`);
    return;
  }

  // 提取路由
  const routes = extractRoutesFromFile(filePath);

  if (routes.length === 0) {
    console.log(` No routes found, skipping...`);
    return;
  }

  console.log(` Found ${routes.length} routes to convert`);

  // 確定變量名稱
  const varName = routes[0]?.varName || 'app';

  // 生成新代碼
  const newCode = generateSmartRegistryCode(routes, varName);

  if (dryRun) {
    console.log(` DRY RUN - Preview of generated code:`);
    console.log('  ' + '─'.repeat(80));
    console.log(newCode.split('\n').map(line => '  ' + line).join('\n'));
    console.log('  ' + '─'.repeat(80));
  } else {
    // 創建備份
    const backupPath = createBackup(filePath);

    // 讀取原文件
    const originalContent = readFileSync(filePath, 'utf-8');

    // 生成智能版本文件名
    const smartFilePath = filePath.replace(/\.ts$/, '-smart.ts');

    // 在文件開頭添加導入
    let newContent = originalContent;

    // 查找第一個路由定義的位置
    const firstRouteMatch = routes[0];
    if (firstRouteMatch) {
      // 在第一個路由定義之前插入智能註冊器代碼
      const lines = newContent.split('\n');
      const insertLine = firstRouteMatch.lineNumber - 1;

      // 插入注釋和智能註冊器代碼
      const smartComment = [
        '',
        '// ═'.repeat(40),
        '//  SMART ROUTE REGISTRY',
        '// 自動排序路由以避免衝突',
        '// ' + '═'.repeat(39),
        ''
      ];

      lines.splice(insertLine, 0, ...smartComment, newCode, '', '/* 原路由定義（已被智能註冊器替代）:');

      // 在文件末尾添加關閉註釋
      lines.push('*/', '');

      newContent = lines.join('\n');
    }

    // 寫入智能版本文件
    writeFileSync(smartFilePath, newContent);
    console.log(` Smart version created: ${smartFilePath}`);
    console.log(` Original backed up to: ${backupPath}`);
    console.log(` Next step: Review ${smartFilePath} and replace original if satisfied`);
  }
}

/**
 * 批量修復所有模組
 */
function batchFix(dryRun: boolean = false): void {
  console.log(' Batch Route Fix Script');
  console.log('═'.repeat(100));
  console.log('');

  if (dryRun) {
    console.log(' DRY RUN MODE - No files will be modified\n');
  }

  console.log(` Modules to fix: ${MODULES_TO_FIX.length}`);
  console.log(` Total conflicts: ${MODULES_TO_FIX.reduce((sum, m) => sum + m.conflicts, 0)}`);
  console.log('');

  let successCount = 0;
  let skipCount = 0;

  MODULES_TO_FIX.forEach((module, index) => {
    console.log(`[${index + 1}/${MODULES_TO_FIX.length}] ${module.name} (${module.conflicts} conflicts)`);

    try {
      applySmartRegistry(module.file, dryRun);
      successCount++;
    } catch (error) {
      console.log(` Error: ${error}`);
      skipCount++;
    }
  });

  console.log('');
  console.log('═'.repeat(100));
  console.log(' SUMMARY');
  console.log('─'.repeat(100));
  console.log(` Successfully processed: ${successCount}`);
  console.log(`  Skipped: ${skipCount}`);
  console.log('');

  if (!dryRun) {
    console.log(' Next Steps:');
    console.log('  1. Review each -smart.ts file');
    console.log('  2. Test the smart version');
    console.log('  3. If satisfied, replace original file:');
    console.log(' mv <file>-smart.ts <file>.ts');
    console.log('  4. Run: npm run check:routes');
    console.log('  5. Commit changes');
  }

  console.log('');
  console.log('═'.repeat(100));
}

// 執行批量修復
const dryRun = process.argv.includes('--dry-run');

try {
  batchFix(dryRun);
} catch (error) {
  console.error(' Fatal error:', error);
  process.exit(1);
}
