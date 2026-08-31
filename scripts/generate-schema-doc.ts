#!/usr/bin/env bun
/**
 * Regenerate `docs/architecture/SCHEMA.md` from the database itself.
 *
 * The previous SCHEMA.md was hand-written, drifted 33 migrations behind reality,
 * and documented columns that had been removed. A generated document cannot
 * drift: re-run this and the doc matches whatever the database actually has.
 *
 * Ground truth is `sqlite_master` + the pragma table-valued functions, NOT
 * `src/db/schema.ts` and NOT `migrations/`. That ordering is deliberate — the
 * 2026-06-17 rebuild proved those two can disagree with production, and the
 * d1_migrations journal has been observed to mark a migration applied when its
 * DDL never landed. What the database contains is the only thing that is true.
 *
 * `src/db/schema.ts` is still read, but only to (a) borrow the human-written
 * comment above each table as its description and (b) report drift in both
 * directions. Drift is reported, never silently reconciled.
 *
 * Usage:
 *   bun scripts/generate-schema-doc.ts --remote     production (read-only)
 *   bun scripts/generate-schema-doc.ts              local D1 mirror
 *   bun scripts/generate-schema-doc.ts --check      exit 1 if the doc is stale
 *
 * This script NEVER writes to the database.
 */

import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const D1_DATABASE_NAME = 'mcis-db';
const SCHEMA_TS = join('src', 'db', 'schema.ts');
const OUTPUT = join('docs', 'architecture', 'SCHEMA.md');

/** Local miniflare D1 mirror (see `bun run db:sync:local`). */
const DEFAULT_LOCAL_DB = join(
  '.wrangler',
  'state',
  'v3',
  'd1',
  'miniflare-D1DatabaseObject',
  '6561ae709fb86aa0aa560450483225e16c16782df5f56ccbc6bcd48f8daabf2d.sqlite'
);

// Wrangler's own bookkeeping table — real, but not part of the application schema.
const INTERNAL_TABLES = new Set(['d1_migrations', '_cf_KV']);

interface MasterRow { type: string; name: string; tbl_name: string; sql: string | null }
interface ColumnRow { tbl: string; cid: number; col: string; type: string; nn: number; dflt: string | null; pk: number }
interface ForeignKeyRow { tbl: string; id: number; seq: number; ref_table: string; from_col: string; to_col: string | null; on_update: string; on_delete: string }

// D1's remote API answers SQLITE_AUTH if a pragma table-valued function is
// evaluated over Cloudflare's internal `_cf_*` tables, so they are excluded from
// every scan rather than filtered afterwards.
// Qualified with the alias on purpose: pragma_table_info also exposes a `name`
// column, so an unqualified reference here would be ambiguous.
const notInternal = (alias: string) =>
  `${alias}.name NOT LIKE 'sqlite_%' AND ${alias}.name NOT LIKE '_cf_%'`;

const MASTER_QUERY = `
  SELECT m.type, m.name, m.tbl_name, m.sql FROM sqlite_master m
  WHERE ${notInternal('m')} AND m.sql IS NOT NULL`;

const COLUMNS_QUERY = `
  SELECT m.name AS tbl, p.cid, p.name AS col, p.type, p."notnull" AS nn, p.dflt_value AS dflt, p.pk
  FROM sqlite_master m JOIN pragma_table_info(m.name) p
  WHERE m.type = 'table' AND ${notInternal('m')}`;

const FOREIGN_KEYS_QUERY = `
  SELECT m.name AS tbl, f.id, f.seq, f."table" AS ref_table, f."from" AS from_col,
         f."to" AS to_col, f.on_update, f.on_delete
  FROM sqlite_master m JOIN pragma_foreign_key_list(m.name) f
  WHERE m.type = 'table' AND ${notInternal('m')}`;

// ---------------------------------------------------------------------------
// Reading the database
// ---------------------------------------------------------------------------

/** Extract the JSON array wrangler prints, ignoring any surrounding banner text. */
function parseWranglerJson(stdout: string): Array<{ results?: Array<Record<string, unknown>> }> {
  const start = stdout.indexOf('[');
  const end = stdout.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`unexpected wrangler output (no JSON array found):\n${stdout.slice(0, 500)}`);
  }
  const parsed: unknown = JSON.parse(stdout.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('wrangler JSON payload was not an array');
  return parsed as Array<{ results?: Array<Record<string, unknown>> }>;
}

/**
 * Read-only production query. Invoked through `node node_modules/wrangler/...`
 * because the Windows .cmd shim mangles a quoted --command argument.
 */
function queryRemote(command: string): Array<Record<string, unknown>> {
  const result = Bun.spawnSync(
    [
      'node',
      join('node_modules', 'wrangler', 'bin', 'wrangler.js'),
      'd1', 'execute', D1_DATABASE_NAME, '--remote', '--json', '--command', command,
    ],
    { timeout: 120_000, stdout: 'pipe', stderr: 'pipe' }
  );
  if (result.exitCode !== 0) {
    throw new Error(
      `wrangler d1 execute failed (exit ${result.exitCode}):\n${result.stderr.toString().slice(0, 1000)}`
    );
  }
  return parseWranglerJson(result.stdout.toString())[0]?.results ?? [];
}

function queryLocal(dbPath: string, command: string): Array<Record<string, unknown>> {
  // Imported lazily so the --remote path never needs the mirror to exist.
  const { Database } = require('bun:sqlite') as typeof import('bun:sqlite');
  const db = new Database(dbPath, { readonly: true });
  try {
    return db.query(command).all() as Array<Record<string, unknown>>;
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Reading schema.ts (descriptions + drift only)
// ---------------------------------------------------------------------------

/**
 * Map SQL table name -> the comment block written above its sqliteTable() call.
 * Purely for human-readable descriptions; a table with no comment simply gets none.
 */
function readSchemaTsDescriptions(source: string): Map<string, string> {
  const descriptions = new Map<string, string>();
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const match = /sqliteTable\(\s*'([^']+)'/.exec(lines[i] ?? '');
    if (!match?.[1]) continue;

    // Walk back over the contiguous `//` comment block directly above.
    const comment: string[] = [];
    for (let j = i - 1; j >= 0; j--) {
      const line = (lines[j] ?? '').trim();
      if (line.startsWith('//')) {
        comment.unshift(line.replace(/^\/\/\s?/, ''));
        continue;
      }
      break;
    }
    if (comment.length > 0) descriptions.set(match[1], comment.join(' '));
  }
  return descriptions;
}

function readSchemaTsTables(source: string): Set<string> {
  return new Set([...source.matchAll(/sqliteTable\(\s*'([^']+)'/g)].map((m) => m[1] as string));
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Pull CHECK constraints out of a CREATE TABLE statement, balancing parentheses. */
function extractChecks(createSql: string): string[] {
  const checks: string[] = [];
  const pattern = /\bCHECK\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(createSql)) !== null) {
    let depth = 1;
    let i = match.index + match[0].length;
    for (; i < createSql.length && depth > 0; i++) {
      if (createSql[i] === '(') depth++;
      else if (createSql[i] === ')') depth--;
    }
    checks.push(createSql.slice(match.index + match[0].length, i - 1).replace(/\s+/g, ' ').trim());
  }
  return checks;
}

function anchor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderColumns(columns: ColumnRow[]): string {
  const rows = columns.map((c) => {
    const constraints: string[] = [];
    if (c.pk > 0) constraints.push(columns.filter((x) => x.pk > 0).length > 1 ? `PK(${c.pk})` : 'PK');
    if (c.nn === 1) constraints.push('NOT NULL');
    return `| \`${c.col}\` | ${c.type || '-'} | ${constraints.join(', ') || '-'} | ${
      c.dflt === null ? '-' : `\`${escapeCell(c.dflt)}\``
    } |`;
  });
  return ['| 欄位 | 型別 | 約束 | 預設值 |', '|---|---|---|---|', ...rows].join('\n');
}

function renderTable(
  name: string,
  createSql: string,
  columns: ColumnRow[],
  foreignKeys: ForeignKeyRow[],
  indexes: MasterRow[],
  description: string | undefined
): string {
  const parts: string[] = [`### \`${name}\``, ''];
  if (description) parts.push(`> ${description}`, '');

  parts.push(renderColumns(columns), '');

  const compositePk = columns.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk);
  if (compositePk.length > 1) {
    parts.push(`**複合主鍵**: (${compositePk.map((c) => `\`${c.col}\``).join(', ')})`, '');
  }

  if (foreignKeys.length > 0) {
    parts.push('**外鍵**:', '');
    for (const fk of foreignKeys) {
      const actions = [
        fk.on_delete && fk.on_delete !== 'NO ACTION' ? `ON DELETE ${fk.on_delete}` : '',
        fk.on_update && fk.on_update !== 'NO ACTION' ? `ON UPDATE ${fk.on_update}` : '',
      ].filter(Boolean).join(' ');
      parts.push(
        `- \`${fk.from_col}\` → \`${fk.ref_table}.${fk.to_col ?? 'rowid'}\`${actions ? ` (${actions})` : ''}`
      );
    }
    parts.push('');
  }

  if (indexes.length > 0) {
    parts.push('**索引**:', '');
    for (const idx of indexes) {
      const unique = /CREATE\s+UNIQUE\s+INDEX/i.test(idx.sql ?? '') ? ' *(UNIQUE)*' : '';
      const partial = /\bWHERE\b/i.test(idx.sql ?? '') ? ' *(partial)*' : '';
      const cols = /\(([^)]*)\)/.exec(idx.sql ?? '')?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
      parts.push(`- \`${idx.name}\`${unique}${partial} — (${cols})`);
    }
    parts.push('');
  }

  const checks = extractChecks(createSql);
  if (checks.length > 0) {
    parts.push('**CHECK 約束**:', '');
    for (const check of checks) parts.push(`- \`${check}\``);
    parts.push('');
  }

  parts.push('<details><summary>CREATE TABLE</summary>', '', '```sql', createSql.trim(), '```', '', '</details>', '');
  return parts.join('\n');
}

function render(
  master: MasterRow[],
  columns: ColumnRow[],
  foreignKeys: ForeignKeyRow[],
  descriptions: Map<string, string>,
  declaredInSchemaTs: Set<string>,
  source: string
): string {
  const tables = master
    .filter((m) => m.type === 'table' && !INTERNAL_TABLES.has(m.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const views = master.filter((m) => m.type === 'view').sort((a, b) => a.name.localeCompare(b.name));
  const indexes = master.filter((m) => m.type === 'index');

  const columnsByTable = new Map<string, ColumnRow[]>();
  for (const c of columns) {
    if (!columnsByTable.has(c.tbl)) columnsByTable.set(c.tbl, []);
    columnsByTable.get(c.tbl)!.push(c);
  }
  for (const list of columnsByTable.values()) list.sort((a, b) => a.cid - b.cid);

  const fksByTable = new Map<string, ForeignKeyRow[]>();
  for (const f of foreignKeys) {
    if (!fksByTable.has(f.tbl)) fksByTable.set(f.tbl, []);
    fksByTable.get(f.tbl)!.push(f);
  }

  const indexesByTable = new Map<string, MasterRow[]>();
  for (const i of indexes) {
    if (!indexesByTable.has(i.tbl_name)) indexesByTable.set(i.tbl_name, []);
    indexesByTable.get(i.tbl_name)!.push(i);
  }
  for (const list of indexesByTable.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  const totalChecks = tables.reduce((sum, t) => sum + extractChecks(t.sql ?? '').length, 0);

  const liveTableNames = new Set(tables.map((t) => t.name));
  const onlyInDb = [...liveTableNames].filter((t) => !declaredInSchemaTs.has(t)).sort();
  const onlyInSchemaTs = [...declaredInSchemaTs].filter((t) => !liveTableNames.has(t)).sort();

  const out: string[] = [];
  out.push('# 資料庫結構 (Database Schema)');
  out.push('');
  out.push('> **此文件由程式產生，請勿手動編輯。**');
  out.push('> 重新產生：`bun run db:doc:schema`（正式庫）或 `bun scripts/generate-schema-doc.ts`（本地鏡像）');
  out.push('>');
  out.push(`> **產生時間**: ${new Date().toISOString()}`);
  out.push(`> **資料來源**: ${source}`);
  out.push('>');
  out.push('> 內容直接讀自資料庫的 `sqlite_master` 與 pragma 函式，**不是**讀 `src/db/schema.ts`');
  out.push('> 或 `migrations/`。這個順序是刻意的：2026-06-17 的重建事件證明那兩者可能與正式庫');
  out.push('> 不一致，而 `d1_migrations` 日誌也曾在 DDL 從未落地的情況下標記 migration 已套用。');
  out.push('> **資料庫裡實際存在的東西，才是唯一的事實。**');
  out.push('');
  out.push('---');
  out.push('');
  out.push('## 概覽');
  out.push('');
  out.push('| 項目 | 數量 |');
  out.push('|---|---|');
  out.push(`| 資料表 | ${tables.length} |`);
  out.push(`| 索引 | ${indexes.length} |`);
  out.push(`| 視圖 | ${views.length} |`);
  out.push(`| 外鍵關係 | ${foreignKeys.length} |`);
  out.push(`| CHECK 約束 | ${totalChecks} |`);
  out.push('');
  if (totalChecks === 0) {
    out.push('> **注意：資料庫中沒有任何 CHECK 約束。** 至少 9 個 migration 的 SQL 有宣告');
    out.push('> CHECK（例如 `customer_feedback.rating` 的 1–5 範圍、`cors_events.type` 的列舉），');
    out.push('> 但正式庫一個都沒有。這與 2026-06-17 重建事件的模式一致 —— 能用 `schema.ts`');
    out.push('> 表達的存活了，只存在於 migration SQL 的則遺失。');
    out.push('>');
    out.push('> `bun run check:migrations` **偵測不到這件事**：它只追蹤 table / index /');
    out.push('> trigger / view 四種物件，不含 CHECK 約束。這些資料完整性保護目前在正式庫');
    out.push('> 沒有生效，相關驗證只靠應用層。');
    out.push('');
  }

  out.push('## 與 `src/db/schema.ts` 的一致性');
  out.push('');
  if (onlyInDb.length === 0 && onlyInSchemaTs.length === 0) {
    out.push(`資料庫中的 ${tables.length} 張表與 \`src/db/schema.ts\` 宣告的表**完全一致**。`);
  } else {
    out.push('> **偵測到漂移。** 以下差異僅回報，不會自動修正。');
    out.push('');
    if (onlyInDb.length > 0) {
      out.push('**只存在於資料庫、未在 `schema.ts` 宣告**：');
      out.push('');
      for (const t of onlyInDb) out.push(`- \`${t}\``);
      out.push('');
      out.push('Drizzle 查詢碰不到這些表。可能是遺留表，或 `schema.ts` 漏了宣告。');
      out.push('');
    }
    if (onlyInSchemaTs.length > 0) {
      out.push('**只在 `schema.ts` 宣告、資料庫中不存在**：');
      out.push('');
      for (const t of onlyInSchemaTs) out.push(`- \`${t}\``);
      out.push('');
      out.push('查詢這些表會在執行期失敗。多半代表某個 migration 沒有套用。');
      out.push('');
    }
  }
  out.push('相關檢查：`bun run check:migrations` 會比對「已套用的 migration 宣告了什麼」與');
  out.push('「資料庫實際有什麼」，涵蓋 table / index / trigger / view 四種物件，比本文件的');
  out.push('表級比對更細。**但它不檢查 CHECK 約束、欄位型別與外鍵**。');
  out.push('');
  out.push('---');
  out.push('');

  out.push('## 資料表目錄');
  out.push('');
  for (const t of tables) {
    const description = descriptions.get(t.name);
    const columnCount = columnsByTable.get(t.name)?.length ?? 0;
    out.push(`- [\`${t.name}\`](#${anchor(t.name)}) — ${columnCount} 欄${description ? `；${escapeCell(description)}` : ''}`);
  }
  out.push('');
  out.push('---');
  out.push('');

  out.push('## 資料表定義');
  out.push('');
  for (const t of tables) {
    out.push(renderTable(
      t.name,
      t.sql ?? '',
      columnsByTable.get(t.name) ?? [],
      fksByTable.get(t.name) ?? [],
      indexesByTable.get(t.name) ?? [],
      descriptions.get(t.name)
    ));
  }

  if (views.length > 0) {
    out.push('---');
    out.push('');
    out.push('## 視圖 (Views)');
    out.push('');
    for (const v of views) {
      out.push(`### \`${v.name}\``, '', '```sql', (v.sql ?? '').trim(), '```', '');
    }
  }

  out.push('---');
  out.push('');
  out.push('## 相關文件');
  out.push('');
  out.push('- [`MIGRATION_CHANGELOG.md`](database/MIGRATION_CHANGELOG.md) — migration 逐版說明');
  out.push('- [`../adr/`](../adr/) — 架構決策紀錄（含取捨與被否決的方案）');
  out.push('- `src/db/schema.ts` — Drizzle ORM 的型別定義');
  out.push('- `migrations/` — 實際的 migration SQL');
  out.push('');

  return out.join('\n');
}

// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);
  const remote = args.includes('--remote');
  const check = args.includes('--check');
  const dbPath = args.find((a) => a.startsWith('--db='))?.slice(5) ?? DEFAULT_LOCAL_DB;

  if (!remote && !existsSync(dbPath)) {
    console.error(`Local D1 mirror not found at ${dbPath}`);
    console.error('Run `bun run db:sync:local` first, or pass --db=<path>, or use --remote.');
    process.exit(1);
  }

  const run = remote
    ? (sql: string) => queryRemote(sql)
    : (sql: string) => queryLocal(dbPath, sql);

  const source = remote ? `REMOTE production D1 (${D1_DATABASE_NAME})` : `local D1 mirror (${dbPath})`;
  console.log(`Reading schema from: ${source}`);

  const master = run(MASTER_QUERY) as unknown as MasterRow[];
  const columns = run(COLUMNS_QUERY) as unknown as ColumnRow[];
  const foreignKeys = run(FOREIGN_KEYS_QUERY) as unknown as ForeignKeyRow[];

  const schemaTs = readFileSync(SCHEMA_TS, 'utf8');
  const markdown = render(
    master,
    columns,
    foreignKeys,
    readSchemaTsDescriptions(schemaTs),
    readSchemaTsTables(schemaTs),
    source
  );

  if (check) {
    const existing = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
    // Ignore the generation timestamp, which changes on every run.
    const strip = (s: string) => s.replace(/^> \*\*產生時間\*\*.*$/m, '').replace(/^> \*\*資料來源\*\*.*$/m, '');
    if (strip(existing) === strip(markdown)) {
      console.log(`OK: ${OUTPUT} is up to date.`);
      process.exit(0);
    }
    console.error(`STALE: ${OUTPUT} does not match the database. Run \`bun run db:doc:schema\`.`);
    process.exit(1);
  }

  writeFileSync(OUTPUT, markdown, 'utf8');
  const tableCount = master.filter((m) => m.type === 'table' && !INTERNAL_TABLES.has(m.name)).length;
  console.log(`Wrote ${OUTPUT} — ${tableCount} tables, ${master.filter((m) => m.type === 'index').length} indexes, ${master.filter((m) => m.type === 'view').length} views.`);
}

main();
