# Teams Module Route Reordering Plan

**File**: `src/modules/teams/handlers/team.ts`
**Total Routes**: 19 routes
**Conflicts to Resolve**: 16

---

## Current Route Order (WRONG)

| Line | Method | Path | Priority | Status |
|------|--------|------|----------|--------|
| 32 | GET | `/health` | STATIC | ✅ Correct position |
| 42 | GET | `/info` | STATIC | ✅ Correct position |
| 67 | GET | `/` | WILDCARD | ❌ TOO EARLY (should be last!) |
| 109 | GET | `/:id` | PARAM | ❌ TOO EARLY (before multi-segment /:id/...) |
| 140 | POST | `/` | WILDCARD | ❌ TOO EARLY (should be last!) |
| 182 | PUT | `/:id` | PARAM | ❌ TOO EARLY |
| 225 | DELETE | `/:id` | PARAM | ❌ TOO EARLY |
| 285 | GET | `/search/:query` | SPECIFIC | ❌ Should be BEFORE /:id |
| 314 | GET | `/:id/members` | PARAM+SEG | ❌ Should be BEFORE /:id |
| 339 | POST | `/:id/members` | PARAM+SEG | ❌ Should be BEFORE /:id |
| 376 | PUT | `/:id/members/:agentId` | PARAM+SEG | ✅ OK (after /:id/members) |
| 404 | DELETE | `/:id/members/:agentId` | PARAM+SEG | ✅ OK (after /:id/members) |
| 438 | POST | `/:id/qr-code` | PARAM+SEG | ❌ Should be BEFORE /:id |
| 484 | GET | `/:id/qr-codes` | PARAM+SEG | ❌ Should be BEFORE /:id |
| 514 | PUT | `/:id/qr-codes/:qrCodeId/deactivate` | PARAM+SEG | ✅ OK (after /:id/qr-codes) |
| 545 | POST | `/:id/qr-code-test` | PARAM+SEG | ❌ Should be BEFORE /:id |
| 563 | GET | `/:id/stats` | PARAM+SEG | ❌ Should be BEFORE /:id |
| 596 | GET | `/stats/all` | SPECIFIC | ❌ Should be near top |
| 620 | POST | `/transfer` | SPECIFIC | ❌ Should be near top |

---

## Correct Route Order (FIXED)

### Priority 1: STATIC routes (no params, no wildcards)
```typescript
app.get('/health', ...)           // Line 32 - KEEP
app.get('/info', ...)              // Line 42 - KEEP
```

### Priority 2: SPECIFIC routes (concrete paths, no params)
```typescript
app.get('/stats/all', ...)         // MOVE UP from line 596
app.post('/transfer', ...)         // MOVE UP from line 620
```

### Priority 3a: SPECIFIC PARAMETERIZED (concrete prefix + param)
```typescript
app.get('/search/:query', ...)     // MOVE UP from line 285
```

### Priority 3b: MULTI-SEGMENT PARAMETERIZED (/:id/something)
**Order by segment count (most segments first):**
```typescript
// 3 segments
app.put('/:id/members/:agentId', ...)           // Line 376 - KEEP
app.delete('/:id/members/:agentId', ...)        // Line 404 - KEEP
app.put('/:id/qr-codes/:qrCodeId/deactivate', ...) // Line 514 - KEEP

// 2 segments
app.get('/:id/members', ...)       // MOVE UP from line 314
app.post('/:id/members', ...)      // MOVE UP from line 339
app.get('/:id/qr-codes', ...)      // MOVE UP from line 484
app.post('/:id/qr-code', ...)      // MOVE UP from line 438
app.post('/:id/qr-code-test', ...) // MOVE UP from line 545
app.get('/:id/stats', ...)         // MOVE UP from line 563
```

### Priority 4: SINGLE PARAMETERIZED (/:id only)
```typescript
app.get('/:id', ...)               // KEEP HERE (after all /:id/... routes)
app.put('/:id', ...)               // KEEP HERE
app.delete('/:id', ...)            // KEEP HERE
```

### Priority 5: WILDCARD routes (must be LAST)
```typescript
app.get('/', ...)                  // MOVE TO END from line 67
app.post('/', ...)                 // MOVE TO END from line 140
```

---

## Implementation Strategy

Due to file size (643 lines) and inline handlers, we'll reorder in 3 safe steps:

### Step 1: Move SPECIFIC routes to top (2 routes)
- Move `/stats/all` (line 596) to after `/info`
- Move `/transfer` (line 620) to after `/stats/all`

### Step 2: Move `/search/:query` up
- Move `/search/:query` (line 285) to after `/transfer`

### Step 3: Move /:id/... routes before /:id
- Move all /:id/members, /:id/stats, /:id/qr-codes routes
- Place them BEFORE the `/:id` GET/PUT/DELETE routes

### Step 4: Move WILDCARD routes to end
- Move `/` GET (line 67) to end of file (before `export default app`)
- Move `/` POST (line 140) to end of file

---

## Risks & Mitigation

**Risks:**
1. Breaking inline handler code when moving routes
2. Line number shifts after each move
3. Losing middleware declarations

**Mitigation:**
1. Move complete handler blocks (including all lines of the inline function)
2. Work from bottom to top (later line numbers first) to minimize line shifts
3. Test after each major change
4. Keep backup file

---

## Testing Plan

After each step:
1. Run conflict detector: `npx tsx scripts/detect-route-conflicts.ts | grep "teams/sub:team"`
2. Start server: `npm run dev`
3. Test endpoints:
   - `curl http://localhost:8787/api/teams/health`
   - `curl http://localhost:8787/api/teams/stats/all`
   - `curl http://localhost:8787/api/teams/123`
   - `curl http://localhost:8787/api/teams/`

---

## Complexity Warning

⚠️ **This is the most complex migration so far!**

- 19 routes to reorder
- 643 lines of code
- Inline handlers (not extracted)
- 16 conflicts to resolve

**Estimated time**: 25-30 minutes
**Alternative approach**: Extract handlers first, then reorder (would take longer but be safer)

**Recommendation**: Proceed carefully with inline editing, test after each major step.

---

*Planning document - do not execute yet*
