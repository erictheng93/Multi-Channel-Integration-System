#!/usr/bin/env node

/**
 * ?¨ç½²æ¸¬è©¦?³æœ¬
 * å°ˆæ??ç¨±ï¼šMulti-Channel Support MVP
 * æª”æ?è·¯å?ï¼?scripts/deploy-test.ts
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

// æ¸¬è©¦?ç½®
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

// æª¢æŸ¥?¨ç½²?ˆæ±ºæ¢ä»¶
function checkPrerequisites(): boolean {
  console.log('?? æª¢æŸ¥?¨ç½²?ˆæ±ºæ¢ä»¶...');
  
  try {
    // æª¢æŸ¥ wrangler ?¯å¦å·²å?è£?
    execSync('wrangler --version', { stdio: 'pipe' });
    console.log('??Wrangler CLI å·²å?è£?);
    
    // æª¢æŸ¥èªè??€??
    execSync('wrangler whoami', { stdio: 'pipe' });
    console.log('??Cloudflare èªè?æ­?¸¸');
    
    // æª¢æŸ¥å¿…è?æª”æ?
    const requiredFiles = [
      'wrangler.toml',
      'src/index.ts',
      'package.json'
    ];
    
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        console.error(`??ç¼ºå?å¿…è?æª”æ?: ${file}`);
        return false;
      }
    }
    console.log('??å¿…è?æª”æ?æª¢æŸ¥?šé?');
    
    return true;
  } catch (error) {
    console.error('???ˆæ±ºæ¢ä»¶æª¢æŸ¥å¤±æ?:', error);
    return false;
  }
}

// æ§‹å»º?ç«¯
function buildFrontend(): boolean {
  console.log('??ï¸? æ§‹å»º?ç«¯?‰ç”¨...');
  
  try {
    // ?²å…¥?ç«¯?®é?ä¸¦æ?å»?
    execSync('cd frontend && npm install && npm run build', { 
      stdio: 'inherit',
      timeout: 300000 // 5?†é?
    });
    console.log('???ç«¯æ§‹å»ºå®Œæ?');
    return true;
  } catch (error) {
    console.error('???ç«¯æ§‹å»ºå¤±æ?:', error);
    return false;
  }
}

// ?‹è?è³‡æ?åº«é·ç§?
function runMigrations(environment: string): boolean {
  console.log(`??ï¸? ?‹è?è³‡æ?åº«é·ç§?(${environment})...`);
  
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
    console.log('??è³‡æ?åº«é·ç§»å???);
    return true;
  } catch (error) {
    console.error('??è³‡æ?åº«é·ç§»å¤±??', error);
    return false;
  }
}

// ?¨ç½²?‰ç”¨
function deployApplication(environment: string): { success: boolean; url?: string } {
  console.log(`?? ?¨ç½²?‰ç”¨??${environment} ?°å?...`);
  
  try {
    let deployCommand = 'wrangler deploy';
    if (environment === 'production') {
      deployCommand += ' --env production';
    }
    
    const deployOutput = execSync(deployCommand, { 
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 180000 // 3?†é?
    });
    
    console.log('???‰ç”¨?¨ç½²å®Œæ?');
    
    // è§???¨ç½²URL
    const urlMatch = deployOutput.match(/Published to (https:\/\/[^\s]+)/);
    const deploymentUrl = urlMatch ? urlMatch[1] : undefined;
    
    if (deploymentUrl) {
      console.log(`?? ?¨ç½²URL: ${deploymentUrl}`);
    }
    
    return { success: true, url: deploymentUrl };
  } catch (error) {
    console.error('???‰ç”¨?¨ç½²å¤±æ?:', error);
    return { success: false };
  }
}

// ?‹è??¥åº·æª¢æŸ¥
async function runHealthCheck(config: TestConfig): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log(`?¥ ?‹è??¥åº·æª¢æŸ¥: ${config.apiBaseUrl}`);
    
    const response = await fetch(`${config.apiBaseUrl}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const duration = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      console.log('???¥åº·æª¢æŸ¥?šé?:', data);
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
    console.error('???¥åº·æª¢æŸ¥å¤±æ?:', error);
    return {
      name: 'Health Check',
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// æ¸¬è©¦å»¶é²è¨Šæ¯?Ÿèƒ½
async function testDelayedMessages(config: TestConfig): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('??æ¸¬è©¦å»¶é²è¨Šæ¯?Ÿèƒ½...');
    
    // æ¨¡æ“¬æ¸¬è©¦è«‹æ?
    const testData = {
      conversationId: 'test-conversation',
      content: 'æ¸¬è©¦å»¶é²è¨Šæ¯',
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
      console.log('??å»¶é²è¨Šæ¯æ¸¬è©¦?šé?:', data);
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
    console.error('??å»¶é²è¨Šæ¯æ¸¬è©¦å¤±æ?:', error);
    return {
      name: 'Delayed Messages',
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// æ¸¬è©¦æª”æ?ä¸Šå‚³?Ÿèƒ½
async function testFileUpload(config: TestConfig): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('?? æ¸¬è©¦æª”æ?ä¸Šå‚³?Ÿèƒ½...');
    
    // ?µå»ºæ¸¬è©¦æª”æ?
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
      console.log('??æª”æ?ä¸Šå‚³æ¸¬è©¦?šé?:', data);
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
    console.error('??æª”æ?ä¸Šå‚³æ¸¬è©¦å¤±æ?:', error);
    return {
      name: 'File Upload',
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ?‹è??€?‰æ¸¬è©?
async function runTests(config: TestConfig): Promise<TestResult[]> {
  console.log('?§ª ?‹è??¨ç½²æ¸¬è©¦...');
  
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
      
      // å¦‚æ??¯é??µæ¸¬è©¦å¤±?—ï?ä¸­æ–·å¾Œç?æ¸¬è©¦
      if (!result.passed && result.name === 'Health Check') {
        console.log('? ï?  ?¥åº·æª¢æŸ¥å¤±æ?ï¼Œè·³?å?çºŒæ¸¬è©?);
        break;
      }
    } catch (error) {
      console.error('æ¸¬è©¦?·è??¯èª¤:', error);
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

// ?Ÿæ?æ¸¬è©¦?±å?
function generateReport(result: DeploymentResult): void {
  console.log('\n?? ?¨ç½²æ¸¬è©¦?±å?');
  console.log('='.repeat(50));
  console.log(`?°å?: ${result.environment}`);
  console.log(`?‚é?: ${result.timestamp}`);
  console.log(`?€?? ${result.success ? '???å?' : '??å¤±æ?'}`);
  
  if (result.deploymentUrl) {
    console.log(`URL: ${result.deploymentUrl}`);
  }
  
  console.log('\næ¸¬è©¦çµæ?:');
  
  for (const test of result.tests) {
    const status = test.passed ? '?? : '??;
    console.log(`  ${status} ${test.name} (${test.duration}ms)`);
    
    if (test.error) {
      console.log(`    ?¯èª¤: ${test.error}`);
    }
  }
  
  const passedTests = result.tests.filter(t => t.passed).length;
  const totalTests = result.tests.length;
  
  console.log(`\nç¸½è?: ${passedTests}/${totalTests} æ¸¬è©¦?šé?`);
  
  // å¯«å…¥æ¸¬è©¦?±å?æª”æ?
  const reportPath = path.join(__dirname, '..', 'deployment-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
  console.log(`\n?? è©³ç´°?±å?å·²ä?å­˜åˆ°: ${reportPath}`);
}

// ä¸»éƒ¨ç½²å‡½??
async function deployAndTest(environment: 'development' | 'production' = 'development'): Promise<DeploymentResult> {
  const startTime = Date.now();
  const config = TEST_CONFIG[environment];
  
  console.log(`?? ?‹å??¨ç½²æ¸¬è©¦æµç? (${environment})...`);
  
  const result: DeploymentResult = {
    success: false,
    environment,
    tests: [],
    timestamp: new Date().toISOString()
  };
  
  try {
    // 1. æª¢æŸ¥?ˆæ±ºæ¢ä»¶
    if (!checkPrerequisites()) {
      throw new Error('?ˆæ±ºæ¢ä»¶æª¢æŸ¥å¤±æ?');
    }
    
    // 2. æ§‹å»º?ç«¯
    if (!buildFrontend()) {
      throw new Error('?ç«¯æ§‹å»ºå¤±æ?');
    }
    
    // 3. ?‹è?è³‡æ?åº«é·ç§?
    if (!runMigrations(environment)) {
      throw new Error('è³‡æ?åº«é·ç§»å¤±??);
    }
    
    // 4. ?¨ç½²?‰ç”¨
    const deployResult = deployApplication(environment);
    if (!deployResult.success) {
      throw new Error('?‰ç”¨?¨ç½²å¤±æ?');
    }
    
    result.deploymentUrl = deployResult.url;
    
    // 5. ç­‰å??¨ç½²?Ÿæ?
    console.log('??ç­‰å??¨ç½²?Ÿæ?...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // ç­‰å?10ç§?
    
    // 6. ?‹è?æ¸¬è©¦
    result.tests = await runTests(config);
    
    // 7. æª¢æŸ¥æ¸¬è©¦çµæ?
    const failedTests = result.tests.filter(t => !t.passed);
    result.success = failedTests.length === 0;
    
    if (result.success) {
      console.log('?? ?¨ç½²æ¸¬è©¦?¨éƒ¨?šé?ï¼?);
    } else {
      console.log(`? ï?  ?¨ç½²å®Œæ?ï¼Œä???${failedTests.length} ?‹æ¸¬è©¦å¤±?—`);
    }
    
  } catch (error) {
    console.error('???¨ç½²æ¸¬è©¦å¤±æ?:', error);
    result.success = false;
  }
  
  const totalDuration = Date.now() - startTime;
  console.log(`?±ï?  ç¸½è€—æ?: ${Math.round(totalDuration / 1000)}ç§’`);
  
  return result;
}

// ä¸»å‡½??
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const environment = args.includes('--prod') ? 'production' : 'development';
  
  if (args.includes('--help')) {
    console.log(`
ä½¿ç”¨?¹æ?:
  node deploy-test.ts [?¸é?]

?¸é?:
  --prod     ?¨ç½²?°ç??¢ç’°å¢?
  --help     é¡¯ç¤ºæ­¤å¹«?©è???

ç¯„ä?:
  node deploy-test.ts          # ?¨ç½²?°é??¼ç’°å¢?
  node deploy-test.ts --prod   # ?¨ç½²?°ç??¢ç’°å¢?
    `);
    return;
  }
  
  const result = await deployAndTest(environment);
  generateReport(result);
  
  // è¨­å??€?ºç¢¼
  process.exit(result.success ? 0 : 1);
}

// ?·è??³æœ¬
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { deployAndTest };