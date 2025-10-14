#!/usr/bin/env node
/**
 * Route Registration Order Validation Tool
 *
 * This tool analyzes src/index.ts to ensure routes are registered in the correct order.
 * It helps prevent issues where routes are intercepted by catch-all routes due to
 * incorrect registration order in Hono framework.
 *
 * Usage:
 *   npm run validate:routes
 *   node scripts/validate-route-order.ts
 *
 * Exit Codes:
 *   0 - All route registrations are correct
 *   1 - Errors found in route registration order
 *   2 - Warnings found (non-critical issues)
 */

import * as fs from 'fs';
import * as path from 'path';

// ==================== Configuration ====================

interface RoutePattern {
  pattern: RegExp;
  name: string;
  requiresPreRegistration: boolean;
  reason: string;
}

interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  line: number;
  route: string;
  message: string;
  suggestion?: string;
}

const KNOWN_PUBLIC_ROUTES: RoutePattern[] = [
  {
    pattern: /\/api\/cors\/(health|config)/,
    name: 'CORS Monitoring (Public)',
    requiresPreRegistration: true,
    reason: 'Public endpoints must be accessible without authentication'
  },
  {
    pattern: /\/api\/websocket\/(health|migration-status|readiness|liveness)/,
    name: 'WebSocket Health Endpoints',
    requiresPreRegistration: true,
    reason: 'Health checks must be accessible for monitoring'
  },
  {
    pattern: /\/api\/analytics\/comparison/,
    name: 'Analytics Comparison API',
    requiresPreRegistration: true,
    reason: 'Prevent interception by main analytics handler'
  },
  {
    pattern: /\/api\/system\/health/,
    name: 'System Health Endpoint',
    requiresPreRegistration: false,
    reason: 'Simple endpoint without catch-all conflicts'
  }
];

// Match either the RouteRegistry creation or the routeGroups.forEach call
const UNIFIED_ROUTE_SYSTEM_MARKERS = [
  /const routeRegistry = new RouteRegistry/,
  /routeGroups\.forEach\(/,
  /創建路由註冊器/,  // Comment before RouteRegistry
];

// ==================== Main Validation Logic ====================

function readIndexFile(): string {
  const indexPath = path.join(process.cwd(), 'src', 'index.ts');

  if (!fs.existsSync(indexPath)) {
    console.error('❌ Error: src/index.ts not found');
    console.error(`   Expected path: ${indexPath}`);
    process.exit(1);
  }

  return fs.readFileSync(indexPath, 'utf-8');
}

function findUnifiedRouteSystemLine(content: string): number {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    // Check if this line matches any of the unified route system markers
    for (const marker of UNIFIED_ROUTE_SYSTEM_MARKERS) {
      if (marker.test(lines[i])) {
        return i + 1; // Convert to 1-based line number
      }
    }
  }

  return -1; // Not found
}

function extractRouteRegistrations(content: string): Array<{line: number, route: string, method: string, fullLine: string}> {
  const lines = content.split('\n');
  const registrations: Array<{line: number, route: string, method: string, fullLine: string}> = [];

  // Match patterns like:
  // app.route('/api/cors', ...)
  // app.get('/api/system/health', ...)
  // app.post('/api/..., ...)
  const routePattern = /app\.(route|get|post|put|delete|patch|options|all)\(['"]([^'"]+)['"]/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip commented-out lines
    if (line.startsWith('//')) {
      continue;
    }

    const match = line.match(routePattern);
    if (match) {
      const method = match[1].toUpperCase();
      const route = match[2];
      registrations.push({
        line: i + 1, // 1-based line number
        route: route,
        method: method,
        fullLine: line
      });
    }
  }

  return registrations;
}

function validateRouteOrder(content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const unifiedSystemLine = findUnifiedRouteSystemLine(content);

  if (unifiedSystemLine === -1) {
    issues.push({
      level: 'warning',
      line: 0,
      route: 'N/A',
      message: 'Could not find Unified Route System initialization',
      suggestion: 'Ensure RouteRegistry and routeGroups.forEach are present in src/index.ts'
    });
    return issues;
  }

  console.log(`ℹ️  Unified Route System found at line ${unifiedSystemLine}\n`);

  const registrations = extractRouteRegistrations(content);

  // Check each route registration
  for (const reg of registrations) {
    // Check if this is a known public route that requires pre-registration
    const matchedPattern = KNOWN_PUBLIC_ROUTES.find(pattern =>
      pattern.pattern.test(reg.route)
    );

    if (matchedPattern && matchedPattern.requiresPreRegistration) {
      if (reg.line > unifiedSystemLine) {
        issues.push({
          level: 'error',
          line: reg.line,
          route: reg.route,
          message: `${matchedPattern.name} registered AFTER Unified Route System`,
          suggestion: `Move this registration to BEFORE line ${unifiedSystemLine}. Reason: ${matchedPattern.reason}`
        });
      }
    }

    // Check for test/diagnostic routes in production code
    if (reg.route.includes('/test-') || reg.route.includes('/debug-')) {
      issues.push({
        level: 'warning',
        line: reg.line,
        route: reg.route,
        message: 'Test/debug route found in production code',
        suggestion: 'Consider removing diagnostic routes before deployment'
      });
    }
  }

  // Check for duplicate route registrations (same path AND same method)
  const routeMap = new Map<string, Array<{line: number, method: string}>>();
  for (const reg of registrations) {
    const key = reg.route;
    if (!routeMap.has(key)) {
      routeMap.set(key, []);
    }
    routeMap.get(key)!.push({line: reg.line, method: reg.method});
  }

  for (const [route, occurrences] of routeMap.entries()) {
    // Group by method to find true duplicates
    const methodMap = new Map<string, number[]>();
    for (const occ of occurrences) {
      if (!methodMap.has(occ.method)) {
        methodMap.set(occ.method, []);
      }
      methodMap.get(occ.method)!.push(occ.line);
    }

    // Only flag if the SAME method is registered multiple times for the SAME route
    for (const [method, lines] of methodMap.entries()) {
      if (lines.length > 1) {
        issues.push({
          level: 'warning',
          line: lines[1],
          route: `${method} ${route}`,
          message: `Duplicate route registration (also at line ${lines[0]})`,
          suggestion: 'Remove duplicate registration or ensure intentional override'
        });
      }
    }
  }

  return issues;
}

function checkDocumentation(content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = content.split('\n');

  // Check for PRE-REGISTER comment blocks
  const preRegisterPattern = /PRE-REGISTER|CRITICAL.*ROUTE/i;
  const routePattern = /app\.route\(['"]\/api/;

  let foundPreRegisterComment = false;

  for (let i = 0; i < lines.length; i++) {
    if (preRegisterPattern.test(lines[i])) {
      foundPreRegisterComment = true;
    }

    // If we find a route registration within 5 lines after the comment
    if (foundPreRegisterComment && i > 0) {
      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        if (routePattern.test(lines[j])) {
          foundPreRegisterComment = false; // Reset for next search
          break;
        }
      }
    }
  }

  return issues;
}

// ==================== Reporting ====================

function printIssues(issues: ValidationIssue[]): void {
  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');
  const infos = issues.filter(i => i.level === 'info');

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     Route Registration Order Validation Report               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All route registrations are in correct order!\n');
    console.log('📊 Summary:');
    console.log(`   • Errors:   ${errors.length}`);
    console.log(`   • Warnings: ${warnings.length}`);
    console.log(`   • Info:     ${infos.length}`);
    return;
  }

  // Print errors
  if (errors.length > 0) {
    console.log('❌ ERRORS:\n');
    for (const issue of errors) {
      console.log(`   Line ${issue.line}: ${issue.route}`);
      console.log(`   ├─ Issue: ${issue.message}`);
      if (issue.suggestion) {
        console.log(`   └─ Fix: ${issue.suggestion}\n`);
      }
    }
  }

  // Print warnings
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:\n');
    for (const issue of warnings) {
      console.log(`   Line ${issue.line}: ${issue.route}`);
      console.log(`   ├─ Issue: ${issue.message}`);
      if (issue.suggestion) {
        console.log(`   └─ Suggestion: ${issue.suggestion}\n`);
      }
    }
  }

  // Print info messages
  if (infos.length > 0) {
    console.log('ℹ️  INFORMATION:\n');
    for (const issue of infos) {
      console.log(`   Line ${issue.line}: ${issue.message}\n`);
    }
  }

  // Summary
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('📊 Summary:');
  console.log(`   • Errors:   ${errors.length}`);
  console.log(`   • Warnings: ${warnings.length}`);
  console.log(`   • Info:     ${infos.length}`);
  console.log('─────────────────────────────────────────────────────────────────\n');

  if (errors.length > 0) {
    console.log('❌ Route registration validation FAILED');
    console.log('   Please fix the errors above before deploying.\n');
    console.log('📚 For more information, see:');
    console.log('   • CLAUDE.md: "Route Registration Order (⚠️ Critical)"');
    console.log('   • docs/architecture/ROUTE_REGISTRATION_ORDER.md\n');
  } else {
    console.log('⚠️  Route registration validation passed with warnings');
    console.log('   Consider addressing the warnings above.\n');
  }
}

// ==================== Main Execution ====================

function main(): void {
  console.log('🔍 Validating route registration order...\n');

  try {
    const content = readIndexFile();
    const validationIssues = validateRouteOrder(content);
    const documentationIssues = checkDocumentation(content);

    const allIssues = [...validationIssues, ...documentationIssues];

    printIssues(allIssues);

    // Exit with appropriate code
    const hasErrors = allIssues.some(i => i.level === 'error');
    const hasWarnings = allIssues.some(i => i.level === 'warning');

    if (hasErrors) {
      process.exit(1);
    } else if (hasWarnings) {
      process.exit(2);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Validation failed with error:');
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly (ES module compatible)
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  main();
}

export { validateRouteOrder, ValidationIssue };
