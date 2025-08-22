#!/usr/bin/env node

/**
 * 部署測試腳本
 * 專案名稱：Multi-Channel Support MVP
 * 檔案路徑：/scripts/deploy-test.ts
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface TestConfig {
  apiBaseUrl: string;
  testTimeout: number;
  retryAttempts: number;
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

interface DeploymentResult {
  success: boolean;
  environment: string;
  deploymentUrl?: string;
  tests: TestResult[];
  timestamp: string;
}

// 測試配置
const TEST_CONFIG: Record<string, TestConfig> = {
  development: {
    apiBaseUrl: 'http://localhost:8787',
    testTimeout: 30000,
    retryAttempts: 3
  },
  production: {
    apiBaseUrl: 'https://multi-channel.imfinethankyouandyou.com',
    testTimeout: 60000,
    retryAttempts: 5
  }
};

// 檢查部署先決條件
function checkPrerequisites(): boolean {
  console.log('🔍 檢查部署先決條件...');
  
  try {
    // 檢查 wrangler 是否已安裝
    execSync('wrangler --version', { stdio: 'pipe' });
    console.log('✅ Wrangler CLI 已安裝');
    
    // 檢查認證狀態
    execSync('wrangler whoami', { stdio: 'pipe' });
    console.log('✅ Cloudflare 認證正常');
    
    // 檢查必要檔案
    const requiredFiles = [
      'wrangler.toml',
      'src/index.ts',
      'package.json'
    ];
    
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        console.error(`❌ 缺少必要檔案: ${file}`);
        return false;
      }
    }
    console.log('✅ 必要檔案檢查通過');
    
    return true;
  } catch (error) {
    console.error('❌ 先決條件檢查失敗:', error);
    return false;
  }
}

// 構建前端
function buildFrontend(): boolean {
  console.log('🏗️  構建前端應用...');
  
  try {
    // 進入前端目錄並構建
    execSync('cd frontend && npm install && npm run build', { 
      stdio: 'inherit',
      timeout: 300000 // 5分鐘
    });
    console.log('✅ 前端構建完成');
    return true;
  } catch (error) {
    console.error('❌ 前端構建失敗:', error);
    return false;
  }
}

// 運行資料庫遷移
function runMigrations(environment: string): boolean {
  console.log(`🗄️  運行資料庫遷移 (${environment})...`);
  
  try {
    if (environment === 'production') {
      execSync('wrangler d1 migrations apply multi-channel-platform --env production', { 
        stdio: 'inherit' 
      });
    } else {
      execSync('wrangler d1 migrations apply multi-channel-platform --local', { 
        stdio: 'inherit' 
      });
    }
    console.log('✅ 資料庫遷移完成');
    return true;
  } catch (error) {
    console.error('❌ 資料庫遷移失敗:', error);
    return false;
  }
}

// 部署應用
function deployApplication(environment: string): { success: boolean; url?: string } {
  console.log(`🚀 部署應用到 ${environment} 環境...`);
  
  try {
    let deployCommand = 'wrangler deploy';
    if (environment === 'production') {
      deployCommand += ' --env production';
    }
    
    const deployOutput = execSync(deployCommand, { 
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 180000 // 3分鐘
    });
    
    console.log('✅ 應用部署完成');
    
    // 解析部署URL
    const urlMatch = deployOutput.match(/Published to (https:\/\/[^\s]+)/);
    const deploymentUrl = urlMatch ? urlMatch[1] : undefined;
    
    if (deploymentUrl) {
      console.log(`🌐 部署URL: ${deploymentUrl}`);
    }
    
    return { success: true, url: deploymentUrl };
  } catch (error) {
    console.error('❌ 應用部署失敗:', error);
    return { success: false };
  }
}

// 運行健康檢查
async function runHealthCheck(config: TestConfig): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log(`🏥 運行健康檢查: ${config.apiBaseUrl}`);
    
    const response = await fetch(`${config.apiBaseUrl}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const duration = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ 健康檢查通過:', data);
      return {
        name: 'Health Check',
        passed: true,
        duration
      };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ 健康檢查失敗:', error);
    return {
      name: 'Health Check',
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// 測試延遲訊息功能
async function testDelayedMessages(config: TestConfig): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('⏰ 測試延遲訊息功能...');
    
    // 模擬測試請求
    const testData = {
      conversationId: 'test-conversation',
      content: '測試延遲訊息',
      delaySeconds: 5,
      senderId: 'test-agent',
      recipientPlatformId: 'test-recipient',
      platform: 'line'
    };
    
    const response = await fetch(`${config.apiBaseUrl}/api/messages/delayed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify(testData)
    });
    
    const duration = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ 延遲訊息測試通過:', data);
      return {
        name: 'Delayed Messages',
        passed: true,
        duration
      };
    } else {
      const errorData = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorData}`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ 延遲訊息測試失敗:', error);
    return {
      name: 'Delayed Messages',
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// 測試檔案上傳功能
async function testFileUpload(config: TestConfig): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('📁 測試檔案上傳功能...');
    
    // 創建測試檔案
    const testFile = new Blob(['Test file content'], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', testFile, 'test.txt');
    formData.append('generateThumbnail', 'false');
    formData.append('compress', 'false');
    
    const response = await fetch(`${config.apiBaseUrl}/api/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token'
      },
      body: formData
    });
    
    const duration = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ 檔案上傳測試通過:', data);
      return {
        name: 'File Upload',
        passed: true,
        duration
      };
    } else {
      const errorData = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorData}`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ 檔案上傳測試失敗:', error);
    return {
      name: 'File Upload',
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// 運行所有測試
async function runTests(config: TestConfig): Promise<TestResult[]> {
  console.log('🧪 運行部署測試...');
  
  const tests = [
    runHealthCheck,
    testDelayedMessages,
    testFileUpload
  ];
  
  const results: TestResult[] = [];
  
  for (const test of tests) {
    try {
      const result = await test(config);
      results.push(result);
      
      // 如果是關鍵測試失敗，中斷後續測試
      if (!result.passed && result.name === 'Health Check') {
        console.log('⚠️  健康檢查失敗，跳過後續測試');
        break;
      }
    } catch (error) {
      console.error('測試執行錯誤:', error);
      results.push({
        name: 'Unknown Test',
        passed: false,
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

// 生成測試報告
function generateReport(result: DeploymentResult): void {
  console.log('\n📊 部署測試報告');
  console.log('='.repeat(50));
  console.log(`環境: ${result.environment}`);
  console.log(`時間: ${result.timestamp}`);
  console.log(`狀態: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
  
  if (result.deploymentUrl) {
    console.log(`URL: ${result.deploymentUrl}`);
  }
  
  console.log('\n測試結果:');
  
  for (const test of result.tests) {
    const status = test.passed ? '✅' : '❌';
    console.log(`  ${status} ${test.name} (${test.duration}ms)`);
    
    if (test.error) {
      console.log(`    錯誤: ${test.error}`);
    }
  }
  
  const passedTests = result.tests.filter(t => t.passed).length;
  const totalTests = result.tests.length;
  
  console.log(`\n總計: ${passedTests}/${totalTests} 測試通過`);
  
  // 寫入測試報告檔案
  const reportPath = path.join(__dirname, '..', 'deployment-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
  console.log(`\n📄 詳細報告已保存到: ${reportPath}`);
}

// 主部署函數
async function deployAndTest(environment: 'development' | 'production' = 'development'): Promise<DeploymentResult> {
  const startTime = Date.now();
  const config = TEST_CONFIG[environment];
  
  console.log(`🚀 開始部署測試流程 (${environment})...`);
  
  const result: DeploymentResult = {
    success: false,
    environment,
    tests: [],
    timestamp: new Date().toISOString()
  };
  
  try {
    // 1. 檢查先決條件
    if (!checkPrerequisites()) {
      throw new Error('先決條件檢查失敗');
    }
    
    // 2. 構建前端
    if (!buildFrontend()) {
      throw new Error('前端構建失敗');
    }
    
    // 3. 運行資料庫遷移
    if (!runMigrations(environment)) {
      throw new Error('資料庫遷移失敗');
    }
    
    // 4. 部署應用
    const deployResult = deployApplication(environment);
    if (!deployResult.success) {
      throw new Error('應用部署失敗');
    }
    
    result.deploymentUrl = deployResult.url;
    
    // 5. 等待部署生效
    console.log('⏳ 等待部署生效...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // 等待10秒
    
    // 6. 運行測試
    result.tests = await runTests(config);
    
    // 7. 檢查測試結果
    const failedTests = result.tests.filter(t => !t.passed);
    result.success = failedTests.length === 0;
    
    if (result.success) {
      console.log('🎉 部署測試全部通過！');
    } else {
      console.log(`⚠️  部署完成，但有 ${failedTests.length} 個測試失敗`);
    }
    
  } catch (error) {
    console.error('❌ 部署測試失敗:', error);
    result.success = false;
  }
  
  const totalDuration = Date.now() - startTime;
  console.log(`⏱️  總耗時: ${Math.round(totalDuration / 1000)}秒`);
  
  return result;
}

// 主函數
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const environment = args.includes('--prod') ? 'production' : 'development';
  
  if (args.includes('--help')) {
    console.log(`
使用方法:
  node deploy-test.ts [選項]

選項:
  --prod     部署到生產環境
  --help     顯示此幫助訊息

範例:
  node deploy-test.ts          # 部署到開發環境
  node deploy-test.ts --prod   # 部署到生產環境
    `);
    return;
  }
  
  const result = await deployAndTest(environment);
  generateReport(result);
  
  // 設定退出碼
  process.exit(result.success ? 0 : 1);
}

// 執行腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { deployAndTest };