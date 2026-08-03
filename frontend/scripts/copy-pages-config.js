#!/usr/bin/env node

/**
 * Copy Cloudflare Pages Configuration Files
 *
 * This script copies _headers and _redirects files to the dist directory
 * for Cloudflare Pages deployment.
 *
 * Usage: node scripts/copy-pages-config.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function copyFile(source, dest, fileName) {
  try {
    if (!fs.existsSync(source)) {
      log(`⚠️  ${fileName} not found at ${source}`, 'yellow');
      return false;
    }

    // Ensure destination directory exists
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
      log(`📁 Created directory: ${destDir}`, 'blue');
    }

    // Copy file
    fs.copyFileSync(source, dest);

    // Verify copy
    if (fs.existsSync(dest)) {
      const stats = fs.statSync(dest);
      log(`✅ Copied ${fileName} (${stats.size} bytes)`, 'green');
      return true;
    } else {
      log(`❌ Failed to copy ${fileName}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error copying ${fileName}: ${error.message}`, 'red');
    return false;
  }
}

function main() {
  log('\n📋 Copying Cloudflare Pages Configuration Files...', 'cyan');
  log('─'.repeat(60), 'blue');

  const rootDir = path.join(__dirname, '..');
  const distDir = path.join(rootDir, 'dist');

  // Check if dist directory exists
  if (!fs.existsSync(distDir)) {
    log(`❌ Error: dist directory not found at ${distDir}`, 'red');
    log('💡 Run "npm run build" first to create the dist directory', 'yellow');
    process.exit(1);
  }

  log(`📂 Source: ${rootDir}`, 'blue');
  log(`📂 Destination: ${distDir}`, 'blue');
  log('─'.repeat(60), 'blue');

  // Source is public/, not the frontend root.
  //
  // These files moved into public/ so that Vite copies them to dist on EVERY
  // build path. They used to sit at the frontend root and depend on this
  // script, which `deploy:pages` never ran - so production shipped with no
  // Content-Security-Policy, X-Frame-Options or Permissions-Policy from the
  // first deploy until 2026-08-03.
  //
  // This script is therefore redundant now: by the time it runs, Vite has
  // already placed identical files in dist. It is kept because `build:pages`,
  // .pages.toml and several deploy scripts still call it, and re-copying the
  // same bytes is harmless. Do not restore the frontend-root paths.
  const publicDir = path.join(rootDir, 'public');

  const headersSuccess = copyFile(
    path.join(publicDir, '_headers'),
    path.join(distDir, '_headers'),
    '_headers'
  );

  const redirectsSuccess = copyFile(
    path.join(publicDir, '_redirects'),
    path.join(distDir, '_redirects'),
    '_redirects'
  );

  log('─'.repeat(60), 'blue');

  // Summary
  const totalFiles = 2;
  const successCount = (headersSuccess ? 1 : 0) + (redirectsSuccess ? 1 : 0);

  if (successCount === totalFiles) {
    log(`✨ Successfully copied ${successCount}/${totalFiles} configuration files!`, 'green');
    log('🚀 Ready for Cloudflare Pages deployment\n', 'green');
    process.exit(0);
  } else if (successCount > 0) {
    log(`⚠️  Partially completed: ${successCount}/${totalFiles} files copied`, 'yellow');
    log('💡 Check the warnings above for details\n', 'yellow');
    process.exit(0); // Don't fail on partial success
  } else {
    log(`❌ Failed to copy configuration files`, 'red');
    log('💡 Please check that _headers and _redirects exist in the frontend directory\n', 'yellow');
    process.exit(1);
  }
}

// Run the script
main();

export { copyFile, main };
