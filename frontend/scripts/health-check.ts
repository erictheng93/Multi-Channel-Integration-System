#!/usr/bin/env bun

import { existsSync, statSync, readFileSync } from 'fs';
// import { resolve } from 'path'; // Not used currently

// 類型定義
type ColorName = 'reset' | 'bright' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan';

interface FileCheckResult {
  exists: boolean;
  size?: number;
  formattedSize?: string;
  isLarge?: boolean;
  warning?: string | null;
}

interface ConfigFile {
  file: string;
  name: string;
}

const colors: Record<ColorName, string> = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {return '0 Bytes';}
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
}

function checkFileSize(filePath: string, maxSize: number = 1024 * 1024): FileCheckResult { // 1MB default
  if (!existsSync(filePath)) {return { exists: false };}
  
  const stats = statSync(filePath);
  const size = stats.size;
  const isLarge = size > maxSize;
  
  return {
    exists: true,
    size,
    formattedSize: formatBytes(size),
    isLarge,
    warning: isLarge ? `File is larger than ${formatBytes(maxSize)}` : null
  };
}

function runHealthCheck(): void {
  log(`${colors.cyan}${colors.bright} Frontend Health Check${colors.reset}\n`);

  // 1. Check Node.js and npm versions
  log(`${colors.blue} Environment Check${colors.reset}`);
  const nodeResult = Bun.spawnSync(['node', '--version'], { stdout: 'pipe', stderr: 'pipe' });
  const npmResult = Bun.spawnSync(['npm', '--version'], { stdout: 'pipe', stderr: 'pipe' });
  if (nodeResult.exitCode === 0 && npmResult.exitCode === 0) {
    log(` Node.js: ${nodeResult.stdout.toString().trim()}`);
    log(` npm: ${npmResult.stdout.toString().trim()}`);
  } else {
    log(` Failed to check Node.js/npm versions`);
  }

  // 2. Check package.json integrity
  log(`\n${colors.blue} Package Configuration${colors.reset}`);
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const depCount = Object.keys(packageJson.dependencies || {}).length;
    const devDepCount = Object.keys(packageJson.devDependencies || {}).length;
    log(` Dependencies: ${depCount} production, ${devDepCount} development`);
    
    // Check for security vulnerabilities
    const auditResult = Bun.spawnSync(['npm', 'audit', '--audit-level=high'], { stdout: 'pipe', stderr: 'pipe' });
    if (auditResult.exitCode === 0) {
      log(` No high-severity security vulnerabilities`);
    } else {
      log(` Security vulnerabilities detected - run 'npm audit' for details`);
    }
  } catch {
    log(` Failed to read package.json`);
  }

  // 3. Check build artifacts
  log(`\n${colors.blue}  Build Artifacts${colors.reset}`);
  const distCheck = checkFileSize('dist', 10 * 1024 * 1024); // 10MB
  if (distCheck.exists) {
    log(` Build directory exists`);
    if (distCheck.isLarge && distCheck.warning) {
      log(` ${distCheck.warning}`);
    }
  } else {
    log(` No build artifacts found (run 'npm run build')`);
  }

  // 4. Check configuration files
  log(`\n${colors.blue}  Configuration Files${colors.reset}`);
  const configFiles: ConfigFile[] = [
    { file: 'vite.config.ts', name: 'Vite Config' },
    { file: 'tsconfig.json', name: 'TypeScript Config' },
    { file: '.eslintrc.cjs', name: 'ESLint Config' },
    { file: 'prettier.config.js', name: 'Prettier Config' }
  ];

  for (const { file, name } of configFiles) {
    const check = checkFileSize(file);
    if (check.exists && check.formattedSize) {
      log(` ${name}: ${check.formattedSize}`);
    } else {
      log(` ${name}: Missing`);
    }
  }

  // 5. Check development server
  log(`\n${colors.blue} Development Server${colors.reset}`);
  const netstatResult = Bun.spawnSync(['netstat', '-an'], { stdout: 'pipe', stderr: 'pipe' });
  if (netstatResult.exitCode === 0) {
    const netstat = netstatResult.stdout.toString();
    const port3000InUse = netstat.includes(':3000');

    if (port3000InUse) {
      log(` Port 3000 is in use (development server may be running)`);
    } else {
      log(` Port 3000 is available`);
    }
  } else {
    log(` Could not check port availability`);
  }

  // 6. Performance metrics
  log(`\n${colors.blue} Performance Metrics${colors.reset}`);
  
  // Check node_modules size
  const nodeModulesCheck = checkFileSize('node_modules', 500 * 1024 * 1024); // 500MB
  if (nodeModulesCheck.exists && nodeModulesCheck.formattedSize) {
    log(` node_modules size: ${nodeModulesCheck.formattedSize}`);
    if (nodeModulesCheck.isLarge) {
      log(` Large node_modules directory - consider cleaning`);
    }
  }

  // Check cache directories
  const cacheCheck = checkFileSize('node_modules/.vite');
  if (cacheCheck.exists && cacheCheck.formattedSize) {
    log(` Vite cache: ${cacheCheck.formattedSize}`);
  }

  // 7. Git status
  log(`\n${colors.blue} Git Status${colors.reset}`);
  const gitResult = Bun.spawnSync(['git', 'status', '--porcelain'], { stdout: 'pipe', stderr: 'pipe' });
  if (gitResult.exitCode === 0) {
    const gitStatus = gitResult.stdout.toString().trim();
    if (gitStatus) {
      const lines = gitStatus.split('\n').length;
      log(` ${lines} uncommitted changes`);
    } else {
      log(` Working directory clean`);
    }
  } else {
    log(` Not a git repository or git not available`);
  }

  // Summary
  log(`\n${colors.green}${colors.bright} Health Check Complete${colors.reset}`);
  log(`${colors.yellow} Recommendations:${colors.reset}`);
  log(`  • Run 'npm run workflow full' for complete validation`);
  log(`  • Use 'npm run build:analyze' to check bundle size`);
  log(`  • Keep dependencies updated with 'npm update'`);
  log(`  • Run 'npm audit fix' to address security issues`);
}

runHealthCheck();