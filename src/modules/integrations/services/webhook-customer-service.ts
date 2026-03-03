// src/modules/integrations/services/webhook-customer-service.ts
// Shared customer lookup/creation logic extracted from webhook.ts (Phase 4 refactoring)

import { eq, and, desc } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { customers, customerTeamAssignments } from '@/db/schema';
import type { Bindings } from '@/types';
import { createContextLogger } from '@/utils/logger';
import { nowISO } from '@/utils/timestamp'

const log = createContextLogger('WebhookCustomer');

type Platform = 'line' | 'facebook';

/**
 * Find an existing customer by platform user ID, or create a new one.
 * Returns the customer record (or null if creation failed).
 */
export async function findOrCreateCustomer(
  env: Bindings,
  platformUserId: string,
  platform: Platform
): Promise<typeof customers.$inferSelect | null> {
  const drizzleDb = createDbClient(env.DB);

  let user = await drizzleDb
    .select()
    .from(customers)
    .where(and(
      eq(customers.platformUserId, platformUserId),
      eq(customers.platform, platform)
    ))
    .get();

  if (!user) {
    // 使用用戶同步服務獲取用戶資料
    let displayName = platform === 'line' ? 'LINE User' : 'Facebook User';
    let avatarUrl = null;

    try {
      const { createUserSyncService } = await import('@/services/user-sync');
      const userSyncService = createUserSyncService(env);

      if (platform === 'line') {
        const profile = await userSyncService.syncLineUser(platformUserId);
        if (profile) {
          displayName = profile.displayName;
          avatarUrl = profile.pictureUrl;
        }
      } else {
        const profile = await userSyncService.syncFacebookUser(platformUserId);
        if (profile) {
          displayName = profile.displayName;
          avatarUrl = profile.pictureUrl;
        }
      }
    } catch (profileError) {
      log.warn(`Failed to sync ${platform} user profile`, { error: profileError instanceof Error ? profileError.message : String(profileError) });
    }

    // Fallback: check customer_team_assignments for LIFF-captured name
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
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
      }
    }

    // 建立新使用者
    const timestamp = nowISO();
    await drizzleDb
      .insert(customers)
      .values({
        platform,
        platformUserId,
        displayName,
        avatarUrl,
        createdAt: timestamp,
        updatedAt: timestamp
      });

    // 重新查詢刚建立的用户
    user = await drizzleDb
      .select()
      .from(customers)
      .where(and(
        eq(customers.platformUserId, platformUserId),
        eq(customers.platform, platform)
      ))
      .get();
  }

  return user || null;
}

/**
 * Check if an existing customer needs a background profile sync,
 * and trigger async update if so.
 */
export async function triggerBackgroundSyncIfNeeded(
  env: Bindings,
  platformUserId: string,
  platform: Platform,
  groupId?: string
): Promise<void> {
  try {
    const { createUserSyncService } = await import('@/services/user-sync');
    const userSyncService = createUserSyncService(env);
    const needsUpdate = await userSyncService.needsUpdate(platformUserId, platform);

    if (needsUpdate) {
      // 異步更新用戶資料（不等待完成）
      if (platform === 'line') {
        userSyncService.syncLineUser(platformUserId, groupId).catch((error: unknown) => {
          log.warn(`Background ${platform} user sync failed`, { error: error instanceof Error ? error.message : String(error) });
        });
      } else {
        userSyncService.syncFacebookUser(platformUserId).catch((error: unknown) => {
          log.warn(`Background ${platform} user sync failed`, { error: error instanceof Error ? error.message : String(error) });
        });
      }
    }
  } catch (syncError) {
    log.warn(`Error checking ${platform} user sync status`, { error: syncError instanceof Error ? syncError.message : String(syncError) });
  }
}
