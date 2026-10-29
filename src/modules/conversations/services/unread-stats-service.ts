// Per-agent unread totals for GET /conversations/stats
//
// DEFINITION (unchanged; "unread" is per agent, NOT the team-wide "awaiting" of awaiting_since):
//   For every conversation visible to the agent:
//     closed                       -> 0 unread, never manually unread
//     threshold T                  -> MAX(last agent/system message, this agent's last_read_at,
//                                      conversations.unread_floor_at)    (missing = 1970)
//     unread messages              -> non-deleted customer messages with created_at > T
//     manually unread              -> this agent's conversation_read_states.marked_unread_at set
//                                      (open conversations only); counts as 1 when the derived count is 0
//   unreadCount         = SUM(manual && count = 0 ? 1 : count)
//   unreadConversations = number of conversations with count > 0 or manually unread
//   oldestUnreadAt      = MIN(oldest unread message) over conversations with count > 0
//
// FAST PATH (migration 0071). A conversation can have count > 0 only if
//   last_customer_message_at > T, and T >= last_agent_message_at. The partial covering index
//   idx_conversations_customer_after_agent holds exactly the conversations where
//   last_customer_message_at > last_agent_message_at, and the agent's manual flags come from a
//   small partial index. Only those candidates (further narrowed by the exact T from
//   conversation columns) have their messages counted, so cost is O(conversations the customer
//   spoke last in + unread messages), not O(all messages of all open conversations).
//
// If the 0071 columns are missing (worker deployed before the migration) it falls back to the
// previous full query, which is also the oracle in the equivalence tests.

import { getConversationVisibilitySql, type ConversationVisibilityUser } from '@/services/conversation-visibility';
import type { RowsReadMeter } from '@/utils/d1-rows-read';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('UnreadStats');

export interface UnreadAggregate {
  unreadCount: number | string | null;
  unreadConversations: number | string | null;
  oldestUnreadAt: string | null;
}

const AGGREGATE_SELECT = `
  SELECT COALESCE(SUM(
    CASE WHEN per.manuallyUnread = 1 AND per.unreadCount = 0
      THEN 1 ELSE per.unreadCount END
  ), 0) as unreadCount,
  COALESCE(SUM(
    CASE WHEN per.manuallyUnread = 1 OR per.unreadCount > 0 THEN 1 ELSE 0 END
  ), 0) as unreadConversations,
  MIN(CASE WHEN per.unreadCount > 0 THEN per.oldestUnreadAt END) as oldestUnreadAt`;

/** Previous implementation: scans the messages of every visible conversation. Fallback and test oracle. */
export function legacyUnreadAggregateSql(visibilityClause: string): string {
  return LEGACY_SQL.replace('__VISIBILITY__', visibilityClause);
}

const LEGACY_SQL = `
      WITH visible AS (
        SELECT
          conversation.id AS id,
          conversation.status AS status,
          conversation.unread_floor_at AS unread_floor_at,
          read_state.last_read_at AS last_read_at,
          read_state.marked_unread_at AS marked_unread_at
        FROM conversations AS conversation
        LEFT JOIN conversation_read_states AS read_state
          ON read_state.conversation_id = conversation.id
          AND read_state.agent_id = ?
        WHERE __VISIBILITY__
      )
      SELECT COALESCE(SUM(
        CASE WHEN per.manuallyUnread = 1 AND per.unreadCount = 0
          THEN 1 ELSE per.unreadCount END
      ), 0) as unreadCount,
      COALESCE(SUM(
        CASE WHEN per.manuallyUnread = 1 OR per.unreadCount > 0 THEN 1 ELSE 0 END
      ), 0) as unreadConversations,
      MIN(CASE WHEN per.unreadCount > 0 THEN per.oldestUnreadAt END) as oldestUnreadAt
      FROM (
        SELECT
          threshold.id,
          threshold.manuallyUnread,
          COUNT(customer_message.id) as unreadCount,
          MIN(customer_message.created_at) as oldestUnreadAt
        FROM (
          SELECT
            visible.id,
            -- 已結案的對話不計入未讀總數（與列表一致）
            CASE WHEN visible.status <> 'closed' AND visible.marked_unread_at IS NOT NULL THEN 1 ELSE 0 END as manuallyUnread,
            CASE WHEN visible.status = 'closed' THEN '9999-12-31' ELSE MAX(
              COALESCE(last_agent.last_agent_at, '1970-01-01'),
              COALESCE(visible.last_read_at, '1970-01-01'),
              COALESCE(visible.unread_floor_at, '1970-01-01')
            ) END as unread_threshold
          FROM visible
          LEFT JOIN (
            SELECT message.conversation_id, MAX(message.created_at) as last_agent_at
            FROM messages AS message
            INNER JOIN visible ON visible.id = message.conversation_id
            WHERE message.sender_type IN ('agent', 'system')
              AND message.deleted_at IS NULL
            GROUP BY message.conversation_id
          ) AS last_agent ON last_agent.conversation_id = visible.id
        ) AS threshold
        LEFT JOIN messages AS customer_message
          ON customer_message.conversation_id = threshold.id
          AND customer_message.sender_type = 'customer'
          AND customer_message.deleted_at IS NULL
          AND customer_message.created_at > threshold.unread_threshold
        GROUP BY threshold.id, threshold.manuallyUnread
      ) AS per
`;

export function fastUnreadAggregateSql(visibilityClause: string, visibilityClause2: string): string {
  // Branch 1: the customer spoke after the last agent/system reply AND after the unread floor
  // (both read from the covering partial index, before any read-state lookup); the exact
  // threshold including this agent's last_read_at is applied in the final WHERE.
  // Branch 2: this agent's manual unread flags that branch 1 did not already pick up.
  const customerLast = "c.last_customer_message_at > COALESCE(c.last_agent_message_at, '')";
  return `
    WITH cand AS (
      SELECT
        c.id AS id,
        CASE WHEN rs.marked_unread_at IS NOT NULL THEN 1 ELSE 0 END AS manuallyUnread,
        MAX(
          COALESCE(c.last_agent_message_at, '1970-01-01'),
          COALESCE(rs.last_read_at, '1970-01-01'),
          COALESCE(c.unread_floor_at, '1970-01-01')
        ) AS unread_threshold,
        c.last_customer_message_at AS last_customer_at
      FROM conversations c
      LEFT JOIN conversation_read_states rs
        ON rs.conversation_id = c.id AND rs.agent_id = ?
      WHERE ${customerLast}
        AND c.last_customer_message_at > COALESCE(c.unread_floor_at, '')
        AND c.status <> 'closed'
        AND ${visibilityClause}
      UNION ALL
      SELECT
        c.id,
        1,
        MAX(
          COALESCE(c.last_agent_message_at, '1970-01-01'),
          COALESCE(rs.last_read_at, '1970-01-01'),
          COALESCE(c.unread_floor_at, '1970-01-01')
        ),
        c.last_customer_message_at
      FROM conversation_read_states rs
      INNER JOIN conversations c ON c.id = rs.conversation_id
      WHERE rs.agent_id = ? AND rs.marked_unread_at IS NOT NULL
        AND c.status <> 'closed'
        AND ${visibilityClause2}
        AND NOT (
          ${customerLast}
          AND c.last_customer_message_at > COALESCE(c.unread_floor_at, '')
        )
    )
    ${AGGREGATE_SELECT}
    FROM (
      SELECT cand.id, cand.manuallyUnread,
             COUNT(cm.id) as unreadCount,
             MIN(cm.created_at) as oldestUnreadAt
      FROM cand
      LEFT JOIN messages cm
        ON cm.conversation_id = cand.id
        AND cm.sender_type = 'customer'
        AND cm.deleted_at IS NULL
        AND cm.created_at > cand.unread_threshold
      WHERE cand.manuallyUnread = 1 OR cand.last_customer_at > cand.unread_threshold
      GROUP BY cand.id, cand.manuallyUnread
    ) AS per
  `;
}

/** Fast path only; throws if the 0071 columns/indexes are missing. */
export async function fastUnreadAggregate(
  db: D1Database,
  user: ConversationVisibilityUser & { id: string | number },
  meter?: RowsReadMeter
): Promise<UnreadAggregate | null> {
  const agentId = String(user.id);
  const v1 = getConversationVisibilitySql(user, 'c.assigned_team_id');
  const v2 = getConversationVisibilitySql(user, 'c.assigned_team_id');
  const result = await db.prepare(fastUnreadAggregateSql(v1.clause, v2.clause))
    .bind(agentId, ...v1.params, agentId, ...v2.params)
    .all<UnreadAggregate>();
  meter?.track(result);
  return result.results?.[0] ?? null;
}

export async function getUnreadAggregate(
  db: D1Database,
  user: ConversationVisibilityUser & { id: string | number },
  meter?: RowsReadMeter
): Promise<UnreadAggregate | null> {
  try {
    return await fastUnreadAggregate(db, user, meter);
  } catch (error) {
    log.warn('Fast unread query failed, using the full query', {
      error: error instanceof Error ? error.message : String(error)
    });
    return legacyUnreadAggregate(db, user, meter);
  }
}

export async function legacyUnreadAggregate(
  db: D1Database,
  user: ConversationVisibilityUser & { id: string | number },
  meter?: RowsReadMeter
): Promise<UnreadAggregate | null> {
  const visibility = getConversationVisibilitySql(user, 'assigned_team_id');
  const result = await db.prepare(legacyUnreadAggregateSql(visibility.clause))
    .bind(String(user.id), ...visibility.params)
    .all<UnreadAggregate>();
  meter?.track(result);
  return result.results?.[0] ?? null;
}
