import type { Bindings } from '@/types';
import { nowMs } from '@/utils/timestamp';

interface WaitMarkerRow { awaiting_since: string | null; assigned_team_id: number | null }

async function readWaitMarker(db: D1Database, conversationId: string): Promise<WaitMarkerRow | null> {
  try {
    return await db.prepare('SELECT awaiting_since, assigned_team_id FROM conversations WHERE id = ?')
      .bind(conversationId).first<WaitMarkerRow>();
  } catch {
    return null;
  }
}

/**
 * The 待回覆 marker as the database triggers left it (migrations 0070-0073), for realtime list
 * events. undefined when it cannot be read, so the list keeps its value until the next sync
 * instead of guessing.
 */
export async function readAwaitingSince(db: D1Database, conversationId: string): Promise<string | null | undefined> {
  const row = await readWaitMarker(db, conversationId);
  return row ? row.awaiting_since : undefined;
}

/**
 * Tells the conversation list the marker after a delivery flipped is_sent: a reply held in the
 * recall window clears the marker only when it is sent, which no new_message event covers.
 * Best-effort; the next list sync corrects a missed event.
 */
export async function broadcastWaitMarker(env: Bindings, conversationId: string): Promise<void> {
  if (!env.MESSAGE_BROADCASTER) { return; }
  const row = await readWaitMarker(env.DB, conversationId);
  if (!row) { return; }
  const event = {
    id: crypto.randomUUID(),
    type: 'conversation_updated',
    source: 'api',
    timestamp: nowMs(),
    conversationId,
    data: { conversationId, awaitingSince: row.awaiting_since },
    priority: 'normal'
  };
  const stub = env.MESSAGE_BROADCASTER.get(env.MESSAGE_BROADCASTER.idFromName('global'));
  // Same audience as the new_message list event: the owning team plus admins, or everyone
  // for the unassigned shared pool.
  const request = row.assigned_team_id
    ? new Request('https://message-broadcaster/broadcast-to-teams-and-admins', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, teamIds: [row.assigned_team_id], includeAdmins: true })
      })
    : new Request('https://message-broadcaster/broadcast-global', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, target: { type: 'global', targets: ['all'] } })
      });
  try {
    await stub.fetch(request);
  } catch (error) {
    console.warn('[wait-marker] list broadcast failed (next sync corrects it)', error);
  }
}
