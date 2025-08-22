/**
 * R2 自定義域名驗證腳本
 * 驗證 R2 bucket 的自定義域名配置是否正常工作
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
    bucketName: 'multi-channel-platform-attachments-develop',
    customDomain: 's3dev.imfinethankyouandyou.com',
    expectedUrl: 'https://s3dev.imfinethankyouandyou.com'
  },
  {
    environment: 'production',
    bucketName: 'multi-channel-platform-attachments-production',
    customDomain: 's3.imfinethankyouandyou.com',
    expectedUrl: 'https://s3.imfinethankyouandyou.com'
  }
];

// 顏色輸出函數
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

// 檢查 Cloudflare CLI 認證
function checkCloudflareAuth(): boolean {
  try {
    execSync('wrangler whoami', { stdio: 'pipe' });
    log('✅ Cloudflare 認證已設定', 'green');
    return true;
  } catch (error) {
    log('❌ Cloudflare 認證未設定，請先執行: wrangler login', 'red');
    return false;
  }
}

// 檢查 R2 bucket 是否存在
function checkR2Bucket(bucketName: string): boolean {
  try {
    const output = execSync(`wrangler r2 bucket list`, { encoding: 'utf8' });
    const bucketExists = output.includes(bucketName);

    if (bucketExists) {
      log(`✅ R2 Bucket ${bucketName} 存在`, 'green');
      return true;
    } else {
      log(`❌ R2 Bucket ${bucketName} 不存在`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ 檢查 R2 Bucket 失敗: ${error}`, 'red');
    return false;
  }
}

// 測試自定義域名解析
async function testDomainResolution(domain: string): Promise<boolean> {
  try {
    log(`🔍 測試域名解析: ${domain}`, 'blue');

    // 使用 fetch 測試域名是否可達
    const testUrl = `https://${domain}`;
    const response = await fetch(testUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000) // 10秒超時
    });

    if (response.ok || response.status === 404) {
      // 404 是正常的，因為我們只是測試域名解析
      log(`✅ 域名 ${domain} 解析正常`, 'green');
      return true;
    } else {
      log(`⚠️  域名 ${domain} 回應狀態: ${response.status}`, 'yellow');
      return true; // 非 404 狀態也可能是正常的
    }
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      log(`❌ 域名 ${domain} 解析超時`, 'red');
    } else {
      log(`❌ 域名 ${domain} 解析失敗: ${error.message}`, 'red');
    }
    return false;
  }
}

// 上傳測試檔案
function uploadTestFile(bucketName: string): string | null {
  try {
    const testContent = `R2 域名測試檔案 - ${new Date().toISOString()}`;
    const testFileName = `test-${Date.now()}.txt`;
    const testFilePath = `/tmp/${testFileName}`;

    // 創建測試檔案
    require('fs').writeFileSync(testFilePath, testContent);

    // 上傳到 R2
    execSync(`wrangler r2 object put ${bucketName}/test/${testFileName} --file ${testFilePath}`, {
      stdio: 'pipe'
    });

    // 清理本地檔案
    require('fs').unlinkSync(testFilePath);

    log(`✅ 測試檔案上傳成功: test/${testFileName}`, 'green');
    return `test/${testFileName}`;
  } catch (error) {
    log(`❌ 測試檔案上傳失敗: ${error}`, 'red');
    return null;
  }
}

// 測試檔案存取
async function testFileAccess(customDomain: string, filePath: string): Promise<boolean> {
  try {
    const fileUrl = `https://${customDomain}/${filePath}`;
    log(`🔍 測試檔案存取: ${fileUrl}`, 'blue');

    const response = await fetch(fileUrl, {
      signal: AbortSignal.timeout(10000)
    });

    if (response.ok) {
      const content = await response.text();
      if (content.includes('R2 域名測試檔案')) {
        log(`✅ 檔案存取成功`, 'green');
        return true;
      } else {
        log(`❌ 檔案內容不正確`, 'red');
        return false;
      }
    } else {
      log(`❌ 檔案存取失敗: ${response.status} ${response.statusText}`, 'red');
      return false;
    }
  } catch (error: any) {
    log(`❌ 檔案存取測試失敗: ${error.message}`, 'red');
    return false;
  }
}

// 清理測試檔案
function cleanupTestFile(bucketName: string, filePath: string): void {
  try {
    execSync(`wrangler r2 object delete ${bucketName}/${filePath}`, { stdio: 'pipe' });
    log(`✅ 測試檔案已清理: ${filePath}`, 'green');
  } catch (error) {
    log(`⚠️  清理測試檔案失敗: ${error}`, 'yellow');
  }
}

// 驗證單個 R2 配置
async function verifyR2Config(config: R2DomainConfig): Promise<boolean> {
  log(`\n🔧 驗證 ${config.environment} 環境配置`, 'magenta');
  log(`   Bucket: ${config.bucketName}`, 'cyan');
  log(`   Domain: ${config.customDomain}`, 'cyan');

  let success = true;

  // 1. 檢查 bucket 存在
  if (!checkR2Bucket(config.bucketName)) {
    success = false;
  }

  // 2. 測試域名解析
  if (!await testDomainResolution(config.customDomain)) {
    success = false;
  }

  // 3. 上傳測試檔案
  const testFilePath = uploadTestFile(config.bucketName);
  if (!testFilePath) {
    success = false;
  } else {
    // 4. 測試檔案存取
    if (!await testFileAccess(config.customDomain, testFilePath)) {
      success = false;
    }

    // 5. 清理測試檔案
    cleanupTestFile(config.bucketName, testFilePath);
  }

  if (success) {
    log(`✅ ${config.environment} 環境配置驗證通過`, 'green');
  } else {
    log(`❌ ${config.environment} 環境配置驗證失敗`, 'red');
  }

  return success;
}

// 主驗證函數
async function main(): Promise<void> {
  log('🚀 開始驗證 R2 自定義域名配置', 'cyan');

  // 檢查 Cloudflare 認證
  if (!checkCloudflareAuth()) {
    process.exit(1);
  }

  let allSuccess = true;

  // 驗證所有配置
  for (const config of R2_CONFIGS) {
    const success = await verifyR2Config(config);
    if (!success) {
      allSuccess = false;
    }
  }

  // 總結
  log('\n📊 驗證結果總結', 'magenta');
  if (allSuccess) {
    log('✅ 所有 R2 自定義域名配置驗證通過', 'green');
    log('\n🎉 您的 R2 存儲已準備就緒！', 'green');
  } else {
    log('❌ 部分 R2 配置驗證失敗', 'red');
    log('\n🔧 請檢查以下項目:', 'yellow');
    log('   1. Cloudflare R2 bucket 是否已創建', 'yellow');
    log('   2. 自定義域名 DNS 設定是否正確', 'yellow');
    log('   3. 域名是否已綁定到對應的 R2 bucket', 'yellow');
    process.exit(1);
  }
}

// 執行腳本
if (require.main === module) {
  main().catch(console.error);
}

export { verifyR2Config };