#!/usr/bin/env node

/**
 * ?�署測試?�本
 * 專�??�稱：Multi-Channel Support MVP
 * 檔�?路�?�?scripts/deploy-test.ts
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

// 測試?�置
const TEST_CONFIG: Record<string, TestConfig> = {
  development: {
    apiBaseUrl: 'http://localhost:8787',
    testTimeout: 30000,
    retryAttempts: 3
  },
  production: {
    apiBaseUrl: 'https://your-api-domain.example.com',
    testTimeout: 60000,
    retryAttempts: 5
  }
};

// 檢查?�署?�決條件
function checkPrerequisites(): boolean {
  console.log('?? 檢查?�署?�決條件...');
  
  try {
    // 檢查 wrangler ?�否已�?�?
    execSync('wrangler --version', { stdio: 'pipe' });
    console.log('??Wrangler CLI 已�?�?);
    
    // 檢查認�??�??
    execSync('wrangler whoami', { stdio: 'pipe' });
    console.log('??Cloudflare 認�?�?��');
    
    // 檢查必�?檔�?
    const requiredFiles = [
      'wrangler.toml',
      'src/index.ts',
      'package.json'
    ];
    
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        console.error(`??缺�?必�?檔�?: ${file}`);
        return false;
      }
    }
    console.log('??必�?檔�?檢查?��?');
    
    return true;
  } catch (error) {
    console.error('???�決條件檢查失�?:', error);
    return false;
  }
}

// 構建?�端
function buildFrontend(): boolean {
  console.log('??�? 構建?�端?�用...');
  
  try {
    // ?�入?�端?��?並�?�?
    execSync('cd frontend && npm install && npm run build', { 
      stdio: 'inherit',
      timeout: 300000 // 5?��?
    });
    console.log('???�端構建完�?');
    return true;
  } catch (error) {
    console.error('???�端構建失�?:', error);
    return false;
  }
}

// ?��?資�?庫遷�?
function runMigrations(environment: string): boolean {
  console.log(`??�? ?��?資�?庫遷�?(${environment})...`);
  
  try {
    if (environment === 'production') {
      execSync('wrangler d1 migrations apply mcis-db --env production', { 
        stdio: 'inherit' 
      });
    } else {
      execSync('wrangler d1 migrations apply mcis-db --local', { 
        stdio: 'inherit' 
      });
    }
    console.log('??資�?庫遷移�???);
    return true;
  } catch (error) {
    console.error('??資�?庫遷移失??', error);
    return false;
  }
}

// ?�署?�用
function deployApplication(environment: string): { success: boolean; url?: string } {
  console.log(`?? ?�署?�用??${environment} ?��?...`);
  
  try {
    let deployCommand = 'wrangler deploy';
    if (environment === 'production') {
      deployCommand += ' --env production';
    }
    
    const deployOutput = execSync(deployCommand, { 
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 180000 // 3?��?
    });
    
    console.log('???�用?�署完�?');
    
    // �???�署URL
    const urlMatch = deployOutput.match(/Published to (https:\/\/[^\s]+)/);
    const deploymentUrl = urlMatch ? urlMatch[1] : undefined;
    
    if (deploymentUrl) {
      console.log(`?? ?�署URL: ${deploymentUrl}`);
    }
    
    return { success: true, url: deploymentUrl };
  } catch (error) {
    console.error('???�用?�署失�?:', error);
    return { success: false };
  }
}

// ?��??�康檢查
async function runHealthCheck(config: TestConfig): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log(`?�� ?��??�康檢查: ${config.apiBaseUrl}`);
    
    const response = await fetch(`${config.apiBaseUrl}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const duration = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      console.log('???�康檢查?��?:', data);
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
    console.error('???�康檢查失�?:', error);
    return {
      name: 'Health Check',
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// 測試延遲訊息?�能
async function testDelayedMessages(config: TestConfig): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('??測試延遲訊息?�能...');
    
    // 模擬測試請�?
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
      console.log('??延遲訊息測試?��?:', data);
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
    console.error('??延遲訊息測試失�?:', error);
    return {
      name: 'Delayed Messages',
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// 測試檔�?上傳?�能
async function testFileUpload(config: TestConfig): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('?? 測試檔�?上傳?�能...');
    
    // ?�建測試檔�?
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
      console.log('??檔�?上傳測試?��?:', data);
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
    console.error('??檔�?上傳測試失�?:', error);
    return {
      name: 'File Upload',
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ?��??�?�測�?
async function runTests(config: TestConfig): Promise<TestResult[]> {
  console.log('?�� ?��??�署測試...');
  
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
      
      // 如�??��??�測試失?��?中斷後�?測試
      if (!result.passed && result.name === 'Health Check') {
        console.log('?��?  ?�康檢查失�?，跳?��?續測�?);
        break;
      }
    } catch (error) {
      console.error('測試?��??�誤:', error);
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

// ?��?測試?��?
function generateReport(result: DeploymentResult): void {
  console.log('\n?? ?�署測試?��?');
  console.log('='.repeat(50));
  console.log(`?��?: ${result.environment}`);
  console.log(`?��?: ${result.timestamp}`);
  console.log(`?�?? ${result.success ? '???��?' : '??失�?'}`);
  
  if (result.deploymentUrl) {
    console.log(`URL: ${result.deploymentUrl}`);
  }
  
  console.log('\n測試結�?:');
  
  for (const test of result.tests) {
    const status = test.passed ? '?? : '??;
    console.log(`  ${status} ${test.name} (${test.duration}ms)`);
    
    if (test.error) {
      console.log(`    ?�誤: ${test.error}`);
    }
  }
  
  const passedTests = result.tests.filter(t => t.passed).length;
  const totalTests = result.tests.length;
  
  console.log(`\n總�?: ${passedTests}/${totalTests} 測試?��?`);
  
  // 寫入測試?��?檔�?
  const reportPath = path.join(__dirname, '..', 'deployment-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
  console.log(`\n?? 詳細?��?已�?存到: ${reportPath}`);
}

// 主部署函??
async function deployAndTest(environment: 'development' | 'production' = 'development'): Promise<DeploymentResult> {
  const startTime = Date.now();
  const config = TEST_CONFIG[environment];
  
  console.log(`?? ?��??�署測試流�? (${environment})...`);
  
  const result: DeploymentResult = {
    success: false,
    environment,
    tests: [],
    timestamp: new Date().toISOString()
  };
  
  try {
    // 1. 檢查?�決條件
    if (!checkPrerequisites()) {
      throw new Error('?�決條件檢查失�?');
    }
    
    // 2. 構建?�端
    if (!buildFrontend()) {
      throw new Error('?�端構建失�?');
    }
    
    // 3. ?��?資�?庫遷�?
    if (!runMigrations(environment)) {
      throw new Error('資�?庫遷移失??);
    }
    
    // 4. ?�署?�用
    const deployResult = deployApplication(environment);
    if (!deployResult.success) {
      throw new Error('?�用?�署失�?');
    }
    
    result.deploymentUrl = deployResult.url;
    
    // 5. 等�??�署?��?
    console.log('??等�??�署?��?...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // 等�?10�?
    
    // 6. ?��?測試
    result.tests = await runTests(config);
    
    // 7. 檢查測試結�?
    const failedTests = result.tests.filter(t => !t.passed);
    result.success = failedTests.length === 0;
    
    if (result.success) {
      console.log('?? ?�署測試?�部?��?�?);
    } else {
      console.log(`?��?  ?�署完�?，�???${failedTests.length} ?�測試失?�`);
    }
    
  } catch (error) {
    console.error('???�署測試失�?:', error);
    result.success = false;
  }
  
  const totalDuration = Date.now() - startTime;
  console.log(`?��?  總耗�?: ${Math.round(totalDuration / 1000)}秒`);
  
  return result;
}

// 主函??
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const environment = args.includes('--prod') ? 'production' : 'development';
  
  if (args.includes('--help')) {
    console.log(`
使用?��?:
  node deploy-test.ts [?��?]

?��?:
  --prod     ?�署?��??�環�?
  --help     顯示此幫?��???

範�?:
  node deploy-test.ts          # ?�署?��??�環�?
  node deploy-test.ts --prod   # ?�署?��??�環�?
    `);
    return;
  }
  
  const result = await deployAndTest(environment);
  generateReport(result);
  
  // 設�??�?�碼
  process.exit(result.success ? 0 : 1);
}

// ?��??�本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { deployAndTest };