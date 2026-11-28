import { and, eq, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { channelIntegrations } from '@/db/schema';
import { nowISO } from '@/utils/timestamp';
import { SHOPEE_PLATFORM, type ShopeeChannelConfig } from './shopee-types';

export interface ShopeeChannelRow {
  id: number;
  teamId: number;
  isActive: boolean;
  config: ShopeeChannelConfig;
  /** Encrypted JSON as stored; decrypt with ChannelCredentialService. */
  credentials: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers pass the project's schema-typed client
type Db = DrizzleD1Database<any>;

/** The shop's channel row, active or not; null when the shop never authorized MCIS. */
export async function findShopeeChannelByShopId(db: Db, shopId: number): Promise<ShopeeChannelRow | null> {
  const rows = await db
    .select({
      id: channelIntegrations.id,
      teamId: channelIntegrations.teamId,
      isActive: channelIntegrations.isActive,
      config: channelIntegrations.config,
      credentials: channelIntegrations.credentials,
    })
    .from(channelIntegrations)
    .where(
      and(
        eq(channelIntegrations.platform, SHOPEE_PLATFORM),
        sql`CAST(json_extract(${channelIntegrations.config}, '$.shopId') AS INTEGER) = ${shopId}`,
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row?.config) return null;
  return {
    id: row.id,
    teamId: row.teamId,
    isActive: row.isActive ?? false,
    config: JSON.parse(row.config) as ShopeeChannelConfig,
    credentials: row.credentials,
  };
}

/** Shallow-merges `patch` into the stored config (read-modify-write; callers own concurrency). */
export async function updateShopeeChannelConfig(
  db: Db,
  channel: ShopeeChannelRow,
  patch: Partial<ShopeeChannelConfig>,
): Promise<ShopeeChannelConfig> {
  const next: ShopeeChannelConfig = { ...channel.config, ...patch };
  await db
    .update(channelIntegrations)
    .set({ config: JSON.stringify(next), updatedAt: nowISO() })
    .where(eq(channelIntegrations.id, channel.id));
  return next;
}

/** Replaces the stored (already encrypted) credentials in one write. */
export async function saveShopeeCredentials(db: Db, channelId: number, encryptedCredentials: string): Promise<void> {
  await db
    .update(channelIntegrations)
    .set({ credentials: encryptedCredentials, updatedAt: nowISO() })
    .where(eq(channelIntegrations.id, channelId));
}

/**
 * Creates the shop's channel row, or overwrites team/config/credentials on the existing one
 * (re-authorization keeps the same row id). Returns the row id.
 */
export async function upsertShopeeChannel(
  db: Db,
  input: { teamId: number; config: ShopeeChannelConfig; encryptedCredentials: string; configuredBy: string },
): Promise<number> {
  const values = {
    teamId: input.teamId,
    config: JSON.stringify(input.config),
    credentials: input.encryptedCredentials,
    isActive: true,
    configuredBy: input.configuredBy,
    updatedAt: nowISO(),
  };
  // shortcut: no unique index on config.shopId, so two simultaneous first authorizations of one shop could insert
  // two rows (the token lock narrows it); add a generated-column unique index if admins ever hit it.
  const existing = await findShopeeChannelByShopId(db, input.config.shopId);
  if (existing) {
    await db.update(channelIntegrations).set(values).where(eq(channelIntegrations.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(channelIntegrations)
    .values({ ...values, platform: SHOPEE_PLATFORM })
    .returning({ id: channelIntegrations.id });
  return row!.id;
}
