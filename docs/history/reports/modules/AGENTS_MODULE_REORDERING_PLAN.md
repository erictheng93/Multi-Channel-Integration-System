# Agents Module Route Reordering Plan

**File**: `src/modules/agents/handlers/agent-main.ts`
**Total Routes**: 17 routes
**Conflicts to Resolve**: 17

---

## Current Route Order (WRONG)

| Line | Method | Path | Priority | Status |
|------|--------|------|----------|--------|
| 31 | POST | `/agents` | BASE | ❌ TOO EARLY (should be last!) |
| 64 | GET | `/agents` | BASE | ❌ TOO EARLY (should be last!) |
| 93 | GET | `/agents/:agentId` | PARAM | ❌ TOO EARLY (before multi-segment) |
| 131 | PUT | `/agents/:agentId` | PARAM | ❌ TOO EARLY (before multi-segment) |
| 175 | DELETE | `/agents/:agentId` | PARAM | ❌ TOO EARLY (before multi-segment) |
| 199 | POST | `/agents/:agentId/skills` | MULTI-SEG | ❌ Should be BEFORE /:agentId |
| 220 | GET | `/agents/:agentId/skills` | MULTI-SEG | ❌ Should be BEFORE /:agentId |
| 238 | PUT | `/agents/:agentId/skills/:skillId` | 3-SEG | ❌ Should be near top |
| 259 | DELETE | `/agents/:agentId/skills/:skillId` | 3-SEG | ❌ Should be near top |
| 284 | GET | `/agents/:agentId/status` | MULTI-SEG | ❌ Should be BEFORE /:agentId |
| 302 | PUT | `/agents/:agentId/status` | MULTI-SEG | ❌ Should be BEFORE /:agentId |
| 323 | GET | `/agents/:agentId/status/history` | 3-SEG | ❌ Should be near top |
| 345 | POST | `/agents/search` | SPECIFIC | ❌ Should be near top |
| 365 | PUT | `/agents/batch` | SPECIFIC | ❌ Should be near top |
| 384 | PUT | `/agents/batch/transfer` | SPECIFIC | ❌ Should be FIRST! |
| 407 | GET | `/agents/:agentId/skills/statistics` | 3-SEG | ❌ Should be near top |
| 425 | GET | `/agents/status/statistics` | SPECIFIC | ❌ Should be near top |

---

## Correct Route Order (FIXED)

### Priority 1: SPECIFIC multi-segment routes
```typescript
router.put('/agents/batch/transfer', ...)         // MOVE UP from line 384
router.get('/agents/status/statistics', ...)      // MOVE UP from line 425
```

### Priority 2: SPECIFIC routes
```typescript
router.put('/agents/batch', ...)                  // MOVE UP from line 365
router.post('/agents/search', ...)                // MOVE UP from line 345
```

### Priority 3: MULTI-SEGMENT 3-segment routes
```typescript
router.put('/agents/:agentId/skills/:skillId', ...)      // MOVE UP from line 238
router.delete('/agents/:agentId/skills/:skillId', ...)   // MOVE UP from line 259
router.get('/agents/:agentId/skills/statistics', ...)    // MOVE UP from line 407
router.get('/agents/:agentId/status/history', ...)       // MOVE UP from line 323
```

### Priority 4: MULTI-SEGMENT 2-segment routes
```typescript
router.post('/agents/:agentId/skills', ...)       // MOVE UP from line 199
router.get('/agents/:agentId/skills', ...)        // MOVE UP from line 220
router.get('/agents/:agentId/status', ...)        // MOVE UP from line 284
router.put('/agents/:agentId/status', ...)        // MOVE UP from line 302
```

### Priority 5: SINGLE PARAMETERIZED routes
```typescript
router.get('/agents/:agentId', ...)               // KEEP HERE (after multi-segment)
router.put('/agents/:agentId', ...)               // KEEP HERE
router.delete('/agents/:agentId', ...)            // KEEP HERE
```

### Priority 6: BASE routes (last!)
```typescript
router.get('/agents', ...)                        // MOVE TO END from line 64
router.post('/agents', ...)                       // MOVE TO END from line 31
```

---

## Implementation Strategy

Due to inline handlers, we'll reorder carefully:

### Step 1: Add organizational comments
- Add clear priority section markers
- Document the correct order inline

### Step 2: Move SPECIFIC routes to top
- `/agents/batch/transfer` to Priority 1
- `/agents/status/statistics` to Priority 1
- `/agents/batch` to Priority 2
- `/agents/search` to Priority 2

### Step 3: Move 3-segment routes
- `/agents/:agentId/skills/:skillId` (PUT/DELETE)
- `/agents/:agentId/skills/statistics`
- `/agents/:agentId/status/history`

### Step 4: Move 2-segment routes
- `/agents/:agentId/skills` (GET/POST)
- `/agents/:agentId/status` (GET/PUT)

### Step 5: Keep single :agentId routes
- Already in relatively correct position

### Step 6: Move base routes to end
- `/agents` (GET/POST) to very end

---

## Verification

After each step:
1. Run TypeScript compilation: `npm run build`
2. Check conflict detector: `npx tsx scripts/detect-route-conflicts.ts | grep "agents"`
3. Test endpoint access

---

**Complexity**: MODERATE (17 routes, inline handlers)
**Estimated time**: 20-25 minutes
**Risk**: MEDIUM (large number of routes to move)

---

*Planning document - executing reordering now*
