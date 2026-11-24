// src/services/customer-conversation-lookup.ts
// Shared "one conversation per customer" lookup used by every inbound path
// (webhooks, LINE follow, LIFF welcome).
//
// conversations.customer_id is UNIQUE since migration 0079 (idx_conversations_customer_unique).
// Before that, legacy data could hold several rows for one customer, and a bare `.get()` returned
// an arbitrary one; the deterministic order below (a non-closed row first, else the most recent
// closed row) is kept so the lookup stays correct on any database the index is not yet on.

import { desc, eq, sql } from 'drizzle-orm';
import { conversations } from '@/db/schema';
import type { Database } from '@/db/drizzle-factory';
import { isUniqueConstraintError } from '@/utils/unique-constraint';

type ConversationDb = Pick<Database, 'select'>;
export type CustomerConversationRow = typeof conversations.$inferSelect;
export type NewCustomerConversation = typeof conversations.$inferInsert;

/** The column the one-conversation-per-customer unique index is on, as SQLite names it. */
export const CONVERSATION_CUSTOMER_UNIQUE_TARGET = 'conversations.customer_id';

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

/**
 * Insert a conversation for a customer who has none, tolerating a concurrent creator.
 *
 * conversations.customer_id is UNIQUE (migration 0079). When another request created this
 * customer's conversation between the caller's lookup and this insert, the insert fails with
 * "UNIQUE constraint failed: conversations.customer_id"; that is not an error here, the
 * winner's conversation is re-read and returned instead. Any other failure is rethrown.
 *
 * @returns null when this call inserted the row (the caller knows `values.id`), otherwise the
 *          conversation that already existed.
 */
export async function insertCustomerConversation(
  db: Pick<Database, 'select' | 'insert'>,
  values: NewCustomerConversation
): Promise<CustomerConversationRow | null> {
  try {
    await db.insert(conversations).values(values);
    return null;
  } catch (error) {
    if (!isUniqueConstraintError(error, CONVERSATION_CUSTOMER_UNIQUE_TARGET)) throw error;
    const existing = await findCustomerConversation(db, values.customerId);
    if (!existing) throw error;
    return existing;
  }
}
