/**
 * R2 ?ªå?ç¾©å??é?è­‰è…³??
 * é©—è? R2 bucket ?„è‡ªå®šç¾©?Ÿå??ç½®?¯å¦æ­?¸¸å·¥ä?
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
    bucketName: 'multi-channel-platform-attachments-dev',
    customDomain: 's3-dev.example.com',
    expectedUrl: 'https://s3-dev.example.com'
  },
  {
    environment: 'production',
    bucketName: 'multi-channel-platform-attachments',
    customDomain: 'your-storage-domain.example.com',
    expectedUrl: 'https://your-storage-domain.example.com'
  }
];

// é¡è‰²è¼¸å‡º?½æ•¸
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

// æª¢æŸ¥ Cloudflare CLI èªè?
function checkCloudflareAuth(): boolean {
  try {
    execSync('wrangler whoami', { stdio: 'pipe' });
    log('??Cloudflare èªè?å·²è¨­å®?, 'green');
    return true;
  } catch (error) {
    log('??Cloudflare èªè??ªè¨­å®šï?è«‹å??·è?: wrangler login', 'red');
    return false;
  }
}

// æª¢æŸ¥ R2 bucket ?¯å¦å­˜åœ¨
function checkR2Bucket(bucketName: string): boolean {
  try {
    const output = execSync(`wrangler r2 bucket list`, { encoding: 'utf8' });
    const bucketExists = output.includes(bucketName);

    if (bucketExists) {
      log(`??R2 Bucket ${bucketName} å­˜åœ¨`, 'green');
      return true;
    } else {
      log(`??R2 Bucket ${bucketName} ä¸å??¨`, 'red');
      return false;
    }
  } catch (error) {
    log(`??æª¢æŸ¥ R2 Bucket å¤±æ?: ${error}`, 'red');
    return false;
  }
}

// æ¸¬è©¦?ªå?ç¾©å??è§£??
async function testDomainResolution(domain: string): Promise<boolean> {
  try {
    log(`?? æ¸¬è©¦?Ÿå?è§??: ${domain}`, 'blue');

    // ä½¿ç”¨ fetch æ¸¬è©¦?Ÿå??¯å¦?¯é?
    const testUrl = `https://${domain}`;
    const response = await fetch(testUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000) // 10ç§’è???
    });

    if (response.ok || response.status === 404) {
      // 404 ?¯æ­£å¸¸ç?ï¼Œå??ºæ??‘åª?¯æ¸¬è©¦å??è§£??
      log(`???Ÿå? ${domain} è§??æ­?¸¸`, 'green');
      return true;
    } else {
      log(`? ï?  ?Ÿå? ${domain} ?æ??€?? ${response.status}`, 'yellow');
      return true; // ??404 ?€?‹ä??¯èƒ½?¯æ­£å¸¸ç?
    }
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      log(`???Ÿå? ${domain} è§??è¶…æ?`, 'red');
    } else {
      log(`???Ÿå? ${domain} è§??å¤±æ?: ${error.message}`, 'red');
    }
    return false;
  }
}

// ä¸Šå‚³æ¸¬è©¦æª”æ?
function uploadTestFile(bucketName: string): string | null {
  try {
    const testContent = `R2 ?Ÿå?æ¸¬è©¦æª”æ? - ${new Date().toISOString()}`;
    const testFileName = `test-${Date.now()}.txt`;
    const testFilePath = `/tmp/${testFileName}`;

    // ?µå»ºæ¸¬è©¦æª”æ?
    require('fs').writeFileSync(testFilePath, testContent);

    // ä¸Šå‚³??R2
    execSync(`wrangler r2 object put ${bucketName}/test/${testFileName} --file ${testFilePath}`, {
      stdio: 'pipe'
    });

    // æ¸…ç??¬åœ°æª”æ?
    require('fs').unlinkSync(testFilePath);

    log(`??æ¸¬è©¦æª”æ?ä¸Šå‚³?å?: test/${testFileName}`, 'green');
    return `test/${testFileName}`;
  } catch (error) {
    log(`??æ¸¬è©¦æª”æ?ä¸Šå‚³å¤±æ?: ${error}`, 'red');
    return null;
  }
}

// æ¸¬è©¦æª”æ?å­˜å?
async function testFileAccess(customDomain: string, filePath: string): Promise<boolean> {
  try {
    const fileUrl = `https://${customDomain}/${filePath}`;
    log(`?? æ¸¬è©¦æª”æ?å­˜å?: ${fileUrl}`, 'blue');

    const response = await fetch(fileUrl, {
      signal: AbortSignal.timeout(10000)
    });

    if (response.ok) {
      const content = await response.text();
      if (content.includes('R2 ?Ÿå?æ¸¬è©¦æª”æ?')) {
        log(`??æª”æ?å­˜å??å?`, 'green');
        return true;
      } else {
        log(`??æª”æ??§å®¹ä¸æ­£ç¢º`, 'red');
        return false;
      }
    } else {
      log(`??æª”æ?å­˜å?å¤±æ?: ${response.status} ${response.statusText}`, 'red');
      return false;
    }
  } catch (error: any) {
    log(`??æª”æ?å­˜å?æ¸¬è©¦å¤±æ?: ${error.message}`, 'red');
    return false;
  }
}

// æ¸…ç?æ¸¬è©¦æª”æ?
function cleanupTestFile(bucketName: string, filePath: string): void {
  try {
    execSync(`wrangler r2 object delete ${bucketName}/${filePath}`, { stdio: 'pipe' });
    log(`??æ¸¬è©¦æª”æ?å·²æ??? ${filePath}`, 'green');
  } catch (error) {
    log(`? ï?  æ¸…ç?æ¸¬è©¦æª”æ?å¤±æ?: ${error}`, 'yellow');
  }
}

// é©—è??®å€?R2 ?ç½®
async function verifyR2Config(config: R2DomainConfig): Promise<boolean> {
  log(`\n?”§ é©—è? ${config.environment} ?°å??ç½®`, 'magenta');
  log(`   Bucket: ${config.bucketName}`, 'cyan');
  log(`   Domain: ${config.customDomain}`, 'cyan');

  let success = true;

  // 1. æª¢æŸ¥ bucket å­˜åœ¨
  if (!checkR2Bucket(config.bucketName)) {
    success = false;
  }

  // 2. æ¸¬è©¦?Ÿå?è§??
  if (!await testDomainResolution(config.customDomain)) {
    success = false;
  }

  // 3. ä¸Šå‚³æ¸¬è©¦æª”æ?
  const testFilePath = uploadTestFile(config.bucketName);
  if (!testFilePath) {
    success = false;
  } else {
    // 4. æ¸¬è©¦æª”æ?å­˜å?
    if (!await testFileAccess(config.customDomain, testFilePath)) {
      success = false;
    }

    // 5. æ¸…ç?æ¸¬è©¦æª”æ?
    cleanupTestFile(config.bucketName, testFilePath);
  }

  if (success) {
    log(`??${config.environment} ?°å??ç½®é©—è??šé?`, 'green');
  } else {
    log(`??${config.environment} ?°å??ç½®é©—è?å¤±æ?`, 'red');
  }

  return success;
}

// ä¸»é?è­‰å‡½??
async function main(): Promise<void> {
  log('?? ?‹å?é©—è? R2 ?ªå?ç¾©å??é?ç½?, 'cyan');

  // æª¢æŸ¥ Cloudflare èªè?
  if (!checkCloudflareAuth()) {
    process.exit(1);
  }

  let allSuccess = true;

  // é©—è??€?‰é?ç½?
  for (const config of R2_CONFIGS) {
    const success = await verifyR2Config(config);
    if (!success) {
      allSuccess = false;
    }
  }

  // ç¸½ç?
  log('\n?? é©—è?çµæ?ç¸½ç?', 'magenta');
  if (allSuccess) {
    log('???€??R2 ?ªå?ç¾©å??é?ç½®é?è­‰é€šé?', 'green');
    log('\n?? ?¨ç? R2 å­˜å„²å·²æ??™å°±ç·’ï?', 'green');
  } else {
    log('???¨å? R2 ?ç½®é©—è?å¤±æ?', 'red');
    log('\n?”§ è«‹æª¢?¥ä»¥ä¸‹é???', 'yellow');
    log('   1. Cloudflare R2 bucket ?¯å¦å·²å‰µå»?, 'yellow');
    log('   2. ?ªå?ç¾©å???DNS è¨­å??¯å¦æ­?¢º', 'yellow');
    log('   3. ?Ÿå??¯å¦å·²ç?å®šåˆ°å°æ???R2 bucket', 'yellow');
    process.exit(1);
  }
}

// ?·è??³æœ¬
if (require.main === module) {
  main().catch(console.error);
}

export { verifyR2Config };