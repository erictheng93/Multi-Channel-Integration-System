// src/services/customer-insert.ts
// Customer creation that tolerates a concurrent creator, shared by the inbound paths
// (webhook findOrCreateCustomer, QR-code follow).
//
// customers has a UNIQUE index on (platform, platform_user_id)
// (customers_platform_platform_user_id_unique). Two requests for a brand-new user can both miss
// the lookup and both insert; the loser's insert fails with
// "UNIQUE constraint failed: customers.platform, customers.platform_user_id". That is not an error
// for a find-or-create caller: the winner's row is re-read and returned instead, exactly as if the
// lookup had found it. Same pattern as insertCustomerConversation.

import { and, eq, isNull } from 'drizzle-orm';
import { customers } from '@/db/schema';
import type { Database } from '@/db/drizzle-factory';
import { isUniqueConstraintError } from '@/utils/unique-constraint';

export type CustomerRow = typeof customers.$inferSelect;
export type NewCustomerRow = typeof customers.$inferInsert;

/**
 * A column of the (platform, platform_user_id) unique index, as SQLite names it in the violation
 * message. isUniqueConstraintError splits the multi-column list, so one column identifies the index.
 */
export const CUSTOMER_PLATFORM_USER_UNIQUE_TARGET = 'customers.platform_user_id';

/** The live (not soft-deleted) customer for a platform user, if any. */
export async function findLiveCustomer(
  db: Pick<Database, 'select'>,
  platform: string,
  platformUserId: string
): Promise<CustomerRow | undefined> {
  return db
    .select()
    .from(customers)
    .where(and(
      eq(customers.platform, platform),
      eq(customers.platformUserId, platformUserId),
      isNull(customers.deletedAt)
    ))
    .get();
}

/**
 * Insert a customer, or return the one a concurrent request inserted first.
 *
 * Only a violation of the (platform, platform_user_id) index is absorbed. The re-read is limited to
 * live rows: a soft-deleted row holding the key is not something to hand back to a caller, so that
 * case, and any other failure (primary key, NOT NULL, ...), rethrows the original error.
 */
export async function insertOrGetCustomer(
  db: Pick<Database, 'select' | 'insert'>,
  values: NewCustomerRow
): Promise<CustomerRow> {
  try {
    return await db.insert(customers).values(values).returning().get();
  } catch (error) {
    if (!isUniqueConstraintError(error, CUSTOMER_PLATFORM_USER_UNIQUE_TARGET)) throw error;
    const existing = await findLiveCustomer(db, values.platform, values.platformUserId);
    if (!existing) throw error;
    return existing;
  }
}
