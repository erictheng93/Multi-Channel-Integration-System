#!/usr/bin/env bun

/**
 * Deploy to Cloudflare Pages
 *
 * This script handles the complete deployment process:
 * 1. Build the frontend (optional, can be skipped with --skip-build)
 * 2. Copy configuration files (_headers, _redirects)
 * 3. Deploy to Cloudflare Pages using wrangler
 *
 * Usage:
 *   bun scripts/deploy-to-pages.ts              # Full build + deploy
 *   bun scripts/deploy-to-pages.ts --skip-build # Deploy only
 */

import path from 'path';
import fs from 'fs';

const scriptDir = import.meta.dir;

// ANSI color codes
type ColorName = 'reset' | 'bright' | 'green' | 'yellow' | 'red' | 'blue' | 'cyan' | 'magenta';

const colors: Record<ColorName, string> = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message: string, color: ColorName = 'reset', bold = false): void {
  const style = bold ? colors.bright : '';
  console.log(`${style}${colors[color]}${message}${colors.reset}`);
}

function section(title: string): void {
  console.log('');
  log('='.repeat(70), 'blue');
  log(`  ${title}`, 'cyan', true);
  log('='.repeat(70), 'blue');
}

function execCommand(command: string, description: string): boolean {
  try {
    log(`\n> ${description}...`, 'cyan');
    const parts = command.split(' ');
    log(`  $ ${command}`, 'blue');

    const result = Bun.spawnSync(parts, {
      stdout: 'inherit',
      stderr: 'inherit',
      cwd: path.join(scriptDir, '..'),
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    if (result.exitCode === 0) {
      log(`Done: ${description} completed`, 'green');
      return true;
    } else {
      log(`Failed: ${description} failed (exit code ${result.exitCode})`, 'red');
      return false;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Failed: ${description} failed`, 'red');
    log(`   Error: ${errorMessage}`, 'red');
    return false;
  }
}

function checkPrerequisites(): boolean {
  section('Checking Prerequisites');

  const distPath = path.join(scriptDir, '..', 'dist');
  const hasDist = fs.existsSync(distPath);

  if (!hasDist) {
    log('Warning: dist directory not found', 'yellow');
    log('   Will build the project first', 'blue');
    return false;
  }

  log('dist directory exists', 'green');
  return true;
}

function buildProject(): boolean {
  section('Building Frontend');

  const buildSuccess = execCommand(
    'npm run build',
    'Building production bundle'
  );

  if (!buildSuccess) {
    log('\nBuild failed! Cannot proceed with deployment.', 'red');
    process.exit(1);
  }

  return true;
}

function copyConfigFiles(): boolean {
  section('Copying Configuration Files');

  const copySuccess = execCommand(
    'node scripts/copy-pages-config.js',
    'Copying _headers and _redirects'
  );

  if (!copySuccess) {
    log('\nWarning: Configuration copy failed, but continuing...', 'yellow');
    log('   Deployment may proceed without custom headers/redirects', 'yellow');
  }

  return true; // Don't fail deployment if config copy fails
}

function deployToPages(): boolean {
  section('Deploying to Cloudflare Pages');

  const projectName = 'mcis';

  log(`\nDeployment Configuration:`, 'cyan');
  log(`   Project: ${projectName}`, 'blue');
  log(`   Directory: dist/`, 'blue');
  log(`   Platform: Cloudflare Pages`, 'blue');

  const deploySuccess = execCommand(
    `npx wrangler pages deploy dist --project-name=${projectName}`,
    'Deploying to Cloudflare Pages'
  );

  return deploySuccess;
}

function printSummary(startTime: number, success: boolean): void {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  section(success ? 'Deployment Summary' : 'Deployment Failed');

  if (success) {
    log(`\nDeployment completed successfully!`, 'green', true);
    log(`Total time: ${duration}s`, 'blue');
    log(`\nYour site is now live!`, 'green');
    log(`   Check the Cloudflare dashboard for the deployment URL`, 'cyan');
  } else {
    log(`\nDeployment failed after ${duration}s`, 'red', true);
    log(`\nTroubleshooting tips:`, 'yellow');
    log(`   1. Check your Cloudflare credentials (wrangler login)`, 'yellow');
    log(`   2. Verify the project name in Cloudflare dashboard`, 'yellow');
    log(`   3. Check network connection`, 'yellow');
    log(`   4. Review the error messages above`, 'yellow');
  }

  console.log('');
}

function main(): void {
  const startTime = Date.now();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build') || args.includes('-s');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    log('\nCloudflare Pages Deployment Script', 'cyan', true);
    log('\nUsage:', 'yellow');
    log('  bun scripts/deploy-to-pages.ts [options]', 'blue');
    log('\nOptions:', 'yellow');
    log('  --skip-build, -s    Skip the build step', 'blue');
    log('  --help, -h          Show this help message', 'blue');
    log('\nExamples:', 'yellow');
    log('  bun scripts/deploy-to-pages.ts              # Full build + deploy', 'blue');
    log('  bun scripts/deploy-to-pages.ts --skip-build # Deploy only', 'blue');
    console.log('');
    process.exit(0);
  }

  // Print header
  log(`\n${  '='.repeat(67)}`, 'magenta');
  log('       Cloudflare Pages Deployment Script                  ', 'magenta', true);
  log('='.repeat(67), 'magenta');

  // Step 1: Check prerequisites
  const hasExistingBuild = checkPrerequisites();

  // Step 2: Build (if needed)
  if (!skipBuild || !hasExistingBuild) {
    if (!buildProject()) {
      printSummary(startTime, false);
      process.exit(1);
    }
  } else {
    section('Skipping Build');
    log('Using existing build from dist/', 'green');
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
