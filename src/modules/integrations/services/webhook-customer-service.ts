// src/modules/integrations/services/webhook-customer-service.ts
// Consolidated customer lookup/creation/update logic for all webhook handlers.
// Single source of truth: distributed lock + deletedAt filter + LIFF fallback + WS broadcast.

import { eq, and, desc, isNull } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { customers, customerTeamAssignments, conversations } from '@/db/schema';
import type { Bindings } from '@/types';
import { DistributedLockService } from '@/services/distributed-lock-service';
import { insertOrGetCustomer } from '@/services/customer-insert';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { createContextLogger } from '@/utils/logger';
import { nowISO } from '@/utils/timestamp';

const log = createContextLogger('WebhookCustomer');

type Platform = 'line' | 'facebook' | 'shopee';
/** Platforms with a profile API that UserSyncService can call. */
type SyncablePlatform = Exclude<Platform, 'shopee'>;

/**
 * Typed interface for customer profile updates.
 * Prevents field confusion between webhook handlers.
 */
export interface CustomerProfileUpdates {
  displayName?: string;
  avatarUrl?: string | null;
  metadata?: Record<string, unknown>;
}

/** TTL of the `webhook:customer:*` lock held while a new customer is created. */
const CUSTOMER_LOCK_TTL_MS = 15000;

/**
 * Upper bound for the LINE/FB profile fetch made while holding the customer lock.
 * It must stay well inside CUSTOMER_LOCK_TTL_MS: if the profile API hangs past the
 * TTL, the lock expires, a second webhook for the same user takes it over and both
 * try to insert the customer. 5s leaves 10s of the TTL for the DB reads and insert.
 * A timeout is handled like any other profile failure: the customer is created with
 * the platform default name (or the LIFF fallback) and no avatar.
 */
export const PROFILE_FETCH_TIMEOUT_MS = 5000;

/**
 * Run `run` with an AbortSignal that fires after `ms`, and reject at that moment even
 * if `run` ignores the signal, so the caller's deadline holds regardless. A one-shot
 * timer (not AbortSignal.timeout) so the rejection is deterministic and the timer is
 * cleared as soon as `run` settles.
 */
async function withProfileTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const reason = new DOMException(`Profile fetch timed out after ${ms}ms`, 'TimeoutError');
      controller.abort(reason);
      reject(reason);
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

interface FindOrCreateOpts {
  groupId?: string;
  sourceTeamId?: number;
  /** Name taken from the webhook itself; used as-is for platforms with no profile API (Shopee). */
  displayName?: string;
}

/**
 * Find an existing customer by platform user ID, or create a new one.
 * Uses distributed lock to prevent duplicate creation during concurrent webhooks.
 * Filters soft-deleted customers (deletedAt IS NULL).
 * Returns the customer record (or null if creation failed).
 */
export async function findOrCreateCustomer(
  env: Bindings,
  platformUserId: string,
  platform: Platform,
  opts?: FindOrCreateOpts
): Promise<typeof customers.$inferSelect | null> {
  const drizzleDb = createDbClient(env.DB);

  // Query with deletedAt IS NULL filter
  let user = await drizzleDb
    .select()
    .from(customers)
    .where(and(
      eq(customers.platformUserId, platformUserId),
      eq(customers.platform, platform),
      isNull(customers.deletedAt)
    ))
    .get();

  if (user) {
    return user;
  }

  // Customer not found -- acquire distributed lock to prevent duplicate creation
  const lockService = new DistributedLockService(env);
  const lockResource = `webhook:customer:${platform}:${platformUserId}`;

  return lockService.withLock(
    lockResource,
    async () => {
      // Double-check inside lock (another worker may have created it)
      const existing = await drizzleDb
        .select()
        .from(customers)
        .where(and(
          eq(customers.platformUserId, platformUserId),
          eq(customers.platform, platform),
          isNull(customers.deletedAt)
        ))
        .get();

      if (existing) {
        return existing;
      }

      // Fetch profile via UserSyncService (Shopee has no profile API: the push carries the name)
      let displayName = platform === 'shopee'
        ? opts?.displayName || 'Shopee 買家'
        : platform === 'line' ? 'LINE User' : 'Facebook User';
      let avatarUrl: string | null = null;

      try {
        const { createUserSyncService } = await import('@/services/user-sync');
        const userSyncService = createUserSyncService(env);

        const profile = platform === 'shopee' ? null : await withProfileTimeout(
          signal => platform === 'line'
            ? userSyncService.syncLineUser(platformUserId, undefined, { signal })
            : userSyncService.syncFacebookUser(platformUserId, { signal }),
          PROFILE_FETCH_TIMEOUT_MS
        );
        if (profile) {
          displayName = profile.displayName;
          avatarUrl = profile.pictureUrl ?? null;
        }
      } catch (profileError) {
        log.warn(`Failed to sync ${platform} user profile`, {
          error: profileError instanceof Error ? profileError.message : String(profileError),
        });
      }

      // Fallback: check customer_team_assignments for LIFF-captured name (LINE only)
      if (platform === 'line' && displayName === 'LINE User') {
        try {
          const assignment = await drizzleDb
            .select({ displayName: customerTeamAssignments.displayName })
            .from(customerTeamAssignments)
            .where(eq(customerTeamAssignments.platformUserId, platformUserId))
            .orderBy(desc(customerTeamAssignments.assignedAt))
            .limit(1)
            .get();
          if (assignment?.displayName) {
            displayName = assignment.displayName;
            log.info('Using LIFF-captured displayName as fallback', { platformUserId, displayName });
          }
        } catch (fallbackError) {
          log.warn('Failed to query LIFF assignment for displayName fallback', {
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          });
        }
      }

      // INSERT new customer. The lock only serialises requests that reach it; a creator outside it
      // (QR follow, or a request whose lock expired) can still win the unique key, and then its row
      // comes back here instead of a UNIQUE error.
      const timestamp = nowISO();
      return insertOrGetCustomer(drizzleDb, {
        platform,
        platformUserId,
        displayName,
        avatarUrl,
        sourceTeamId: opts?.sourceTeamId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    },
    { ttl: CUSTOMER_LOCK_TTL_MS, timeout: 8000 }
  );
}

/**
 * Update a customer's profile fields, broadcasting changes via WebSocket.
 * Only updates fields that actually changed (diff-based).
 * Broadcasts customer_profile_updated to all active conversations.
 */
export async function updateCustomerProfile(
  env: Bindings,
  customerId: number,
  updates: CustomerProfileUpdates
): Promise<void> {
  const drizzleDb = createDbClient(env.DB);

  // Fetch current customer
  const current = await drizzleDb
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .get();

  if (!current) {
    log.warn('Cannot update profile: customer not found', { customerId });
    return;
  }

  // Diff to find actual changes
  const changes: Record<string, unknown> = {};

  if (updates.displayName !== undefined && updates.displayName !== current.displayName) {
    changes.displayName = updates.displayName;
  }
  if (updates.avatarUrl !== undefined && updates.avatarUrl !== current.avatarUrl) {
    changes.avatarUrl = updates.avatarUrl;
  }
  if (updates.metadata !== undefined) {
    const currentMeta = current.metadata ? JSON.parse(current.metadata as string) : null;
    const newMeta = JSON.stringify(updates.metadata);
    if (newMeta !== JSON.stringify(currentMeta)) {
      changes.metadata = newMeta;
    }
  }

  // Nothing changed -- skip update + broadcast
  if (Object.keys(changes).length === 0) {
    return;
  }

  // Apply update
  const timestamp = nowISO();
  await drizzleDb
    .update(customers)
    .set({ ...changes, updatedAt: timestamp })
    .where(eq(customers.id, customerId));

  // Broadcast if displayName or avatarUrl changed
  const hasVisibleChange = 'displayName' in changes || 'avatarUrl' in changes;
  if (hasVisibleChange) {
    try {
      // Query active conversations for this customer
      const activeConversations = await drizzleDb
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(
          eq(conversations.customerId, customerId),
          isNull(conversations.deletedAt)
        ))
        .all();

      const conversationIds = activeConversations.map(c => c.id);
      if (conversationIds.length > 0) {
        const broadcastService = new WebSocketBroadcastService(env);

        // Build payload matching frontend's expected shape:
        // { customerId, changes: { displayName?, avatarUrl? }, conversationIds: string[] }
        const visibleChanges: Record<string, string | null> = {};
        if ('displayName' in changes) visibleChanges.displayName = changes.displayName as string | null;
        if ('avatarUrl' in changes) visibleChanges.avatarUrl = changes.avatarUrl as string | null;

        const broadcastData = {
          customerId,
          changes: visibleChanges,
          conversationIds,
        };

        for (const convId of conversationIds) {
          await broadcastService.broadcastConversationEvent({
            type: 'customer_profile_updated',
            conversationId: convId,
            data: broadcastData,
          });
        }
      }
    } catch (broadcastError) {
      log.warn('Failed to broadcast customer profile update', {
        customerId,
        error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
      });
    }
  }
}

/**
 * Check if an existing customer needs a background profile sync,
 * and trigger async update if so.
 * On sync failure: sets updatedAt = null to enable retry-on-next-message.
 */
export async function triggerBackgroundSyncIfNeeded(
  env: Bindings,
  platformUserId: string,
  platform: SyncablePlatform,
  groupId?: string
): Promise<void> {
  try {
    const { createUserSyncService } = await import('@/services/user-sync');
    const userSyncService = createUserSyncService(env);
    const needsUpdate = await userSyncService.needsUpdate(platformUserId, platform);

    if (needsUpdate) {
      const drizzleDb = createDbClient(env.DB);

      // Fire-and-forget async sync with retry-on-failure
      const syncPromise = platform === 'line'
        ? userSyncService.syncLineUser(platformUserId, groupId)
        : userSyncService.syncFacebookUser(platformUserId);

      syncPromise.catch(async (error) => {
        log.warn(`Background ${platform} user sync failed`, {
          error: error instanceof Error ? error.message : String(error),
        });
        // Set updatedAt to null to enable retry-on-next-message
        try {
          await drizzleDb
            .update(customers)
            .set({ updatedAt: null })
            .where(and(
              eq(customers.platformUserId, platformUserId),
              eq(customers.platform, platform)
            ));
        } catch (dbError) {
          log.warn('Failed to nullify updatedAt for retry', {
            error: dbError instanceof Error ? dbError.message : String(dbError),
          });
        }
      });
    }
  } catch (syncError) {
    log.warn(`Error checking ${platform} user sync status`, {
      error: syncError instanceof Error ? syncError.message : String(syncError),
    });
  }
}
