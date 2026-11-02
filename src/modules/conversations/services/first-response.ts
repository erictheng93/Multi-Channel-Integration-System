// First-response stamping
//
// conversations.first_response_at records when a HUMAN agent first answered the
// customer. It is the source of the dashboard's first-response time, so it must
// only be written for real agent replies:
//   - never for auto-reply (sender_type 'system') or broadcasts (not a reply),
//   - never for a reply that did not reach the platform (failed / recalled).
// Callers therefore invoke this only after a successful delivery (or, for the
// recall-window scheduler, after the message was stored as sent).
//
// Idempotent by construction: `WHERE first_response_at IS NULL` means the first
// writer wins and every later call (retries, duplicate alarms, later replies)
// changes zero rows.

import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '@/db/drizzle-factory';
import { conversations } from '@/db/schema';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('FirstResponse');

/** Stamp first_response_at once. Never throws: this is a metric, not part of sending. */
export async function stampFirstResponse(
  db: Database,
  conversationId: string,
  respondedAt: string
): Promise<void> {
  try {
    await db
      .update(conversations)
      .set({ firstResponseAt: respondedAt })
      .where(and(eq(conversations.id, conversationId), isNull(conversations.firstResponseAt)));
  } catch (error) {
    log.warn('Failed to stamp first_response_at (non-fatal)', {
      conversationId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
