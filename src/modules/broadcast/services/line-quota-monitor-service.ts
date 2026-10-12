import { and, eq, isNull } from 'drizzle-orm';
import type { Bindings } from '@/types';
import type { Database } from '@/db/drizzle-factory';
import { channelIntegrations, teams } from '@/db/schema';
import { getLineMessageQuota, getLineMessageUsage } from '@/utils/line';
import { createContextLogger } from '@/utils/logger';
import { nowISO } from '@/utils/timestamp';
import { ChannelCredentialService } from '@modules/integrations/services/channel-credential-service';

const log = createContextLogger('LineQuotaMonitor');

/** Daily poll, UTC 18:00 (Taipei 02:00). Must match the extra entry in wrangler.toml [triggers].crons. */
export const LINE_QUOTA_CRON = '0 18 * * *';

const SNAPSHOT_KV_KEY = 'line-quota:snapshot';
/** Manual refreshes inside this window return the stored snapshot instead of hitting LINE again. */
const MANUAL_REFRESH_THROTTLE_MS = 30_000;
/** Safety net only: the daily cron overwrites the key long before this. */
const SNAPSHOT_TTL_SECONDS = 7 * 24 * 60 * 60;
const SYSTEM_DEFAULT_LABEL = '系統預設';

export type LineQuotaSource = 'cron' | 'manual';

export interface LineQuotaChannelSnapshot {
  /** Opaque id derived from the access token hash; never the token itself. */
  channelKey: string;
  label: string;
  /** false = no monthly target limit; only `used` is meaningful. */
  limited: boolean;
  limit: number | null;
  used: number | null;
  remaining: number | null;
  /** Last SUCCESSFUL fetch. Kept across failures so the UI can still show the last known numbers. */
  fetchedAt: string | null;
  /** Set when the latest attempt failed; null when it succeeded. */
  error: string | null;
}

export interface LineQuotaSnapshotSet {
  items: LineQuotaChannelSnapshot[];
  /** When this set was last written (attempt time, success or not). */
  updatedAt: string | null;
  source: LineQuotaSource | null;
  /** true when a manual refresh was answered from the stored snapshot (30s throttle). */
  throttled: boolean;
}

interface LineChannel {
  channelKey: string;
  token: string;
  labels: string[];
}

const EMPTY_SET: LineQuotaSnapshotSet = { items: [], updatedAt: null, source: null, throttled: false };

export class LineQuotaMonitorService {
  private readonly credentialService: ChannelCredentialService;

  constructor(
    private readonly db: Database,
    private readonly env: Bindings
  ) {
    this.credentialService = new ChannelCredentialService(env);
  }

  async getSnapshot(): Promise<LineQuotaSnapshotSet> {
    const stored = await this.readStored();
    return stored ?? EMPTY_SET;
  }

  async refresh(source: LineQuotaSource): Promise<LineQuotaSnapshotSet> {
    const previous = await this.readStored();

    if (source === 'manual' && previous?.updatedAt) {
      const age = Date.now() - new Date(previous.updatedAt).getTime();
      if (age >= 0 && age < MANUAL_REFRESH_THROTTLE_MS) {
        return { ...previous, throttled: true };
      }
    }

    const channels = await this.collectChannels();
    const previousByKey = new Map((previous?.items ?? []).map((item) => [item.channelKey, item]));
    const items = await Promise.all(
      channels.map((channel) => this.queryChannel(channel, previousByKey.get(channel.channelKey)))
    );

    const snapshot: LineQuotaSnapshotSet = { items, updatedAt: nowISO(), source, throttled: false };
    await this.env.CACHE.put(SNAPSHOT_KV_KEY, JSON.stringify(snapshot), {
      expirationTtl: SNAPSHOT_TTL_SECONDS,
    });

    // TODO(quota-alert): low-quota notification seam. Evaluate `snapshot` here (threshold, who to
    // notify, de-dupe state) once that feature is scheduled. Intentionally not implemented yet.
    return snapshot;
  }

  private async readStored(): Promise<LineQuotaSnapshotSet | null> {
    const raw = await this.env.CACHE.get(SNAPSHOT_KV_KEY);
    if (!raw) {
      return null;
    }
    try {
      return { ...EMPTY_SET, ...(JSON.parse(raw) as LineQuotaSnapshotSet), throttled: false };
    } catch {
      return null;
    }
  }

  /** Every distinct LINE access token in use: one per active team integration, plus the env default. */
  private async collectChannels(): Promise<LineChannel[]> {
    const rows = await this.db
      .select({
        credentials: channelIntegrations.credentials,
        teamName: teams.name,
      })
      .from(channelIntegrations)
      .leftJoin(teams, eq(teams.id, channelIntegrations.teamId))
      .where(
        and(
          eq(channelIntegrations.platform, 'line'),
          eq(channelIntegrations.isActive, true),
          isNull(teams.deletedAt)
        )
      );

    const byToken = new Map<string, string[]>();
    for (const row of rows) {
      const credentials = await this.credentialService.getDecryptedCredentials(row);
      const token = credentials.accessToken;
      if (!token) {
        continue;
      }
      byToken.set(token, [...(byToken.get(token) ?? []), row.teamName ?? '未命名團隊']);
    }

    const envToken = this.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (envToken) {
      byToken.set(envToken, [...(byToken.get(envToken) ?? []), SYSTEM_DEFAULT_LABEL]);
    }

    return Promise.all(
      [...byToken.entries()].map(async ([token, labels]) => ({
        channelKey: await hashToken(token),
        token,
        labels,
      }))
    );
  }

  private async queryChannel(
    channel: LineChannel,
    previous: LineQuotaChannelSnapshot | undefined
  ): Promise<LineQuotaChannelSnapshot> {
    const label = [...new Set(channel.labels)].join('、');
    const [quota, usage] = await Promise.all([
      getLineMessageQuota(channel.token),
      getLineMessageUsage(channel.token),
    ]);

    if (!quota.success || !usage.success) {
      const error = quota.error ?? usage.error ?? 'LINE quota query failed';
      log.warn('LINE quota poll failed for channel', { channelKey: channel.channelKey, error });
      return {
        channelKey: channel.channelKey,
        label,
        limited: previous?.limited ?? false,
        limit: previous?.limit ?? null,
        used: previous?.used ?? null,
        remaining: previous?.remaining ?? null,
        fetchedAt: previous?.fetchedAt ?? null,
        error,
      };
    }

    const limited = quota.type === 'limited';
    const limit = limited ? quota.value ?? 0 : null;
    const used = usage.totalUsage ?? 0;
    return {
      channelKey: channel.channelKey,
      label,
      limited,
      limit,
      used,
      remaining: limit === null ? null : Math.max(limit - used, 0),
      fetchedAt: nowISO(),
      error: null,
    };
  }
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
