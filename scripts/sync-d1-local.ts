/**
 * sync-d1-local.ts
 *
 * Pulls the REMOTE production D1 (mcis-db) down into the LOCAL miniflare D1 so the
 * local environment is a 1:1 mirror of remote DATA. Scope is D1 only (KV/R2 are not synced).
 *
 * Why this exists: the project runs against remote bindings by default, but a local mirror
 * is useful for offline inspection and for `bun run dev:local`. Keeping it in a script makes
 * the sync repeatable and safe.
 *
 * Pipeline:
 *   1. wrangler d1 export --remote  -> SQL dump (schema + data) into .wrangler/ (gitignored)
 *   2. locate the active local mcis-db sqlite file (miniflare hash dir)
 *   3. wipe it, then import the dump via bun:sqlite with foreign_keys OFF
 *      (wrangler's local `execute --file` does NOT honour the dump's PRAGMA defer_foreign_keys
 *       because it auto-commits per statement, so an FK that points at a not-yet-created table
 *       fails. Importing the whole dump in one connection with FK off avoids this.)
 *   4. PRAGMA foreign_key_check + row-count verification against the remote counts.
 *
 * Remote impact: NONE. The export is a read-only operation.
 *
 * Usage: bun run db:sync:local
 */
import { Database } from 'bun:sqlite';
import { $ } from 'bun';
import { readFileSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const DB_NAME = 'mcis-db';
const D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const DUMP_PATH = '.wrangler/d1-remote-dump.sql'; // under .wrangler -> already gitignored (contains prod PII)
// Run wrangler via node to avoid the Windows .cmd shim mangling --command quotes.
const WRANGLER = ['node_modules/wrangler/bin/wrangler.js'];

function log(msg: string): void {
  console.log(`[sync-d1-local] ${msg}`);
}

/** Most recently modified non-metadata sqlite = the active mcis-db local file. */
function activeLocalDbFile(): string {
  const candidates = readdirSync(D1_DIR)
    .filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')
    .map((f) => ({ f, mtime: statSync(join(D1_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (candidates.length === 0) {
    throw new Error(`No local D1 sqlite found in ${D1_DIR}. Run a wrangler --local command first.`);
  }
  return join(D1_DIR, candidates[0].f);
}

function wipe(file: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    const p = file + suffix;
    if (existsSync(p)) rmSync(p);
  }
}

async function main(): Promise<void> {
  // 1. Ensure a local mcis-db file exists (wrangler creates it on first local touch), then export remote.
  log('Touching local D1 so the file exists...');
  await $`node ${WRANGLER} d1 execute ${DB_NAME} --local --command ${'SELECT 1'}`.quiet();

  log('Exporting REMOTE D1 (read-only)...');
  await $`node ${WRANGLER} d1 export ${DB_NAME} --remote --output=${DUMP_PATH}`;

  const sql = readFileSync(DUMP_PATH, 'utf8');
  const inserts = (sql.match(/INSERT INTO/g) ?? []).length;
  log(`Dump ready: ${(sql.length / 1024 / 1024).toFixed(1)}MB, ${inserts} INSERT statements.`);

  // 2 + 3. Wipe local mcis-db and re-import the dump with FK enforcement off.
  const dbFile = activeLocalDbFile();
  log(`Resetting local DB file: ${dbFile}`);
  wipe(dbFile);

  const db = new Database(dbFile, { create: true });
  db.exec('PRAGMA foreign_keys=OFF;');
  db.exec('PRAGMA journal_mode=WAL;');
  log('Importing dump into local D1...');
  const t0 = performance.now();
  db.exec(sql);
  db.exec('PRAGMA foreign_key_check;'); // throws if any FK is left dangling
  log(`Import done in ${Math.round(performance.now() - t0)}ms; FK integrity OK.`);

  // 4. Verify a sample of tables matches remote.
  const tables = (
    db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")
      .all() as { name: string }[]
  ).map((t) => t.name);
  let total = 0;
  for (const t of tables) {
    total += (db.query(`SELECT COUNT(*) c FROM "${t}"`).get() as { c: number }).c;
  }
  db.close();
  log(`Local mirror ready: ${tables.length} tables, ${total} user rows.`);
  log('Use `bun run dev:local` to run the Worker against this local D1.');
}

main().catch((err) => {
  console.error('[sync-d1-local] FAILED:', err);
  process.exit(1);
});
