#!/usr/bin/env tsx
// 路徑和路由配置檢查腳本

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(' 檢查路徑和路由配置...\n');

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string[];
}

const results: CheckResult[] = [];

// 檢查 TypeScript 配置
console.log('1. 檢查 TypeScript 路徑配置...');
try {
  const tsconfigPath = resolve(__dirname, 'tsconfig.json');
  const tsconfigContent = readFileSync(tsconfigPath, 'utf-8');
  const tsconfig = JSON.parse(tsconfigContent);

  const expectedPaths = [
    '@modules/*',
    '@shared/*',
    '@auth/*',
    '@conversations/*',
    '@teams/*'
  ];

  const actualPaths = Object.keys(tsconfig.compilerOptions?.paths || {});
  const missingPaths = expectedPaths.filter(path => !actualPaths.includes(path));

  if (missingPaths.length === 0) {
    results.push({
      name: 'TypeScript 路徑別名',
      status: 'pass',
      message: '所有路徑別名配置正確'
    });
  } else {
    results.push({
      name: 'TypeScript 路徑別名',
      status: 'warning',
      message: `缺少路徑別名: ${missingPaths.join(', ')}`,
      details: missingPaths
    });
  }
} catch (error) {
  results.push({
    name: 'TypeScript 配置',
    status: 'fail',
    message: '無法讀取 tsconfig.json'
  });
}

// 檢查模組結構
console.log('\n2. 檢查模組結構完整性...');
const moduleStructure = {
  'Authentication': {
    base: 'src/modules/auth',
    required: ['index.ts', 'handlers/index.ts', 'types/auth-types.ts']
  },
  'Conversations': {
    base: 'src/modules/conversations',
    required: ['index.ts', 'handlers/index.ts', 'types/conversation-types.ts']
  },
  'Teams': {
    base: 'src/modules/teams',
    required: ['handlers', 'services', 'types'] // 目錄檢查
  }
};

Object.entries(moduleStructure).forEach(([moduleName, config]) => {
  const moduleBase = resolve(__dirname, config.base);

  if (!existsSync(moduleBase)) {
    results.push({
      name: `${moduleName} 模組`,
      status: 'fail',
      message: `模組目錄不存在: ${config.base}`
    });
    return;
  }

  const missingFiles = config.required.filter(file => {
    const filePath = resolve(moduleBase, file);
    return !existsSync(filePath);
  });

  if (missingFiles.length === 0) {
    results.push({
      name: `${moduleName} 模組結構`,
      status: 'pass',
      message: '模組結構完整'
    });
  } else {
    results.push({
      name: `${moduleName} 模組結構`,
      status: moduleName === 'Teams' ? 'warning' : 'fail',
      message: `缺少檔案/目錄: ${missingFiles.join(', ')}`,
      details: missingFiles
    });
  }
});

// 檢查共享資源
console.log('\n3. 檢查共享資源...');
const sharedResources = [
  'src/shared/database/schema.ts',
  'src/shared/types/index.ts',
  'src/shared/utils/api-response.ts',
  'src/shared/utils/drizzle-converters.ts'
];

sharedResources.forEach(resource => {
  const resourcePath = resolve(__dirname, resource);
  if (existsSync(resourcePath)) {
    results.push({
      name: `共享資源: ${resource.split('/').pop()}`,
      status: 'pass',
      message: '檔案存在'
    });
  } else {
    results.push({
      name: `共享資源: ${resource.split('/').pop()}`,
      status: 'fail',
      message: `檔案缺失: ${resource}`
    });
  }
});

// 檢查主應用程式整合
console.log('\n4. 檢查主應用程式整合...');
try {
  const indexModularPath = resolve(__dirname, 'src/index-modular.ts');
  if (existsSync(indexModularPath)) {
    const content = readFileSync(indexModularPath, 'utf-8');

    const hasAuthImport = content.includes("from './modules/auth'");
    const hasConvImport = content.includes("from './modules/conversations'");
    const hasAuthRoute = content.includes("app.route('/api/auth'");
    const hasConvRoute = content.includes("app.route('/api/conversations'");

    if (hasAuthImport && hasConvImport && hasAuthRoute && hasConvRoute) {
      results.push({
        name: '主應用程式整合',
        status: 'pass',
        message: 'Auth 和 Conversations 模組已正確整合'
      });
    } else {
      results.push({
        name: '主應用程式整合',
        status: 'warning',
        message: '部分模組未正確整合',
        details: [
          hasAuthImport ? ' Auth 導入' : ' Auth 導入缺失',
          hasConvImport ? ' Conversations 導入' : ' Conversations 導入缺失',
          hasAuthRoute ? ' Auth 路由' : ' Auth 路由缺失',
          hasConvRoute ? ' Conversations 路由' : ' Conversations 路由缺失'
        ]
      });
    }
  } else {
    results.push({
      name: '主應用程式',
      status: 'fail',
      message: 'index-modular.ts 檔案不存在'
    });
  }
} catch (error) {
  results.push({
    name: '主應用程式檢查',
    status: 'fail',
    message: '無法檢查主應用程式檔案'
  });
}

// 輸出結果
console.log('\n 檢查結果摘要:');
console.log('='.repeat(60));

const passCount = results.filter(r => r.status === 'pass').length;
const warnCount = results.filter(r => r.status === 'warning').length;
const failCount = results.filter(r => r.status === 'fail').length;

console.log(` 通過: ${passCount} 項`);
console.log(`  警告: ${warnCount} 項`);
console.log(` 失敗: ${failCount} 項`);

console.log('\n 詳細結果:');
results.forEach(result => {
  const icon = result.status === 'pass' ? '' : result.status === 'warning' ? '' : '';
  console.log(`${icon} ${result.name}: ${result.message}`);

  if (result.details) {
    result.details.forEach(detail => {
      console.log(` - ${detail}`);
    });
  }
});

console.log('\n 需要修復的項目:');
const needsFixing = results.filter(r => r.status === 'fail' || r.status === 'warning');
if (needsFixing.length > 0) {
  needsFixing.forEach((item, index) => {
    console.log(`${index + 1}. ${item.name}: ${item.message}`);
  });
} else {
  console.log(' 所有配置都正確！');
}

console.log('\n' + '='.repeat(60));
console.log(`整體狀態: ${failCount === 0 ? (warnCount === 0 ? ' 優秀' : ' 良好') : ' 需要修復'}`);

export { results };