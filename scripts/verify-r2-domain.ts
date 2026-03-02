/**
 * R2 ?��?義�??��?證腳??
 * 驗�? R2 bucket ?�自定義?��??�置?�否�?��工�?
 */

import { execSync } from 'child_process';

interface R2DomainConfig {
  environment: 'development' | 'production';
  bucketName: string;
  customDomain: string;
  expectedUrl: string;
}

const R2_CONFIGS: R2DomainConfig[] = [
  {
    environment: 'development',
    bucketName: 'mcis-files',
    customDomain: 's3-dev.example.com',
    expectedUrl: 'https://s3-dev.example.com'
  },
  {
    environment: 'production',
    bucketName: 'mcis-files',
    customDomain: 'your-storage-domain.example.com',
    expectedUrl: 'https://your-storage-domain.example.com'
  }
];

// 顏色輸出?�數
const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`
};

function log(message: string, color: keyof typeof colors = 'cyan'): void {
  console.log(colors[color](message));
}

// 檢查 Cloudflare CLI 認�?
function checkCloudflareAuth(): boolean {
  try {
    execSync('wrangler whoami', { stdio: 'pipe' });
    log('??Cloudflare 認�?已設�?, 'green');
    return true;
  } catch (error) {
    log('??Cloudflare 認�??�設定�?請�??��?: wrangler login', 'red');
    return false;
  }
}

// 檢查 R2 bucket ?�否存在
function checkR2Bucket(bucketName: string): boolean {
  try {
    const output = execSync(`wrangler r2 bucket list`, { encoding: 'utf8' });
    const bucketExists = output.includes(bucketName);

    if (bucketExists) {
      log(`??R2 Bucket ${bucketName} 存在`, 'green');
      return true;
    } else {
      log(`??R2 Bucket ${bucketName} 不�??�`, 'red');
      return false;
    }
  } catch (error) {
    log(`??檢查 R2 Bucket 失�?: ${error}`, 'red');
    return false;
  }
}

// 測試?��?義�??�解??
async function testDomainResolution(domain: string): Promise<boolean> {
  try {
    log(`?? 測試?��?�??: ${domain}`, 'blue');

    // 使用 fetch 測試?��??�否?��?
    const testUrl = `https://${domain}`;
    const response = await fetch(testUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000) // 10秒�???
    });

    if (response.ok || response.status === 404) {
      // 404 ?�正常�?，�??��??�只?�測試�??�解??
      log(`???��? ${domain} �??�?��`, 'green');
      return true;
    } else {
      log(`?��?  ?��? ${domain} ?��??�?? ${response.status}`, 'yellow');
      return true; // ??404 ?�?��??�能?�正常�?
    }
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      log(`???��? ${domain} �??超�?`, 'red');
    } else {
      log(`???��? ${domain} �??失�?: ${error.message}`, 'red');
    }
    return false;
  }
}

// 上傳測試檔�?
function uploadTestFile(bucketName: string): string | null {
  try {
    const testContent = `R2 ?��?測試檔�? - ${new Date().toISOString()}`;
    const testFileName = `test-${Date.now()}.txt`;
    const testFilePath = `/tmp/${testFileName}`;

    // ?�建測試檔�?
    require('fs').writeFileSync(testFilePath, testContent);

    // 上傳??R2
    execSync(`wrangler r2 object put ${bucketName}/test/${testFileName} --file ${testFilePath}`, {
      stdio: 'pipe'
    });

    // 清�??�地檔�?
    require('fs').unlinkSync(testFilePath);

    log(`??測試檔�?上傳?��?: test/${testFileName}`, 'green');
    return `test/${testFileName}`;
  } catch (error) {
    log(`??測試檔�?上傳失�?: ${error}`, 'red');
    return null;
  }
}

// 測試檔�?存�?
async function testFileAccess(customDomain: string, filePath: string): Promise<boolean> {
  try {
    const fileUrl = `https://${customDomain}/${filePath}`;
    log(`?? 測試檔�?存�?: ${fileUrl}`, 'blue');

    const response = await fetch(fileUrl, {
      signal: AbortSignal.timeout(10000)
    });

    if (response.ok) {
      const content = await response.text();
      if (content.includes('R2 ?��?測試檔�?')) {
        log(`??檔�?存�??��?`, 'green');
        return true;
      } else {
        log(`??檔�??�容不正確`, 'red');
        return false;
      }
    } else {
      log(`??檔�?存�?失�?: ${response.status} ${response.statusText}`, 'red');
      return false;
    }
  } catch (error: any) {
    log(`??檔�?存�?測試失�?: ${error.message}`, 'red');
    return false;
  }
}

// 清�?測試檔�?
function cleanupTestFile(bucketName: string, filePath: string): void {
  try {
    execSync(`wrangler r2 object delete ${bucketName}/${filePath}`, { stdio: 'pipe' });
    log(`??測試檔�?已�??? ${filePath}`, 'green');
  } catch (error) {
    log(`?��?  清�?測試檔�?失�?: ${error}`, 'yellow');
  }
}

// 驗�??��?R2 ?�置
async function verifyR2Config(config: R2DomainConfig): Promise<boolean> {
  log(`\n?�� 驗�? ${config.environment} ?��??�置`, 'magenta');
  log(`   Bucket: ${config.bucketName}`, 'cyan');
  log(`   Domain: ${config.customDomain}`, 'cyan');

  let success = true;

  // 1. 檢查 bucket 存在
  if (!checkR2Bucket(config.bucketName)) {
    success = false;
  }

  // 2. 測試?��?�??
  if (!await testDomainResolution(config.customDomain)) {
    success = false;
  }

  // 3. 上傳測試檔�?
  const testFilePath = uploadTestFile(config.bucketName);
  if (!testFilePath) {
    success = false;
  } else {
    // 4. 測試檔�?存�?
    if (!await testFileAccess(config.customDomain, testFilePath)) {
      success = false;
    }

    // 5. 清�?測試檔�?
    cleanupTestFile(config.bucketName, testFilePath);
  }

  if (success) {
    log(`??${config.environment} ?��??�置驗�??��?`, 'green');
  } else {
    log(`??${config.environment} ?��??�置驗�?失�?`, 'red');
  }

  return success;
}

// 主�?證函??
async function main(): Promise<void> {
  log('?? ?��?驗�? R2 ?��?義�??��?�?, 'cyan');

  // 檢查 Cloudflare 認�?
  if (!checkCloudflareAuth()) {
    process.exit(1);
  }

  let allSuccess = true;

  // 驗�??�?��?�?
  for (const config of R2_CONFIGS) {
    const success = await verifyR2Config(config);
    if (!success) {
      allSuccess = false;
    }
  }

  // 總�?
  log('\n?? 驗�?結�?總�?', 'magenta');
  if (allSuccess) {
    log('???�??R2 ?��?義�??��?置�?證通�?', 'green');
    log('\n?? ?��? R2 存儲已�??�就緒�?', 'green');
  } else {
    log('???��? R2 ?�置驗�?失�?', 'red');
    log('\n?�� 請檢?�以下�???', 'yellow');
    log('   1. Cloudflare R2 bucket ?�否已創�?, 'yellow');
    log('   2. ?��?義�???DNS 設�??�否�?��', 'yellow');
    log('   3. ?��??�否已�?定到對�???R2 bucket', 'yellow');
    process.exit(1);
  }
}

// ?��??�本
if (require.main === module) {
  main().catch(console.error);
}

export { verifyR2Config };