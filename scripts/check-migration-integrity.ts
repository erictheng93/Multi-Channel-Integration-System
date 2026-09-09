/**
 * check-migration-integrity.ts
 *
 * Verifies that every schema object DECLARED by a file in migrations/ actually
 * EXISTS in the target database, and — the important part — flags any migration
 * that d1_migrations claims was applied but whose objects are missing.
 *
 * Why this exists:
 *   Production D1 `mcis-db` was deleted and rebuilt on 2026-06-17. The rebuild
 *   INSERTed rows into `d1_migrations` but never executed the migration DDL.
 *   Nothing in this repo checked that, so the same root cause resurfaced three
 *   times, each time found by accident months later:
 *
 *     2026-06-30  messages.platform_message_id lost its UNIQUE constraint
 *                 -> duplicate LINE media written to R2
 *     2026-07-21  missing index -> O(n^2) unread-count query -> USD 22 D1 bill
 *     2026-07-30  all 15 indexes from 0027_schema_optimizations.sql absent;
 *                 d1_migrations id=21 says applied 2026-06-17 08:18:50.
 *                 Missing idx_notifications_user_unread = 82.2% of rows_read.
 *
 *   This script is the tripwire. `d1_migrations` is a claim; sqlite_master is
 *   the truth. Never trust the journal again.
 *
 * How it works:
 *   1. Replays migrations/*.sql in filename order as a symbolic DDL simulation
 *      (CREATE / DROP / ALTER ... RENAME), so an object intentionally removed by
 *      a LATER migration is never reported as missing. Table drops cascade to
 *      that table's indexes and triggers, exactly as SQLite does.
 *   2. Reads sqlite_master from the target database (read-only).
 *   3. Diffs expected vs actual, then splits the diff by d1_migrations state:
 *        - recorded as applied + objects missing  -> PHANTOM APPLIED (fatal)
 *        - not recorded + objects missing         -> pending migration (warning)
 *
 * Usage:
 *   bun scripts/check-migration-integrity.ts                 (local D1 mirror)
 *   bun scripts/check-migration-integrity.ts --remote        (production, read-only)
 *   bun scripts/check-migration-integrity.ts --db=<path>     (explicit sqlite file)
 *   bun scripts/check-migration-integrity.ts --verbose       (also list everything expected)
 *
 * This script NEVER writes. Local files are opened read-only; the remote path
 * issues a single SELECT against sqlite_master via `wrangler d1 execute`.
 *
 * Exit codes:
 *   0 = every object declared by an applied migration exists
 *   1 = phantom-applied migrations / definition mismatches / operational failure
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MIGRATIONS_DIR = 'migrations';
const D1_DATABASE_NAME = 'mcis-db';

/** Local miniflare D1 mirror (see `bun run db:sync:local`). */
const DEFAULT_LOCAL_DB = join(
  '.wrangler',
  'state',
  'v3',
  'd1',
  'miniflare-D1DatabaseObject',
  '6561ae709fb86aa0aa560450483225e16c16782df5f56ccbc6bcd48f8daabf2d.sqlite'
);

const SQLITE_MASTER_QUERY = 'SELECT type,name,tbl_name,sql FROM sqlite_master';
const D1_MIGRATIONS_QUERY = 'SELECT name FROM d1_migrations';

/**
 * SQLite identifier: `backtick`, "double", [bracket] or bare.
 * Kept as a source string so it can be composed into larger regexes.
 */
const IDENT = '(?:`[^`]+`|"[^"]+"|\\[[^\\]]+\\]|[A-Za-z_][A-Za-z0-9_$]*)';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ObjectType = 'table' | 'index' | 'trigger' | 'view';

interface UniqueConstraint {
  /** Normalized column names, in declaration order. */
  columns: string[];
  /** Migration filename that declared the constraint. */
  declaredBy: string;
  /** Human-readable origin, e.g. "UNIQUE(platform_message_id)". */
  label: string;
}

interface SchemaObject {
  type: ObjectType;
  /** Current name after any ALTER TABLE ... RENAME TO replay. */
  name: string;
  /** Owning table for index/trigger; own name for table/view. */
  table: string;
  /** Index only: declared with UNIQUE. */
  unique: boolean;
  /** Index only: normalized indexed columns/expressions. */
  columns: string[];
  /** Index only: has a WHERE clause (partial index). */
  partial: boolean;
  /** Table only: UNIQUE constraints declared inside CREATE TABLE. */
  uniqueConstraints: UniqueConstraint[];
  /** Migration filename that created the object in its current form. */
  declaredBy: string;
  /**
   * Every migration that has declared this object, oldest first. A later
   * migration re-declaring an object (a repair migration) must not erase the
   * fact that an EARLIER, already-applied migration also promised it.
   */
  declaredByChain: string[];
}

interface ActualDatabase {
  /** lowercased object name -> row */
  objects: Map<string, { type: string; name: string; tblName: string; sql: string | null }>;
  /** Migration filenames recorded in d1_migrations; null when the table is absent. */
  recordedMigrations: Set<string> | null;
}

type FindingKind = 'missing-object' | 'missing-unique' | 'not-unique' | 'column-drift';

interface Finding {
  kind: FindingKind;
  /** Fatal findings gate CI; non-fatal are printed as warnings. */
  fatal: boolean;
  migration: string;
  objectType: ObjectType | 'unique-constraint';
  name: string;
  detail: string;
  /**
   * Set when an EARLIER applied migration also declared this object, i.e. the
   * object is genuinely phantom-applied even if a later pending migration is
   * queued to repair it. Never let a queued fix hide the original lie.
   */
  phantomLineage?: string[];
}

// ---------------------------------------------------------------------------
// SQL lexing helpers
// ---------------------------------------------------------------------------

/** Strip `--` line comments and slash-star block comments, respecting string/ident quoting. */
function stripComments(sql: string): string {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === '-' && next === '-') {
      // Line comment: drop through end of line, keep the newline.
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) {
        if (sql[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
      out += ' ';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      out += ch;
      i++;
      while (i < sql.length) {
        if (sql[i] === quote) {
          // Doubled quote is an escaped quote, not a terminator.
          if (sql[i + 1] === quote) {
            out += quote + quote;
            i += 2;
            continue;
          }
          out += quote;
          i++;
          break;
        }
        out += sql[i];
        i++;
      }
      continue;
    }
    if (ch === '[') {
      while (i < sql.length && sql[i] !== ']') {
        out += sql[i];
        i++;
      }
      out += ']';
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

const TRIGGER_START_RE = /\bCREATE\s+(?:TEMP(?:ORARY)?\s+)?TRIGGER\b/i;

/**
 * Split comment-free SQL into statements on top-level semicolons.
 * A CREATE TRIGGER body (BEGIN ... END) contains semicolons and is kept whole.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let buf = '';
  let depth = 0;
  let i = 0;

  const flush = (): void => {
    const trimmed = buf.trim();
    if (trimmed.length > 0) statements.push(trimmed);
    buf = '';
  };

  while (i < sql.length) {
    const ch = sql[i];

    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      buf += ch;
      i++;
      while (i < sql.length) {
        buf += sql[i];
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            buf += sql[i + 1];
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === '[') {
      while (i < sql.length && sql[i] !== ']') {
        buf += sql[i];
        i++;
      }
      buf += ']';
      i++;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);

    if (ch === ';' && depth === 0) {
      const insideTriggerBody =
        TRIGGER_START_RE.test(buf) && /\bBEGIN\b/i.test(buf) && !/\bEND\s*$/i.test(buf.trim());
      if (insideTriggerBody) {
        buf += ch;
        i++;
        continue;
      }
      flush();
      i++;
      continue;
    }

    buf += ch;
    i++;
  }
  flush();
  return statements;
}

/** Extract the balanced-parenthesis group starting at `openIdx` (which must be a `(`). */
function extractParenGroup(sql: string, openIdx: number): { body: string; endIdx: number } | null {
  if (sql[openIdx] !== '(') return null;
  let depth = 0;
  let i = openIdx;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i++;
      while (i < sql.length && sql[i] !== quote) i++;
      i++;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return { body: sql.slice(openIdx + 1, i), endIdx: i };
      }
    }
    i++;
  }
  return null;
}

/** Split a parenthesized list on top-level commas. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let buf = '';
  let depth = 0;
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      buf += ch;
      i++;
      while (i < body.length) {
        buf += body[i];
        if (body[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(buf.trim());
      buf = '';
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf.trim().length > 0) parts.push(buf.trim());
  return parts;
}

function unquoteIdent(raw: string): string {
  const s = raw.trim();
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '`' && last === '`') || (first === '"' && last === '"')) {
      return s.slice(1, -1);
    }
    if (first === '[' && last === ']') return s.slice(1, -1);
  }
  return s;
}

/** Normalize one index/constraint column term: drop COLLATE / ASC / DESC, unquote, lowercase. */
function normalizeColumnTerm(term: string): string {
  let t = term.trim();
  t = t.replace(/\s+COLLATE\s+\S+/gi, '');
  t = t.replace(/\s+(ASC|DESC)\s*$/i, '');
  return unquoteIdent(t.trim()).toLowerCase();
}

function normalizeColumns(body: string): string[] {
  return splitTopLevel(body)
    .map(normalizeColumnTerm)
    .filter((c) => c.length > 0);
}

// ---------------------------------------------------------------------------
// DDL statement parsing
// ---------------------------------------------------------------------------

const CREATE_INDEX_RE = new RegExp(
  `^CREATE\\s+(UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:${IDENT}\\s*\\.\\s*)?(${IDENT})\\s+ON\\s+(${IDENT})\\s*\\(`,
  'is'
);
const CREATE_TABLE_RE = new RegExp(
  `^CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:${IDENT}\\s*\\.\\s*)?(${IDENT})\\s*\\(`,
  'is'
);
const CREATE_VIEW_RE = new RegExp(
  `^CREATE\\s+(?:TEMP(?:ORARY)?\\s+)?VIEW\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:${IDENT}\\s*\\.\\s*)?(${IDENT})`,
  'is'
);
const CREATE_TRIGGER_RE = new RegExp(
  `^CREATE\\s+(?:TEMP(?:ORARY)?\\s+)?TRIGGER\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:${IDENT}\\s*\\.\\s*)?(${IDENT})[\\s\\S]*?\\bON\\s+(${IDENT})`,
  'is'
);
const DROP_RE = new RegExp(
  `^DROP\\s+(INDEX|TABLE|VIEW|TRIGGER)\\s+(?:IF\\s+EXISTS\\s+)?(?:${IDENT}\\s*\\.\\s*)?(${IDENT})`,
  'is'
);
const RENAME_TABLE_RE = new RegExp(
  `^ALTER\\s+TABLE\\s+(?:${IDENT}\\s*\\.\\s*)?(${IDENT})\\s+RENAME\\s+TO\\s+(${IDENT})`,
  'is'
);
const RENAME_COLUMN_RE = new RegExp(
  `^ALTER\\s+TABLE\\s+(?:${IDENT}\\s*\\.\\s*)?(${IDENT})\\s+RENAME\\s+(?:COLUMN\\s+)?(${IDENT})\\s+TO\\s+(${IDENT})`,
  'is'
);

interface ParsedIndex {
  name: string;
  table: string;
  unique: boolean;
  columns: string[];
  partial: boolean;
}

/** Parse a CREATE INDEX statement. Also used on sqlite_master.sql for actual indexes. */
function parseCreateIndex(statement: string): ParsedIndex | null {
  const m = CREATE_INDEX_RE.exec(statement);
  if (!m) return null;
  const openIdx = statement.indexOf('(', m.index + m[0].length - 1);
  const group = extractParenGroup(statement, openIdx);
  if (!group) return null;
  const tail = statement.slice(group.endIdx + 1);
  return {
    name: unquoteIdent(m[2]),
    table: unquoteIdent(m[3]),
    unique: Boolean(m[1]),
    columns: normalizeColumns(group.body),
    partial: /\bWHERE\b/i.test(tail),
  };
}

interface ParsedTable {
  name: string;
  uniqueConstraints: Array<{ columns: string[]; label: string }>;
}

/**
 * Parse a CREATE TABLE statement, collecting UNIQUE constraints from both
 * table-level clauses -- UNIQUE(a,b) / CONSTRAINT x UNIQUE(a,b) -- and
 * inline column definitions -- `col TEXT UNIQUE`.
 */
function parseCreateTable(statement: string): ParsedTable | null {
  const m = CREATE_TABLE_RE.exec(statement);
  if (!m) return null;
  const openIdx = statement.indexOf('(', m.index + m[0].length - 1);
  const group = extractParenGroup(statement, openIdx);
  if (!group) return null;

  const uniqueConstraints: Array<{ columns: string[]; label: string }> = [];

  for (const part of splitTopLevel(group.body)) {
    const tableLevel = /^(?:CONSTRAINT\s+\S+\s+)?UNIQUE\s*\(/i.exec(part);
    if (tableLevel) {
      const g = extractParenGroup(part, part.indexOf('(', tableLevel[0].length - 1));
      if (g) {
        const columns = normalizeColumns(g.body);
        if (columns.length > 0) {
          uniqueConstraints.push({ columns, label: `UNIQUE(${columns.join(', ')})` });
        }
      }
      continue;
    }

    // Skip other table-level constraints so their bodies are not mistaken for
    // column definitions (a CHECK body can legitimately contain the word UNIQUE).
    if (/^(?:CONSTRAINT\b|PRIMARY\s+KEY\b|CHECK\b|FOREIGN\s+KEY\b)/i.test(part)) continue;

    // Inline column-level UNIQUE. Guard against matching inside a DEFAULT string.
    const inline = new RegExp(`^(${IDENT})\\b`, 'i').exec(part);
    if (inline && /\bUNIQUE\b/i.test(part.replace(/'[^']*'/g, ''))) {
      const column = unquoteIdent(inline[1]).toLowerCase();
      uniqueConstraints.push({ columns: [column], label: `${column} UNIQUE (inline)` });
    }
  }

  return { name: unquoteIdent(m[1]), uniqueConstraints };
}

// ---------------------------------------------------------------------------
// Migration replay
// ---------------------------------------------------------------------------

function listMigrationFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    throw new Error(`migrations directory not found: ${dir}`);
  }
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

/**
 * Replay every migration in filename order and return the schema objects the
 * migration chain is expected to leave behind.
 *
 * Ordering is the whole point: a CREATE in 0027 followed by a DROP in 0036 must
 * net out to "absent", and a table rebuild (CREATE _new / DROP old / RENAME)
 * must not leave a phantom `*_new` expectation behind. An audit that reports
 * intentionally-removed objects gets ignored, which is how three incidents with
 * the same root cause slipped through.
 */
function buildExpectedSchema(
  files: string[],
  dir: string
): {
  objects: Map<string, SchemaObject>;
  declaringMigrations: string[];
} {
  const objects = new Map<string, SchemaObject>();
  const declaringMigrations: string[] = [];

  const key = (name: string): string => name.toLowerCase();

  /**
   * Declaration chains survive DROPs. If 0027 creates an index, 0036 drops it,
   * and 0055 re-creates it, the chain is [0027, 0055] -- so a missing object can
   * still be attributed to the applied migration that first promised it.
   */
  const chains = new Map<string, string[]>();
  const appendChain = (name: string, file: string): string[] => {
    const k = key(name);
    const chain = chains.get(k) ?? [];
    if (chain[chain.length - 1] !== file) chain.push(file);
    chains.set(k, chain);
    return [...chain];
  };

  const dropTableCascade = (tableName: string): void => {
    const target = key(tableName);
    for (const [k, obj] of [...objects.entries()]) {
      // SQLite drops a table's indexes and triggers along with the table.
      if (k === target || key(obj.table) === target) objects.delete(k);
    }
  };

  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf-8');
    const statements = splitStatements(stripComments(raw));
    let declaredSomething = false;

    for (const statement of statements) {
      // --- CREATE INDEX -------------------------------------------------
      const idx = parseCreateIndex(statement);
      if (idx) {
        objects.set(key(idx.name), {
          type: 'index',
          name: idx.name,
          table: idx.table,
          unique: idx.unique,
          columns: idx.columns,
          partial: idx.partial,
          uniqueConstraints: [],
          declaredBy: file,
          declaredByChain: appendChain(idx.name, file),
        });
        declaredSomething = true;
        continue;
      }

      // --- CREATE TABLE -------------------------------------------------
      const tbl = parseCreateTable(statement);
      if (tbl) {
        objects.set(key(tbl.name), {
          type: 'table',
          name: tbl.name,
          table: tbl.name,
          unique: false,
          columns: [],
          partial: false,
          uniqueConstraints: tbl.uniqueConstraints.map((u) => ({
            columns: u.columns,
            declaredBy: file,
            label: u.label,
          })),
          declaredBy: file,
          declaredByChain: appendChain(tbl.name, file),
        });
        declaredSomething = true;
        continue;
      }

      // --- CREATE VIEW --------------------------------------------------
      const viewMatch = CREATE_VIEW_RE.exec(statement);
      if (viewMatch) {
        const name = unquoteIdent(viewMatch[1]);
        objects.set(key(name), {
          type: 'view',
          name,
          table: name,
          unique: false,
          columns: [],
          partial: false,
          uniqueConstraints: [],
          declaredBy: file,
          declaredByChain: appendChain(name, file),
        });
        declaredSomething = true;
        continue;
      }

      // --- CREATE TRIGGER -----------------------------------------------
      const trigMatch = CREATE_TRIGGER_RE.exec(statement);
      if (trigMatch) {
        const name = unquoteIdent(trigMatch[1]);
        objects.set(key(name), {
          type: 'trigger',
          name,
          table: unquoteIdent(trigMatch[2]),
          unique: false,
          columns: [],
          partial: false,
          uniqueConstraints: [],
          declaredBy: file,
          declaredByChain: appendChain(name, file),
        });
        declaredSomething = true;
        continue;
      }

      // --- DROP ----------------------------------------------------------
      const dropMatch = DROP_RE.exec(statement);
      if (dropMatch) {
        const what = dropMatch[1].toLowerCase();
        const name = unquoteIdent(dropMatch[2]);
        if (what === 'table') dropTableCascade(name);
        else objects.delete(key(name));
        continue;
      }

      // --- ALTER TABLE ... RENAME TO -------------------------------------
      const renameTable = RENAME_TABLE_RE.exec(statement);
      if (renameTable) {
        const from = unquoteIdent(renameTable[1]);
        const to = unquoteIdent(renameTable[2]);
        const existing = objects.get(key(from));
        if (existing && existing.type === 'table') {
          objects.delete(key(from));
          objects.set(key(to), { ...existing, name: to, table: to });
          const chain = chains.get(key(from));
          if (chain) {
            chains.delete(key(from));
            chains.set(key(to), chain);
          }
        }
        // SQLite carries indexes and triggers over to the new table name.
        for (const obj of objects.values()) {
          if (obj.type !== 'table' && key(obj.table) === key(from)) obj.table = to;
        }
        continue;
      }

      // --- ALTER TABLE ... RENAME COLUMN --------------------------------
      const renameColumn = RENAME_COLUMN_RE.exec(statement);
      if (renameColumn) {
        const table = key(unquoteIdent(renameColumn[1]));
        const from = unquoteIdent(renameColumn[2]).toLowerCase();
        const to = unquoteIdent(renameColumn[3]).toLowerCase();
        for (const obj of objects.values()) {
          if (key(obj.table) !== table) continue;
          obj.columns = obj.columns.map((c) => (c === from ? to : c));
          for (const uc of obj.uniqueConstraints) {
            uc.columns = uc.columns.map((c) => (c === from ? to : c));
          }
        }
        continue;
      }

      // Everything else (INSERT / UPDATE / PRAGMA / ALTER ADD COLUMN /
      // SELECT / ANALYZE) does not change the object inventory.
    }

    if (declaredSomething) declaringMigrations.push(file);
  }

  return { objects, declaringMigrations };
}

// ---------------------------------------------------------------------------
// Database readers (read-only)
// ---------------------------------------------------------------------------

interface MasterRow {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
}

function toMasterRows(rows: Array<Record<string, unknown>>): MasterRow[] {
  return rows.map((r) => ({
    type: String(r.type ?? ''),
    name: String(r.name ?? ''),
    tbl_name: String(r.tbl_name ?? ''),
    sql: typeof r.sql === 'string' ? r.sql : null,
  }));
}

function buildActual(rows: MasterRow[], recorded: Set<string> | null): ActualDatabase {
  const objects = new Map<string, { type: string; name: string; tblName: string; sql: string | null }>();
  for (const row of rows) {
    objects.set(row.name.toLowerCase(), {
      type: row.type,
      name: row.name,
      tblName: row.tbl_name,
      sql: row.sql,
    });
  }
  return { objects, recordedMigrations: recorded };
}

/** Minimal read-only sqlite reader. Prefers bun:sqlite, falls back to better-sqlite3. */
async function readLocalDatabase(dbPath: string): Promise<ActualDatabase> {
  if (!existsSync(dbPath)) {
    throw new Error(
      `local D1 mirror not found: ${dbPath}\n` +
        '  Run `bun run db:sync:local` first, or pass --db=<path>, or use --remote.'
    );
  }

  const isBun = typeof globalThis.Bun !== 'undefined';
  let all: (sql: string) => Array<Record<string, unknown>>;
  let close: () => void;

  if (isBun) {
    const { Database } = await import('bun:sqlite');
    const db = new Database(dbPath, { readonly: true });
    all = (sql) => db.query(sql).all() as Array<Record<string, unknown>>;
    close = () => db.close();
  } else {
    const mod = await import('better-sqlite3');
    const BetterSqlite = (mod.default ?? mod) as unknown as new (
      path: string,
      opts: { readonly: boolean; fileMustExist: boolean }
    ) => {
      prepare(sql: string): { all(): Array<Record<string, unknown>> };
      close(): void;
    };
    const db = new BetterSqlite(dbPath, { readonly: true, fileMustExist: true });
    all = (sql) => db.prepare(sql).all();
    close = () => db.close();
  }

  try {
    const master = toMasterRows(all(SQLITE_MASTER_QUERY));
    const hasJournal = master.some(
      (r) => r.type === 'table' && r.name.toLowerCase() === 'd1_migrations'
    );
    const recorded = hasJournal
      ? new Set(all(D1_MIGRATIONS_QUERY).map((r) => String(r.name ?? '')))
      : null;
    return buildActual(master, recorded);
  } finally {
    close();
  }
}

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
      'd1',
      'execute',
      D1_DATABASE_NAME,
      '--remote',
      '--json',
      '--command',
      command,
    ],
    { timeout: 120_000, stdout: 'pipe', stderr: 'pipe' }
  );

  const stdout = result.stdout.toString();
  if (result.exitCode !== 0) {
    throw new Error(
      `wrangler d1 execute failed (exit ${result.exitCode}):\n${result.stderr.toString().slice(0, 1000)}`
    );
  }
  const payload = parseWranglerJson(stdout);
  return payload[0]?.results ?? [];
}

function readRemoteDatabase(): ActualDatabase {
  const master = toMasterRows(queryRemote(SQLITE_MASTER_QUERY));
  const hasJournal = master.some(
    (r) => r.type === 'table' && r.name.toLowerCase() === 'd1_migrations'
  );
  const recorded = hasJournal
    ? new Set(queryRemote(D1_MIGRATIONS_QUERY).map((r) => String(r.name ?? '')))
    : null;
  return buildActual(master, recorded);
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

function sameColumnSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

/**
 * A UNIQUE table constraint is satisfied either by the constraint still being
 * present in the live CREATE TABLE text, or by an equivalent UNIQUE index.
 * Migration 0050 deliberately restored 0011's constraint as a partial unique
 * index, so accepting the index form is required to avoid a false positive.
 */
function uniqueConstraintSatisfied(
  tableName: string,
  columns: string[],
  actual: ActualDatabase
): boolean {
  const liveTable = actual.objects.get(tableName.toLowerCase());
  if (liveTable?.sql) {
    const parsed = parseCreateTable(liveTable.sql.trim());
    if (parsed?.uniqueConstraints.some((uc) => sameColumnSet(uc.columns, columns))) return true;
  }

  for (const obj of actual.objects.values()) {
    if (obj.type !== 'index') continue;
    if (obj.tblName.toLowerCase() !== tableName.toLowerCase()) continue;
    if (!obj.sql) {
      // Auto-index from a UNIQUE/PK constraint; its columns are not in
      // sqlite_master. The CREATE TABLE text check above already covers it.
      continue;
    }
    const parsed = parseCreateIndex(obj.sql.trim());
    if (parsed?.unique && sameColumnSet(parsed.columns, columns)) return true;
  }
  return false;
}

function compare(expected: Map<string, SchemaObject>, actual: ActualDatabase): Finding[] {
  const findings: Finding[] = [];
  const recorded = actual.recordedMigrations;

  /** Applied migrations, other than the latest declaration, that also promised this object. */
  const earlierAppliedDeclarations = (obj: SchemaObject): string[] =>
    recorded === null
      ? []
      : obj.declaredByChain.filter((m) => m !== obj.declaredBy && recorded.has(m));

  for (const obj of expected.values()) {
    const live = actual.objects.get(obj.name.toLowerCase());

    if (!live) {
      const lineage = earlierAppliedDeclarations(obj);
      findings.push({
        kind: 'missing-object',
        fatal: true,
        migration: obj.declaredBy,
        objectType: obj.type,
        name: obj.name,
        detail:
          obj.type === 'index'
            ? `index on ${obj.table}(${obj.columns.join(', ')})${obj.partial ? ' [partial]' : ''}`
            : `${obj.type} ${obj.name}`,
        ...(lineage.length > 0 ? { phantomLineage: lineage } : {}),
      });
      continue;
    }

    if (obj.type === 'index' && live.sql) {
      const parsed = parseCreateIndex(live.sql.trim());
      if (parsed) {
        if (obj.unique && !parsed.unique) {
          findings.push({
            kind: 'not-unique',
            fatal: true,
            migration: obj.declaredBy,
            objectType: 'index',
            name: obj.name,
            detail: 'declared UNIQUE but the live index is not unique',
          });
        } else if (!sameColumnSet(obj.columns, parsed.columns)) {
          // Column drift is usually a harmless rewrite (drizzle push, later
          // hand-tuning). Reported, but never gates CI.
          findings.push({
            kind: 'column-drift',
            fatal: false,
            migration: obj.declaredBy,
            objectType: 'index',
            name: obj.name,
            detail: `declared (${obj.columns.join(', ')}) but live is (${parsed.columns.join(', ')})`,
          });
        }
      }
    }

    if (obj.type === 'table') {
      for (const uc of obj.uniqueConstraints) {
        if (!uniqueConstraintSatisfied(obj.name, uc.columns, actual)) {
          findings.push({
            kind: 'missing-unique',
            fatal: true,
            migration: uc.declaredBy,
            objectType: 'unique-constraint',
            name: `${obj.name}.${uc.columns.join('+')}`,
            detail: `${uc.label} is neither a live table constraint nor a UNIQUE index`,
          });
        }
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function groupByMigration(findings: Finding[]): Map<string, Finding[]> {
  const grouped = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = grouped.get(f.migration);
    if (list) list.push(f);
    else grouped.set(f.migration, [f]);
  }
  return new Map([...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en')));
}

function printGroup(grouped: Map<string, Finding[]>, indent = '  '): void {
  for (const [migration, items] of grouped) {
    console.log(`${indent}${migration}  (${items.length} object(s))`);
    for (const f of items) {
      console.log(`${indent}  - ${f.objectType} ${f.name}`);
      console.log(`${indent}      ${f.detail}`);
      if (f.phantomLineage && f.phantomLineage.length > 0) {
        console.log(
          `${indent}      also declared by APPLIED migration(s): ${f.phantomLineage.join(', ')}`
        );
      }
    }
  }
}

interface Options {
  remote: boolean;
  dbPath: string;
  migrationsDir: string;
  verbose: boolean;
}

function parseArgs(argv: string[]): Options {
  let remote = false;
  let dbPath = DEFAULT_LOCAL_DB;
  let migrationsDir = DEFAULT_MIGRATIONS_DIR;
  let verbose = false;

  for (const arg of argv) {
    if (arg === '--remote') remote = true;
    else if (arg === '--verbose' || arg === '-v') verbose = true;
    else if (arg.startsWith('--db=')) dbPath = arg.slice('--db='.length);
    else if (arg.startsWith('--migrations=')) migrationsDir = arg.slice('--migrations='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: bun scripts/check-migration-integrity.ts ' +
          '[--remote] [--db=<path>] [--migrations=<dir>] [--verbose]'
      );
      process.exit(0);
    } else {
      console.error(`check-migration-integrity: unknown argument "${arg}"`);
      process.exit(1);
    }
  }
  return { remote, dbPath, migrationsDir, verbose };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  console.log('Migration Integrity Audit');
  console.log('=========================');

  const files = listMigrationFiles(options.migrationsDir);
  const { objects: expected, declaringMigrations } = buildExpectedSchema(files, options.migrationsDir);

  const counts: Record<ObjectType, number> = { table: 0, index: 0, trigger: 0, view: 0 };
  let uniqueConstraintCount = 0;
  for (const obj of expected.values()) {
    counts[obj.type]++;
    uniqueConstraintCount += obj.uniqueConstraints.length;
  }

  console.log(`Target:     ${options.remote ? `REMOTE production D1 (${D1_DATABASE_NAME})` : `local mirror (${options.dbPath})`}`);
  console.log(
    `Migrations: ${files.length} file(s) in ${options.migrationsDir}/, ` +
      `${declaringMigrations.length} declaring schema objects`
  );
  console.log(
    `Expected:   ${counts.table} table(s), ${counts.index} index(es), ${counts.view} view(s), ` +
      `${counts.trigger} trigger(s), ${uniqueConstraintCount} unique constraint(s)`
  );
  console.log('');

  if (options.verbose) {
    console.log('Expected objects after replaying all migrations:');
    for (const obj of [...expected.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      console.log(`  ${obj.type.padEnd(8)} ${obj.name}  (${obj.declaredBy})`);
      for (const uc of obj.uniqueConstraints) {
        console.log(`    unique   ${obj.name}.${uc.columns.join('+')}  (${uc.declaredBy})`);
      }
    }
    console.log('');
  }

  const actual = options.remote
    ? readRemoteDatabase()
    : await readLocalDatabase(options.dbPath);

  const findings = compare(expected, actual);
  const recorded = actual.recordedMigrations;

  // The bug signature: d1_migrations says applied, the objects are not there.
  const phantom = findings.filter(
    (f) => f.fatal && (recorded === null || recorded.has(f.migration))
  );
  const pending = findings.filter(
    (f) => f.fatal && recorded !== null && !recorded.has(f.migration)
  );
  const warnings = findings.filter((f) => !f.fatal);

  if (phantom.length > 0) {
    const grouped = groupByMigration(phantom);
    console.log('PHANTOM-APPLIED MIGRATIONS');
    console.log('-'.repeat(60));
    if (recorded === null) {
      console.log('The d1_migrations table is absent from this database, so applied-state');
      console.log('cannot be confirmed. Every missing object is reported here.');
    } else {
      console.log('These migrations are recorded in d1_migrations as APPLIED, but the');
      console.log('objects they declare do not exist in the database. The journal is');
      console.log('lying: the rows were inserted without the DDL ever running.');
    }
    console.log('');
    printGroup(grouped);
    console.log('');
  }

  const queuedRepairs = pending.filter((f) => f.phantomLineage && f.phantomLineage.length > 0);

  if (pending.length > 0) {
    console.log('PENDING MIGRATIONS (not recorded in d1_migrations)');
    console.log('-'.repeat(60));
    console.log('Expected but absent, and the migration has not been applied yet.');
    console.log('This is normal for un-deployed migrations, so it is not a failure.');
    if (queuedRepairs.length > 0) {
      console.log('');
      console.log(
        `NOTE: ${queuedRepairs.length} of these are PHANTOM-APPLIED objects with a repair`
      );
      console.log('migration already queued -- an earlier migration recorded as applied also');
      console.log('declared them (see the "also declared by" lines). The database is still');
      console.log('missing them until that repair migration is actually run.');
    }
    console.log('');
    printGroup(groupByMigration(pending));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('DEFINITION DRIFT (non-fatal)');
    console.log('-'.repeat(60));
    printGroup(groupByMigration(warnings));
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`Objects checked:            ${expected.size}`);
  console.log(`Phantom-applied objects:    ${phantom.length}`);
  console.log(`Pending-migration objects:  ${pending.length}`);
  console.log(`  of which queued repairs:  ${queuedRepairs.length}`);
  console.log(`Non-fatal drift:            ${warnings.length}`);

  if (phantom.length > 0) {
    const migrationCount = groupByMigration(phantom).size;
    console.log('');
    console.log(
      `FAIL: ${phantom.length} object(s) declared by ${migrationCount} applied migration(s) are missing.`
    );
    console.log('');
    console.log('What to do:');
    console.log('  1. Do NOT re-run `bun run db:migrate` blindly -- d1_migrations already');
    console.log('     records these files, so the runner will skip them.');
    console.log('  2. Extract the missing DDL and apply it as a NEW forward migration,');
    console.log('     or replay the individual statements against the target database.');
    console.log('  3. Re-run this audit until it reports 0 phantom-applied objects.');
    process.exit(1);
  }

  console.log('');
  console.log('OK: every object declared by an applied migration exists.');
}

main().catch((err: unknown) => {
  console.error('check-migration-integrity failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
