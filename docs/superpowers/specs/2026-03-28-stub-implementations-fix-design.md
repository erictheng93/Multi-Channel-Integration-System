# Stub Implementations Fix — Design Spec

**Date:** 2026-03-28
**Scope:** Replace 12 TODO stubs returning fake data with real implementations (11 actionable + 1 documentation fix)

## Problem

12 TODO stubs across 4 service files return hardcoded zeros or no-ops in production. Users see fabricated statistics and broken features (export, file deletion).

## Files & Stubs

| # | File | Stubs | Impact |
|---|------|-------|--------|
| 1 | `src/modules/session/services/session-service.ts` | 5 | Fake priority/sentiment stats, empty tag ops |
| 2 | `src/modules/analytics/services/period-comparison-service.ts` | 5 | All return `0` |
| 3 | `src/modules/reports/services/report-manager-service.ts` | 1 | Export silently does nothing |
| 4 | `src/modules/reports/services/report-generator-service.ts` | 1 | R2 file not deleted |

**Also affected:** `session-stats-service.ts` and `analytics-service.ts` have the same priority/sentiment stubs (3 copies of the same fake logic).

## Design Decision: Fields Without Backing Data

**Chosen: Option A — Return `null`** for metrics with no DB column or table.

- `sessionsBySentiment` → `null` (no sentiment column in DB)
- `customerSatisfactionScore` → `null` (no rating/feedback table)

**Why:** Zero is a valid measurement value. `null` is unambiguous — "not available." The frontend renders "N/A" or hides the section. The API contract is preserved (field exists, type becomes nullable). When these features are eventually implemented, `null` → real data is a non-breaking upgrade.

## Implementation Details

### Group A: session-service.ts + session-stats-service.ts + analytics-service.ts

#### A1: `sessionsByPriority` — Real DB query

The `conversationSessions` table has no `priority` column, but `conversations` does. JOIN through `conversationId`:

```sql
SELECT c.priority, COUNT(*) as count
FROM conversation_sessions cs
JOIN conversations c ON cs.conversation_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.priority
```

Map results to `{ low, medium, high, urgent }` with defaults of 0. Sessions whose conversation has no priority default to `'normal'` (schema default).

**Apply to all 3 files:** `session-service.ts:669`, `session-stats-service.ts:30`, `analytics-service.ts:404-421`.

#### A2: `sessionsBySentiment` — Return `null`

Change `SessionStats.sessionsBySentiment` type from `Record<...>` to `Record<...> | null`.

All 3 implementations return `null` instead of `{ positive: 0, negative: 0, neutral: total }`.

**Type change:** `src/modules/session/types/session-types.ts:124`

**Apply to all 3 files:** `session-service.ts:670`, `session-stats-service.ts:31`, `analytics-service.ts:424-441`.

#### A3: Tag operations (`add_tags`, `remove_tags`) — Real implementation

The `conversation_tags` table exists with `(conversationId, tagId, assignedBy, assignedAt)`.

For a given session, look up its `conversationId`, then:
- **add_tags**: INSERT INTO `conversation_tags` for each tag ID in `operation.data.tagIds`
- **remove_tags**: DELETE FROM `conversation_tags` WHERE matching

The handler has access to `c.get('jwtPayload')` with `userId`. Add optional `userId` parameter to `batchOperation(operation, userId?)` and pass it from the handler. Use it as `assignedBy` for tag operations.

**Fallback:** If `operation.data?.tags` is missing or empty, skip silently (already the pattern for `update_priority`).

### Group B: period-comparison-service.ts

#### B1: `getAverageResolutionTime` — Real calculation

Resolution time = time from conversation creation to close.

```sql
SELECT AVG(
  (julianday(closed_at) - julianday(created_at)) * 24 * 60
) as avg_minutes
FROM conversations
WHERE closed_at IS NOT NULL
  AND deleted_at IS NULL
  AND created_at BETWEEN :start AND :end
```

Returns average in **minutes**. Uses existing `buildWhereConditions('conversations', period, filters)` pattern + `conversations.status = 'closed'` filter (already used by `getClosedConversations`).

#### B2: `getAverageResponseTime` — Real calculation

First response time = `firstResponseAt - createdAt` for conversations that have a first response.

```sql
SELECT AVG(
  (julianday(first_response_at) - julianday(created_at)) * 24 * 60
) as avg_minutes
FROM conversations
WHERE first_response_at IS NOT NULL
  AND deleted_at IS NULL
  AND created_at BETWEEN :start AND :end
```

Returns average in **minutes**.

#### B3: `getCustomerSatisfactionScore` — Return `null`

No rating/feedback table exists in the schema. Change return type to `number | null`, return `null`.

Update the metric dispatcher to handle `null` in `ComparisonData` (the `buildComparisonData` method treats `null` as "not available" — both current and previous are `null`, trend is `'stable'`).

#### B4: `getAverageSessionDuration` — Real calculation

```sql
SELECT AVG(
  (julianday(end_time) - julianday(start_time)) * 24 * 60
) as avg_minutes
FROM conversation_sessions
WHERE end_time IS NOT NULL
  AND created_at BETWEEN :start AND :end
```

Note: `conversationSessions` is not in the current `buildWhereConditions` table map. Add `'sessions'` case mapping to `conversationSessions.createdAt`.

#### B5: `getUserEngagementRate` — Real calculation

Engagement rate = active users / total active agents in the period.

```sql
-- Active users (from activities table, already implemented)
SELECT COUNT(DISTINCT user_id) FROM activities WHERE created_at BETWEEN :start AND :end

-- Total agents
SELECT COUNT(*) FROM agents WHERE is_active = 1 AND deleted_at IS NULL
```

Rate = `activeUsers / totalAgents * 100`. Returns percentage (0-100). If no agents, return 0.

### Group C: report-manager-service.ts

#### C1: Export action — Delegate to download

The export action in `batchOperation` should reuse `downloadReport()`:

```typescript
case 'export': {
  const exportResult = await generator.downloadReport(reportId, userId, utils);
  success = !!exportResult;
  downloadUrl = exportResult?.url;
  break;
}
```

This is identical to the `download` case. The distinction between "download" and "export" is a frontend concern (different trigger, same backend action). If format conversion is needed later, it can be added here.

### Group D: report-generator-service.ts

#### D1: `deleteReportFile` — Remove dead stub

**Finding:** Reports are NOT stored in R2. The `downloadUrl` is `/api/reports/{id}/download` — an API route that regenerates report data from DB on each request. There is no R2 object to delete.

**Action:** Remove the TODO comment. The method body stays empty (no-op) because there's no file to delete. Add a clarifying comment explaining why:

```typescript
async deleteReportFile(_downloadUrl: string): Promise<void> {
  // Reports are generated on-the-fly from DB data, not stored in R2.
  // No file cleanup needed — deleting the report DB record is sufficient.
}
```

This reduces the stub count from 12 to 11 actionable items (this one is a documentation fix only).

## Type Changes Summary

| File | Change |
|------|--------|
| `session-types.ts:124` | `sessionsBySentiment: Record<...> \| null` |
| `period-comparison-service.ts` | `getCustomerSatisfactionScore` return type → `number \| null` |
| `period-comparison-service.ts` | `buildWhereConditions` add `'sessions'` table case |
| `report-generator-service.ts` | Remove TODO, add clarifying comment (no-op is correct) |

## Frontend Impact

Minimal. Components rendering `sessionsBySentiment` need a `v-if` null guard. Search for consumers:

- Session stats display components
- Any dashboard widget showing sentiment breakdown

These should render "N/A" or hide when `null`.

## Testing Strategy

- **session-service**: Test priority stats return real distribution from joined conversations
- **period-comparison**: Test each metric returns non-zero for seeded data; test `null` for satisfaction
- **report-manager**: Test export action calls download flow
- **report-generator**: Test `deleteReportFile` calls R2 delete (mock R2 bucket)

## Out of Scope

- Adding a `sentiment` column to `conversation_sessions` (future feature)
- Adding a customer satisfaction/rating table (future feature)
- Frontend changes for null guards (separate PR if needed)
