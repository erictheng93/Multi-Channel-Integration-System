# ADR 0004 — Per-Agent Conversation Read State

- **Status:** Accepted
- **Date:** 2026-08-31
- **Deciders:** Eric (project owner)
- **Related code:** `src/modules/conversations/services/conversation-read-state.ts`,
  `src/modules/conversations/handlers/conversation-read.ts`,
  `src/modules/conversations/handlers/conversation-queries.ts`,
  `src/modules/conversations/handlers/conversation-messages.ts`,
  `migrations/0060_add_conversation_read_states.sql`
- **Supersedes:** none
- **Superseded by:** none

## Context

Read/unread state lived in two columns on the conversation row:

| Column | Added by | Meaning |
|--------|----------|---------|
| `conversations.last_read_at` | Migration 0047 | When "an agent" last viewed this conversation |
| `conversations.marked_unread_at` | Migration 0054 | Manual unread override; floors the effective count at 1 |

Neither column carries an `agent_id`. With 30 active agents across 11 teams, that
made read state a single shared cell: one agent opening a conversation cleared
the unread badge for everyone, and one agent marking a conversation unread
raised a badge on all 29 others. The behaviour was intentional at the time — the
button's own comment in `ConversationHeader.vue` reads
「設定手動未讀標記，讓其他客服在列表看到未讀徽章」 — but it makes the badge
useless as a personal work queue, which is what operators actually use it for.

The unread count itself is derived, never stored:

```
unread = customer messages created after MAX(last_agent_reply, last_read_at)
         floored at 1 when marked_unread_at IS NOT NULL
```

The two terms of that `MAX` mean different things, and conflating them is the
root of the problem:

| Term | Real meaning | Naturally scoped to |
|------|--------------|---------------------|
| `last_agent_reply` | "this customer message has been handled" | the team |
| `last_read_at` | "I have personally seen this" | one agent |

A previous investigation (2026-07-21) concluded the formula could not express
per-agent state without a schema change. This ADR is that schema change.

## Decision

Add a table keyed on the missing dimension:

```sql
CREATE TABLE conversation_read_states (
  agent_id         TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  last_read_at     TEXT,
  marked_unread_at TEXT,
  updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (agent_id, conversation_id)
);
```

**Only the "have I seen this" half becomes per-agent.** The `last_agent_reply`
term stays global. This is decision **A-1**, chosen over full independence
(A-2, where each agent's unread ignores other agents' replies entirely).

Rationale for keeping `last_agent_reply` global: with 30 agents and 11 teams,
A-2 would leave every supervisor and every non-assigned agent accumulating
unread badges for conversations that were answered days ago and that they will
never action. The badge would stop meaning "needs a reply" and start meaning
"you personally have not opened this", which nobody works from. A-1 keeps the
badge actionable while still giving each agent their own "seen" state.

Storage is deliberately sparse: a row is created lazily, the first time a given
agent reads or flags a given conversation. A missing row means "never read",
which is the correct default and needs no backfill for new conversations.

The old columns are **not dropped**. Keeping them makes rollback a single
`wrangler rollback` rather than a reverse migration, for as long as the new
semantics are still under observation.

## Consequences

**Positive**

- Each agent gets an independent read/unread state; the badge becomes a personal
  work queue.
- The unread formula's two halves are now separated, so future product changes
  can move either one without touching the other.
- The table generalises: per-agent "pinned", "muted" or "snoozed" would be new
  columns here rather than new schema decisions.

**Negative / accepted costs**

- One more table to maintain, including cleanup when an agent leaves. `ON DELETE
  CASCADE` handles the hard-delete case; the project's soft-delete rule means
  rows normally persist, which is harmless.
- `conversations.last_read_at` / `.marked_unread_at` are now dead weight until
  they are dropped (see Follow-ups).
- The API response for the list endpoint still carries a `markedUnreadAt` field
  sourced from the deprecated column. Nothing reads it; it is removed together
  with the columns.

**Neutral**

- No frontend change was required — the API shape is identical, only the scoping
  moved. The store's optimistic update already only touched the acting user's
  copy, so it was correct for per-agent semantics by accident.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| **A-2: make `last_agent_reply` per-agent too** | Full independence, but every supervisor accumulates permanent unread for already-answered conversations. The badge stops being actionable. Revisit only if the team moves to "each agent owns their own customers, nobody hands over". |
| **JSON column `read_states` on `conversations`** | Smaller diff, but not indexable, and 30 agents writing to one JSON cell race and overwrite each other. |
| **A Durable Object per agent holding read state** | Fits the existing DO-heavy architecture, but every conversation-list render would need a DO round trip. Unacceptable latency and cost on the hottest page in the product. |
| **Suffixed columns (`read_by_1`, `read_by_2`, …)** | Not extensible; rejected without further analysis. |

## Implementation summary

Four read sites and three write sites moved from the global columns to the new
table, all writes going through one service so the semantics cannot drift:

| Kind | Endpoint | Change |
|------|----------|--------|
| read | `GET /api/conversations/stats` | `visible` CTE joins the requesting agent's row |
| read | `GET /api/conversations/:id` | separate per-agent override lookup + per-agent threshold |
| read | `GET /api/conversations` | `createConversationUnreadCountQuery` takes the agent id |
| write | `PUT /api/conversations/:id/read` | upsert this agent's `last_read_at` |
| write | `PUT /api/conversations/:id/unread` | upsert this agent's `marked_unread_at` |
| write | `PUT /api/conversations/:id/messages/read` | upsert this agent's `last_read_at` |

Three implementation details worth preserving:

1. **The per-agent filter must stay inside the CTE / derived table.** Placed in
   an outer `WHERE`, D1 expands every agent-conversation pair before filtering —
   the exact shape behind the 2026-07 D1 rows-read billing incident. Verified
   via `EXPLAIN QUERY PLAN`: the join is
   `SEARCH rs USING INDEX sqlite_autoindex_conversation_read_states_1 (agent_id=? AND conversation_id=?)`,
   an index seek, and index 0053 still drives both message lookups.

2. **`agentIdOf()` normalisation is mandatory.** `agents.id` is `TEXT` while the
   JWT carries `id` as `string | number`, and SQLite treats `INTEGER 3` and
   `TEXT '3'` as different storage classes. An unnormalised bind matches no row,
   and every conversation silently reads as fully unread.

3. **The batch query returns a row per conversation in the chunk**, not only
   those with unread messages, because `manuallyUnread` must reach the caller
   even when the derived count is 0. Binding order is ids then agent id — 90 + 1,
   inside D1's 100-parameter cap.

`PUT /:id/unread` also got simpler: it has just cleared this agent's
`last_read_at`, so the threshold collapses to the global last agent reply and the
recount binds two parameters instead of three.

## Operational checks

Deployed 2026-08-31. Worker version `81079406-e349-47c8-98a7-7fef4b5bc264`;
rollback point `8bb0456c-2c65-415e-9443-16ad5f589dfe`. Frontend was not
redeployed. Migration backfilled 3 570 rows (30 agents × the 119 conversations
that carried state) so that day-one behaviour is identical to the old global
behaviour — verified before deploy by running both formulas over the same data:
0 conversations differed for any agent tested.

Health query (on Windows this **must** run via
`node node_modules/wrangler/bin/wrangler.js` — the `.cmd` shim strips the quotes
around `--command`):

```sql
SELECT
  (SELECT COUNT(*) FROM conversation_read_states) AS rows_total,
  (SELECT COUNT(*) FROM (SELECT conversation_id FROM conversation_read_states
     GROUP BY conversation_id
     HAVING COUNT(DISTINCT COALESCE(last_read_at,'-')||'|'||COALESCE(marked_unread_at,'-')) > 1
   )) AS diverged_convs,
  (SELECT COUNT(*) FROM conversation_read_states rs
     LEFT JOIN agents a ON a.id = rs.agent_id WHERE a.id IS NULL) AS orphan_agent_rows;
```

| Metric | Healthy | Investigate when |
|--------|---------|------------------|
| `diverged_convs` | `> 0` once agents have used the list | agents active but still 0 → per-agent writes are not landing |
| `rows_total` | grows ~1 per (agent, conversation) first read; ceiling 9 540 | jumps by ~30 for a single conversation → something is fanning out writes |
| `orphan_agent_rows` | `0` | `> 0` → foreign key or cascade not working |

`COUNT(DISTINCT updated_at) > 1` is a weaker signal — it only proves a write
happened, not that two agents hold different state. Use `diverged_convs`.

**Live verification, 2026-08-31 04:02–04:05 UTC.** Two agents read the same
conversation minutes apart while a customer message arrived between them:

```
03:59:32  customer
04:01:26  agent
04:02:05  customer
04:02:30  ← admin marks read
04:02:52  agent reply          ← global term, raises everyone's threshold
04:03:54  customer             ← new message
04:04:39  ← Eric marks read
```

Effective unread on that one conversation, at the same instant:
System Administrator 1, 鄧登元 Eric 0, 蕭亦彤 Connie 1 — each correct under the
formula, and the 28 agents who did not participate kept their backfilled state
untouched. The deprecated columns were confirmed unchanged, proving the new code
writes exclusively to the new table. Zero errors in `wrangler tail`.

Under the old global model, Eric's read at 04:04:39 would have hidden the
04:03:54 customer message from all 29 other agents.

## Follow-ups

**Dropping the deprecated columns** — decision deferred to on/after **2026-09-14**
(two-week observation window agreed 2026-08-31). Functional correctness is
already proven; the window is only to watch for chronic effects (row growth,
orphans). Prerequisites, all required:

1. `diverged_convs > 0` sustained and `orphan_*` still 0, no errors in the logs.
   Row growth should track ~1 per first read, never ~30.
2. Accept losing one-command rollback. After the drop, `wrangler rollback` to a
   pre-0060 Worker fails because the old code reads those columns.
3. Code cleanup must land **first**, in three files:
   - `src/db/schema.ts` — the two deprecated column declarations
   - `src/modules/activities/services/restore-helpers.ts` — the restore
     allowlist still names both columns; left in place it would write to a
     non-existent column and error
   - `shared/api-contracts/conversations.ts` — `markedUnreadAt?` is still
     exposed on the list response

   Two other matches are comments only and need no change:
   `src/services/permission-service.ts` and
   `frontend/src/composables/conversation/useConversationState.ts`.
4. Verified droppable: neither column is indexed (checked against production
   `sqlite_master`, 2026-08-31), so `ALTER TABLE … DROP COLUMN` is permitted.
5. Take a fresh backup immediately before.

**Not planned:** revisiting A-2. Reopen only if the operating model changes to
per-agent customer ownership.
