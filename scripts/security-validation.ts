#!/usr/bin/env node
/**
 * Security Validation Script
 * Tests security fixes and validates configuration
 */

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
    const indexPath = join(process.cwd(), 'src', 'index.ts');
    const content = await this.readFile(indexPath);

    // Check if debug endpoint is properly protected
    const hasEnvironmentCheck = content.includes('securityConfig.debug.enabled');
    const hasAuthCheck = content.includes('jwtAuth');
    const hasRoleCheck = content.includes("user.role !== 'admin'");

    return hasEnvironmentCheck && hasAuthCheck && hasRoleCheck;
  }

  private async checkCorsConfiguration(): Promise<boolean> {
    const indexPath = join(process.cwd(), 'src', 'index.ts');
    const content = await this.readFile(indexPath);

    // Check if CORS is no longer wildcard
    const hasWildcardCors = content.includes("origin: '*'");
    const hasSecureCors = content.includes('isOriginAllowed');

    return !hasWildcardCors && hasSecureCors;
  }

  private async checkSecurityHeaders(): Promise<boolean> {
    const indexPath = join(process.cwd(), 'src', 'index.ts');
    const content = await this.readFile(indexPath);

    // Check if security headers are implemented
    const hasCSP = content.includes('Content-Security-Policy');
    const hasHSTS = content.includes('Strict-Transport-Security');
    const hasFrameOptions = content.includes('X-Frame-Options');

    return hasCSP && hasHSTS && hasFrameOptions;
  }

  private async checkMockDataProduction(): Promise<boolean> {
    const storePath = join(process.cwd(), 'frontend', 'src', 'stores', 'conversations.ts');
    const content = await this.readFile(storePath);

    // Check if mock data has proper environment checks
    const hasDEVCheck = content.includes('import.meta.env.DEV');
    const hasVITESTCheck = content.includes('!import.meta.env.VITEST');
    const hasWarningLog = content.includes('console.warn');

    return hasDEVCheck && hasVITESTCheck && hasWarningLog;
  }

  private async checkSecurityConfigExists(): Promise<boolean> {
    const configPath = join(process.cwd(), 'src', 'config', 'security.ts');
    return await this.fileExists(configPath);
  }

  private async checkEnvironmentValidation(): Promise<boolean> {
    const envPath = join(process.cwd(), 'src', 'utils', 'environment.ts');
    return await this.fileExists(envPath);
  }

  private async checkProductionBuildSecurity(): Promise<boolean> {
    const vitePath = join(process.cwd(), 'frontend', 'vite.config.ts');
    const content = await this.readFile(vitePath);

    // Check if production build removes debug code
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

    for (const path of paths) {
      const fullPath = join(process.cwd(), path);
      const content = await this.readFile(fullPath);

      // Check for common hardcoded secrets patterns
      const suspiciousPatterns = [
        'password\\s*=\\s*["\'](?!\\$|\\{)[^"\']{8,}["\']',
        'secret\\s*=\\s*["\'](?!\\$|\\{)[^"\']{8,}["\']',
        'key\\s*=\\s*["\'](?!\\$|\\{)[^"\']{8,}["\']',
        'token\\s*=\\s*["\'](?!\\$|\\{)[^"\']{8,}["\']'
      ];

      for (const pattern of suspiciousPatterns) {
        if (new RegExp(pattern, 'i').test(content)) {
          return false;
        }
      }
    }

    return true;
  }

  private async checkSQLInjectionProtection(): Promise<boolean> {
    const schemaPath = join(process.cwd(), 'src', 'db', 'schema.ts');
    const content = await this.readFile(schemaPath);

    // Check if using Drizzle ORM (which provides SQL injection protection)
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

      if (passed) {
        this.results.passed++;
        this.results.results.push({
          name: check.name,
          status: 'pass',
          message: check.description,
          severity: check.severity
        });
      } else {
        this.results.failed++;
        this.results.results.push({
          name: check.name,
          status: 'fail',
          message: `FAILED: ${check.description}`,
          severity: check.severity
        });
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
    console.log(' Running Security Validation...\n');

    const checks = this.getSecurityChecks();

    for (const check of checks) {
      await this.runCheck(check);
    }

    return this.results;
  }

  public printResults(): void {
    console.log(' Security Validation Results\n');
    console.log('=' .repeat(50));

    // Summary
    const total = this.results.passed + this.results.failed + this.results.skipped;
    console.log(`Total checks: ${total}`);
    console.log(` Passed: ${this.results.passed}`);
    console.log(` Failed: ${this.results.failed}`);
    console.log(`  Skipped: ${this.results.skipped}\n`);

    // Detailed results
    const highSeverityFailures = this.results.results.filter(r => r.status === 'fail' && r.severity === 'high');
    const mediumSeverityFailures = this.results.results.filter(r => r.status === 'fail' && r.severity === 'medium');

    if (highSeverityFailures.length > 0) {
      console.log(' HIGH SEVERITY FAILURES:');
      highSeverityFailures.forEach(result => {
        console.log(` ${result.name}: ${result.message}`);
      });
      console.log();
    }

    if (mediumSeverityFailures.length > 0) {
      console.log('  MEDIUM SEVERITY FAILURES:');
      mediumSeverityFailures.forEach(result => {
        console.log(` ${result.name}: ${result.message}`);
      });
      console.log();
    }

    // All results
    console.log('DETAILED RESULTS:');
    this.results.results.forEach(result => {
      const icon = result.status === 'pass' ? '' : result.status === 'fail' ? '' : '';
      console.log(`  ${icon} ${result.name}: ${result.message}`);\n });\n \n // Final verdict\n const criticalFailures = highSeverityFailures.length;\n if (criticalFailures === 0) {\n console.log('\\n Security validation PASSED! No critical vulnerabilities found.');\n } else {\n console.log(`\\n Security validation FAILED! ${criticalFailures} critical vulnerabilities found.`);\n process.exit(1);\n }\n  }\n}\n\n// Main execution\nasync function main() {\n  const validator = new SecurityValidator();\n  await validator.validate();\n  validator.printResults();\n}\n\nif (require.main === module) {\n  main().catch(console.error);\n}\n\nexport { SecurityValidator };