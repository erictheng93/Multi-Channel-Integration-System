#!/usr/bin/env node

/**
 * Cloudflare R2 å­˜å„²è¨­å??³æœ¬
 * å°ˆæ??ç¨±ï¼šMulti-Channel Support MVP
 * æª”æ?è·¯å?ï¼?scripts/setup-r2-storage.ts
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// R2 Bucket ?ç½®
const R2_CONFIG: R2ConfigType = {
  development: {
    bucketName: 'multi-channel-platform-attachments',
    corsPolicy: {
      AllowedOrigins: ['http://localhost:5173', 'http://localhost:8787', 'https://your-storage-domain.example.com'],
      AllowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      AllowedHeaders: ['*'],
      MaxAgeSeconds: 3600
    }
  },
  production: {
    bucketName: 'multi-channel-platform-attachments',
    corsPolicy: {
      AllowedOrigins: ['https://your-api-domain.example.com', 'https://your-storage-domain.example.com'], // å¯¦é??Ÿå?
      AllowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      AllowedHeaders: ['*'],
      MaxAgeSeconds: 3600
    }
  }
};

// æª¢æŸ¥ Cloudflare CLI ?¯å¦å·²å?è£?
function checkCloudflareAuth(): boolean {
  try {
    execSync('wrangler whoami', { stdio: 'pipe' });
    console.log('??Cloudflare èªè?å·²è¨­å®?);
    return true;
  } catch (error) {
    console.error('??Cloudflare èªè??ªè¨­å®šï?è«‹å??·è?: wrangler login');
    return false;
  }
}

// ?µå»º R2 Bucket
function createR2Bucket(bucketName: string, environment: string = 'development'): boolean {
  try {
    console.log(`?ª£ ?µå»º R2 Bucket: ${bucketName}`);
    
    // æª¢æŸ¥ bucket ?¯å¦å·²å???
    try {
      execSync(`wrangler r2 bucket list | grep ${bucketName}`, { stdio: 'pipe' });
      console.log(`?¹ï?  Bucket ${bucketName} å·²å??¨`);
      return true;
    } catch (error) {
      // Bucket ä¸å??¨ï??µå»º?°ç?
    }
    
    // ?µå»º bucket
    execSync(`wrangler r2 bucket create ${bucketName}`, { stdio: 'inherit' });
    console.log(`??Bucket ${bucketName} ?µå»º?å?`);
    
    return true;
  } catch (error: any) {
    console.error(`???µå»º Bucket å¤±æ?: ${error.message}`);
    return false;
  }
}

// è¨­å? CORS ?¿ç?
function setupCORS(bucketName: string, corsPolicy: CorsPolicy): boolean {
  try {
    console.log(`?”§ è¨­å? ${bucketName} ??CORS ?¿ç?...`);
    
    // ?µå»º?¨æ? CORS ?ç½®æª”æ?
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
      // è¨­å? CORS
      execSync(`wrangler r2 bucket cors put ${bucketName} --file ${corsConfigPath}`, {
        stdio: 'inherit'
      });
      console.log(`??${bucketName} CORS è¨­å?å®Œæ?`);
    } finally {
      // æ¸…ç??¨æ?æª”æ?
      if (fs.existsSync(corsConfigPath)) {
        fs.unlinkSync(corsConfigPath);
      }
    }
    
    return true;
  } catch (error: any) {
    console.error(`??CORS è¨­å?å¤±æ?: ${error.message}`);
    return false;
  }
}

// æ¸¬è©¦ R2 å­˜å?
function testR2Access(bucketName: string): boolean {
  try {
    console.log(`?§ª æ¸¬è©¦ ${bucketName} å­˜å?æ¬Šé?...`);
    
    // ?µå»ºæ¸¬è©¦æª”æ?
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'R2 å­˜å?æ¸¬è©¦æª”æ?');
    
    try {
      // ä¸Šå‚³æ¸¬è©¦æª”æ?
      execSync(`wrangler r2 object put ${bucketName}/test/test-file.txt --file ${testFilePath}`, {
        stdio: 'pipe'
      });
      
      // ?—å‡ºæª”æ?
      execSync(`wrangler r2 object list ${bucketName} --prefix test/`, {
        stdio: 'inherit'
      });
      
      // ?ªé™¤æ¸¬è©¦æª”æ?
      execSync(`wrangler r2 object delete ${bucketName}/test/test-file.txt`, {
        stdio: 'pipe'
      });
      
      console.log(`??${bucketName} å­˜å?æ¸¬è©¦?šé?`);
      return true;
    } finally {
      // æ¸…ç??¬åœ°æ¸¬è©¦æª”æ?
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  } catch (error: any) {
    console.error(`??R2 å­˜å?æ¸¬è©¦å¤±æ?: ${error.message}`);
    return false;
  }
}

// ?Ÿæ??°å?è®Šæ•¸?ç½®
function generateEnvConfig(): void {
  console.log('?? ?Ÿæ??°å?è®Šæ•¸?ç½®...');
  
  const envConfig = `
# Cloudflare R2 ?ç½®
# ?‹ç™¼?°å?: https://s3dev.example.com
# ?Ÿç”¢?°å?: https://your-storage-domain.example.com
R2_PUBLIC_URL=https://s3dev.example.com
R2_ACCOUNT_ID=your-cloudflare-account-id

# æª”æ?ä¸Šå‚³?ç½®
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document
`;

  console.log('è«‹å?ä»¥ä??ç½®æ·»å??°æ‚¨??.env æª”æ?ä¸?');
  console.log(envConfig);
  
  // å¦‚æ? .env æª”æ?ä¸å??¨ï??µå»ºå®?
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    const envExamplePath = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('??å·²å‰µå»?.env æª”æ?ï¼Œè?å¡«å…¥å¯¦é??ç½®??);
    }
  }
}

// ä¸»è¨­å®šå‡½??
async function setupR2Storage(environment: keyof R2ConfigType = 'development'): Promise<boolean> {
  console.log(`?? ?‹å?è¨­å? Cloudflare R2 å­˜å„² (${environment})...`);
  
  // æª¢æŸ¥èªè?
  if (!checkCloudflareAuth()) {
    return false;
  }
  
  const config = R2_CONFIG[environment];
  if (!config) {
    console.error(`??ä¸æ”¯?´ç??°å?: ${environment}`);
    return false;
  }
  
  // ?µå»º R2 Bucket
  if (!createR2Bucket(config.bucketName, environment)) {
    return false;
  }
  
  // è¨­å? CORS
  if (!setupCORS(config.bucketName, config.corsPolicy)) {
    return false;
  }
  
  // æ¸¬è©¦å­˜å?
  if (!testR2Access(config.bucketName)) {
    return false;
  }
  
  // ?Ÿæ??°å?è®Šæ•¸?ç½®
  generateEnvConfig();
  
  console.log(`??Cloudflare R2 å­˜å„²è¨­å?å®Œæ? (${environment})`);
  return true;
}

// ä¸»å‡½??
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const environment: keyof R2ConfigType = args.includes('--prod') ? 'production' : 'development';
  
  if (args.includes('--help')) {
    console.log(`
ä½¿ç”¨?¹æ?:
  node setup-r2-storage.ts [?¸é?]

?¸é?:
  --prod     è¨­å??Ÿç”¢?°å? R2 å­˜å„²
  --help     é¡¯ç¤ºæ­¤å¹«?©è???

ç¯„ä?:
  node setup-r2-storage.ts          # è¨­å??‹ç™¼?°å?
  node setup-r2-storage.ts --prod   # è¨­å??Ÿç”¢?°å?
    `);
    return;
  }
  
  await setupR2Storage(environment);
}

// ?·è??³æœ¬
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { setupR2Storage };