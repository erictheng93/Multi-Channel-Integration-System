// Data Backup handler — admin-only manual backups + visibility into the
// automatic (GitHub Actions) backups stored in R2 `mcis-backups`.
//
// Routes (mounted at /api/data/backup):
//   GET  /            list recent backups + last automatic backup
//   POST /run         create an on-demand full DB backup -> R2 manual/
//   GET  /download    stream a backup object for download (?key=...)
import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth, requireRole } from '@/middleware/auth';
import { nowISO } from '@/utils/timestamp';

const backupHandler = new Hono<{ Bindings: Bindings }>();

// All backup operations are admin-only (a backup = the whole DB, incl. PII).
backupHandler.use('*', jwtAuth, requireRole('admin'));

function escapeSqlValue(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
}

/**
 * Yield a full SQL dump (schema + data) of the D1 database, one statement at a time.
 * Schema is blob-free (text/int/real/null), so value serialization is exact.
 * Paginated per table to stay within D1 response limits.
 */
async function* dumpStatements(db: Bindings['DB']): AsyncGenerator<string> {
  const tables = await db
    .prepare(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND sql IS NOT NULL ORDER BY name"
    )
    .all<{ name: string; sql: string }>();

  yield 'PRAGMA defer_foreign_keys=TRUE;\n';
  const PAGE = 1000;

  for (const t of tables.results) {
    yield `${t.sql};\n`;
    let offset = 0;
    for (;;) {
      const page = await db
        .prepare(`SELECT * FROM "${t.name}" LIMIT ? OFFSET ?`)
        .bind(PAGE, offset)
        .all<Record<string, unknown>>();
      const rows = page.results;
      if (rows.length === 0) break;
      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = cols.map((col) => escapeSqlValue(row[col]));
        yield `INSERT INTO "${t.name}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals.join(', ')});\n`;
      }
      if (rows.length < PAGE) break;
      offset += PAGE;
    }
  }
}

// R2 multipart parts must be >= 5 MiB (except the last), which also bounds memory.
const PART_SIZE = 5 * 1024 * 1024;

/** Stream the dump into R2 via multipart upload; returns the size in bytes. */
export async function putDump(
  bucket: R2Bucket,
  key: string,
  statements: AsyncIterable<string>,
  options: R2PutOptions
): Promise<number> {
  const upload = await bucket.createMultipartUpload(key, options);
  const encoder = new TextEncoder();
  const parts: R2UploadedPart[] = [];
  let chunks: Uint8Array[] = [];
  let buffered = 0;
  let total = 0;

  const flush = async () => {
    const body = new Uint8Array(buffered);
    let at = 0;
    for (const chunk of chunks) {
      body.set(chunk, at);
      at += chunk.length;
    }
    parts.push(await upload.uploadPart(parts.length + 1, body));
    chunks = [];
    buffered = 0;
  };

  try {
    for await (const statement of statements) {
      const bytes = encoder.encode(statement);
      chunks.push(bytes);
      buffered += bytes.length;
      total += bytes.length;
      if (buffered >= PART_SIZE) await flush();
    }
    if (buffered > 0) await flush();
    await upload.complete(parts);
    return total;
  } catch (error) {
    await upload.abort().catch(() => undefined);
    throw error;
  }
}

// GET /api/data/backup — list backups + last automatic backup
backupHandler.get('/', async (c) => {
  const bucket = c.env.R2_BACKUP;
  if (!bucket) {
    return c.json({ success: false, error: 'Backup storage not configured' }, 500);
  }
  const listed = await bucket.list({ limit: 1000 });
  const items = listed.objects
    .map((o) => ({
      key: o.key,
      size: o.size,
      uploaded: o.uploaded instanceof Date ? o.uploaded.toISOString() : String(o.uploaded),
      tier: o.key.split('/')[0] || 'other',
    }))
    .sort((a, b) => b.uploaded.localeCompare(a.uploaded));

  const lastAuto = items.find((i) => i.tier === 'daily') || null;
  return c.json({
    success: true,
    data: { items, lastAuto, count: items.length },
    timestamp: nowISO(),
  });
});

// POST /api/data/backup/run — on-demand full backup to R2 manual/
backupHandler.post('/run', async (c) => {
  const bucket = c.env.R2_BACKUP;
  if (!bucket) {
    return c.json({ success: false, error: 'Backup storage not configured' }, 500);
  }
  const user = c.get('user');
  const stamp = nowISO().replace(/[:.]/g, '-');
  const key = `manual/mcis-db-${stamp}.sql`;

  const size = await putDump(bucket, key, dumpStatements(c.env.DB), {
    httpMetadata: { contentType: 'application/sql' },
    customMetadata: {
      triggeredBy: String(user?.email || user?.id || 'admin'),
      createdAt: nowISO(),
    },
  });

  return c.json({
    success: true,
    data: { key, size },
    message: '備份已建立並上傳至雲端',
    timestamp: nowISO(),
  });
});

// GET /api/data/backup/download?key=... — stream a backup for download
backupHandler.get('/download', async (c) => {
  const bucket = c.env.R2_BACKUP;
  if (!bucket) {
    return c.json({ success: false, error: 'Backup storage not configured' }, 500);
  }
  const key = c.req.query('key');
  if (!key) {
    return c.json({ success: false, error: 'key query parameter is required' }, 400);
  }
  const object = await bucket.get(key);
  if (!object) {
    return c.json({ success: false, error: 'Backup not found' }, 404);
  }
  const filename = key.split('/').pop() || 'backup.sql';
  c.header('Content-Type', 'application/sql');
  c.header('Content-Disposition', `attachment; filename="${filename}"`);
  return c.body(object.body);
});

export default backupHandler;
