// Admin-only one-off migration endpoints.
//
// Mounted at /api/admin/migrations/*. All routes require jwtAuth +
// requireAdmin. See src/modules/system/services/legacy-filename-backfill.ts
// for the migration this handler currently exposes.

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth, requireAdmin } from '@/middleware/auth';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import { createContextLogger } from '@/utils/logger';
import { runBackfillLegacyFilenames } from '@/modules/system/services/legacy-filename-backfill';

const log = createContextLogger('AdminMigrations');

const adminMigrationsHandler = new Hono<{ Bindings: Bindings }>();

adminMigrationsHandler.use('*', jwtAuth, requireAdmin());

/**
 * Backfill legacy file_attachments rows whose filename lacks an extension.
 *
 * POST /api/admin/migrations/backfill-legacy-filenames
 *
 * Query params
 *   dryRun  : "false" to mutate. Anything else (including missing) = dry-run.
 *   limit   : batch size, default 50, max 200.
 *   cursor  : last processed id; omit for the first batch.
 *
 * Response
 *   { success, stats: { scanned, fixed, skipped, missingR2, errors,
 *                       lastId, nextCursor, done, dryRun, sample, errorDetails } }
 */
adminMigrationsHandler.post('/backfill-legacy-filenames', async (c) => {
  try {
    const dryRunParam = c.req.query('dryRun');
    const limitParam = c.req.query('limit');
    const cursor = c.req.query('cursor') || undefined;

    // Default: dry-run. Only explicit "false" triggers a real mutation.
    const dryRun = dryRunParam !== 'false';

    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 50;
    if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
      return c.json(
        { success: false, error: 'limit must be a positive integer' },
        HTTP_STATUS.BAD_REQUEST
      );
    }
    const limit = Math.min(parsedLimit, 200);

    log.info('Starting backfill', { dryRun, limit, cursor });
    const stats = await runBackfillLegacyFilenames(c.env, { dryRun, limit, cursor });
    log.info('Backfill batch complete', {
      dryRun,
      scanned: stats.scanned,
      fixed: stats.fixed,
      skipped: stats.skipped,
      missingR2: stats.missingR2,
      errors: stats.errors,
      done: stats.done,
    });

    return c.json({ success: true, stats });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default adminMigrationsHandler;
