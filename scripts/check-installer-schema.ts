/**
 * CI guard: the Web Installer's bundled migrations must produce the schema the
 * embedded worker needs.
 *
 * The installer cannot replay migrations/ (the early files assume tables that only
 * a drizzle push created), so web-installer/backend/src/migrations/bundled-migrations.ts
 * is a separately maintained baseline plus catch-up deltas. This script replays that
 * file into an in-memory SQLite and diffs it against docs/architecture/SCHEMA.md,
 * which is generated from production sqlite_master.
 *
 * Fails when the installer schema lacks a table, a column, an index, or a unique
 * key that production has. Objects that exist only in the installer (legacy columns,
 * legacy indexes) are reported but do not fail: the worker no longer reads them.
 *
 * Fix: add a new numbered entry to BUNDLED_MIGRATIONS (never edit an applied one).
 * Usage: bun scripts/check-installer-schema.ts
 */
import { Database } from 'bun:sqlite';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BUNDLED_MIGRATIONS } from '../web-installer/backend/src/migrations/bundled-migrations';

const root = join(import.meta.dir, '..');
const doc = readFileSync(join(root, 'docs/architecture/SCHEMA.md'), 'utf8');
const sections = doc
  .slice(doc.indexOf('## 資料表定義'), doc.indexOf('## 視圖'))
  .split(/\n### `/)
  .slice(1);

const ref = new Database(':memory:');
const refIndexes: { table: string; name: string; unique: boolean; partial: boolean; predicate: string; cols: string }[] = [];

// Quoting, case, spacing and outer parentheses are cosmetic; the rest of a WHERE clause is the contract.
const normalizePredicate = (sql: string): string => {
  let p = sql.replace(/[`"]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  while (p.startsWith('(') && p.endsWith(')')) p = p.slice(1, -1).trim();
  return p;
};
for (const section of sections) {
  const sql = section.match(/```sql\n([\s\S]*?)\n```/)?.[1];
  if (!sql) throw new Error(`No CREATE TABLE block for section ${section.slice(0, 40)}`);
  ref.exec(sql);
  for (const line of section.split('\n')) {
    const m = line.match(/^- `([^`]+)`((?: \*\([a-zA-Z]+\)\*)*) — \(([^)]*)\)(?: WHERE (.*))?$/);
    if (m) {
      const cols = m[3].replace(/[`\s]/g, '');
      refIndexes.push({ table: section.split('`')[0], name: m[1], unique: m[2].includes('UNIQUE'), partial: m[2].includes('partial'), predicate: normalizePredicate(m[4] ?? ''), cols });
    }
  }
}

const inst = new Database(':memory:');
const problems: string[] = [];
for (const migration of BUNDLED_MIGRATIONS) {
  // Same splitter as MigrationRunner.splitSQLStatements
  const statements = migration.sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.replace(/--[^\n]*/g, '').trim().length > 0);
  for (const statement of statements) {
    try {
      inst.exec(statement);
    } catch (e) {
      problems.push(`migration ${migration.version} statement failed: ${(e as Error).message}`);
    }
  }
}

const tableNames = (d: Database): string[] =>
  (d.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map((r) => r.name);
const columns = (d: Database, t: string): string[] =>
  (d.query(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((r) => r.name);
const uniqueSets = (d: Database, t: string): string[] =>
  (d.query(`PRAGMA index_list(${t})`).all() as { name: string; unique: number }[])
    .filter((i) => i.unique)
    .map((i) => (d.query(`PRAGMA index_info(${i.name})`).all() as { name: string }[]).map((c) => c.name).join(','));

// Partial-ness and the WHERE predicate (SCHEMA.md records both) are part of a unique key's identity.
const uniqueIndexKeys = (d: Database, t: string): string[] =>
  (d.query(`PRAGMA index_list(${t})`).all() as { name: string; unique: number; partial: number }[])
    .filter((i) => i.unique)
    .map((i) => {
      const cols = (d.query(`PRAGMA index_info(${i.name})`).all() as { name: string }[]).map((c) => c.name).join(',');
      if (!i.partial) return cols;
      const sql = (d.query('SELECT sql FROM sqlite_master WHERE name = ?').get(i.name) as { sql: string }).sql;
      return `${cols} [partial WHERE ${normalizePredicate(/\bWHERE\b([\s\S]*)$/i.exec(sql)?.[1] ?? '')}]`;
    });

const instTables = tableNames(inst);
for (const table of tableNames(ref)) {
  if (!instTables.includes(table)) {
    problems.push(`missing table: ${table}`);
    continue;
  }
  const have = columns(inst, table);
  for (const col of columns(ref, table)) if (!have.includes(col)) problems.push(`missing column: ${table}.${col}`);
  const haveUnique = uniqueSets(inst, table);
  for (const u of uniqueSets(ref, table)) if (!haveUnique.includes(u)) problems.push(`missing unique key: ${table}(${u})`);
}

const instIndexNames = (inst.query("SELECT name FROM sqlite_master WHERE type='index'").all() as { name: string }[]).map((r) => r.name);
for (const idx of refIndexes) {
  // The reference DB is built from CREATE TABLE only, so named UNIQUE indexes never reach the
  // table-level check above. A unique index is satisfied by any unique key on the same
  // columns and the same partial-ness, however declared (a same-named non-unique index does not count);
  // other indexes match by name.
  const key = idx.cols + (idx.partial ? ` [partial WHERE ${idx.predicate}]` : '');
  if (idx.unique ? instTables.includes(idx.table) && uniqueIndexKeys(inst, idx.table).includes(key) : instIndexNames.includes(idx.name)) continue;
  problems.push(idx.unique ? `missing unique key: ${idx.table}(${key}) [${idx.name}]` : `missing index: ${idx.name}`);
}

if (problems.length > 0) {
  console.error('Installer bundled migrations drift from docs/architecture/SCHEMA.md:\n  ' + problems.join('\n  '));
  console.error('\nAdd a new entry to BUNDLED_MIGRATIONS in web-installer/backend/src/migrations/bundled-migrations.ts.');
  process.exit(1);
}
console.log(`Installer schema matches SCHEMA.md (${instTables.length} tables, ${BUNDLED_MIGRATIONS.length} bundled migrations).`);
