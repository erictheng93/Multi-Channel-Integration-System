# Unread Count Backend Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `unreadCount` to the conversation listing and detail API responses so the already-implemented frontend green dot indicators render correctly.

**Architecture:** Zero-migration approach. Add a batch SQL subquery to `conversation-queries.ts` that counts customer messages sent after the last agent/system reply per conversation. This uses the semantic "unread = customer waiting for a response," which matches LINE OA behavior. No new tables, columns, or endpoints needed.

**Tech Stack:** Cloudflare Workers (Hono), D1 (SQLite), raw SQL via `c.env.DB.prepare()`

**Spec:** Approved during brainstorming in conversation (2026-03-24). No separate spec file — this is a targeted bug fix.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/modules/conversations/handlers/conversation-queries.ts` | Modify | Add unread count SQL query to both LIST and DETAIL endpoints |
| `tests/integration/handlers/conversation-handlers.integration.test.ts` | Modify | Add tests verifying `unreadCount` in API responses |

---

### Task 1: Add unread count batch query to conversation LIST handler

**Files:**
- Modify: `src/modules/conversations/handlers/conversation-queries.ts` (lines 295-420)

- [ ] **Step 1: Add the unread count batch SQL query**

After the existing `lastMessagesMap` query block (after line 397), add a new batch query that counts unread messages per conversation. Insert this block BEFORE the `combinedData` mapping (before line 399):

```typescript
    // Batch query: count unread customer messages per conversation
    // "Unread" = customer messages sent after the last agent/system reply
    let unreadCountMap = new Map<string, number>();

    if (conversationIds.length > 0) {
      const unreadPlaceholders = conversationIds.map(() => '?').join(',');
      const unreadCountQuery = `
        SELECT
          m.conversation_id as conversationId,
          COUNT(*) as unreadCount
        FROM messages m
        WHERE m.conversation_id IN (${unreadPlaceholders})
          AND m.sender_type = 'customer'
          AND m.deleted_at IS NULL
          AND m.created_at > COALESCE(
            (SELECT MAX(m2.created_at) FROM messages m2
             WHERE m2.conversation_id = m.conversation_id
             AND m2.sender_type IN ('agent', 'system')
             AND m2.deleted_at IS NULL),
            '1970-01-01'
          )
        GROUP BY m.conversation_id
      `;

      try {
        const unreadResult = await c.env.DB.prepare(unreadCountQuery)
          .bind(...conversationIds)
          .all();

        if (unreadResult.results) {
          for (const row of unreadResult.results as any[]) {
            unreadCountMap.set(row.conversationId, Number(row.unreadCount));
          }
        }
      } catch (unreadError) {
        log.warn('Failed to fetch unread counts', {
          error: unreadError instanceof Error ? unreadError.message : String(unreadError)
        });
        // Continue with empty map — unreadCount will default to 0
      }
    }
```

- [ ] **Step 2: Include unreadCount in the combinedData response**

In the `combinedData` mapping (line ~403, inside `return { ...conv, ...`), add `unreadCount` after `lastMessageType`:

```typescript
        // Unread count: customer messages awaiting agent response
        unreadCount: unreadCountMap.get(conv.id) || 0
```

The full return block should look like:
```typescript
      return {
        ...conv,
        lastMessage: (lastMsg && displayContent) ? { ... } : null,
        lastMessageContent: displayContent,
        lastMessageAtActual: lastMsg?.createdAt || null,
        lastMessageType: lastMsg?.messageType || null,
        // Unread count: customer messages awaiting agent response
        unreadCount: unreadCountMap.get(conv.id) || 0
      };
```

- [ ] **Step 3: Run type check**

Run: `cd /d/Code/Multi_Channel_Integration_System && bunx tsc --noEmit`
Expected: PASS — no type errors

- [ ] **Step 4: Commit**

```bash
git add src/modules/conversations/handlers/conversation-queries.ts
git commit -m "feat(conversations): add unreadCount to conversation list API response"
```

---

### Task 2: Add unread count to conversation DETAIL handler

**Files:**
- Modify: `src/modules/conversations/handlers/conversation-queries.ts` (lines 74-123)

- [ ] **Step 1: Add unread count query to the detail endpoint**

After the existing `lastMessageData` query (after line 88), add a single-conversation unread count query:

```typescript
    // Query unread count for this conversation
    let unreadCount = 0;
    try {
      const unreadResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as unreadCount
        FROM messages m
        WHERE m.conversation_id = ?
          AND m.sender_type = 'customer'
          AND m.deleted_at IS NULL
          AND m.created_at > COALESCE(
            (SELECT MAX(m2.created_at) FROM messages m2
             WHERE m2.conversation_id = m.conversation_id
             AND m2.sender_type IN ('agent', 'system')
             AND m2.deleted_at IS NULL),
            '1970-01-01'
          )
      `).bind(conversationId).first();

      if (unreadResult) {
        unreadCount = Number((unreadResult as any).unreadCount) || 0;
      }
    } catch (unreadError) {
      log.warn('Failed to fetch unread count for conversation', { conversationId, error: unreadError });
    }
```

- [ ] **Step 2: Include unreadCount in the response object**

In the `conversationData` object (line ~93), add `unreadCount` after `lastMessageType`:

```typescript
      lastMessageType: lastMessageData?.messageType || null,
      // Unread count: customer messages awaiting agent response
      unreadCount
```

- [ ] **Step 3: Run type check**

Run: `cd /d/Code/Multi_Channel_Integration_System && bunx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/conversations/handlers/conversation-queries.ts
git commit -m "feat(conversations): add unreadCount to conversation detail API response"
```

---

### Task 3: Add integration tests for unreadCount

**Files:**
- Modify: `tests/integration/handlers/conversation-handlers.integration.test.ts`

- [ ] **Step 1: Add test for unreadCount in conversation list response**

Add a new describe block inside the existing `Conversation Handlers Integration Tests` suite. The test needs to configure `env.DB.prepare` to return unread count data:

```typescript
  describe('GET /api/conversations — unreadCount', () => {
    test('should include unreadCount in response when unread messages exist', async () => {
      // Setup: conversations with customers
      resetMockDbState({
        selectResults: [
          {
            conversations: {
              id: 'conv-001',
              customerId: 1,
              assignedTeamId: null,
              status: 'active',
              priority: null,
              firstResponseAt: null,
              closedAt: null,
              lastMessageAt: '2026-01-01T00:00:00Z',
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
              deletedAt: null,
            },
            customers: {
              id: 1,
              displayName: 'Test Customer',
              platform: 'line',
              platformUserId: 'U123',
              avatarUrl: null,
              createdAt: '2026-01-01T00:00:00Z',
            },
            teams: null,
          },
        ],
      });

      // Mock DB.prepare to return unread counts
      const mockAll = vi.fn()
        .mockResolvedValueOnce({ success: true, results: [
          { messageId: 'msg-1', conversationId: 'conv-001', content: 'Hello', createdAt: '2026-01-01T00:00:00Z', senderType: 'customer', messageType: 'text' }
        ] })  // latestMessages query
        .mockResolvedValueOnce({ success: true, results: [
          { conversationId: 'conv-001', unreadCount: 3 }
        ] });  // unreadCount query

      env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: mockAll,
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const res = await makeRequest(app, '/api/conversations');
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data[0].unreadCount).toBe(3);
    });

    test('should return unreadCount 0 when no unread messages', async () => {
      resetMockDbState({
        selectResults: [
          {
            conversations: {
              id: 'conv-001',
              customerId: 1,
              assignedTeamId: null,
              status: 'active',
              priority: null,
              firstResponseAt: null,
              closedAt: null,
              lastMessageAt: '2026-01-01T00:00:00Z',
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
              deletedAt: null,
            },
            customers: {
              id: 1,
              displayName: 'Test Customer',
              platform: 'line',
              platformUserId: 'U123',
              avatarUrl: null,
              createdAt: '2026-01-01T00:00:00Z',
            },
            teams: null,
          },
        ],
      });

      // Mock: no unread messages returned
      const mockAll = vi.fn()
        .mockResolvedValueOnce({ success: true, results: [
          { messageId: 'msg-1', conversationId: 'conv-001', content: 'Agent reply', createdAt: '2026-01-01T01:00:00Z', senderType: 'agent', messageType: 'text' }
        ] })
        .mockResolvedValueOnce({ success: true, results: [] });  // empty = no unread

      env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: mockAll,
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const res = await makeRequest(app, '/api/conversations');
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.data[0].unreadCount).toBe(0);
    });
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /d/Code/Multi_Channel_Integration_System && bunx vitest run tests/integration/handlers/conversation-handlers.integration.test.ts`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/integration/handlers/conversation-handlers.integration.test.ts
git commit -m "test(conversations): add integration tests for unreadCount in API response"
```

---

### Task 4: Deploy and verify

- [ ] **Step 1: Deploy backend**

Run: `cd /d/Code/Multi_Channel_Integration_System && bun run deploy`
Expected: Successful deployment

- [ ] **Step 2: Verify in browser**

1. Navigate to `http://localhost:5173/conversations`
2. Check that conversations with pending customer messages show green dots
3. Check that conversations where the last message is from an agent show no dots
4. Verify the API response includes `unreadCount` field with correct values

- [ ] **Step 3: Run full test suite**

Run: `cd /d/Code/Multi_Channel_Integration_System && bunx vitest run`
Expected: ALL PASS — no regressions
