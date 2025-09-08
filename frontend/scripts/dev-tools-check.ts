#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

// 類型定義
interface DevToolCheck {
  name: string;
  files: string[];
  command: string | null;
}

interface PackageJson {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface TsConfig {
  compilerOptions?: {
    strict?: boolean;
  };
}

console.log('🔧 Frontend Development Tools Check\n');

const checks: DevToolCheck[] = [
  {
    name: 'ESLint Configuration',
    files: ['.eslintrc.cjs', '.eslintignore'],
    command: 'npx eslint --version'
  },
  {
    name: 'TypeScript Configuration',
    files: ['tsconfig.json', 'tsconfig.node.json'],
    command: 'npx tsc --version'
  },
  {
    name: 'Vite Configuration',
    files: ['vite.config.ts', 'vite.config.performance.ts'],
    command: 'npx vite --version'
  },
  {
    name: 'Prettier Configuration',
    files: ['prettier.config.js'],
    command: 'npx prettier --version'
  },
  {
    name: 'VS Code Configuration',
    files: ['.vscode/settings.json', '.vscode/extensions.json'],
    command: null
  }
];

let allPassed = true;

for (const check of checks) {
  console.log(`📋 Checking ${check.name}...`);
  
  // Check files
  const missingFiles = check.files.filter(file => !existsSync(resolve(file)));
  if (missingFiles.length > 0) {
    console.log(`  ❌ Missing files: ${missingFiles.join(', ')}`);
    allPassed = false;
  } else {
    console.log(`  ✅ All configuration files present`);
  }
  
  // Check command
  if (check.command) {
    try {
      const version = execSync(check.command, { encoding: 'utf8' }).trim();
      console.log(`  ✅ Tool available: ${version}`);
    } catch {
      console.log(`  ❌ Tool not available or not working`);
      allPassed = false;
    }
  }
  
  console.log();
}

// Additional checks
console.log('🔍 Additional Checks...');

// Check package.json scripts
const packageJson: PackageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const requiredScripts: string[] = [
  'dev', 'build', 'preview', 'type-check', 'lint', 
  'lint:check', 'build:analyze', 'build:report'
];

const missingScripts = requiredScripts.filter(script => !packageJson.scripts?.[script]);
if (missingScripts.length > 0) {
  console.log(`❌ Missing npm scripts: ${missingScripts.join(', ')}`);
  allPassed = false;
} else {
  console.log('✅ All required npm scripts present');
}

// Check TypeScript strict mode
const tsConfig: TsConfig = JSON.parse(readFileSync('tsconfig.json', 'utf8'));
if (tsConfig.compilerOptions?.strict) {
  console.log('✅ TypeScript strict mode enabled');
} else {
  console.log('❌ TypeScript strict mode not enabled');
  allPassed = false;
}

// Check for development dependencies
const requiredDevDeps: string[] = [
  'eslint', '@typescript-eslint/eslint-plugin', 'prettier',
  'vite', 'vue-tsc', 'rollup-plugin-visualizer'
];

const missingDevDeps = requiredDevDeps.filter(dep => !packageJson.devDependencies?.[dep]);
if (missingDevDeps.length > 0) {
  console.log(`❌ Missing dev dependencies: ${missingDevDeps.join(', ')}`);
  allPassed = false;
} else {
  console.log('✅ All required dev dependencies present');
}

console.log(`\n${  '='.repeat(50)}`);
if (allPassed) {
  console.log('🎉 All development tools are properly configured!');
  console.log('✨ Your frontend development environment is 100% complete!');
} else {
  console.log('⚠️  Some issues found. Please address them for optimal development experience.');
}
console.log('='.repeat(50));