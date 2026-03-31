#!/usr/bin/env node

/**
 * Cloudflare R2 存儲設�??�本
 * 專�??�稱：Multi-Channel Support MVP
 * 檔�?路�?�?scripts/setup-r2-storage.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function runSync(cmd: string[]): string {
  const result = Bun.spawnSync(cmd, { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString() || `Command failed with exit code ${result.exitCode}`);
  }
  return result.stdout.toString();
}

function runInherit(cmd: string[]): void {
  const result = Bun.spawnSync(cmd, { stdout: 'inherit', stderr: 'inherit' });
  if (result.exitCode !== 0) {
    throw new Error(`Command failed with exit code ${result.exitCode}`);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CorsPolicy {
  AllowedOrigins: string[];
  AllowedMethods: string[];
  AllowedHeaders: string[];
  MaxAgeSeconds: number;
}

interface R2Environment {
  bucketName: string;
  corsPolicy: CorsPolicy;
}

interface R2ConfigType {
  development: R2Environment;
  production: R2Environment;
}

// R2 Bucket ?�置
const R2_CONFIG: R2ConfigType = {
  development: {
    bucketName: 'mcis-files',
    corsPolicy: {
      AllowedOrigins: ['http://localhost:5173', 'http://localhost:8787', 'https://your-storage-domain.example.com'],
      AllowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      AllowedHeaders: ['*'],
      MaxAgeSeconds: 3600
    }
  },
  production: {
    bucketName: 'mcis-files',
    corsPolicy: {
      AllowedOrigins: ['https://your-api-domain.example.com', 'https://your-storage-domain.example.com'], // 實�??��?
      AllowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      AllowedHeaders: ['*'],
      MaxAgeSeconds: 3600
    }
  }
};

// 檢查 Cloudflare CLI ?�否已�?�?
function checkCloudflareAuth(): boolean {
  try {
    runSync(['wrangler', 'whoami']);
    console.log('??Cloudflare 認�?已設�?);
    return true;
  } catch (error) {
    console.error('??Cloudflare 認�??�設定�?請�??��?: wrangler login');
    return false;
  }
}

// ?�建 R2 Bucket
function createR2Bucket(bucketName: string, environment: string = 'development'): boolean {
  try {
    console.log(`?�� ?�建 R2 Bucket: ${bucketName}`);
    
    // 檢查 bucket ?�否已�???
    try {
      const bucketList = runSync(['wrangler', 'r2', 'bucket', 'list']);
      if (!bucketList.includes(bucketName)) {
        throw new Error('Bucket not found');
      }
      console.log(`?��?  Bucket ${bucketName} 已�??�`);
      return true;
    } catch (error) {
      // Bucket 不�??��??�建?��?
    }

    // ?�建 bucket
    runInherit(['wrangler', 'r2', 'bucket', 'create', bucketName]);
    console.log(`??Bucket ${bucketName} ?�建?��?`);
    
    return true;
  } catch (error: any) {
    console.error(`???�建 Bucket 失�?: ${error.message}`);
    return false;
  }
}

// 設�? CORS ?��?
function setupCORS(bucketName: string, corsPolicy: CorsPolicy): boolean {
  try {
    console.log(`?�� 設�? ${bucketName} ??CORS ?��?...`);
    
    // ?�建?��? CORS ?�置檔�?
    const corsConfigPath = path.join(__dirname, 'temp-cors.json');
    const corsConfig = {
      CORSRules: [{
        AllowedOrigins: corsPolicy.AllowedOrigins,
        AllowedMethods: corsPolicy.AllowedMethods,
        AllowedHeaders: corsPolicy.AllowedHeaders,
        MaxAgeSeconds: corsPolicy.MaxAgeSeconds
      }]
    };
    
    fs.writeFileSync(corsConfigPath, JSON.stringify(corsConfig, null, 2));
    
    try {
      // 設�? CORS
      runInherit(['wrangler', 'r2', 'bucket', 'cors', 'put', bucketName, '--file', corsConfigPath]);
      console.log(`??${bucketName} CORS 設�?完�?`);
    } finally {
      // 清�??��?檔�?
      if (fs.existsSync(corsConfigPath)) {
        fs.unlinkSync(corsConfigPath);
      }
    }
    
    return true;
  } catch (error: any) {
    console.error(`??CORS 設�?失�?: ${error.message}`);
    return false;
  }
}

// 測試 R2 存�?
function testR2Access(bucketName: string): boolean {
  try {
    console.log(`?�� 測試 ${bucketName} 存�?權�?...`);
    
    // ?�建測試檔�?
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'R2 存�?測試檔�?');
    
    try {
      // 上傳測試檔�?
      runSync(['wrangler', 'r2', 'object', 'put', `${bucketName}/test/test-file.txt`, '--file', testFilePath]);

      // ?�出檔�?
      runInherit(['wrangler', 'r2', 'object', 'list', bucketName, '--prefix', 'test/']);

      // ?�除測試檔�?
      runSync(['wrangler', 'r2', 'object', 'delete', `${bucketName}/test/test-file.txt`]);
      
      console.log(`??${bucketName} 存�?測試?��?`);
      return true;
    } finally {
      // 清�??�地測試檔�?
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  } catch (error: any) {
    console.error(`??R2 存�?測試失�?: ${error.message}`);
    return false;
  }
}

// ?��??��?變數?�置
function generateEnvConfig(): void {
  console.log('?? ?��??��?變數?�置...');
  
  const envConfig = `
# Cloudflare R2 ?�置
# ?�發?��?: https://s3dev.example.com
# ?�產?��?: https://your-storage-domain.example.com
R2_PUBLIC_URL=https://s3dev.example.com
R2_ACCOUNT_ID=your-cloudflare-account-id

# 檔�?上傳?�置
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document
`;

  console.log('請�?以�??�置添�??�您??.env 檔�?�?');
  console.log(envConfig);
  
  // 如�? .env 檔�?不�??��??�建�?
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    const envExamplePath = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('??已創�?.env 檔�?，�?填入實�??�置??);
    }
  }
}

// 主設定函??
async function setupR2Storage(environment: keyof R2ConfigType = 'development'): Promise<boolean> {
  console.log(`?? ?��?設�? Cloudflare R2 存儲 (${environment})...`);
  
  // 檢查認�?
  if (!checkCloudflareAuth()) {
    return false;
  }
  
  const config = R2_CONFIG[environment];
  if (!config) {
    console.error(`??不支?��??��?: ${environment}`);
    return false;
  }
  
  // ?�建 R2 Bucket
  if (!createR2Bucket(config.bucketName, environment)) {
    return false;
  }
  
  // 設�? CORS
  if (!setupCORS(config.bucketName, config.corsPolicy)) {
    return false;
  }
  
  // 測試存�?
  if (!testR2Access(config.bucketName)) {
    return false;
  }
  
  // ?��??��?變數?�置
  generateEnvConfig();
  
  console.log(`??Cloudflare R2 存儲設�?完�? (${environment})`);
  return true;
}

// 主函??
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const environment: keyof R2ConfigType = args.includes('--prod') ? 'production' : 'development';
  
  if (args.includes('--help')) {
    console.log(`
使用?��?:
  node setup-r2-storage.ts [?��?]

?��?:
  --prod 設�??�產?��? R2 存儲
  --help 顯示此幫?��???

範�?:
  node setup-r2-storage.ts # 設�??�發?��?
  node setup-r2-storage.ts --prod # 設�??�產?��?
    `);
    return;
  }
  
  await setupR2Storage(environment);
}

// ?��??�本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { setupR2Storage };