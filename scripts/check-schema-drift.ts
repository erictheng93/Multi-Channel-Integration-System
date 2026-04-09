/**
 * Schema Drift Checker
 *
 * Compares Drizzle ORM schema definitions against the actual production D1 database.
 * Detects columns defined in the schema but missing from D1 — these cause runtime
 * INSERT failures (the exact class of bug that broke message saving for 3 days).
 *
 * Usage:
 *   bun scripts/check-schema-drift.ts
 *
 * Exit codes:
 *   0 = no critical drift (safe to deploy)
 *   1 = critical drift found (columns in schema but not in D1)
 *
 * Integrated into: package.json "predeploy" script
 */

import * as schema from '../src/db/schema';
import { getTableName, getTableColumns } from 'drizzle-orm';

// Collect all sqliteTable exports from schema by trying getTableName on each export.
// Bug history: this loop used to destructure `[, value]` (discarding the key) but then
// pushed `[key, value]` — undefined `key` threw ReferenceError which was swallowed by
// the catch, leaving `tables` empty and the checker always reporting "Tables checked: 0".
const tables: Array<[string, unknown]> = [];
for (const [key, value] of Object.entries(schema)) {
  if (value && typeof value === 'object') {
    try {
      getTableName(value as any);
      tables.push([key, value]);
    } catch {
      // Not a table object, skip
    }
  }
}

interface ColumnMismatch {
  table: string;
  column: string;
  direction: 'schema-only' | 'd1-only';
  risk: 'CRITICAL' | 'LOW';
}

function getD1Columns(tableName: string): string[] {
  try {
    const result = Bun.spawnSync(
      ['npx', 'wrangler', 'd1', 'execute', 'mcis-db', '--remote', '--json',
       '--command', `SELECT name FROM pragma_table_info('${tableName}')`],
      { timeout: 30_000, stderr: 'pipe', stdout: 'pipe' }
    );
    const output = result.stdout.toString();
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed) && parsed[0]?.results) {
      return parsed[0].results.map((r: { name: string }) => r.name);
    }
    return [];
  } catch {
    return [];
  }
}

function getSchemaColumns(tableObj: unknown): string[] {
  try {
    const columns = getTableColumns(tableObj as any);
    return Object.values(columns).map((col: any) => col.name as string);
  } catch {
    return [];
  }
}

function main() {
  console.log('Schema Drift Checker');
  console.log('====================');
  console.log('Comparing Drizzle schema against production D1...\n');

  const mismatches: ColumnMismatch[] = [];
  let tablesChecked = 0;

  for (const [, tableObj] of tables) {
    const tableName = getTableName(tableObj as any);
    const schemaColumns = getSchemaColumns(tableObj);
    if (schemaColumns.length === 0) continue;

    process.stdout.write(`  Checking ${tableName}...`);
    const d1Columns = getD1Columns(tableName);

    if (d1Columns.length === 0) {
      console.log(' SKIPPED (not found or query failed)');
      continue;
    }

    tablesChecked++;

    // CRITICAL: columns in schema but NOT in D1 (will cause INSERT failures)
    const schemaOnly = schemaColumns.filter(col => !d1Columns.includes(col));
    for (const col of schemaOnly) {
      mismatches.push({ table: tableName, column: col, direction: 'schema-only', risk: 'CRITICAL' });
    }

    // LOW: columns in D1 but NOT in schema (orphaned, harmless)
    const d1Only = d1Columns.filter(col => !schemaColumns.includes(col));
    for (const col of d1Only) {
      mismatches.push({ table: tableName, column: col, direction: 'd1-only', risk: 'LOW' });
    }

    const critCount = schemaOnly.length;
    const lowCount = d1Only.length;

    if (critCount > 0) {
      console.log(` CRITICAL (${critCount} missing from D1)`);
    } else if (lowCount > 0) {
      console.log(` OK (${lowCount} orphaned in D1)`);
    } else {
      console.log(' OK');
    }
  }

  // Report
  const critical = mismatches.filter(m => m.risk === 'CRITICAL');
  const low = mismatches.filter(m => m.risk === 'LOW');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Tables checked: ${tablesChecked}`);
  console.log(`Critical mismatches: ${critical.length}`);
  console.log(`Low-risk orphans: ${low.length}`);

  if (critical.length > 0) {
    console.log(`\nCRITICAL: Columns in Drizzle schema but MISSING from D1:`);
    console.log('These will cause runtime INSERT/SELECT failures!\n');
    for (const m of critical) {
      console.log(`  ${m.table}.${m.column}`);
    }
    console.log(`\nFix: Run 'bun run db:migrate' or manually ALTER TABLE to add missing columns.`);
    console.log('DEPLOY BLOCKED.\n');
    process.exit(1);
  }

  if (low.length > 0) {
    console.log(`\nLOW: Orphaned columns in D1 (not in schema, harmless):`);
    for (const m of low) {
      console.log(`  ${m.table}.${m.column}`);
    }
  }

  console.log(`\nNo critical schema drift detected. Safe to deploy.\n`);
  process.exit(0);
}

main();
