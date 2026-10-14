// Per-agent conversation read state (Migration 0060)
//
// Read/unread used to live in two columns on the conversations row, so one
// agent opening a conversation cleared every other agent's unread badge. State
// now belongs to the (agent, conversation) pair in conversation_read_states.
//
// Only the "have I seen this" half is per-agent. The last-agent-reply half of
// the unread formula stays global (decision A-1): a customer message answered
// by anyone counts as handled for the whole team, so unread badges keep
// meaning "needs a reply" rather than "nobody has personally opened this".

import { createDbClient } from '@/db/drizzle-factory';
import { conversationReadStates } from '@/db/schema';

export interface ReadStateValue {
  lastReadAt: string | null;
  markedUnreadAt: string | null;
}

// agents.id is TEXT but the JWT carries the id as string | number. SQLite
// treats INTEGER 3 and TEXT '3' as different storage classes, so binding an
// unnormalised id would silently match no read-state row and every
// conversation would read as unread. Always normalise before binding.
export function agentIdOf(user: { id: string | number }): string {
  return String(user.id);
}

// Records one agent's read state for one conversation.
//
// The composite primary key (agent_id, conversation_id) makes this atomic, so
// the same agent acting from two tabs cannot interleave into a lost update and
// no distributed lock is needed. Rows are created lazily — an agent who has
// never opened a conversation has no row, and the read path treats a missing
// row as "never read", which is the correct default.
export async function upsertReadState(
  db: ReturnType<typeof createDbClient>,
  agentId: string,
  conversationId: string,
  state: ReadStateValue,
  now: string
): Promise<void> {
  await db
    .insert(conversationReadStates)
    .values({
      agentId,
      conversationId,
      lastReadAt: state.lastReadAt,
      markedUnreadAt: state.markedUnreadAt,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: [conversationReadStates.agentId, conversationReadStates.conversationId],
      set: {
        lastReadAt: state.lastReadAt,
        markedUnreadAt: state.markedUnreadAt,
        updatedAt: now
      }
    });
}

// Marks a conversation unread for one agent ONLY while it is not closed, in a
// single statement: the status check and the write cannot be split by another
// agent closing the conversation in between. Returns false (nothing written)
// when the conversation is closed.
export async function markUnreadIfOpen(
  db: D1Database,
  agentId: string,
  conversationId: string,
  now: string
): Promise<boolean> {
  const result = await db
    .prepare(`
      INSERT INTO conversation_read_states (agent_id, conversation_id, last_read_at, marked_unread_at, updated_at)
      SELECT ?, ?, NULL, ?, ?
      WHERE EXISTS (SELECT 1 FROM conversations WHERE id = ? AND status <> 'closed')
      ON CONFLICT (agent_id, conversation_id) DO UPDATE SET
        last_read_at = NULL,
        marked_unread_at = excluded.marked_unread_at,
        updated_at = excluded.updated_at
    `)
    .bind(agentId, conversationId, now, now, conversationId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}
