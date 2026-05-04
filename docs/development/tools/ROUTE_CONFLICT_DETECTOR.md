# Route Conflict Auto-Detection Tool

**Version**: 1.0.0
**Status**:  Production Ready
**Purpose**: Automatically scan handler files for potential route conflicts and prevent routing bugs

---

##  Table of Contents

1. [Overview](#overview)
2. [Installation & Usage](#installation--usage)
3. [Understanding Results](#understanding-results)
4. [Real vs False Positives](#real-vs-false-positives)
5. [Best Practices](#best-practices)
6. [Examples](#examples)
7. [Integration with CI/CD](#integration-with-cicd)

---

## Overview

The Route Conflict Auto-Detection Tool scans all handler files in your codebase to identify potential route registration conflicts that could cause routing failures.

### What It Detects

-  **Static vs Dynamic Route Conflicts**: Routes like `/search` vs `/:id`
-  **Duplicate Route Registrations**: Same route registered multiple times
-  **Cross-Module Conflicts**: Routes from different modules that could interfere
-  **Registration Order Issues**: Routes that depend on registration sequence

### What It Doesn't Detect

-  Routes registered in different middleware chains (intentional separation)
-  Routes within the same handler file (Hono handles these correctly)
-  Conditional routes (depends on runtime logic)

---

## Installation & Usage

### Basic Usage

```bash
# Run the detector
node scripts/route-conflict-detector.cjs

# Verbose output
node scripts/route-conflict-detector.cjs --verbose

# JSON output for CI/CD
node scripts/route-conflict-detector.cjs --json > report.json
```

### Exit Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `0` | Success | No conflicts detected |
| `1` | Warning | Conflicts found (medium/low severity) |
| `2` | Error | Critical conflicts found |

### Command-Line Options

```bash
# Show scanning progress
--verbose

# Output JSON report
--json

# Help information
--help
```

---

## Understanding Results

### Severity Levels

####  CRITICAL - Likely to cause routing failures
**What it means**: These conflicts will almost certainly cause routing bugs in production.

**Example**:
```
Static route "/search" could be intercepted by dynamic route "/:id"
```

**Action Required**: **IMMEDIATE FIX**

####  MEDIUM - May cause unexpected behavior
**What it means**: These conflicts might cause issues depending on registration order.

**Example**:
```
Duplicate route registration in different modules
```

**Action Required**: **REVIEW NEEDED**

####  LOW - Potential maintenance issue
**What it means**: No immediate routing failure, but could complicate future changes.

**Example**:
```
Routes have overlapping patterns in different base paths
```

**Action Required**: **DOCUMENT OR REFACTOR**

---

## Real vs False Positives

###  Real Conflicts (Action Required)

#### Example 1: Static vs Dynamic in Same Module
```typescript
// CONFLICT: This is a real problem!
// File: src/modules/session/handlers/session.ts

sessionHandler.get('/search', async (c) => {  // Static route
  // Search sessions
});

sessionHandler.get('/:sessionId', async (c) => {  // Dynamic route
  // Get specific session
});

// Problem: If /:sessionId is registered first, /search will never be reached!
```

**Solution**: Add reserved path validation in the dynamic route handler:
```typescript
sessionHandler.get('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');

  // FIX: Reject reserved paths
  const RESERVED_PATHS = ['search', 'stats', 'batch'];
  if (RESERVED_PATHS.includes(sessionId.toLowerCase())) {
    return c.json({ error: 'Invalid sessionId' }, 400);
  }

  // Continue with normal logic
});
```

#### Example 2: Cross-Module Conflicts in index.ts
```typescript
// CONFLICT: Registration order matters!
// File: src/index.ts

// If unified route system registers this dynamic route first...
app.route('/api/teams', teamHandlers);  // Contains /:id/members

// ...this static route will never be reached
app.get('/api/teams/members', getTeamMembers);  // Static route

// FIX: Pre-register static routes BEFORE unified system
app.get('/api/teams/members', getTeamMembers);  // Register FIRST
app.route('/api/teams', teamHandlers);  // Register AFTER
```

### False Positives (Can Ignore)

#### Example 1: Different Modules with Same Base Path
```typescript
// NOT A CONFLICT: Different modules, properly separated
// File: src/modules/analytics/handlers/analytics-main.ts
app.get('/conversations', getConversationAnalytics);

// File: src/modules/conversations/handlers/conversation-main.ts
app.get('/conversations/:id', getConversation);

// These are registered under different route prefixes in index.ts:
// app.route('/api/analytics', analyticsHandlers);
// app.route('/api/conversations', conversationHandlers);
```

#### Example 2: Same File Routes (Hono Handles This)
```typescript
// NOT A CONFLICT: Same handler file, Hono registers correctly
// File: src/modules/qrcode/handlers/qrcode-main.ts

app.get('/search', searchQRCodes); // Hono registers this first
app.get('/:id', getQRCodeById); // Then this

// Hono automatically handles registration order within the same handler
```

---

## Best Practices

### 1. **Pre-Register Critical Static Routes**

Always register static routes BEFORE the unified route system in `src/index.ts`:

```typescript
// GOOD: Pre-register static routes
app.get('/api/teams/members', getTeamMembers);  // Static route first

// Then register unified system
const routeRegistry = new RouteRegistry(app);
routeGroups.forEach(group => routeRegistry.registerGroup(group));
```

### 2. **Use Reserved Path Validation**

For dynamic routes that could intercept static routes, add validation:

```typescript
// GOOD: Validate dynamic parameters
app.get('/:id', async (c) => {
  const id = c.req.param('id');

  const RESERVED_PATHS = ['search', 'stats', 'health', 'batch'];
  if (RESERVED_PATHS.includes(id.toLowerCase())) {
    return c.json({
      error: `Invalid ID - "${id}" is a reserved endpoint path`
    }, 400);
  }

  // Continue with ID lookup
});
```

### 3. **Document Route Registration Order**

Add comments in `src/index.ts` explaining why routes are registered in a specific order:

```typescript
// GOOD: Clear documentation
// Priority 1: Public endpoints without auth (registered first)
app.route('/api/websocket/health', websocketHealthHandler);

// Priority 2: Static routes that could conflict with dynamic routes
app.get('/api/teams/members', getTeamMembers);

// Priority 3: Unified route system (may have dynamic routes)
const routeRegistry = new RouteRegistry(app);
routeGroups.forEach(group => routeRegistry.registerGroup(group));
```

### 4. **Use Specific Route Patterns**

Prefer specific patterns over generic ones:

```typescript
// BAD: Too generic, could conflict
app.get('/:type/:id', handler);

// GOOD: Specific base path
app.get('/users/:id', handler);
app.get('/teams/:id', handler);
```

---

## Examples

### Example 1: Fixing a Critical Conflict

**Detected Conflict:**
```
 CRITICAL - Likely to cause routing failures

Route 1: GET /api/qrcode/search
  File: src/modules/qrcode/handlers/qrcode-main.ts:45

Route 2: GET /api/qrcode/:id
  File: src/modules/qrcode/handlers/qrcode-main.ts:132

Reason: Static route "/search" could be intercepted by dynamic route "/:id"

Suggested Fix:
Add reserved path validation in the dynamic route handler
```

**Applied Fix:**
```typescript
// src/modules/qrcode/handlers/qrcode-main.ts

static async getById(c: Context<{ Bindings: Bindings }>) {
  const id = c.req.param('id');

  // ROUTE CONFLICT PREVENTION
  const RESERVED_PATHS = [
    'health', 'stats', 'search', 'advanced-search',
    'type', 'tags', 'batch', 'templates', 'export',
    'scan', 'public', 'admin'
  ];

  if (RESERVED_PATHS.includes(id.toLowerCase())) {
    return errorResponse(
      c,
      `Invalid QR code ID - "${id}" is a reserved endpoint path`,
      400
    );
  }

  // Continue with normal logic...
}
```

**Result**:  Conflict resolved, routes work correctly

### Example 2: Pre-Registering Static Routes

**Detected Conflict:**
```
 CRITICAL

Route 1: GET /api/teams/members
  File: src/handlers/team.ts:50

Route 2: GET /api/teams/:id/members
  File: src/modules/teams/handlers/team.ts:120

Reason: Dynamic route could intercept static route if registered first
```

**Applied Fix:**
```typescript
// src/index.ts

// ROUTE CONFLICT PREVENTION
// Pre-register /api/teams/members BEFORE unified route system
// to prevent interception by /:id/members dynamic route
app.get('/api/teams/members', getTeamMembers);

// Now register unified route system
const routeRegistry = new RouteRegistry(app);
routeGroups.forEach(group => routeRegistry.registerGroup(group));
```

**Result**:  Static route always reached, no interception

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Route Conflict Check

on: [push, pull_request]

jobs:
  check-routes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: bun install

      - name: Run route conflict detector
        run: node scripts/route-conflict-detector.cjs --json > route-report.json
        continue-on-error: true

      - name: Upload route report
        uses: actions/upload-artifact@v3
        with:
          name: route-conflict-report
          path: route-report.json

      - name: Check for critical conflicts
        run: |
          CRITICAL_COUNT=$(jq '.statistics.bySeverity.critical' route-report.json)
          if [ "$CRITICAL_COUNT" -gt 0 ]; then
            echo " Found $CRITICAL_COUNT critical route conflicts!"
            exit 1
          fi
          echo " No critical route conflicts detected"
```

### Pre-Commit Hook

```bash
#!/bin/bash
# .husky/pre-commit

echo " Checking for route conflicts..."

node scripts/route-conflict-detector.cjs --json > /tmp/route-report.json
EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
  echo " Critical route conflicts detected!"
  echo "Run: node scripts/route-conflict-detector.cjs --verbose"
  echo "to see details"
  exit 1
fi

if [ $EXIT_CODE -eq 1 ]; then
  echo "  Route conflicts detected (non-critical)"
  echo "Consider reviewing before committing"
fi

echo " Route conflict check passed"
exit 0
```

---

## Technical Details

### Route Pattern Extraction

The tool uses regex patterns to extract routes from TypeScript handler files:

```javascript
// Patterns detected:
/\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g

// Examples matched:
app.get('/users', handler)
router.post('/teams/:id', handler)
handler.delete('/:userId', handler)
```

### Conflict Analysis Algorithm

```
For each pair of routes:
  1. Check if same HTTP method
  2. Skip if same file (Hono handles this)
  3. Check if paths could match same request
  4. Analyze severity based on:
     - Static vs Dynamic
     - Same path (duplicate)
     - Overlapping patterns
```

### Filtering False Positives

The tool filters out:
-  Routes within the same file
-  Different HTTP methods
-  Completely different base paths

---

## Troubleshooting

### "Too many conflicts detected"

**Problem**: Tool reports thousands of conflicts

**Cause**: Cross-module routes with same base path (expected in modular architecture)

**Solution**: Focus on **CRITICAL** conflicts only. Most MEDIUM conflicts across modules are false positives.

```bash
# Filter for critical only
node scripts/route-conflict-detector.cjs --json | jq '.conflicts[] | select(.severity == "CRITICAL")'
```

### "Missed a real conflict"

**Problem**: Tool didn't detect a known conflict

**Cause**: Routes registered dynamically or conditionally

**Solution**: Manual review of `src/index.ts` route registration order

### "Duplicate route warnings for test files"

**Problem**: Seeing conflicts in test files

**Cause**: Test files often mock routes

**Solution**: Tool already excludes `*.test.ts` and `*.spec.ts` files

---

## Roadmap

### Planned Improvements

- [ ] AST-based parsing (instead of regex) for more accurate route extraction
- [ ] Integration with `src/index.ts` to understand actual registration order
- [ ] Interactive mode to auto-fix detected conflicts
- [ ] Web UI for visual route conflict exploration
- [ ] Support for middleware-specific route chains

### Contributing

To improve the detector, see: `scripts/route-conflict-detector.cjs`

Key areas for contribution:
- Better false positive filtering
- Support for more route registration patterns
- Integration with TypeScript AST
- Performance optimization for large codebases

---

## Summary

The Route Conflict Auto-Detection Tool is a powerful static analysis tool that helps prevent routing bugs by detecting potential conflicts before they reach production.

**Key Takeaways**:
-  Focus on **CRITICAL** conflicts first
-  Pre-register static routes in `src/index.ts`
-  Add reserved path validation in dynamic routes
-  Document route registration order
-  Integrate with CI/CD for continuous monitoring

**For more information**, see:
- `docs/architecture/ROUTE_REGISTRATION_ORDER.md`
- `scripts/route-conflict-analysis.md`
- `scripts/route-conflict-fix-summary.md`

---

*Generated by Claude Code - Route Conflict Detection Tool*
*Last Updated: 2025-10-20*
