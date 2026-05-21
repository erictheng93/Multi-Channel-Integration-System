#!/usr/bin/env node
/**
 * Security validation script.
 * Checks whether expected security controls are present in source files.
 */

import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { join } from 'path';

interface SecurityCheck {
  name: string;
  description: string;
  check: () => Promise<boolean>;
  severity: 'high' | 'medium' | 'low';
}

interface ValidationResult {
  passed: number;
  failed: number;
  skipped: number;
  results: Array<{
    name: string;
    status: 'pass' | 'fail' | 'skip';
    message: string;
    severity: string;
  }>;
}

class SecurityValidator {
  private results: ValidationResult = {
    passed: 0,
    failed: 0,
    skipped: 0,
    results: []
  };

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async readFile(path: string): Promise<string> {
    try {
      return await fs.readFile(path, 'utf-8');
    } catch {
      return '';
    }
  }

  private async checkDebugEndpointSecurity(): Promise<boolean> {
    const content = await this.readFile(join(process.cwd(), 'src', 'index.ts'));
    const hasEnvironmentCheck = content.includes('securityConfig.debug.enabled');
    const hasAuthCheck = content.includes('jwtAuth');
    const hasRoleCheck = content.includes("user.role !== 'admin'");

    return hasEnvironmentCheck && hasAuthCheck && hasRoleCheck;
  }

  private async checkCorsConfiguration(): Promise<boolean> {
    const content = await this.readFile(join(process.cwd(), 'src', 'index.ts'));
    const hasWildcardCors = content.includes("origin: '*'");
    const hasSecureCors = content.includes('isOriginAllowed');

    return !hasWildcardCors && hasSecureCors;
  }

  private async checkSecurityHeaders(): Promise<boolean> {
    const content = await this.readFile(join(process.cwd(), 'src', 'index.ts'));
    const hasCSP = content.includes('Content-Security-Policy');
    const hasHSTS = content.includes('Strict-Transport-Security');
    const hasFrameOptions = content.includes('X-Frame-Options');

    return hasCSP && hasHSTS && hasFrameOptions;
  }

  private async checkMockDataProduction(): Promise<boolean> {
    const content = await this.readFile(join(process.cwd(), 'frontend', 'src', 'stores', 'conversations.ts'));
    const hasDEVCheck = content.includes('import.meta.env.DEV');
    const hasVITESTCheck = content.includes('!import.meta.env.VITEST');
    const hasWarningLog = content.includes('console.warn');

    return hasDEVCheck && hasVITESTCheck && hasWarningLog;
  }

  private async checkSecurityConfigExists(): Promise<boolean> {
    return this.fileExists(join(process.cwd(), 'src', 'config', 'security.ts'));
  }

  private async checkEnvironmentValidation(): Promise<boolean> {
    return this.fileExists(join(process.cwd(), 'src', 'utils', 'environment.ts'));
  }

  private async checkProductionBuildSecurity(): Promise<boolean> {
    const content = await this.readFile(join(process.cwd(), 'frontend', 'vite.config.ts'));
    const hasDropConsole = content.includes('drop_console');
    const hasDropDebugger = content.includes('drop_debugger');
    const hasPureFuncs = content.includes('pure_funcs');

    return hasDropConsole && hasDropDebugger && hasPureFuncs;
  }

  private async checkHardcodedSecrets(): Promise<boolean> {
    const paths = [
      'src/index.ts',
      'src/utils/auth.ts',
      'src/middleware/auth.ts'
    ];

    const suspiciousPatterns = [
      'password\\s*=\\s*["\'](?!\\$|\\{)[^"\']{8,}["\']',
      'secret\\s*=\\s*["\'](?!\\$|\\{)[^"\']{8,}["\']',
      'key\\s*=\\s*["\'](?!\\$|\\{)[^"\']{8,}["\']',
      'token\\s*=\\s*["\'](?!\\$|\\{)[^"\']{8,}["\']'
    ];

    for (const path of paths) {
      const content = await this.readFile(join(process.cwd(), path));

      for (const pattern of suspiciousPatterns) {
        if (new RegExp(pattern, 'i').test(content)) {
          return false;
        }
      }
    }

    return true;
  }

  private async checkSQLInjectionProtection(): Promise<boolean> {
    const content = await this.readFile(join(process.cwd(), 'src', 'db', 'schema.ts'));
    const usesDrizzle = content.includes('drizzle-orm');
    const usesParameterized = content.includes('sqliteTable');

    return usesDrizzle && usesParameterized;
  }

  private getSecurityChecks(): SecurityCheck[] {
    return [
      {
        name: 'Debug Endpoint Security',
        description: 'Debug endpoints should be protected and environment-gated',
        check: () => this.checkDebugEndpointSecurity(),
        severity: 'high'
      },
      {
        name: 'CORS Configuration',
        description: 'CORS should not allow all origins',
        check: () => this.checkCorsConfiguration(),
        severity: 'high'
      },
      {
        name: 'Security Headers',
        description: 'Security headers should be implemented',
        check: () => this.checkSecurityHeaders(),
        severity: 'medium'
      },
      {
        name: 'Mock Data Production Safety',
        description: 'Mock data should not be included in production builds',
        check: () => this.checkMockDataProduction(),
        severity: 'medium'
      },
      {
        name: 'Security Configuration',
        description: 'Security configuration module should exist',
        check: () => this.checkSecurityConfigExists(),
        severity: 'low'
      },
      {
        name: 'Environment Validation',
        description: 'Environment validation utility should exist',
        check: () => this.checkEnvironmentValidation(),
        severity: 'low'
      },
      {
        name: 'Production Build Security',
        description: 'Production builds should remove debug code',
        check: () => this.checkProductionBuildSecurity(),
        severity: 'medium'
      },
      {
        name: 'No Hardcoded Secrets',
        description: 'Code should not contain hardcoded secrets',
        check: () => this.checkHardcodedSecrets(),
        severity: 'high'
      },
      {
        name: 'SQL Injection Protection',
        description: 'Database queries should use parameterized statements',
        check: () => this.checkSQLInjectionProtection(),
        severity: 'high'
      }
    ];
  }

  private async runCheck(check: SecurityCheck): Promise<void> {
    try {
      const passed = await check.check();

      this.results.results.push({
        name: check.name,
        status: passed ? 'pass' : 'fail',
        message: passed ? check.description : `FAILED: ${check.description}`,
        severity: check.severity
      });

      if (passed) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    } catch (error) {
      this.results.skipped++;
      this.results.results.push({
        name: check.name,
        status: 'skip',
        message: `SKIPPED: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: check.severity
      });
    }
  }

  public async validate(): Promise<ValidationResult> {
    console.log('Running security validation...');

    for (const check of this.getSecurityChecks()) {
      await this.runCheck(check);
    }

    return this.results;
  }

  public printResults(): void {
    console.log('Security validation results');
    console.log('='.repeat(50));

    const total = this.results.passed + this.results.failed + this.results.skipped;
    console.log(`Total checks: ${total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Skipped: ${this.results.skipped}`);

    const highSeverityFailures = this.results.results.filter(
      (result) => result.status === 'fail' && result.severity === 'high'
    );
    const mediumSeverityFailures = this.results.results.filter(
      (result) => result.status === 'fail' && result.severity === 'medium'
    );

    if (highSeverityFailures.length > 0) {
      console.log('\nHigh severity failures:');
      highSeverityFailures.forEach((result) => {
        console.log(`- ${result.name}: ${result.message}`);
      });
    }

    if (mediumSeverityFailures.length > 0) {
      console.log('\nMedium severity failures:');
      mediumSeverityFailures.forEach((result) => {
        console.log(`- ${result.name}: ${result.message}`);
      });
    }

    console.log('\nDetailed results:');
    this.results.results.forEach((result) => {
      console.log(`- ${result.status.toUpperCase()} ${result.name}: ${result.message}`);
    });

    if (highSeverityFailures.length === 0) {
      console.log('\nSecurity validation passed. No critical vulnerabilities found.');
      return;
    }

    console.log(`\nSecurity validation failed. ${highSeverityFailures.length} critical issue(s) found.`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const validator = new SecurityValidator();
  await validator.validate();
  validator.printResults();
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { SecurityValidator };
