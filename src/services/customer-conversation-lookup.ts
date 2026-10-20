// src/services/customer-conversation-lookup.ts
// Shared "one conversation per customer" lookup used by every inbound path
// (webhooks, LINE follow, LIFF welcome).
//
// conversations.customer_id has no UNIQUE constraint, and legacy data from before the
// one-conversation rule can hold several rows for one customer. A bare `.get()` returns an
// arbitrary one, which could be an old closed row while a newer live one exists; reopening it
// would split the customer's messages across two live conversations. This picks
// deterministically: a non-closed row first, else the most recent closed row.

import { desc, eq, sql } from 'drizzle-orm';
import { conversations } from '@/db/schema';
import type { Database } from '@/db/drizzle-factory';

type ConversationDb = Pick<Database, 'select'>;
export type CustomerConversationRow = typeof conversations.$inferSelect;

export async function findCustomerConversation(
  db: ConversationDb,
  customerId: number
): Promise<CustomerConversationRow | undefined> {
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.customerId, customerId))
    .orderBy(
      sql`CASE WHEN ${conversations.status} = 'closed' THEN 1 ELSE 0 END`,
      desc(conversations.lastMessageAt),
      desc(conversations.createdAt),
      desc(conversations.id)
    )
    .limit(1)
    .get();
}

/**
 * Status a closed conversation returns to when the customer interacts again:
 * assigned when a team owns it, otherwise active. Null when it is not closed.
 */
export function getReopenStatus(
  status: string | null | undefined,
  hasTeam: boolean
): 'assigned' | 'active' | null {
  if (status !== 'closed') return null;
  return hasTeam ? 'assigned' : 'active';
}
