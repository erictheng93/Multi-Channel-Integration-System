#!/usr/bin/env node

/**
 * Deploy to Cloudflare Pages
 *
 * This script handles the complete deployment process:
 * 1. Build the frontend (optional, can be skipped with --skip-build)
 * 2. Copy configuration files (_headers, _redirects)
 * 3. Deploy to Cloudflare Pages using wrangler
 *
 * Usage:
 *   node scripts/deploy-to-pages.js              # Full build + deploy
 *   node scripts/deploy-to-pages.js --skip-build # Deploy only
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset', bold = false) {
  const style = bold ? colors.bright : '';
  console.log(`${style}${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('');
  log('═'.repeat(70), 'blue');
  log(`  ${title}`, 'cyan', true);
  log('═'.repeat(70), 'blue');
}

function execCommand(command, description) {
  try {
    log(`\n▶ ${description}...`, 'cyan');
    log(`  $ ${command}`, 'blue');

    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    log(`✅ ${description} completed`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description} failed`, 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

function checkPrerequisites() {
  section('🔍 Checking Prerequisites');

  const distPath = path.join(__dirname, '..', 'dist');
  const hasDist = fs.existsSync(distPath);

  if (!hasDist) {
    log('⚠️  dist directory not found', 'yellow');
    log('   Will build the project first', 'blue');
    return false;
  }

  log('✅ dist directory exists', 'green');
  return true;
}

function buildProject() {
  section('📦 Building Frontend');

  const buildSuccess = execCommand(
    'npm run build',
    'Building production bundle'
  );

  if (!buildSuccess) {
    log('\n❌ Build failed! Cannot proceed with deployment.', 'red');
    process.exit(1);
  }

  return true;
}

function copyConfigFiles() {
  section('📋 Copying Configuration Files');

  const copySuccess = execCommand(
    'node scripts/copy-pages-config.js',
    'Copying _headers and _redirects'
  );

  if (!copySuccess) {
    log('\n⚠️  Configuration copy failed, but continuing...', 'yellow');
    log('   Deployment may proceed without custom headers/redirects', 'yellow');
  }

  return true; // Don't fail deployment if config copy fails
}

function deployToPages() {
  section('🚀 Deploying to Cloudflare Pages');

  const projectName = 'multi-channel-platform-frontend';

  log(`\n📋 Deployment Configuration:`, 'cyan');
  log(`   Project: ${projectName}`, 'blue');
  log(`   Directory: dist/`, 'blue');
  log(`   Platform: Cloudflare Pages`, 'blue');

  const deploySuccess = execCommand(
    `npx wrangler pages deploy dist --project-name=${projectName}`,
    'Deploying to Cloudflare Pages'
  );

  return deploySuccess;
}

function printSummary(startTime, success) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  section(success ? '✅ Deployment Summary' : '❌ Deployment Failed');

  if (success) {
    log(`\n🎉 Deployment completed successfully!`, 'green', true);
    log(`⏱️  Total time: ${duration}s`, 'blue');
    log(`\n🌐 Your site is now live!`, 'green');
    log(`   Check the Cloudflare dashboard for the deployment URL`, 'cyan');
  } else {
    log(`\n💔 Deployment failed after ${duration}s`, 'red', true);
    log(`\n🔧 Troubleshooting tips:`, 'yellow');
    log(`   1. Check your Cloudflare credentials (wrangler login)`, 'yellow');
    log(`   2. Verify the project name in Cloudflare dashboard`, 'yellow');
    log(`   3. Check network connection`, 'yellow');
    log(`   4. Review the error messages above`, 'yellow');
  }

  console.log('');
}

function main() {
  const startTime = Date.now();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build') || args.includes('-s');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    log('\n📚 Cloudflare Pages Deployment Script', 'cyan', true);
    log('\nUsage:', 'yellow');
    log('  node scripts/deploy-to-pages.js [options]', 'blue');
    log('\nOptions:', 'yellow');
    log('  --skip-build, -s    Skip the build step', 'blue');
    log('  --help, -h          Show this help message', 'blue');
    log('\nExamples:', 'yellow');
    log('  node scripts/deploy-to-pages.js              # Full build + deploy', 'blue');
    log('  node scripts/deploy-to-pages.js --skip-build # Deploy only', 'blue');
    console.log('');
    process.exit(0);
  }

  // Print header
  log('\n╔═══════════════════════════════════════════════════════════════════╗', 'magenta');
  log('║       🚀 Cloudflare Pages Deployment Script 🚀                  ║', 'magenta', true);
  log('╚═══════════════════════════════════════════════════════════════════╝', 'magenta');

  // Step 1: Check prerequisites
  const hasExistingBuild = checkPrerequisites();

  // Step 2: Build (if needed)
  if (!skipBuild || !hasExistingBuild) {
    if (!buildProject()) {
      printSummary(startTime, false);
      process.exit(1);
    }
  } else {
    section('⏭️  Skipping Build');
    log('✅ Using existing build from dist/', 'green');
  }

  // Step 3: Copy configuration files
  copyConfigFiles();

  // Step 4: Deploy
  const deploySuccess = deployToPages();

  // Step 5: Print summary
  printSummary(startTime, deploySuccess);

  process.exit(deploySuccess ? 0 : 1);
}

// Run the script
main();

export { main };
