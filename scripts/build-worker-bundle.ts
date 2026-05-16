/**
 * Worker Bundle Build Script
 *
 * This script bundles the main CRM Worker code using Wrangler and generates
 * a TypeScript file that can be embedded into the Web Installer for deployment
 * to customer accounts.
 *
 * Usage: npm run build:worker-bundle
 *
 * Output: web-installer/backend/src/services/generated/worker-bundle.ts
 *
 * Note: Uses Wrangler for bundling to ensure proper Cloudflare Workers compatibility
 * with nodejs_compat and other Workers-specific features.
 */

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Note: This script is already Bun-compatible (uses esbuild, not child_process)

interface BuildConfig {
  entryPoint: string;
  outputPath: string;
  tempDir: string;
  minify: boolean;
}

const config: BuildConfig = {
  entryPoint: path.join(__dirname, '../src/index.ts'),
  outputPath: path.join(__dirname, '../web-installer/backend/src/services/generated/worker-bundle.ts'),
  tempDir: path.join(__dirname, '../.worker-bundle-temp'),
  minify: true,
};

async function buildWorkerBundle(): Promise<void> {
  console.log(' Building Worker bundle for Web Installer...\n');

  const startTime = Date.now();

  try {
    // Step 1: Verify entry point exists
    if (!fs.existsSync(config.entryPoint)) {
      throw new Error(`Entry point not found: ${config.entryPoint}`);
    }
    console.log(' Entry point found:', config.entryPoint);

    // Step 2: Create temp directory
    if (fs.existsSync(config.tempDir)) {
      fs.rmSync(config.tempDir, { recursive: true });
    }
    fs.mkdirSync(config.tempDir, { recursive: true });

    // Step 3: Build with esbuild using Workers-compatible settings
    console.log('\n Running esbuild with Workers compatibility...');

    const result = await esbuild.build({
      entryPoints: [config.entryPoint],
      bundle: true,
      minify: config.minify,
      format: 'esm',
      target: 'esnext',
      platform: 'browser', // Workers are more like browser than node
      write: false,
      metafile: true,
      treeShaking: true,
      keepNames: true, // Important for Durable Objects class names
      conditions: ['workerd', 'worker', 'browser'],
      mainFields: ['browser', 'worker', 'module', 'main'],
      external: [
        // Cloudflare Workers built-in modules (provided by runtime)
        'cloudflare:workers',
        'cloudflare:sockets',
        // Node.js compat modules (provided by nodejs_compat)
        'node:crypto',
        'node:buffer',
        'node:stream',
        'node:util',
        'node:events',
        'node:assert',
        'node:async_hooks',
        'node:path',
        'node:string_decoder',
        // Also handle non-prefixed versions
        'crypto',
        'buffer',
        'stream',
        'util',
        'events',
        'assert',
        'async_hooks',
        'path',
        'string_decoder',
        'fs',
        'zlib',
      ],
      define: {
        'process.env.NODE_ENV': '"production"',
        'global': 'globalThis',
      },
      alias: {
        // Map node built-ins to their node: prefixed versions
        'crypto': 'node:crypto',
        'buffer': 'node:buffer',
        'stream': 'node:stream',
        'util': 'node:util',
        'events': 'node:events',
        'assert': 'node:assert',
        'path': 'node:path',
      },
      logLevel: 'warning',
    });

    if (result.outputFiles.length === 0) {
      throw new Error('No output files generated');
    }

    const bundledCode = result.outputFiles[0].text;

    // Step 3: Analyze the bundle
    console.log('\n Bundle analysis:');

    if (result.metafile) {
      const inputs = Object.keys(result.metafile.inputs);
      console.log(` - Input files: ${inputs.length}`);

      const totalInputSize = Object.values(result.metafile.inputs)
        .reduce((sum, input) => sum + input.bytes, 0);
      console.log(` - Total input size: ${(totalInputSize / 1024).toFixed(2)} KB`);
    }

    console.log(` - Output size: ${(bundledCode.length / 1024).toFixed(2)} KB`);

    // Check for Worker size limit (10MB for paid, 1MB for free)
    const sizeInMB = bundledCode.length / 1024 / 1024;
    if (sizeInMB > 10) {
      console.warn(`\n Warning: Bundle size (${sizeInMB.toFixed(2)} MB) exceeds Workers 10MB limit!`);
    } else if (sizeInMB > 1) {
      console.log(` -  Bundle requires paid Workers plan (>${1}MB)`);
    }

    // Step 4: Escape code for embedding in TypeScript template literal
    const escapedCode = escapeForTemplateLiteral(bundledCode);

    // Step 5: Generate the output file
    const output = generateOutputFile(escapedCode, bundledCode.length);

    // Step 6: Ensure output directory exists
    const outputDir = path.dirname(config.outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Step 7: Write output file
    fs.writeFileSync(config.outputPath, output, 'utf-8');

    // Step 8: Cleanup temp directory
    if (fs.existsSync(config.tempDir)) {
      fs.rmSync(config.tempDir, { recursive: true });
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n Worker bundle generated successfully!');
    console.log(` - Output: ${config.outputPath}`);
    console.log(` - Duration: ${duration}s`);
    console.log(` - File size: ${(Buffer.byteLength(output) / 1024).toFixed(2)} KB`);

    // Step 9: Verify the generated file
    verifyGeneratedFile(config.outputPath);

    // Step 10: Important note about deployment
    console.log('\n Important Notes:');
    console.log(' - The bundle requires nodejs_compat flag in wrangler.toml');
    console.log(' - Make sure customer deployments include this compatibility flag');

  } catch (error) {
    console.error('\n Build failed:', error);
    process.exit(1);
  }
}

/**
 * Escape special characters for embedding in a TypeScript template literal
 */
function escapeForTemplateLiteral(code: string): string {
  return code
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/`/g, '\\`') // Escape backticks
    .replace(/\$/g, '\\$') // Escape dollar signs (template interpolation)
    .replace(/\r\n/g, '\n'); // Normalize line endings
}

/**
 * Generate the output TypeScript file content
 */
function generateOutputFile(escapedCode: string, originalSize: number): string {
  const timestamp = new Date().toISOString();

  return `/**
 * Auto-generated Worker Bundle
 *
 * Generated at: ${timestamp}
 * Original size: ${(originalSize / 1024).toFixed(2)} KB
 *
 * DO NOT EDIT MANUALLY - This file is auto-generated by build-worker-bundle.ts
 *
 * To regenerate:
 * npm run build:worker-bundle
 */

/**
 * The bundled CRM Worker script
 * This contains the complete backend application code including:
 * - Hono framework with all route handlers
 * - Drizzle ORM database operations
 * - Durable Objects for WebSocket management
 * - Authentication and middleware
 * - All API endpoints
 */
export const BUNDLED_WORKER_SCRIPT = \`${escapedCode}\`;

/**
 * Bundle metadata
 */
export const BUNDLE_METADATA = {
  generatedAt: '${timestamp}',
  originalSizeBytes: ${originalSize},
  originalSizeKB: ${(originalSize / 1024).toFixed(2)},
  version: '1.0.0',
} as const;

/**
 * Durable Object class names that need to be exported
 * These must match the classes defined in the Worker
 */
export const DURABLE_OBJECT_CLASSES = [
  'ConversationRoom',
  'UserConnection',
  'MessageBroadcaster',
  'DelayedMessageBuffer',
  'LockCoordinator',
  'LatestMessageCacheCoordinator',
  'CustomerConversationDO',
  'CustomerMessageDO',
  'RateLimiterDO',
  'MetricsCollectorDO',
] as const;

/**
 * Required bindings for the Worker to function
 */
export const REQUIRED_BINDINGS = {
  d1: ['DB'],
  kv: ['SESSIONS', 'CACHE'],
  r2: ['R2_BUCKET'],
  queue: ['LINE_MESSAGE_QUEUE'],
  durableObjects: DURABLE_OBJECT_CLASSES,
} as const;
`;
}

/**
 * Verify the generated file is valid
 */
function verifyGeneratedFile(filePath: string): void {
  console.log('\n Verifying generated file...');

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check if file has content
    if (content.length < 100) {
      throw new Error('Generated file seems too small');
    }

    // Check for expected exports
    const expectedExports = [
      'BUNDLED_WORKER_SCRIPT',
      'BUNDLE_METADATA',
      'DURABLE_OBJECT_CLASSES',
      'REQUIRED_BINDINGS',
    ];

    for (const exportName of expectedExports) {
      if (!content.includes(`export const ${exportName}`)) {
        throw new Error(`Missing export: ${exportName}`);
      }
    }

    // Check that the bundled script contains expected patterns
    if (!content.includes('fetch') || !content.includes('export')) {
      console.warn(' Warning: Bundle may be incomplete - missing expected Worker patterns');
    }

    console.log(' Generated file verification passed');

  } catch (error) {
    console.error(' Verification failed:', error);
    throw error;
  }
}

// Run the build
buildWorkerBundle();
