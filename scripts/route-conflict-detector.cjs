#!/usr/bin/env node
/**
 * Route Conflict Auto-Detection Tool
 *
 * Automatically scans all handler files for potential route conflicts
 * and generates warnings to prevent routing bugs.
 *
 * Usage:
 *   node scripts/route-conflict-detector.js
 *   node scripts/route-conflict-detector.js --verbose
 *   node scripts/route-conflict-detector.js --json > report.json
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
  includePatterns: ['**/handlers/**/*.ts', '**/handlers/*.ts'],
  excludePatterns: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
  severityLevels: {
    CRITICAL: { emoji: '🔴', priority: 3, description: 'Likely to cause routing failures' },
    MEDIUM: { emoji: '🟡', priority: 2, description: 'May cause unexpected behavior' },
    LOW: { emoji: '🟢', priority: 1, description: 'Potential maintenance issue' }
  }
};

// HTTP methods to detect
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all'];

/**
 * Route pattern class
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

  getBasePath() {
    const segments = this.path.split('/');
    // Return everything before the first dynamic segment
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
  constructor(severity, route1, route2, reason, suggestion) {
    this.severity = severity;
    this.route1 = route1;
    this.route2 = route2;
    this.reason = reason;
    this.suggestion = suggestion;
  }

  toString() {
    const { emoji, description } = CONFIG.severityLevels[this.severity];
    return `
${emoji} ${this.severity} - ${description}

Conflict Details:
  Route 1: ${this.route1.toString()}
    File: ${this.route1.filePath}:${this.route1.lineNumber}

  Route 2: ${this.route2.toString()}
    File: ${this.route2.filePath}:${this.route2.lineNumber}

Reason: ${this.reason}

Suggested Fix:
${this.suggestion}
`;
  }
}

/**
 * Scanner class - extracts routes from files
 */
class RouteScanner {
  constructor() {
    this.routes = [];
  }

  /**
   * Scan a single file for route patterns
   */
  scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relPath = path.relative(process.cwd(), filePath);

    // Regex patterns for different route registration styles
    const patterns = [
      // app.get('/path', ...)
      /\.(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]/g,

      // router.get('/path', ...)
      /router\.(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]/g,

      // handler.get('/path', ...)
      /handler\.(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]/g,

      // .route('/path').get(...)
      /\.route\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.\s*(get|post|put|patch|delete)/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const method = match[1] || match[2]; // Depends on pattern group order
        const routePath = match[2] || match[1];

        // Find line number
        const matchIndex = match.index;
        const lineNumber = content.substring(0, matchIndex).split('\n').length;
        const contextLine = lines[lineNumber - 1]?.trim() || '';

        const route = new RoutePattern(method, routePath, relPath, lineNumber, contextLine);
        this.routes.push(route);
      }
    });
  }

  /**
   * Recursively scan directory for handler files
   */
  scanDirectory(dir) {
    if (!fs.existsSync(dir)) {
      console.warn(`⚠️  Directory not found: ${dir}`);
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and other excluded directories
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        this.scanDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        // Check if it's a handler file
        if (fullPath.includes('handlers') || fullPath.includes('handler')) {
          this.scanFile(fullPath);
        }
      }
    }
  }

  getRoutes() {
    return this.routes;
  }
}

/**
 * Conflict detector - analyzes routes for conflicts
 */
class ConflictDetector {
  constructor(routes) {
    this.routes = routes;
    this.conflicts = [];
  }

  /**
   * Check if two routes could conflict
   */
  checkConflict(route1, route2) {
    // Same method required for conflict
    if (route1.method !== route2.method && route1.method !== 'ALL' && route2.method !== 'ALL') {
      return null;
    }

    // IMPORTANT: Skip conflicts within the same file
    // Routes in the same handler file are part of the same handler class
    // and won't intercept each other (Hono registers them together)
    if (route1.filePath === route2.filePath) {
      return null;
    }

    // Check if paths could match the same request
    if (this.pathsCouldMatch(route1.path, route2.path)) {
      return this.analyzeConflict(route1, route2);
    }

    return null;
  }

  /**
   * Check if two paths could match the same HTTP request
   */
  pathsCouldMatch(path1, path2) {
    // Exact match
    if (path1 === path2) return true;

    // Normalize paths
    const segments1 = path1.split('/').filter(s => s);
    const segments2 = path2.split('/').filter(s => s);

    // Different lengths could still match if one has fewer segments
    const minLength = Math.min(segments1.length, segments2.length);

    for (let i = 0; i < minLength; i++) {
      const seg1 = segments1[i];
      const seg2 = segments2[i];

      // Dynamic segment matches anything
      if (seg1.startsWith(':') || seg2.startsWith(':')) {
        continue;
      }

      // Static segments must match exactly
      if (seg1 !== seg2) {
        return false;
      }
    }

    // Paths could match
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
               `If "${route2.path}" is registered first in index.ts, requests to "${route1.path}" will never reach it.`;
      suggestion = `1. Pre-register "${route1.path}" BEFORE unified route system in index.ts\n` +
                   `2. OR add reserved path validation in the dynamic route handler:\n` +
                   `   if (RESERVED_PATHS.includes(paramValue)) {\n` +
                   `     return c.json({ error: 'Invalid parameter' }, 400);\n` +
                   `   }`;
    } else if (route1.isDynamic && !route2.isDynamic) {
      severity = 'CRITICAL';
      reason = `Dynamic route "${route1.path}" could intercept static route "${route2.path}". ` +
               `If "${route1.path}" is registered first, requests to "${route2.path}" will be caught by the dynamic handler.`;
      suggestion = `1. Pre-register "${route2.path}" BEFORE the dynamic route in index.ts\n` +
                   `2. OR add reserved path validation in "${route1.path}" handler`;
    }
    // Case 2: Both dynamic with different parameters (MEDIUM)
    else if (route1.isDynamic && route2.isDynamic && route1.path !== route2.path) {
      severity = 'MEDIUM';
      reason = `Both routes are dynamic with different parameter names. Registration order matters.`;
      suggestion = `Ensure routes are registered in correct order in index.ts. More specific routes should come first.`;
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
   * Detect all conflicts
   */
  detectConflicts() {
    // Group routes by base path for efficiency
    const routesByBase = {};

    for (const route of this.routes) {
      const basePath = route.getBasePath();
      if (!routesByBase[basePath]) {
        routesByBase[basePath] = [];
      }
      routesByBase[basePath].push(route);
    }

    // Check for conflicts within each base path group
    for (const basePath in routesByBase) {
      const routes = routesByBase[basePath];

      for (let i = 0; i < routes.length; i++) {
        for (let j = i + 1; j < routes.length; j++) {
          const conflict = this.checkConflict(routes[i], routes[j]);
          if (conflict) {
            this.conflicts.push(conflict);
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
}

/**
 * Report generator
 */
class ReportGenerator {
  constructor(routes, conflicts) {
    this.routes = routes;
    this.conflicts = conflicts;
  }

  generateTextReport() {
    console.log(`
╔════════════════════════════════════════════════════════════════════╗
║          ROUTE CONFLICT AUTO-DETECTION REPORT                      ║
╚════════════════════════════════════════════════════════════════════╝
`);

    console.log(`📊 Scan Statistics:
   Total Routes Scanned: ${this.routes.length}
   Total Conflicts Found: ${this.conflicts.length}
`);

    // Count by severity
    const bySeverity = { CRITICAL: 0, MEDIUM: 0, LOW: 0 };
    this.conflicts.forEach(c => bySeverity[c.severity]++);

    console.log(`🔍 Conflicts by Severity:
   ${CONFIG.severityLevels.CRITICAL.emoji} CRITICAL: ${bySeverity.CRITICAL}
   ${CONFIG.severityLevels.MEDIUM.emoji} MEDIUM:   ${bySeverity.MEDIUM}
   ${CONFIG.severityLevels.LOW.emoji} LOW:      ${bySeverity.LOW}
`);

    if (this.conflicts.length === 0) {
      console.log(`✅ No route conflicts detected! Your routing configuration is clean.
`);
      return 0;
    }

    console.log(`
═══════════════════════════════════════════════════════════════════════
                         DETAILED CONFLICT REPORT
═══════════════════════════════════════════════════════════════════════
`);

    this.conflicts.forEach((conflict, index) => {
      console.log(`\n[Conflict #${index + 1}]`);
      console.log(conflict.toString());
      console.log('─'.repeat(70));
    });

    // Return exit code based on severity
    if (bySeverity.CRITICAL > 0) return 2;
    if (bySeverity.MEDIUM > 0 || bySeverity.LOW > 0) return 1;
    return 0;
  }

  generateJSONReport() {
    const report = {
      timestamp: new Date().toISOString(),
      statistics: {
        totalRoutes: this.routes.length,
        totalConflicts: this.conflicts.length,
        bySeverity: {
          critical: this.conflicts.filter(c => c.severity === 'CRITICAL').length,
          medium: this.conflicts.filter(c => c.severity === 'MEDIUM').length,
          low: this.conflicts.filter(c => c.severity === 'LOW').length
        }
      },
      routes: this.routes.map(r => ({
        method: r.method,
        path: r.path,
        file: r.filePath,
        line: r.lineNumber,
        isDynamic: r.isDynamic
      })),
      conflicts: this.conflicts.map(c => ({
        severity: c.severity,
        route1: {
          method: c.route1.method,
          path: c.route1.path,
          file: c.route1.filePath,
          line: c.route1.lineNumber
        },
        route2: {
          method: c.route2.method,
          path: c.route2.path,
          file: c.route2.filePath,
          line: c.route2.lineNumber
        },
        reason: c.reason,
        suggestion: c.suggestion
      }))
    };

    console.log(JSON.stringify(report, null, 2));
    return report.statistics.bySeverity.critical > 0 ? 2 : (report.conflicts.length > 0 ? 1 : 0);
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const jsonOutput = args.includes('--json');

  if (verbose) {
    console.log('🔍 Starting route conflict detection...');
    console.log(`   Scanning directory: ${CONFIG.handlersDir}\n`);
  }

  // Step 1: Scan all handler files
  const scanner = new RouteScanner();
  scanner.scanDirectory(CONFIG.handlersDir);
  const routes = scanner.getRoutes();

  if (verbose) {
    console.log(`✅ Scanned ${routes.length} routes from handler files\n`);
  }

  // Step 2: Detect conflicts
  const detector = new ConflictDetector(routes);
  detector.detectConflicts();
  const conflicts = detector.getConflicts();

  // Step 3: Generate report
  const reporter = new ReportGenerator(routes, conflicts);
  const exitCode = jsonOutput ? reporter.generateJSONReport() : reporter.generateTextReport();

  process.exit(exitCode);
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for testing
module.exports = { RoutePattern, RouteScanner, ConflictDetector, RouteConflict, ReportGenerator };
