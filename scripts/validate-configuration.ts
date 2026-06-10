#!/usr/bin/env bun

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

type CheckStatus = 'pass' | 'warn' | 'fail';

interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
}

const rootDir = process.cwd();
const results: CheckResult[] = [];

function addResult(name: string, status: CheckStatus, message: string): void {
  results.push({ name, status, message });
}

function readProjectFile(relativePath: string): string {
  return readFileSync(join(rootDir, relativePath), 'utf-8');
}

function requireFile(relativePath: string, label: string): boolean {
  const exists = existsSync(join(rootDir, relativePath));
  addResult(label, exists ? 'pass' : 'fail', exists
    ? `${relativePath} exists`
    : `${relativePath} is missing`);
  return exists;
}

function checkPackageJson(): void {
  const label = 'package.json scripts';

  try {
    const packageJson = JSON.parse(readProjectFile('package.json')) as {
      packageManager?: string;
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts ?? {};
    const issues: string[] = [];

    if (!packageJson.packageManager?.startsWith('bun@')) {
      issues.push('packageManager must pin Bun');
    }

    const expectedScripts: Record<string, string> = {
      'validate:config': 'bun scripts/validate-configuration.ts',
      'validate:routes': 'bun scripts/validate-route-order.ts',
      'validate:all': 'bun run validate:config && bun run validate:routes',
      'dev': 'wrangler dev --remote',
      'dev:remote': 'wrangler dev --remote',
      'predeploy':
        'bun scripts/guard-production-command.ts predeploy -- bun scripts/check-schema-drift.ts',
      'deploy': 'bun scripts/guard-production-command.ts deploy -- wrangler deploy --minify',
      'db:migrate':
        'bun scripts/guard-production-command.ts d1:migrate -- wrangler d1 migrations apply DB --remote',
      'db:seed':
        'bun scripts/guard-production-command.ts d1:seed -- wrangler d1 execute mcis-db --remote --file=./seed.sql',
      'db:push': 'bun scripts/guard-production-command.ts drizzle:push -- drizzle-kit push',
      'db:studio': 'bun scripts/guard-production-command.ts drizzle:studio -- drizzle-kit studio',
      'db:introspect':
        'bun scripts/guard-production-command.ts drizzle:introspect -- drizzle-kit introspect',
      'db:query':
        'bun scripts/guard-production-command.ts d1:query -- wrangler d1 execute mcis-db --remote',
      'sync:db:structure': 'bun scripts/sync-database.ts --schema-only',
    };

    for (const [scriptName, expectedCommand] of Object.entries(expectedScripts)) {
      if (scripts[scriptName] !== expectedCommand) {
        issues.push(`${scriptName} should be "${expectedCommand}"`);
      }
    }

    addResult(
      label,
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0 ? 'Bun package manager and validation scripts are configured' : issues.join('; ')
    );
  } catch (error) {
    addResult(label, 'fail', `Unable to parse package.json: ${String(error)}`);
  }
}

function checkWranglerConfig(): void {
  const label = 'wrangler.toml';

  try {
    const wrangler = readProjectFile('wrangler.toml');
    const issues: string[] = [];
    const warnings: string[] = [];

    const requiredPatterns: Array<[string, RegExp]> = [
      ['worker name', /^name\s*=\s*"mcis-worker"/m],
      ['main entry', /^main\s*=\s*"src\/index\.ts"/m],
      ['production environment', /^ENVIRONMENT\s*=\s*"production"/m],
      ['FRONTEND_URL', /^FRONTEND_URL\s*=\s*"https?:\/\/[^"]+"/m],
      ['BACKEND_URL', /^BACKEND_URL\s*=\s*"https?:\/\/[^"]+"/m],
      ['STORAGE_PUBLIC_URL', /^STORAGE_PUBLIC_URL\s*=\s*"https?:\/\/[^"]+"/m],
      ['DB binding', /binding\s*=\s*"DB"/],
      ['SESSIONS KV binding', /binding\s*=\s*"SESSIONS"/],
      ['CACHE KV binding', /binding\s*=\s*"CACHE"/],
      ['R2_BUCKET binding', /binding\s*=\s*"R2_BUCKET"/],
    ];

    for (const [name, pattern] of requiredPatterns) {
      if (!pattern.test(wrangler)) {
        issues.push(`missing or invalid ${name}`);
      }
    }

    const forbiddenEnvMatch = wrangler.match(/^\[env\.(development|staging)\]/m);
    if (forbiddenEnvMatch) {
      issues.push(`forbidden ${forbiddenEnvMatch[0]} section found; this repo is production-only`);
    }

    const requiredDurableObjects = [
      'CONVERSATION_ROOM',
      'USER_CONNECTION',
      'MESSAGE_BROADCASTER',
      'DELAYED_MESSAGE_SCHEDULER',
      'DISTRIBUTED_LOCK',
      'LATEST_MESSAGE_COORDINATOR',
      'CUSTOMER_CONVERSATION_DO',
      'CUSTOMER_MESSAGE_DO',
      'RATE_LIMITER',
      'METRICS_COLLECTOR',
    ];

    for (const binding of requiredDurableObjects) {
      if (!new RegExp(`name\\s*=\\s*"${binding}"`).test(wrangler)) {
        warnings.push(`Durable Object binding ${binding} is not declared`);
      }
    }

    if (issues.length > 0) {
      addResult(label, 'fail', issues.join('; '));
    } else if (warnings.length > 0) {
      addResult(label, 'warn', warnings.join('; '));
    } else {
      addResult(label, 'pass', 'Worker entry, production vars, storage bindings, and Durable Objects are configured');
    }
  } catch (error) {
    addResult(label, 'fail', `Unable to read wrangler.toml: ${String(error)}`);
  }
}

function checkSourceConfiguration(): void {
  const label = 'source configuration hooks';

  try {
    const index = readProjectFile('src/index.ts');
    const issues: string[] = [];

    const requiredSnippets = [
      'validateRouteConfig()',
      'routeGroups.forEach',
      'getSecurityHeaders',
      'isOriginAllowed',
      '/api/system/config-check',
    ];

    for (const snippet of requiredSnippets) {
      if (!index.includes(snippet)) {
        issues.push(`src/index.ts does not contain ${snippet}`);
      }
    }

    addResult(
      label,
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0 ? 'Route, security header, CORS, and config-check hooks are present' : issues.join('; ')
    );
  } catch (error) {
    addResult(label, 'fail', `Unable to inspect source configuration: ${String(error)}`);
  }
}

function printResults(): void {
  const failed = results.filter(result => result.status === 'fail');
  const warnings = results.filter(result => result.status === 'warn');
  const passed = results.filter(result => result.status === 'pass');

  console.log('Validating static project configuration...\n');

  for (const result of results) {
    const marker = result.status === 'pass' ? 'PASS' : result.status === 'warn' ? 'WARN' : 'FAIL';
    console.log(`${marker} ${result.name}`);
    console.log(`  ${result.message}`);
  }

  console.log('\nSummary:');
  console.log(`  Passed:   ${passed.length}`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log(`  Failed:   ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nConfiguration validation failed.');
    process.exit(1);
  }

  console.log('\nConfiguration validation passed.');
}

function main(): void {
  requireFile('wrangler.toml', 'Wrangler config file');
  requireFile('src/index.ts', 'Worker entry file');
  requireFile('src/config/security.ts', 'Security config module');
  requireFile('src/utils/environment.ts', 'Environment utility module');
  requireFile('frontend/vite.config.ts', 'Frontend Vite config');

  checkPackageJson();
  checkWranglerConfig();
  checkSourceConfiguration();
  printResults();
}

main();
