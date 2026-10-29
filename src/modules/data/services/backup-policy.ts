// Backup schedule and retention, as CONFIGURATION CONSTANTS.
//
// These mirror what is configured outside the Worker and are NOT read from it at runtime:
//   - schedule: .github/workflows/backup.yml  (cron '0 19 * * *' = 03:00 Asia/Taipei)
//   - retention: R2 lifecycle rules on the mcis-backups bucket
//                (`wrangler r2 bucket lifecycle list mcis-backups`)
// If either is changed there, change it here too; the API reports them under `policy.source`
// so a UI can label them as configured policy rather than a live reading.

/** Every top-level R2 prefix the backup system writes to. */
export const BACKUP_PREFIXES = ['daily', 'monthly', 'manual', 'members', 'tags', 'assignments'] as const;
export type BackupTier = (typeof BACKUP_PREFIXES)[number];

export interface BackupPolicy {
  source: 'configuration-constants';
  note: string;
  schedule: {
    cron: string;
    timezone: string;
    localTime: string;
    description: string;
  };
  retentionDays: Record<BackupTier, number>;
}

export const BACKUP_POLICY: BackupPolicy = {
  source: 'configuration-constants',
  note: 'Mirrors .github/workflows/backup.yml and the R2 lifecycle rules; not read from them at runtime.',
  schedule: {
    cron: '0 19 * * *',
    timezone: 'Asia/Taipei',
    localTime: '03:00',
    description: 'Daily at 03:00 Asia/Taipei (19:00 UTC); monthly copy on the 1st (UTC)',
  },
  retentionDays: {
    daily: 30,
    monthly: 365,
    members: 365,
    tags: 365,
    assignments: 365,
    manual: 90,
  },
};

/** R2 list() returns at most 1000 keys per call; page until not truncated, bounded per prefix. */
export const BACKUP_LIST_PAGE_SIZE = 1000;
export const BACKUP_LIST_MAX_PAGES_PER_PREFIX = 10;
