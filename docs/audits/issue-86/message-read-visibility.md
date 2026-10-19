# Issue #86: message read visibility

This implements the read-consistency phase of option A. It does not introduce
a soft-delete writer or change recall (`is_recalled`) behavior. No schema,
migration, environment, or Durable Object alarm changes are needed.

## Read contract

- `notDeletedMessage` in `src/db/message-conditions.ts` is the shared Drizzle
  condition used by the message DO, session list/count, and attachment routes.
  Raw SQL and queries with table aliases use equivalent `deleted_at IS NULL`
  clauses; the shared condition must not be applied blindly to aliased tables.
- All four DO message-result branches filter before ordering and limiting.
  A cursor anchor includes deleted rows, but must belong to the requested
  conversation. Missing or null-timestamp anchors retain the existing fallback.
- List and detail latest-message previews exclude deleted rows. The list query
  filters both its MAX timestamp subquery and the outer joined message rows,
  including when deleted and visible messages share a timestamp.
- DO attachment batches use the visible message IDs. The separate attachment
  GET and POST APIs treat deleted parent messages as missing (404).
- Session list/count use the same filter. Sequence allocation intentionally
  includes deleted rows to avoid reusing an earlier sequence number.
- Latest-message cache DB fallback and warmup exclude deleted rows. Existing
  cache hits are unchanged; a future delete writer must invalidate them.

## Deferred decisions

- Customer activity statistics (`customer-stats.ts`), analytics
  (`analytics-queries.ts`), and reports (`report-generator-service.ts`) keep
  their existing metric definitions. Before changing them, decide whether each
  metric measures visible messages or historical service activity. These are
  not all presentation queries; some analytics functions are placeholders.
- Reply target validation, delivery queues, webhook deduplication, restoration,
  and privacy/file retention require writer-side policy. They are not a generic
  instruction to filter every message lookup. A complete soft-delete feature
  must define those policies and cache/frontend invalidation before activation.
- Timestamp-only pagination can still skip messages sharing a timestamp. This
  pre-existing behavior is outside this patch; retaining deleted cursor anchors
  does not solve it or the fallback for physically removed anchors.

## Verification

`tests/unit/services/message-read-visibility.test.ts` exercises the actual
Drizzle/D1 SQL against SQLite, and real Hono handlers with authentication and
file signing stubbed. It covers all DO branches, deleted and foreign cursors,
limit boundaries, attachment visibility, session totals/sequence allocation,
cache fallback/warmup, and list/detail/window consistency.

Production/remote validation remains a deployment check. Tests do not modify
production messages or introduce a deletion endpoint.
