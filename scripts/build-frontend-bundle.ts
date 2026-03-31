/**
 * Frontend Bundle Build Script
 *
 * This script builds the Vue frontend and generates a TypeScript file
 * containing all assets as Base64-encoded strings for deployment via
 * the Web Installer.
 *
 * Usage: npm run build:frontend-bundle
 *
 * Output: web-installer/backend/src/services/generated/frontend-bundle.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


interface BundledAsset {
  path: string;
  content: string; // Base64 encoded
  contentType: string;
  originalSize: number;
}

interface BuildConfig {
  frontendDir: string;
  distDir: string;
  outputPath: string;
  skipBuild: boolean;
}

const config: BuildConfig = {
  frontendDir: path.join(__dirname, '../frontend'),
  distDir: path.join(__dirname, '../frontend/dist'),
  outputPath: path.join(__dirname, '../web-installer/backend/src/services/generated/frontend-bundle.ts'),
  skipBuild: process.argv.includes('--skip-build'),
};

// Content type mapping
const CONTENT_TYPES: Record<string, string> = {
  'html': 'text/html; charset=utf-8',
  'css': 'text/css; charset=utf-8',
  'js': 'application/javascript; charset=utf-8',
  'mjs': 'application/javascript; charset=utf-8',
  'json': 'application/json; charset=utf-8',
  'svg': 'image/svg+xml',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'ico': 'image/x-icon',
  'woff': 'font/woff',
  'woff2': 'font/woff2',
  'ttf': 'font/ttf',
  'eot': 'application/vnd.ms-fontobject',
  'otf': 'font/otf',
  'map': 'application/json',
  'txt': 'text/plain; charset=utf-8',
  'xml': 'application/xml',
};

async function buildFrontendBundle(): Promise<void> {
  console.log(' Building Frontend bundle for Web Installer...\n');

  const startTime = Date.now();

  try {
    // Step 1: Build frontend (unless skipped)
    if (!config.skipBuild) {
      console.log(' Running Vite build...');
      console.log(` Working directory: ${config.frontendDir}\n`);

      const proc = Bun.spawn(['npm', 'run', 'build'], {
        cwd: config.frontendDir,
        stdout: 'inherit',
        stderr: 'inherit',
        env: {
          ...Bun.env,
          NODE_ENV: 'production',
        },
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error(`Frontend build failed with exit code ${exitCode}`);
      }

      console.log('\n Frontend build completed');
    } else {
      console.log(' Skipping build (--skip-build flag)');
    }

    // Step 2: Verify dist directory exists
    if (!fs.existsSync(config.distDir)) {
      throw new Error(`Dist directory not found: ${config.distDir}\nRun the build first.`);
    }
    console.log(' Dist directory found:', config.distDir);

    // Step 3: Collect all assets
    console.log('\n Collecting assets...');
    const assets = collectAssets(config.distDir);
    console.log(` Found ${assets.length} files`);

    // Step 4: Analyze assets
    console.log('\n Asset analysis:');
    const assetsByType = analyzeAssets(assets);
    for (const [type, typeAssets] of Object.entries(assetsByType)) {
      const totalSize = typeAssets.reduce((sum, a) => sum + a.originalSize, 0);
      console.log(` - ${type}: ${typeAssets.length} files, ${formatSize(totalSize)}`);
    }

    const totalOriginalSize = assets.reduce((sum, a) => sum + a.originalSize, 0);
    const totalBase64Size = assets.reduce((sum, a) => sum + a.content.length, 0);
    console.log(`\n Total original size: ${formatSize(totalOriginalSize)}`);
    console.log(` Total Base64 size: ${formatSize(totalBase64Size)} (+${((totalBase64Size / totalOriginalSize - 1) * 100).toFixed(1)}%)`);

    // Step 5: Generate output file
    console.log('\n Generating output file...');
    const output = generateOutputFile(assets, totalOriginalSize);

    // Step 6: Ensure output directory exists
    const outputDir = path.dirname(config.outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Step 7: Write output file
    fs.writeFileSync(config.outputPath, output, 'utf-8');

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n Frontend bundle generated successfully!');
    console.log(` - Output: ${config.outputPath}`);
    console.log(` - Duration: ${duration}s`);
    console.log(` - File size: ${formatSize(Buffer.byteLength(output))}`);
    console.log(` - Assets: ${assets.length} files`);

    // Step 8: Generate index file
    generateAssetIndex(assets, config.outputPath);

  } catch (error) {
    console.error('\n Build failed:', error);
    process.exit(1);
  }
}

/**
 * Recursively collect all assets from a directory
 */
function collectAssets(dir: string, basePath: string = ''): BundledAsset[] {
  const assets: BundledAsset[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      // Recursively process subdirectories
      assets.push(...collectAssets(fullPath, relativePath));
    } else {
      // Process file
      const content = fs.readFileSync(fullPath);
      const base64Content = content.toString('base64');
      const contentType = getContentType(entry.name);

      assets.push({
        path: relativePath.startsWith('/') ? relativePath.slice(1) : relativePath,
        content: base64Content,
        contentType,
        originalSize: content.length,
      });
    }
  }

  return assets;
}

/**
 * Get content type for a file
 */
function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

/**
 * Analyze assets by type
 */
function analyzeAssets(assets: BundledAsset[]): Record<string, BundledAsset[]> {
  const byType: Record<string, BundledAsset[]> = {};

  for (const asset of assets) {
    const ext = asset.path.split('.').pop()?.toLowerCase() || 'other';
    if (!byType[ext]) {
      byType[ext] = [];
    }
    byType[ext].push(asset);
  }

  return byType;
}

/**
 * Format bytes as human-readable string
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Generate the output TypeScript file
 */
function generateOutputFile(assets: BundledAsset[], totalOriginalSize: number): string {
  const timestamp = new Date().toISOString();

  // Create a compact JSON representation of assets
  const assetsJson = JSON.stringify(assets.map(a => ({
    p: a.path,
    c: a.content,
    t: a.contentType,
    s: a.originalSize,
  })));

  return `/**
 * Auto-generated Frontend Bundle
 *
 * Generated at: ${timestamp}
 * Total assets: ${assets.length}
 * Original size: ${formatSize(totalOriginalSize)}
 *
 * DO NOT EDIT MANUALLY - This file is auto-generated by build-frontend-bundle.ts
 *
 * To regenerate:
 * npm run build:frontend-bundle
 */

/**
 * Bundled frontend asset
 */
export interface BundledAsset {
  /** Relative path from dist root */
  path: string;
  /** Base64-encoded content */
  content: string;
  /** MIME content type */
  contentType: string;
  /** Original file size in bytes */
  originalSize: number;
}

/**
 * Bundle metadata
 */
export const BUNDLE_METADATA = {
  generatedAt: '${timestamp}',
  totalAssets: ${assets.length},
  totalOriginalSizeBytes: ${totalOriginalSize},
  totalOriginalSize: '${formatSize(totalOriginalSize)}',
  version: '1.0.0',
} as const;

// Compact asset data (p=path, c=content, t=type, s=size)
const COMPACT_ASSETS: Array<{p: string; c: string; t: string; s: number}> = ${assetsJson};

/**
 * All bundled frontend assets
 */
export const BUNDLED_FRONTEND_ASSETS: BundledAsset[] = COMPACT_ASSETS.map(a => ({
  path: a.p,
  content: a.c,
  contentType: a.t,
  originalSize: a.s,
}));

/**
 * Decode a Base64 asset to Uint8Array
 */
export function decodeAsset(asset: BundledAsset): Uint8Array {
  const binaryString = atob(asset.content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decode a Base64 asset to string (for text files)
 */
export function decodeAssetToString(asset: BundledAsset): string {
  return atob(asset.content);
}

/**
 * Find an asset by path
 */
export function findAsset(path: string): BundledAsset | undefined {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return BUNDLED_FRONTEND_ASSETS.find(a => a.path === normalizedPath);
}

/**
 * Get all assets matching a pattern
 */
export function findAssetsByPattern(pattern: RegExp): BundledAsset[] {
  return BUNDLED_FRONTEND_ASSETS.filter(a => pattern.test(a.path));
}

/**
 * Get index.html with injected runtime config
 */
export function getIndexHtmlWithConfig(config: {
  apiBaseUrl: string;
  wsBaseUrl: string;
  appUrl: string;
  projectName: string;
}): string {
  const indexAsset = findAsset('index.html');
  if (!indexAsset) {
    throw new Error('index.html not found in bundle');
  }

  let html = decodeAssetToString(indexAsset);

  // Inject runtime configuration
  const configScript = \`<script>
    window.CRM_CONFIG = {
      apiBaseUrl: '\${config.apiBaseUrl}',
      wsBaseUrl: '\${config.wsBaseUrl}',
      appUrl: '\${config.appUrl}',
      projectName: '\${config.projectName}'
    };
  </script>\`;

  // Insert before closing </head> tag
  html = html.replace('</head>', \`\${configScript}</head>\`);

  return html;
}
`;
}

/**
 * Generate an index file showing all assets
 */
function generateAssetIndex(assets: BundledAsset[], outputPath: string): void {
  const indexPath = outputPath.replace('.ts', '-index.txt');

  const lines = [
    'Frontend Bundle Asset Index',
    '=' .repeat(50),
    `Generated: ${new Date().toISOString()}`,
    `Total assets: ${assets.length}`,
    '',
    'Assets:',
    '-'.repeat(50),
  ];

  // Sort assets by path
  const sorted = [...assets].sort((a, b) => a.path.localeCompare(b.path));

  for (const asset of sorted) {
    lines.push(`${asset.path.padEnd(50)} ${formatSize(asset.originalSize).padStart(10)} ${asset.contentType}`);
  }

  fs.writeFileSync(indexPath, lines.join('\n'), 'utf-8');
  console.log(` - Asset index: ${indexPath}`);
}

// Run the build
buildFrontendBundle();
