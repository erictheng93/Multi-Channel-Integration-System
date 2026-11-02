// Maps a reports table row to the API shape. Shared by listing, status lookup and details so the
// "expired" rule lives in one place.

import type { reports } from '@/db/schema';
import type { ReportBase, ReportFormat, ReportStatus } from '../types/report-types';
import { nowISO } from '@/utils/timestamp';

export type ReportRow = typeof reports.$inferSelect;

function parseJsonObject(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** A completed report past its expiresAt is reported as `expired` (the stored status stays `completed`). */
export function effectiveReportStatus(
  status: string,
  expiresAt: string | null,
  nowMs: number = Date.now()
): ReportStatus {
  if (status === 'completed' && expiresAt) {
    const expiry = Date.parse(expiresAt);
    if (!Number.isNaN(expiry) && nowMs > expiry) {
      return 'expired';
    }
  }
  return status as ReportStatus;
}

export function mapReportRow(row: ReportRow): ReportBase {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    type: row.type as ReportBase['type'],
    format: row.format as ReportFormat,
    status: effectiveReportStatus(row.status, row.expiresAt),
    createdBy: row.createdBy,
    createdAt: row.createdAt || nowISO(),
    updatedAt: row.updatedAt || undefined,
    startedAt: row.generationStartedAt || undefined,
    completedAt: row.completedAt || undefined,
    expiresAt: row.expiresAt || undefined,
    downloadUrl: row.downloadUrl || undefined,
    fileSize: row.fileSize || undefined,
    teamId: row.teamId || undefined,
    errorMessage: row.errorMessage || undefined,
    metadata: parseJsonObject(row.options),
  };
}
