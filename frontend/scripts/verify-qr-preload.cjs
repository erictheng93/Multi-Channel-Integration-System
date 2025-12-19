#!/usr/bin/env node

/**
 * QR Background Preload 功能驗證腳本
 *
 * 用途：自動化驗證新功能的程式碼品質與配置
 *
 * 使用方式：
 *   node scripts/verify-qr-preload.js
 */

const fs = require('fs');
const path = require('path');

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, icon, message) {
  console.log(`${colors[color]}${icon} ${message}${colors.reset}`);
}

function success(message) {
  log('green', '✅', message);
}

function error(message) {
  log('red', '❌', message);
}

function info(message) {
  log('blue', 'ℹ️ ', message);
}

function warn(message) {
  log('yellow', '⚠️ ', message);
}

// 驗證項目
const checks = {
  filesExist: [],
  configValid: [],
  importsCorrect: [],
  errors: []
};

console.log(`\n${  '='.repeat(60)}`);
console.log('🧪 QR Background Preload 功能驗證');
console.log(`${'='.repeat(60)  }\n`);

// ==================== 檢查 1: 檔案存在性 ====================

info('檢查 1: 驗證新增檔案...');

const requiredFiles = [
  'src/services/qrPreloadService.ts',
  'src/config/features.ts',
  'docs/QR_BACKGROUND_PRELOAD.md'
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    success(`檔案存在: ${file}`);
    checks.filesExist.push(file);
  } else {
    error(`檔案不存在: ${file}`);
    checks.errors.push(`Missing file: ${file}`);
  }
});

console.log('');

// ==================== 檢查 2: 配置正確性 ====================

info('檢查 2: 驗證 Feature Flag 配置...');

try {
  const featuresPath = path.join(__dirname, '..', 'src/config/features.ts');
  const featuresContent = fs.readFileSync(featuresPath, 'utf-8');

  // 檢查必要的配置項
  const requiredConfigs = [
    'QR_BACKGROUND_PRELOAD',
    'enabled: true',
    'rolloutPercentage: 100',
    'maxConcurrent',
    'idleTimeout',
    'networkConditions'
  ];

  requiredConfigs.forEach(config => {
    if (featuresContent.includes(config)) {
      success(`配置項存在: ${config}`);
      checks.configValid.push(config);
    } else {
      error(`配置項缺失: ${config}`);
      checks.errors.push(`Missing config: ${config}`);
    }
  });
} catch (err) {
  error(`讀取 features.ts 失敗: ${err.message}`);
  checks.errors.push(err.message);
}

console.log('');

// ==================== 檢查 3: Import 正確性 ====================

info('檢查 3: 驗證 TeamManagement.vue 整合...');

try {
  const teamMgmtPath = path.join(__dirname, '..', 'src/views/TeamManagement.vue');
  const teamMgmtContent = fs.readFileSync(teamMgmtPath, 'utf-8');

  // 檢查必要的 imports
  const requiredImports = [
    'qrPreloadService',
    'isFeatureEnabled',
    'checkNetworkConditions',
    'getFeatureConfig',
    'onUnmounted'
  ];

  requiredImports.forEach(imp => {
    if (teamMgmtContent.includes(imp)) {
      success(`Import 正確: ${imp}`);
      checks.importsCorrect.push(imp);
    } else {
      error(`Import 缺失: ${imp}`);
      checks.errors.push(`Missing import: ${imp}`);
    }
  });

  // 檢查關鍵函數
  const requiredFunctions = [
    'startBackgroundQRPreload',
    'qrPreloadService.start',
    'qrPreloadService.stop'
  ];

  requiredFunctions.forEach(func => {
    if (teamMgmtContent.includes(func)) {
      success(`函數存在: ${func}`);
    } else {
      error(`函數缺失: ${func}`);
      checks.errors.push(`Missing function: ${func}`);
    }
  });
} catch (err) {
  error(`讀取 TeamManagement.vue 失敗: ${err.message}`);
  checks.errors.push(err.message);
}

console.log('');

// ==================== 檢查 4: 程式碼品質 ====================

info('檢查 4: 驗證程式碼品質...');

try {
  const servicePath = path.join(__dirname, '..', 'src/services/qrPreloadService.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');

  // 檢查關鍵類別和方法
  const requiredElements = [
    'export class QRPreloadService',
    'start(teams: Team[])',
    'stop()',
    'pause()',
    'resume()',
    'getMetrics()',
    'requestIdleCallback',
    'PreloadMetrics'
  ];

  requiredElements.forEach(element => {
    if (serviceContent.includes(element)) {
      success(`程式碼元素: ${element}`);
    } else {
      warn(`可選元素缺失: ${element}`);
    }
  });

  // 檢查文檔註解
  if (serviceContent.includes('/**') && serviceContent.includes('* @')) {
    success('包含文檔註解');
  } else {
    warn('缺少文檔註解');
  }
} catch (err) {
  error(`讀取 qrPreloadService.ts 失敗: ${err.message}`);
  checks.errors.push(err.message);
}

console.log('');

// ==================== 總結報告 ====================

console.log('='.repeat(60));
console.log('📊 驗證結果總結');
console.log(`${'='.repeat(60)  }\n`);

console.log(`${colors.cyan}檔案檢查:${colors.reset}`);
console.log(`  ✅ 通過: ${checks.filesExist.length}/${requiredFiles.length}`);

console.log(`\n${colors.cyan}配置檢查:${colors.reset}`);
console.log(`  ✅ 通過: ${checks.configValid.length}/6`);

console.log(`\n${colors.cyan}Import 檢查:${colors.reset}`);
console.log(`  ✅ 通過: ${checks.importsCorrect.length}/5`);

console.log(`\n${colors.cyan}錯誤統計:${colors.reset}`);
if (checks.errors.length === 0) {
  success('無錯誤！所有檢查通過 ✨');
} else {
  error(`發現 ${checks.errors.length} 個錯誤：`);
  checks.errors.forEach((err, i) => {
    console.log(`  ${i + 1}. ${err}`);
  });
}

console.log(`\n${  '='.repeat(60)}`);

// 退出碼
process.exit(checks.errors.length > 0 ? 1 : 0);
