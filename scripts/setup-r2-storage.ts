#!/usr/bin/env node

/**
 * Cloudflare R2 storage setup script
 * Project: Multi-Channel Support MVP
 * Path: scripts/setup-r2-storage.ts
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

// R2 bucket configuration
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
      AllowedOrigins: ['https://your-api-domain.example.com', 'https://your-storage-domain.example.com'], // replace with real domains
      AllowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      AllowedHeaders: ['*'],
      MaxAgeSeconds: 3600
    }
  }
};

// Check that the Cloudflare CLI is authenticated
function checkCloudflareAuth(): boolean {
  try {
    runSync(['wrangler', 'whoami']);
    console.log('Cloudflare authentication OK');
    return true;
  } catch {
    console.error('Cloudflare is not authenticated. Run: wrangler login');
    return false;
  }
}

// Create the R2 bucket if it does not exist yet
function createR2Bucket(bucketName: string): boolean {
  try {
    console.log(`Creating R2 bucket: ${bucketName}`);

    // Skip creation when the bucket already exists
    try {
      const bucketList = runSync(['wrangler', 'r2', 'bucket', 'list']);
      if (!bucketList.includes(bucketName)) {
        throw new Error('Bucket not found');
      }
      console.log(`Bucket ${bucketName} already exists`);
      return true;
    } catch {
      // Bucket does not exist, create it below
    }

    runInherit(['wrangler', 'r2', 'bucket', 'create', bucketName]);
    console.log(`Bucket ${bucketName} created`);

    return true;
  } catch (error) {
    console.error(`Failed to create bucket: ${getErrorMessage(error)}`);
    return false;
  }
}

// Apply the CORS policy
function setupCORS(bucketName: string, corsPolicy: CorsPolicy): boolean {
  try {
    console.log(`Applying CORS policy to ${bucketName}...`);

    // Write a temporary CORS config file
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
      runInherit(['wrangler', 'r2', 'bucket', 'cors', 'put', bucketName, '--file', corsConfigPath]);
      console.log(`CORS configured for ${bucketName}`);
    } finally {
      // Remove the temporary file
      if (fs.existsSync(corsConfigPath)) {
        fs.unlinkSync(corsConfigPath);
      }
    }

    return true;
  } catch (error) {
    console.error(`CORS setup failed: ${getErrorMessage(error)}`);
    return false;
  }
}

// Verify read/write access to the bucket
function testR2Access(bucketName: string): boolean {
  try {
    console.log(`Testing access to ${bucketName}...`);

    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'R2 access test file');

    try {
      // Upload
      runSync(['wrangler', 'r2', 'object', 'put', `${bucketName}/test/test-file.txt`, '--file', testFilePath]);

      // List
      runInherit(['wrangler', 'r2', 'object', 'list', bucketName, '--prefix', 'test/']);

      // Delete
      runSync(['wrangler', 'r2', 'object', 'delete', `${bucketName}/test/test-file.txt`]);

      console.log(`Access test passed for ${bucketName}`);
      return true;
    } finally {
      // Remove the local test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  } catch (error) {
    console.error(`R2 access test failed: ${getErrorMessage(error)}`);
    return false;
  }
}

// Print the environment variable template
function generateEnvConfig(): void {
  console.log('Generating environment variable template...');

  const envConfig = `
# Cloudflare R2 configuration
# Development: https://s3dev.example.com
# Production: https://your-storage-domain.example.com
R2_PUBLIC_URL=https://s3dev.example.com
R2_ACCOUNT_ID=your-cloudflare-account-id

# File upload configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document
`;

  console.log('Add the following to your .env file:');
  console.log(envConfig);

  // Create .env from .env.example when it is missing
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    const envExamplePath = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('Created .env from .env.example, fill in the real values.');
    }
  }
}

// Main setup routine
async function setupR2Storage(environment: keyof R2ConfigType = 'development'): Promise<boolean> {
  console.log(`Setting up Cloudflare R2 storage (${environment})...`);

  if (!checkCloudflareAuth()) {
    return false;
  }

  const config = R2_CONFIG[environment];
  if (!config) {
    console.error(`Unsupported environment: ${environment}`);
    return false;
  }

  if (!createR2Bucket(config.bucketName)) {
    return false;
  }

  if (!setupCORS(config.bucketName, config.corsPolicy)) {
    return false;
  }

  if (!testR2Access(config.bucketName)) {
    return false;
  }

  generateEnvConfig();

  console.log(`Cloudflare R2 storage setup complete (${environment})`);
  return true;
}

// CLI entry
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const environment: keyof R2ConfigType = args.includes('--prod') ? 'production' : 'development';

  if (args.includes('--help')) {
    console.log(`
Usage:
  node setup-r2-storage.ts [options]

Options:
  --prod  Set up the production R2 storage
  --help  Show this help

Examples:
  node setup-r2-storage.ts          # development
  node setup-r2-storage.ts --prod   # production
    `);
    return;
  }

  await setupR2Storage(environment);
}

// Run only when executed directly
if (import.meta.main) {
  main().catch(console.error);
}

export { setupR2Storage };
