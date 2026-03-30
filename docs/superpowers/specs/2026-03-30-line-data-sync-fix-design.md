# LINE User Data Sync Fix - Design Spec

**Date**: 2026-03-30
**Status**: Approved
**Approach**: (B) Consolidate + Fix

## Problem Statement

Three LINE users (洪建豐, lily卉, 呂s) reported data synchronization issues. Investigation revealed 3 confirmed bugs caused by a structural root issue: customer creation/update logic is duplicated in 4 separate code paths, each with different defects.

### Confirmed Bugs

**Bug #1 (Critical): displayName overwritten with avatarUrl**
- File: `src/modules/customer/services/customer-crud.ts:268`
- `updateData.displayName = additionalInfo.avatarUrl` (should be `updateData.avatarUrl`)
- Triggers when: avatar changes (with or without name change)
- Result: customer displayName becomes a URL string, avatarUrl never updates

**Bug #2 (High): Follow handler lacks distributed lock**
- File: `src/modules/integrations/handlers/line-follow-handler.ts:179-205`
- Customer creation uses simple if-then-insert without lock
- `line-message-handler.ts` HAS a lock; `line-follow-handler.ts` does NOT
- Triggers when: follow + message events arrive simultaneously for a new user
- Result: UNIQUE constraint violation or inconsistent data

**Bug #3 (Medium): No WebSocket broadcast for profile updates**
- No `customer_profile_updated` event exists in the WebSocket event system
- Frontend caches customer data in conversation objects (5-min TTL)
- Triggers when: customer profile updates in backend
- Result: agents see stale displayName/avatar until page reload or cache expiry

### Additional Issues

- **No `deletedAt` filter**: Webhook handlers query customers without checking `deletedAt IS NULL`, so soft-deleted customers can still receive messages
- **Silent sync failures**: Background profile sync uses fire-and-forget pattern; failures are logged as warnings but never retried
- **No `sourceTeamId`**: Main webhook handlers don't set `sourceTeamId` on customer creation

### Root Cause

Customer creation/update logic is duplicated in 4 places:

| Path | File | Lock? | deletedAt? | avatarUrl bug? |
|------|------|-------|-----------|----------------|
| LINE message | `line-message-handler.ts:130-216` | YES | NO | No (inline SQL) |
| LINE follow | `line-follow-handler.ts:179-231` | **NO** | NO | No (inline SQL) |
| Facebook message | `facebook-event-processor.ts:117-170` | YES | NO | No (inline SQL) |
| Message normalization | `message-normalization-service.ts:395-435` | **NO** | NO | No (raw SQL) |
| CustomerCrudService | `customer-crud.ts:240-299` | N/A | N/A | **YES** |
| Unused shared service | `webhook-customer-service.ts:19-107` | **NO** | NO | No |

Fixes applied in one path don't propagate to others. This is the structural cause of recurrence.

## Solution Architecture

### Core Change: Single Canonical Service

Rewrite `src/modules/integrations/services/webhook-customer-service.ts` as the single source of truth for all webhook-triggered customer operations. All 4 webhook handlers delegate to this service instead of containing inline logic.

```
line-message-handler ──┐
line-follow-handler  ──┤──→ WebhookCustomerService (single service)
facebook-event-proc  ──┤      ├─ findOrCreateCustomer()  [lock + deletedAt + LIFF]
msg-normalization    ──┘      ├─ updateCustomerProfile()  [correct fields + WS broadcast]
                              └─ triggerBackgroundSyncIfNeeded()  [retry on failure]
```

### Service API

#### `findOrCreateCustomer(env, platformUserId, platform, opts?)`

Parameters:
- `env: Bindings` - Worker bindings
- `platformUserId: string` - LINE User ID or Facebook PSID
- `platform: 'line' | 'facebook'`
- `opts?: { groupId?: string; sourceTeamId?: number }` - optional context

Flow:
1. Query existing customer: `WHERE platform = ? AND platformUserId = ? AND deletedAt IS NULL`
2. If found, return existing customer
3. If not found, acquire distributed lock: `webhook:customer:{platform}:{platformUserId}` (TTL 15s, timeout 8s)
4. Double-check inside lock (prevent race)
5. Fetch profile via `UserSyncService.syncLineUser()` or `syncFacebookUser()`
6. If LINE and profile fetch failed, fallback to LIFF-captured displayName from `customer_team_assignments`
7. INSERT customer with correct fields (including `sourceTeamId` if provided)
8. Re-query and return

#### `updateCustomerProfile(env, customerId, updates)`

Parameters:
- `env: Bindings`
- `customerId: number`
- `updates: { displayName?: string; avatarUrl?: string | null; metadata?: Record<string, unknown> }`

Flow:
1. Typed interface ensures `displayName` only receives strings, `avatarUrl` only receives URLs (prevents field confusion bug)
2. Diff against current values to detect actual changes
3. UPDATE only changed fields + `updatedAt = now()`
4. If `displayName` or `avatarUrl` changed:
   - Query affected conversationIds: `SELECT id FROM conversations WHERE customer_id = ? AND status != 'closed' AND deleted_at IS NULL`
   - Broadcast `customer_profile_updated` via WebSocket to each conversation room

#### `triggerBackgroundSyncIfNeeded(env, platformUserId, platform, opts?)`

Parameters:
- `env: Bindings`
- `platformUserId: string`
- `platform: 'line' | 'facebook'`
- `opts?: { groupId?: string }`

Flow:
1. Call `UserSyncService.needsUpdate()` (24h staleness check)
2. If stale, fire-and-forget sync (preserves webhook response latency)
3. On sync failure: `SET updatedAt = NULL WHERE platformUserId = ? AND platform = ?`
   - This ensures `needsUpdate()` returns true on the next interaction, triggering an immediate retry
   - Replaces silent failure with self-healing retry pattern

### File Changes

#### REWRITE: `src/modules/integrations/services/webhook-customer-service.ts`
- Rewrite `findOrCreateCustomer()` with distributed lock, deletedAt filter, LIFF fallback, sourceTeamId
- Rewrite `triggerBackgroundSyncIfNeeded()` with retry-on-failure pattern
- NEW: `updateCustomerProfile()` with typed interface and WebSocket broadcast

#### FIX: `src/modules/customer/services/customer-crud.ts`
- Line 268: `updateData.displayName = additionalInfo.avatarUrl` -> `updateData.avatarUrl = additionalInfo.avatarUrl`
- This standalone fix is needed because `CustomerCrudService.findOrCreate()` is a separate code path used by the customer management API (not webhooks)

#### SIMPLIFY: `src/modules/integrations/handlers/line-message-handler.ts`
- Replace inline customer creation (lines 130-216) with `findOrCreateCustomer()` call
- Replace inline sync check (lines 229-244) with `triggerBackgroundSyncIfNeeded()` call
- Keep message-specific logic (message parsing, dedup, saveMessage) as-is

#### SIMPLIFY: `src/modules/integrations/handlers/line-follow-handler.ts`
- Replace inline customer creation (lines 179-205) with `findOrCreateCustomer()` call
- Replace inline customer update (lines 219-231) with `updateCustomerProfile()` call
- Keep follow-specific logic inline: QR code token extraction, parallel team assignment lookup, LIFF displayName override, welcome auto-reply

#### SIMPLIFY: `src/modules/integrations/handlers/facebook-event-processor.ts`
- Replace inline customer creation (lines 117-170) with `findOrCreateCustomer()` call
- Replace inline sync check (lines 172-186) with `triggerBackgroundSyncIfNeeded()` call

#### SIMPLIFY: `src/modules/integrations/services/message-normalization-service.ts`
- Remove private `findOrCreateCustomer()` method (lines 395-435)
- Delegate to shared `findOrCreateCustomer()` from webhook-customer-service
- Note: This service receives `db: D1Database` directly (not `env: Bindings`). The shared `findOrCreateCustomer` requires `env` for distributed lock access. The normalization service's `processInboundMessage` caller must pass `env` instead of bare `db`, or the normalization service must store `env` in its constructor. Preferred: add `env: Bindings` to `ProcessInboundMessageOptions` and pass through.

#### ADD: Frontend WebSocket handler for `customer_profile_updated`
- `frontend/src/stores/conversations/realtimeHandler.ts`: Add handler for `customer_profile_updated` event
- On receive: update customer fields in cached conversation objects, invalidate conversation list cache

### WebSocket Event: `customer_profile_updated`

```typescript
{
  type: 'customer_profile_updated',
  source: 'webhook',
  conversationId: string,  // for routing to correct conversation room
  data: {
    customerId: number,
    changes: {
      displayName?: string,
      avatarUrl?: string | null
    },
    conversationIds: string[]  // all active conversations for this customer
  }
}
```

Delivery: Uses existing `broadcastToConversationRooms()` infrastructure. One event per affected conversation room.

### Follow Handler Detail

The follow handler has unique logic that other handlers don't share. After consolidation:

1. `findOrCreateCustomer(env, userId, 'line')` -- shared service (now has lock)
2. Follow-specific logic (kept inline):
   - QR code token extraction (followParam / linkNonce / liffParam)
   - Parallel team assignment lookup (Promise.all with assignment + QR tasks)
   - LIFF displayName override if LINE API failed
   - Team assignment to customer metadata
   - Conversation creation with team assignment
   - Welcome auto-reply message
3. `updateCustomerProfile(env, customer.id, { displayName, avatarUrl, metadata })` -- shared service

### Data Repair

One-time script to fix existing corrupted records:

1. Query: `SELECT * FROM customers WHERE display_name LIKE 'http%' OR display_name LIKE '%line-scdn%' OR display_name LIKE '%fbcdn%'`
2. For each corrupted customer: call LINE/Facebook Profile API to fetch real displayName
3. UPDATE with correct displayName and avatarUrl
4. Specifically verify the 3 reported users: 洪建豐, lily卉, 呂s

Delivery: One-time repair function added to `webhook-customer-service.ts` (`repairCorruptedDisplayNames(env)`), callable via a temporary admin API endpoint. Remove the endpoint after repair is confirmed.

## Testing Strategy

### Unit Tests: `webhook-customer-service.test.ts`

**findOrCreateCustomer():**
- Creates new customer with correct fields (displayName, avatarUrl, platform, platformUserId)
- Returns existing customer without creating duplicate
- Distributed lock prevents race condition (concurrent calls for same user)
- `deletedAt IS NULL` filter excludes soft-deleted customers
- LIFF fallback works when LINE API fails
- Works correctly for both LINE and Facebook platforms

**updateCustomerProfile():**
- displayName updated correctly when only name changes
- avatarUrl updated correctly when only avatar changes
- Both fields updated correctly when both change simultaneously
- WebSocket broadcast fires when displayName or avatarUrl changes
- No broadcast when nothing actually changed
- Typed interface prevents field confusion (compile-time safety)

**triggerBackgroundSyncIfNeeded():**
- Skips sync if customer was updated recently (<24h)
- Triggers sync if customer is stale (>24h)
- On sync failure: sets updatedAt to null (enables retry on next interaction)

### Regression Tests: `customer-crud.test.ts`

**findOrCreate() field mapping:**
- Avatar changes only -> avatarUrl updated, displayName preserved
- Name changes only -> displayName updated, avatarUrl preserved
- Both change -> both updated correctly
- Neither changes -> no update triggered

### Integration Tests

- LINE message handler uses shared service (no inline customer SQL)
- LINE follow handler uses shared service AND has distributed lock
- Facebook event processor uses shared service
- Concurrent follow + message for same new user -> exactly 1 customer record created

### Frontend Tests

- `customer_profile_updated` WebSocket event updates conversation customer data
- Cache invalidation triggers conversation list refresh

## Verification Plan

### Pre-Deploy
1. All existing tests pass (backend 1842 + frontend 3624)
2. New unit tests for consolidated service pass
3. New regression tests for customer-crud.ts field mapping pass
4. TypeScript strict mode compilation passes

### Post-Deploy
1. Run data repair script for corrupted displayNames
2. Verify the 3 reported users (洪建豐, lily卉, 呂s) show correct names
3. Monitor structured logs for:
   - Profile sync failures (should now self-heal via retry)
   - UNIQUE constraint violations on customers table (should be zero)
   - `customer_profile_updated` WebSocket events firing correctly

### Long-Term Prevention
- Typed `UpdateCustomerData` interface prevents field confusion at compile time
- Single service eliminates logic duplication (bugs fixed once, applied everywhere)
- Distributed lock on all paths prevents race conditions
- Retry-on-failure pattern prevents silent sync failures from persisting
- WebSocket broadcast ensures frontend always reflects latest data

## Files Changed Summary

| File | Action | Lines Changed (est.) |
|------|--------|---------------------|
| `src/modules/integrations/services/webhook-customer-service.ts` | Rewrite | ~200 |
| `src/modules/customer/services/customer-crud.ts` | Fix line 268 | 1 |
| `src/modules/integrations/handlers/line-message-handler.ts` | Simplify | -80, +10 |
| `src/modules/integrations/handlers/line-follow-handler.ts` | Simplify | -50, +15 |
| `src/modules/integrations/handlers/facebook-event-processor.ts` | Simplify | -60, +10 |
| `src/modules/integrations/services/message-normalization-service.ts` | Simplify | -40, +10 |
| `frontend/src/stores/conversations/realtimeHandler.ts` | Add handler | +30 |
| `tests/unit/services/webhook-customer-service.test.ts` | New | ~300 |
| `tests/unit/modules/customer/services/customer-crud-field-mapping.test.ts` | New | ~100 |

**Net effect**: ~230 lines removed (duplicated inline logic), ~200 lines added (consolidated service), ~400 lines tests added.
