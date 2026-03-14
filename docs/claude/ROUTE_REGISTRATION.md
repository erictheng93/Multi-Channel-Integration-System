# Route Registration Order ( Critical)

**WHY IT MATTERS**: In Hono framework, route registration order determines routing priority. Routes registered later **cannot override** earlier catch-all routes. This can cause route interception issues where endpoints return unexpected authentication errors.

## Route Registration Priority Levels

Routes in `src/index.ts` MUST be registered in this specific order:

```

 Priority 1 (HIGHEST): Public Endpoints Without Auth

 Register BEFORE Unified Route System (Line ~221-240)

 WebSocket health endpoints
 /api/websocket/health
 /api/websocket/migration-status

 CORS monitoring endpoints
 /api/cors/health (Public)
 /api/cors/config (Public)
 /api/cors/stats (Admin - internal auth check)

 Analytics comparison API
 /api/analytics/comparison/*

 WHY: These need direct access without middleware
 interception from unified route system


 Priority 2: Explicit Auth Middleware + Handler

 Register BEFORE Unified Route System (Line ~238-243)

 WebSocket Dashboard (with explicit jwtAuth)
 app.use('/api/websocket/dashboard/*', jwtAuth)
 app.route('/api/websocket/dashboard', handler)

 WHY: Explicit middleware declaration for clarity


 Priority 3: Unified Route System (Line ~252)

 RouteRegistry + routeGroups.forEach(...)

 Batch registration of modular routes
 May create catch-all routes
 Can intercept later registrations

 WHY: Centralized route management for most endpoints


 Priority 4 (LOWEST): Fine-grained Individual Routes

 Register AFTER Unified Route System (Line ~297+)

 System settings endpoints
 Credentials management
 Team management endpoints

 WHY: Specific endpoints that don't conflict with
 catch-all routes

```

## Common Pitfalls & Solutions

**Problem**: New endpoint returns `401 Unauthorized` even without auth requirements

```typescript
// BAD: Register after unified route system
const routeRegistry = new RouteRegistry(app);
routeGroups.forEach(group => routeRegistry.registerGroup(group));

// This will be intercepted by unified system!
app.route('/api/myendpoint', myHandler); // TOO LATE
```

```typescript
// GOOD: Pre-register BEFORE unified route system
// Register public endpoint first
app.route('/api/myendpoint', myHandler); // PRIORITY

const routeRegistry = new RouteRegistry(app);
routeGroups.forEach(group => routeRegistry.registerGroup(group));
```

## Route Registration Checklist

When adding a new API handler:

- [ ] **Does it need public access (no auth)?**
  - YES → Register BEFORE unified route system (Priority 1)
  - NO → Can register in unified system or after (Priority 3-4)

- [ ] **Test with diagnostic route first**
  ```typescript
  app.route('/test-myendpoint', myHandler); // Test route
  app.route('/api/myendpoint', myHandler); // Production route
  ```

- [ ] **Verify with curl testing**
  ```bash
  curl https://your-domain.com/api/myendpoint
  # Should NOT return 401 if public endpoint
  ```

- [ ] **Add E2E test coverage**
  - Test both authenticated and unauthenticated scenarios

- [ ] **Document in route registration section**
  - Add clear comments explaining WHY this route needs special positioning

## Reference: Recent Fix Example

**Issue**: CORS monitoring endpoints returned 401 errors
- **Root Cause**: Handler registered AFTER unified route system (Line 425+)
- **Solution**: Moved registration BEFORE unified system (Line 221)
- **Result**: All 12 E2E tests passing, endpoints accessible
- **Fix Version**: d51fc6c8-02aa-4458-82af-af8e9c6d5d6a

See `docs/architecture/ROUTE_REGISTRATION_ORDER.md` for detailed guide.

## Visual Route Registration Flow

```
src/index.ts Execution Flow:
┌───────────────────────────────────────────────────────┐
│ 1. Import handlers and middleware │
└───────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────┐
│ 2. Register Priority 1: Public Endpoints │
│ - WebSocket health │
│ - CORS monitoring │
│ - Analytics comparison │
└───────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────┐
│ 3. Register Priority 2: Explicit Auth Endpoints │
│ - WebSocket dashboard (with jwtAuth) │
└───────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────┐
│ 4. Register Priority 3: Unified Route System │
│ - RouteRegistry.registerGroup() │
│ - Batch handler registration │
│ - May create catch-all routes │
└───────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────┐
│ 5. Register Priority 4: Fine-grained Routes │
│ - System settings │
│ - Credentials management │
└───────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────┐
│ 6. Export app │
└───────────────────────────────────────────────────────┘
```

## Debugging Route Issues

### Check Route Registration

```typescript
// Add logging to verify route order
console.log('Registering public endpoints...');
app.route('/api/public', publicHandler);

console.log('Registering unified route system...');
const routeRegistry = new RouteRegistry(app);

console.log('Route registration complete');
```

### Test Route Priority

```bash
# Test public endpoint (should work without auth)
curl https://your-domain.com/api/websocket/health

# Test protected endpoint (should require auth)
curl https://your-domain.com/api/conversations
```

### Inspect Route Conflicts

Look for routes that might create catch-all patterns:
- `app.route('/api/*', handler)` - Catches ALL /api/* routes
- `app.use('/api/*', middleware)` - Applies middleware to ALL /api/* routes

## Best Practices

1. **Group Related Routes**: Keep public endpoints together at Priority 1
2. **Comment WHY**: Always explain why a route needs specific positioning
3. **Test Early**: Verify routes work before integrating into unified system
4. **Document Changes**: Update this file when adding new priority rules
5. **Use Explicit Middleware**: Prefer explicit middleware over catch-all patterns
