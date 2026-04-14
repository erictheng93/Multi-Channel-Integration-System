// Legacy file_attachments filename backfill.
//
// BACKGROUND
// Before the downloadAndStore extension fix (commit eb1586ed), LINE image
// webhooks wrote file_attachments rows with filename like "image_<messageId>"
// with no extension, and R2 objects were uploaded with
// `Content-Disposition: inline; filename="image_<messageId>"`.
//
// The dedicated download button is now routed through the backend proxy,
// which forces `Content-Disposition: attachment` with a corrected filename,
// so new and legacy rows both download cleanly. However, customer service
// users who right-click an inline <img> and pick "Save image as..." still
// hit the R2 object directly, and R2 sends the original inline
// Content-Disposition whose filename carries no extension — so Windows
// cannot open the saved file.
//
// This migration rewrites each legacy R2 object's Content-Disposition
// filename and updates the DB filename column so right-click save defaults
// to an openable filename.
//
// DESIGN
//   * Idempotent: rows that already have an extension are skipped.
//   * Resumable: cursor = last processed id, ORDER BY id.
//   * Batched: caller passes limit; we process up to that many rows per call.
//   * Preserves R2 contentType, cacheControl, customMetadata.
//   * Dry-run mode mutates nothing.

import type { Bindings } from '@/types';
import { createDbClient } from '@/db/drizzle-factory';
import { fileAttachments } from '@/db/schema';
import { and, gt, asc, eq } from 'drizzle-orm';
import { ensureFilenameExtension } from '@/utils/mime-ext';
import { nowISO } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('LegacyFilenameBackfill');

export interface BackfillOptions {
  dryRun: boolean;
  limit: number;
  cursor?: string;
}

export interface BackfillSampleFix {
  id: string;
  oldFilename: string;
  newFilename: string;
  mimeType: string;
  r2Key: string;
}

export interface BackfillError {
  id: string;
  reason: string;
}

export interface BackfillResult {
  dryRun: boolean;
  scanned: number;
  fixed: number;
  skipped: number;
  missingR2: number;
  errors: number;
  lastId: string | null;
  nextCursor: string | null;
  done: boolean;
  sample: BackfillSampleFix[];
  errorDetails: BackfillError[];
}

const SAMPLE_LIMIT = 10;

export async function runBackfillLegacyFilenames(
  env: Bindings,
  opts: BackfillOptions
): Promise<BackfillResult> {
  const db = createDbClient(env.DB);

  if (!env.R2_BUCKET) {
    throw new Error('R2_BUCKET binding is not configured');
  }

  // Fetch one more than requested so we know whether another batch remains.
  const rows = await db
    .select({
      id: fileAttachments.id,
      filename: fileAttachments.filename,
      mimeType: fileAttachments.mimeType,
      r2Key: fileAttachments.r2Key,
    })
    .from(fileAttachments)
    .where(
      and(
        opts.cursor ? gt(fileAttachments.id, opts.cursor) : undefined
      )
    )
    .orderBy(asc(fileAttachments.id))
    .limit(opts.limit + 1)
    .all();

  const hasMore = rows.length > opts.limit;
  const batch = hasMore ? rows.slice(0, opts.limit) : rows;

  const result: BackfillResult = {
    dryRun: opts.dryRun,
    scanned: 0,
    fixed: 0,
    skipped: 0,
    missingR2: 0,
    errors: 0,
    lastId: null,
    nextCursor: null,
    done: !hasMore,
    sample: [],
    errorDetails: [],
  };

  for (const row of batch) {
    result.scanned++;
    result.lastId = row.id;

    const currentFilename = row.filename ?? '';
    const newFilename = ensureFilenameExtension(currentFilename, row.mimeType);

    if (newFilename === currentFilename) {
      result.skipped++;
      continue;
    }

    if (opts.dryRun) {
      result.fixed++;
      if (result.sample.length < SAMPLE_LIMIT) {
        result.sample.push({
          id: row.id,
          oldFilename: currentFilename,
          newFilename,
          mimeType: row.mimeType,
          r2Key: row.r2Key,
        });
      }
      continue;
    }

    try {
      // Rewrite R2 metadata. R2 has no metadata-only update API, so we must
      // fetch the body and put it back. Ingress is free on R2; the cost is
      // one Class A (put) + one Class B (get) operation per object.
      const existing = await env.R2_BUCKET.get(row.r2Key);
      if (!existing) {
        result.missingR2++;
        log.warn('R2 object missing, skipping metadata rewrite', {
          id: row.id,
          r2Key: row.r2Key,
        });
        // Still fix the DB filename — that helps the download button path even
        // when the underlying object is gone.
        await db
          .update(fileAttachments)
          .set({ filename: newFilename, updatedAt: nowISO() })
          .where(eq(fileAttachments.id, row.id))
          .run();
        result.fixed++;
        if (result.sample.length < SAMPLE_LIMIT) {
          result.sample.push({
            id: row.id,
            oldFilename: currentFilename,
            newFilename,
            mimeType: row.mimeType,
            r2Key: row.r2Key,
          });
        }
        continue;
      }

      const body = await existing.arrayBuffer();

      await env.R2_BUCKET.put(row.r2Key, body, {
        httpMetadata: {
          contentType: existing.httpMetadata?.contentType ?? row.mimeType,
          contentDisposition: `inline; filename="${newFilename}"`,
          cacheControl: existing.httpMetadata?.cacheControl,
          contentEncoding: existing.httpMetadata?.contentEncoding,
          contentLanguage: existing.httpMetadata?.contentLanguage,
        },
        customMetadata: existing.customMetadata,
      });

      await db
        .update(fileAttachments)
        .set({ filename: newFilename, updatedAt: nowISO() })
        .where(eq(fileAttachments.id, row.id))
        .run();

      result.fixed++;
      if (result.sample.length < SAMPLE_LIMIT) {
        result.sample.push({
          id: row.id,
          oldFilename: currentFilename,
          newFilename,
          mimeType: row.mimeType,
          r2Key: row.r2Key,
        });
      }
    } catch (err) {
      result.errors++;
      const reason = err instanceof Error ? err.message : String(err);
      result.errorDetails.push({ id: row.id, reason });
      log.error('Failed to backfill row', { id: row.id, r2Key: row.r2Key }, err instanceof Error ? err : new Error(reason));
    }
  }

  result.nextCursor = hasMore ? result.lastId : null;
  result.done = !hasMore;
  return result;
}
