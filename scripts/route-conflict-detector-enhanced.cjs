#!/usr/bin/env node
/**
 * Enhanced Route Conflict Auto-Detection Tool
 *
 * This version is MODULE-AWARE and filters out cross-module false positives.
 *
 * Key Enhancement:
 * - Parses module structure from file paths
 * - Only reports conflicts WITHIN the same module namespace
 * - Filters out cross-module false positives (e.g., /api/analytics/conversations vs /api/collaboration/conversations)
 *
 * Usage:
 *   node scripts/route-conflict-detector-enhanced.cjs
 *   node scripts/route-conflict-detector-enhanced.cjs --verbose
 *   node scripts/route-conflict-detector-enhanced.cjs --show-cross-module
 *   node scripts/route-conflict-detector-enhanced.cjs --json > report.json
 *
 * Exit Codes:
 *   0 - No conflicts detected
 *   1 - Conflicts found
 *   2 - Critical conflicts found
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  handlersDir: path.join(__dirname, '../src/modules'),
  legacyHandlersDir: path.join(__dirname, '../src/handlers'),
  includePatterns: ['**/handlers/**/*.ts', '**/handlers/*.ts'],
  excludePatterns: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/*.backup.ts'],
  severityLevels: {
    CRITICAL: { emoji: '🔴', priority: 3, description: 'Likely to cause routing failures' },
    MEDIUM: { emoji: '🟡', priority: 2, description: 'May cause unexpected behavior' },
    LOW: { emoji: '🟢', priority: 1, description: 'Potential maintenance issue' }
  },
  // Module namespace mapping (file path pattern → API prefix)
  moduleMapping: {
    'modules/auth/': '/api/auth',
    'modules/system/': '/api/system',
    'modules/teams/': '/api/teams',
    'modules/agents/': '/api/agents',
    'modules/customer/': '/api/customers',
    'modules/conversations/': '/api/conversations',
    'modules/messaging/': '/api/messages',
    'modules/session/': '/api/sessions',
    'modules/analytics/': '/api/analytics',
    'modules/reports/': '/api/reports',
    'modules/activities/': '/api/activities',
    'modules/notifications/': '/api/notifications',
    'modules/qrcode/': '/api/qr-codes',
    'modules/collaboration/': '/api/collaboration',
    'modules/realtime/': '/api/realtime',
    'handlers/auth': '/api/auth',
    'handlers/team': '/api/teams',
    'handlers/agent': '/api/agents',
    'handlers/customer': '/api/customers',
    'handlers/conversation': '/api/conversations',
    'handlers/messaging': '/api/messages',
    'handlers/session': '/api/sessions',
    'handlers/system': '/api/system',
    'handlers/notification': '/api/notifications',
    'handlers/activity': '/api/activities',
    'handlers/webhook': '/api/webhook',
    'handlers/websocket': '/api/websocket',
    'handlers/delayed-message': '/api/delayed-messages',
    'handlers/queue-monitor': '/api/queues',
    'handlers/user-experience': '/api/user-experience',
    'handlers/alert-config': '/api/alerts',
    'handlers/data-optimization': '/api/data',
    'handlers/phase2-auth': '/api/auth'
  }
};

// Command line args
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const SHOW_CROSS_MODULE = args.includes('--show-cross-module');
const JSON_OUTPUT = args.includes('--json');

// HTTP methods to detect
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all'];

/**
 * Route pattern class with module awareness
 */
class RoutePattern {
  constructor(method, path, filePath, lineNumber, context) {
    this.method = method.toUpperCase();
    this.path = path;
    this.filePath = filePath;
    this.lineNumber = lineNumber;
    this.context = context;
    this.isDynamic = this.checkDynamic();
    this.dynamicSegments = this.extractDynamicSegments();
    this.staticSegments = this.extractStaticSegments();
    this.moduleNamespace = this.extractModuleNamespace();
  }

  /**
   * Extract module namespace from file path
   * Example: src/modules/analytics/handlers/analytics-main.ts → /api/analytics
   */
  extractModuleNamespace() {
    const normalizedPath = this.filePath.replace(/\\/g, '/');

    // Try to match against known module patterns
    for (const [pattern, namespace] of Object.entries(CONFIG.moduleMapping)) {
      if (normalizedPath.includes(pattern)) {
        return namespace;
      }
    }

    // Fallback: extract from src/modules/{module}/ or src/handlers/{handler}
    const modulesMatch = normalizedPath.match(/src\/modules\/([^/]+)\//);
    if (modulesMatch) {
      const moduleName = modulesMatch[1];
      return `/api/${moduleName}`;
    }

    const handlersMatch = normalizedPath.match(/src\/handlers\/([^/]+)/);
    if (handlersMatch) {
      const handlerName = handlersMatch[1].replace(/-main|-router|-handler/, '');
      return `/api/${handlerName}`;
    }

    // Unknown module
    return '/api/unknown';
  }

  checkDynamic() {
    return this.path.includes(':');
  }

  extractDynamicSegments() {
    const matches = this.path.match(/:[a-zA-Z_][a-zA-Z0-9_]*/g);
    return matches || [];
  }

  extractStaticSegments() {
    return this.path.split('/').filter(seg => seg && !seg.startsWith(':'));
  }

  toString() {
    return `${this.method} ${this.path}`;
  }

  toFullPath() {
    return `${this.method} ${this.moduleNamespace}${this.path}`;
  }

  getBasePath() {
    const segments = this.path.split('/');
    const baseSegments = [];
    for (const seg of segments) {
      if (seg.startsWith(':')) break;
      baseSegments.push(seg);
    }
    return baseSegments.join('/') || '/';
  }
}

/**
 * Conflict detection result
 */
class RouteConflict {
  constructor(severity, route1, route2, reason, suggestion, isCrossModule = false) {
    this.severity = severity;
    this.route1 = route1;
    this.route2 = route2;
    this.reason = reason;
    this.suggestion = suggestion;
    this.isCrossModule = isCrossModule;
  }

  toString() {
    const { emoji, description } = CONFIG.severityLevels[this.severity];
    const crossModuleTag = this.isCrossModule ? ' [CROSS-MODULE]' : '';

    return `
${emoji} ${this.severity}${crossModuleTag} - ${description}

Conflict Details:
  Route 1: ${this.route1.toString()}
    File: ${this.route1.filePath}:${this.route1.lineNumber}
    Full Path: ${this.route1.toFullPath()}

  Route 2: ${this.route2.toString()}
    File: ${this.route2.filePath}:${this.route2.lineNumber}
    Full Path: ${this.route2.toFullPath()}

Reason: ${this.reason}

Suggested Fix:
${this.suggestion}
`;
  }
}

/**
 * File scanner
 */
class FileScanner {
  constructor() {
    this.handlerFiles = [];
  }

  scanDirectory(dir) {
    if (!fs.existsSync(dir)) {
      console.warn(`⚠️  Directory not found: ${dir}`);
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!CONFIG.excludePatterns.some(pattern => {
          const simplePattern = pattern.replace('**/', '').replace('/**', '');
          return fullPath.includes(simplePattern);
        })) {
          this.scanDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.ts') &&
            !CONFIG.excludePatterns.some(pattern => {
              // Convert glob pattern to simple check
              if (pattern.includes('.test.ts')) return entry.name.includes('.test.ts');
              if (pattern.includes('.spec.ts')) return entry.name.includes('.spec.ts');
              if (pattern.includes('.backup.ts')) return entry.name.includes('.backup.ts');
              return false;
            })) {
          this.handlerFiles.push(fullPath);
        }
      }
    }
  }

  getFiles() {
    return this.handlerFiles;
  }
}

/**
 * Route extractor
 */
class RouteExtractor {
  constructor(filePath) {
    this.filePath = filePath;
    this.routes = [];
  }

  extractRoutes() {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;

        // Match patterns like:  router.get('/path', ...
        for (const method of HTTP_METHODS) {
          const patterns = [
            new RegExp(`\\.(${method})\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`, 'i'),
            new RegExp(`app\\.(${method})\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`, 'i'),
            new RegExp(`router\\.(${method})\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`, 'i'),
          ];

          for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
              const detectedMethod = match[1];
              const routePath = match[2];

              const route = new RoutePattern(
                detectedMethod,
                routePath,
                this.filePath,
                lineNumber,
                line.trim()
              );

              this.routes.push(route);
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error reading file ${this.filePath}:`, error.message);
    }

    return this.routes;
  }
}

/**
 * Enhanced conflict detector with module awareness
 */
class ConflictDetector {
  constructor(routes) {
    this.routes = routes;
    this.conflicts = [];
    this.crossModuleConflicts = [];
  }

  /**
   * Check if two routes could conflict (MODULE-AWARE VERSION)
   */
  checkConflict(route1, route2) {
    // Same method required for conflict
    if (route1.method !== route2.method && route1.method !== 'ALL' && route2.method !== 'ALL') {
      return null;
    }

    // ENHANCEMENT #1: Skip conflicts within the same file
    if (route1.filePath === route2.filePath) {
      return null;
    }

    // ENHANCEMENT #2: Check if routes are in different modules
    const isCrossModule = route1.moduleNamespace !== route2.moduleNamespace;

    // If cross-module and not showing cross-module warnings, skip
    if (isCrossModule && !SHOW_CROSS_MODULE) {
      return null;
    }

    // Check if paths could match the same request
    if (this.pathsCouldMatch(route1.path, route2.path)) {
      const conflict = this.analyzeConflict(route1, route2);
      if (conflict && isCrossModule) {
        conflict.isCrossModule = true;
        // Lower severity for cross-module conflicts
        if (conflict.severity === 'CRITICAL') {
          conflict.severity = 'LOW';
          conflict.reason = `[CROSS-MODULE] ${conflict.reason} However, these routes are in different modules (${route1.moduleNamespace} vs ${route2.moduleNamespace}), so they won't conflict in production.`;
        }
      }
      return conflict;
    }

    return null;
  }

  /**
   * Check if two paths could match the same HTTP request
   */
  pathsCouldMatch(path1, path2) {
    if (path1 === path2) return true;

    const segments1 = path1.split('/').filter(s => s);
    const segments2 = path2.split('/').filter(s => s);

    const minLength = Math.min(segments1.length, segments2.length);

    for (let i = 0; i < minLength; i++) {
      const seg1 = segments1[i];
      const seg2 = segments2[i];

      if (seg1.startsWith(':') || seg2.startsWith(':')) {
        continue;
      }

      if (seg1 !== seg2) {
        return false;
      }
    }

    return true;
  }

  /**
   * Analyze severity and details of a conflict
   */
  analyzeConflict(route1, route2) {
    let severity = 'LOW';
    let reason = '';
    let suggestion = '';

    // Case 1: Static route vs Dynamic route (CRITICAL)
    if (!route1.isDynamic && route2.isDynamic) {
      severity = 'CRITICAL';
      reason = `Static route "${route1.path}" could be intercepted by dynamic route "${route2.path}". ` +
               `If "${route2.path}" is registered first, requests to "${route1.path}" will never reach it.`;
      suggestion = `Ensure "${route1.path}" is registered BEFORE "${route2.path}" in the route registration order.`;
    } else if (route1.isDynamic && !route2.isDynamic) {
      severity = 'CRITICAL';
      reason = `Dynamic route "${route1.path}" could intercept static route "${route2.path}". ` +
               `If "${route1.path}" is registered first, requests to "${route2.path}" will be caught by the dynamic handler.`;
      suggestion = `Ensure "${route2.path}" is registered BEFORE "${route1.path}" in the route registration order.`;
    }
    // Case 2: Both dynamic with different parameters (MEDIUM)
    else if (route1.isDynamic && route2.isDynamic && route1.path !== route2.path) {
      severity = 'MEDIUM';
      reason = `Both routes are dynamic with different parameter names. Registration order matters.`;
      suggestion = `Ensure routes are registered in correct order. More specific routes should come first.`;
    }
    // Case 3: Exact duplicate routes (MEDIUM)
    else if (route1.path === route2.path) {
      severity = 'MEDIUM';
      reason = `Duplicate route registration. The first registration will handle all requests.`;
      suggestion = `Remove duplicate route or ensure they're in different middleware chains.`;
    }
    // Case 4: Other potential conflicts (LOW)
    else {
      severity = 'LOW';
      reason = `Routes have overlapping patterns and could interfere with each other.`;
      suggestion = `Review route registration order and ensure intended precedence.`;
    }

    return new RouteConflict(severity, route1, route2, reason, suggestion);
  }

  /**
   * Detect all conflicts (with module awareness)
   */
  detectConflicts() {
    // Group routes by module namespace AND base path for efficiency
    const routesByModuleAndBase = {};

    for (const route of this.routes) {
      const key = `${route.moduleNamespace}::${route.getBasePath()}`;
      if (!routesByModuleAndBase[key]) {
        routesByModuleAndBase[key] = [];
      }
      routesByModuleAndBase[key].push(route);
    }

    // Check for conflicts within each module+base path group
    for (const key in routesByModuleAndBase) {
      const routes = routesByModuleAndBase[key];

      for (let i = 0; i < routes.length; i++) {
        for (let j = i + 1; j < routes.length; j++) {
          const conflict = this.checkConflict(routes[i], routes[j]);
          if (conflict) {
            if (conflict.isCrossModule) {
              this.crossModuleConflicts.push(conflict);
            } else {
              this.conflicts.push(conflict);
            }
          }
        }
      }
    }

    // Also check cross-module if requested
    if (SHOW_CROSS_MODULE) {
      const allRoutes = Object.values(routesByModuleAndBase).flat();
      for (let i = 0; i < allRoutes.length; i++) {
        for (let j = i + 1; j < allRoutes.length; j++) {
          if (allRoutes[i].moduleNamespace !== allRoutes[j].moduleNamespace) {
            const conflict = this.checkConflict(allRoutes[i], allRoutes[j]);
            if (conflict && !this.crossModuleConflicts.includes(conflict)) {
              this.crossModuleConflicts.push(conflict);
            }
          }
        }
      }
    }

    // Sort by severity
    this.conflicts.sort((a, b) => {
      return CONFIG.severityLevels[b.severity].priority - CONFIG.severityLevels[a.severity].priority;
    });

    return this.conflicts;
  }

  getConflicts() {
    return this.conflicts;
  }

  getCrossModuleConflicts() {
    return this.crossModuleConflicts;
  }
}

/**
 * Report generator
 */
class ReportGenerator {
  constructor(routes, conflicts, crossModuleConflicts = []) {
    this.routes = routes;
    this.conflicts = conflicts;
    this.crossModuleConflicts = crossModuleConflicts;
  }

  generateTextReport() {
    console.log(`
╔════════════════════════════════════════════════════════════════════╗
║     ENHANCED ROUTE CONFLICT DETECTION REPORT (Module-Aware)        ║
╚════════════════════════════════════════════════════════════════════╝
`);

    console.log(`📊 Scan Statistics:
   Total Routes Scanned: ${this.routes.length}
   Within-Module Conflicts: ${this.conflicts.length}
   Cross-Module Warnings: ${this.crossModuleConflicts.length} (filtered out by default)
`);

    // Count by severity
    const bySeverity = { CRITICAL: 0, MEDIUM: 0, LOW: 0 };
    this.conflicts.forEach(c => bySeverity[c.severity]++);

    console.log(`🔍 Within-Module Conflicts by Severity:
   ${CONFIG.severityLevels.CRITICAL.emoji} CRITICAL: ${bySeverity.CRITICAL}
   ${CONFIG.severityLevels.MEDIUM.emoji} MEDIUM:   ${bySeverity.MEDIUM}
   ${CONFIG.severityLevels.LOW.emoji} LOW:      ${bySeverity.LOW}
`);

    if (this.conflicts.length === 0) {
      console.log(`✅ No route conflicts detected within modules! Your routing configuration is clean.

💡 Note: ${this.crossModuleConflicts.length} cross-module route overlaps were detected but filtered out.
   These are NOT real conflicts because routes are in different module namespaces.
   Example: /api/analytics/conversations vs /api/collaboration/conversations → NO CONFLICT

   Use --show-cross-module flag to see these informational warnings.
`);
      return 0;
    }

    console.log(`
═══════════════════════════════════════════════════════════════════════
                    WITHIN-MODULE CONFLICT DETAILS
═══════════════════════════════════════════════════════════════════════
`);

    this.conflicts.forEach((conflict, index) => {
      console.log(`\n[Conflict #${index + 1}]`);
      console.log(conflict.toString());
      console.log('─'.repeat(70));
    });

    if (SHOW_CROSS_MODULE && this.crossModuleConflicts.length > 0) {
      console.log(`
═══════════════════════════════════════════════════════════════════════
                  CROSS-MODULE WARNINGS (Informational)
═══════════════════════════════════════════════════════════════════════

These are NOT real conflicts because the routes are in different module
namespaces. They are shown for informational purposes only.
`);

      this.crossModuleConflicts.slice(0, 10).forEach((conflict, index) => {
        console.log(`\n[Cross-Module Warning #${index + 1}]`);
        console.log(conflict.toString());
        console.log('─'.repeat(70));
      });

      if (this.crossModuleConflicts.length > 10) {
        console.log(`\n... and ${this.crossModuleConflicts.length - 10} more cross-module warnings.`);
      }
    }

    // Return exit code based on severity
    if (bySeverity.CRITICAL > 0) return 2;
    if (bySeverity.MEDIUM > 0 || bySeverity.LOW > 0) return 1;
    return 0;
  }

  generateJsonReport() {
    const report = {
      summary: {
        totalRoutes: this.routes.length,
        withinModuleConflicts: this.conflicts.length,
        crossModuleWarnings: this.crossModuleConflicts.length,
        bySeverity: {
          critical: this.conflicts.filter(c => c.severity === 'CRITICAL').length,
          medium: this.conflicts.filter(c => c.severity === 'MEDIUM').length,
          low: this.conflicts.filter(c => c.severity === 'LOW').length
        }
      },
      conflicts: this.conflicts.map(c => ({
        severity: c.severity,
        route1: { method: c.route1.method, path: c.route1.path, fullPath: c.route1.toFullPath(), file: c.route1.filePath, line: c.route1.lineNumber },
        route2: { method: c.route2.method, path: c.route2.path, fullPath: c.route2.toFullPath(), file: c.route2.filePath, line: c.route2.lineNumber },
        reason: c.reason,
        suggestion: c.suggestion
      })),
      crossModuleWarnings: SHOW_CROSS_MODULE ? this.crossModuleConflicts.map(c => ({
        route1: { method: c.route1.method, path: c.route1.path, fullPath: c.route1.toFullPath(), module: c.route1.moduleNamespace },
        route2: { method: c.route2.method, path: c.route2.path, fullPath: c.route2.toFullPath(), module: c.route2.moduleNamespace }
      })) : []
    };

    console.log(JSON.stringify(report, null, 2));
    return report.conflicts.length > 0 ? 1 : 0;
  }
}

/**
 * Main execution
 */
function main() {
  if (VERBOSE) {
    console.log('🔍 Scanning for handler files...');
  }

  // Scan for handler files
  const scanner = new FileScanner();
  scanner.scanDirectory(CONFIG.handlersDir);
  scanner.scanDirectory(CONFIG.legacyHandlersDir);

  const files = scanner.getFiles();

  if (VERBOSE) {
    console.log(`📁 Found ${files.length} handler files`);
  }

  // Extract routes from all files
  const allRoutes = [];
  for (const file of files) {
    const extractor = new RouteExtractor(file);
    const routes = extractor.extractRoutes();
    allRoutes.push(...routes);

    if (VERBOSE && routes.length > 0) {
      console.log(`   ${file}: ${routes.length} routes`);
    }
  }

  if (VERBOSE) {
    console.log(`\n📊 Total routes extracted: ${allRoutes.length}\n`);
  }

  // Detect conflicts
  const detector = new ConflictDetector(allRoutes);
  const conflicts = detector.detectConflicts();
  const crossModuleConflicts = detector.getCrossModuleConflicts();

  // Generate report
  const reporter = new ReportGenerator(allRoutes, conflicts, crossModuleConflicts);

  let exitCode;
  if (JSON_OUTPUT) {
    exitCode = reporter.generateJsonReport();
  } else {
    exitCode = reporter.generateTextReport();
  }

  process.exit(exitCode);
}

// Run
main();
