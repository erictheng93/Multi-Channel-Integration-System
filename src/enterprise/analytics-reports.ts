// Analytics sub-module: custom report generation
//
// SECURITY NOTE: This module builds dynamic SQL SELECT / GROUP BY clauses from
// caller-supplied strings. ALL user-facing strings (metric names, group-by
// fields, tag names) MUST pass through the allowlist validators defined below
// before reaching Drizzle's SQL builder. Never feed untrusted input directly
// into `sql.raw()` or into `.as()` — those are escape hatches that cannot be
// made safe by any Drizzle version.
//
// Reference: CVE-2026-39356 (drizzle-orm SQL identifier injection, fixed in
// 0.45.2) — the version bump closes one hole, but allowlist validation is the
// defence-in-depth that matters here, because we still use `sql.raw()` for
// dynamic JSON path fragments that parameterisation cannot express.

import type { AnalyticsFilter } from '../types/enterprise';
import { createDbClient } from '../db/drizzle-factory';
import { sql, and, gte, lte, desc, count, avg, sum, type SQL } from 'drizzle-orm';
import type { SelectedFields } from 'drizzle-orm/sqlite-core';
import { metrics, conversations } from '../db/schema';

// ----------------------------------------------------------------------------
// Allowlists — the single source of truth for "what is a valid report field".
// Exported so callers (and tests) can enumerate them.
// ----------------------------------------------------------------------------

/** Metric names that map to fixed aggregation / column expressions. */
export const ALLOWED_METRIC_NAMES = [
  'count',
  'avg_value',
  'sum_value',
  'metric_name',
  'metric_value',
  'timestamp',
] as const;

/** Group-by fields — every entry MUST have a corresponding static SQL mapping. */
export const ALLOWED_GROUP_BY_FIELDS = [
  'team_id',
  'platform',
  'metric_name',
] as const;

/**
 * Tag names embedded in `tag_<name>` metrics must match this pattern.
 * Restricting to `[a-zA-Z0-9_]{1,64}` makes it safe to concatenate the name
 * into a SQLite `json_extract` path literal, which cannot be parameterised.
 */
const SAFE_TAG_NAME_REGEX = /^[a-zA-Z0-9_]{1,64}$/;

export type AllowedMetricName = (typeof ALLOWED_METRIC_NAMES)[number] | `tag_${string}`;
export type AllowedGroupByField = (typeof ALLOWED_GROUP_BY_FIELDS)[number];

/** Thrown when a report config contains a field outside the allowlist. */
export class InvalidReportConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReportConfigError';
  }
}

// ----------------------------------------------------------------------------
// Validators
// ----------------------------------------------------------------------------

/**
 * Returns the tag name for a `tag_<name>` metric if the input is a valid
 * tag metric, or `null` otherwise. Throws on malformed tag names so that
 * obviously-attacker-controlled input fails loudly instead of being silently
 * dropped.
 */
function parseTagMetric(name: string): string | null {
  if (!name.startsWith('tag_')) return null;
  const tagName = name.substring(4);
  if (!SAFE_TAG_NAME_REGEX.test(tagName)) {
    throw new InvalidReportConfigError(
      `Invalid tag metric name: ${JSON.stringify(name)} ` +
        `(tag portion must match ${SAFE_TAG_NAME_REGEX})`
    );
  }
  return tagName;
}

/** Validates a single metric name. Throws `InvalidReportConfigError` on failure. */
export function validateMetricName(name: string): void {
  if ((ALLOWED_METRIC_NAMES as readonly string[]).includes(name)) return;
  // parseTagMetric throws on bad tag_* input and returns non-null on good input
  if (parseTagMetric(name) !== null) return;
  throw new InvalidReportConfigError(`Unknown metric name: ${JSON.stringify(name)}`);
}

/** Validates a single group-by field. Throws `InvalidReportConfigError` on failure. */
export function validateGroupByField(field: string): void {
  if ((ALLOWED_GROUP_BY_FIELDS as readonly string[]).includes(field)) return;
  throw new InvalidReportConfigError(`Unknown group-by field: ${JSON.stringify(field)}`);
}

/** Validates an entire report config's dynamic fields. Call before building SQL. */
export function validateReportConfig(metricNames: string[], groupBy: string[]): void {
  for (const name of metricNames) validateMetricName(name);
  for (const field of groupBy) validateGroupByField(field);
}

// ----------------------------------------------------------------------------
// SQL builders — all assume inputs have already been validated
// ----------------------------------------------------------------------------

/**
 * Build a SQLite `json_extract(tags, '$.<tagName>')` expression.
 *
 * SQLite's json_extract requires the path as a literal (it cannot be bound
 * as a parameter), so we construct the path string via concatenation. This
 * is ONLY safe because `tagName` has already been validated against
 * `SAFE_TAG_NAME_REGEX`, which forbids quotes and JSON path metacharacters.
 */
function tagJsonPath(tagName: string): SQL {
  if (!SAFE_TAG_NAME_REGEX.test(tagName)) {
    // Defence-in-depth: refuse to build SQL for an unvalidated name even if
    // a future caller forgets to call validateMetricName first.
    throw new InvalidReportConfigError(`Refusing to build JSON path for unsafe tag name: ${tagName}`);
  }
  // Safe because `tagName` has already been validated against
  // SAFE_TAG_NAME_REGEX (= /^[a-zA-Z0-9_]{1,64}$/), which forbids every
  // character that could break out of a single-quoted SQLite literal.
  // SQLite json_extract paths MUST be literals (they cannot be bound as
  // parameters), so this is the only legitimate sql.raw() in the repo.
  // eslint-disable-next-line no-unsafe-sql-raw
  return sql`json_extract(${metrics.tags}, ${sql.raw(`'$.${tagName}'`)})`;
}

// Build Drizzle select fields dynamically from metric names and group-by fields.
// Inputs MUST have passed `validateReportConfig` first; this function also
// validates as a belt-and-braces measure so direct callers can't bypass checks.
export function buildDrizzleSelectFields(metricNames: string[], groupBy: string[]) {
  validateReportConfig(metricNames, groupBy);

  const selectFields: SelectedFields = {};

  // Add metric fields
  for (const metricName of metricNames) {
    switch (metricName) {
      case 'count':
        selectFields.count = count().as('count');
        break;
      case 'avg_value':
        selectFields.avgValue = avg(metrics.metricValue).as('avg_value');
        break;
      case 'sum_value':
        selectFields.sumValue = sum(metrics.metricValue).as('sum_value');
        break;
      case 'metric_name':
        selectFields.metricName = metrics.metricName;
        break;
      case 'metric_value':
        selectFields.metricValue = metrics.metricValue;
        break;
      case 'timestamp':
        selectFields.timestamp = metrics.timestamp;
        break;
      default: {
        // Must be a `tag_<name>` metric (validated above). Re-derive the tag
        // name here instead of trusting an outer variable.
        const tagName = parseTagMetric(metricName);
        if (tagName === null) {
          // Unreachable: validateMetricName would have thrown already.
          throw new InvalidReportConfigError(`Unknown metric name reached builder: ${metricName}`);
        }
        selectFields[metricName] = tagJsonPath(tagName).as(metricName);
        break;
      }
    }
  }

  // Add group-by projection columns. Every case here is a fixed static mapping
  // — there is no dynamic branch, so no `sql.raw()` with user input.
  for (const groupField of groupBy) {
    switch (groupField) {
      case 'team_id':
        selectFields.teamId = sql`json_extract(${metrics.tags}, '$.team_id')`.as('team_id');
        break;
      case 'platform':
        selectFields.platform = sql`json_extract(${metrics.tags}, '$.platform')`.as('platform');
        break;
      case 'metric_name':
        selectFields.metricName = metrics.metricName;
        break;
      // No default: validateGroupByField has already rejected anything else.
    }
  }

  // If nothing was projected, fall back to a default column set so the query
  // still produces rows.
  if (Object.keys(selectFields).length === 0) {
    return {
      metricName: metrics.metricName,
      metricValue: metrics.metricValue,
      timestamp: metrics.timestamp,
      tags: metrics.tags,
    };
  }

  return selectFields;
}

/**
 * Build the expressions used in the SQL GROUP BY clause. Inputs MUST have
 * passed validation. Every branch here is a static mapping — no `sql.raw()`.
 */
export function buildGroupByExpressions(groupBy: string[]): SQL[] {
  for (const field of groupBy) validateGroupByField(field);

  return groupBy.map((field) => {
    switch (field) {
      case 'team_id':
        return sql`json_extract(${metrics.tags}, '$.team_id')`;
      case 'platform':
        return sql`json_extract(${metrics.tags}, '$.platform')`;
      case 'metric_name':
        return sql`${metrics.metricName}`;
      default:
        // Unreachable after validateGroupByField, but narrows the type.
        throw new InvalidReportConfigError(`Unknown group-by field reached builder: ${field}`);
    }
  });
}

// Generate a custom report based on configuration
export async function generateCustomReport(
  db: D1Database,
  reportConfig: {
    metrics: string[];
    filters: AnalyticsFilter;
    groupBy: string[];
    period: { start: number; end: number };
    format: 'json' | 'csv';
  }
): Promise<Record<string, unknown>[] | string> {
  const { metrics: metricNames, filters, groupBy, period, format } = reportConfig;

  // Validate once, up front — fail loudly on bad input before touching the DB.
  validateReportConfig(metricNames, groupBy);

  const drizzle = createDbClient(db);

  // Build dynamic select clause using Drizzle ORM
  const selectFields = buildDrizzleSelectFields(metricNames, groupBy);

  // Build all filter conditions
  const whereConditions = [
    gte(metrics.timestamp, period.start),
    lte(metrics.timestamp, period.end),
  ];

  // Add additional filters dynamically. These values are always bound as
  // parameters by Drizzle's tagged template, so they are safe without extra
  // validation.
  if (filters.teamId !== undefined) {
    whereConditions.push(sql`json_extract(${metrics.tags}, '$.team_id') = ${filters.teamId}`);
  }

  if (filters.platform !== undefined) {
    whereConditions.push(sql`json_extract(${metrics.tags}, '$.platform') = ${filters.platform}`);
  }

  // Build the complete query conditionally to avoid TypeScript issues
  let result;

  if (groupBy.length > 0) {
    const groupByFields = buildGroupByExpressions(groupBy);

    result = await drizzle
      .select(selectFields)
      .from(metrics)
      .leftJoin(conversations, sql`json_extract(${metrics.tags}, '$.conversation_id') = ${conversations.id}`)
      .where(and(...whereConditions))
      .groupBy(...groupByFields)
      .orderBy(desc(metrics.timestamp));
  } else {
    result = await drizzle
      .select(selectFields)
      .from(metrics)
      .leftJoin(conversations, sql`json_extract(${metrics.tags}, '$.conversation_id') = ${conversations.id}`)
      .where(and(...whereConditions))
      .orderBy(desc(metrics.timestamp));
  }

  if (format === 'csv') {
    return convertToCSV(result);
  }

  return result;
}

// ----------------------------------------------------------------------------
// CSV serialisation
// ----------------------------------------------------------------------------

/**
 * Characters that cause Excel / Google Sheets / LibreOffice Calc to interpret
 * a cell as a formula when the first character of the cell matches one of
 * these. OWASP Formula Injection (CWE-1236) is mitigated by prefixing any
 * such cell with a single apostrophe, which the spreadsheet engines treat
 * as "literal text" without rendering the apostrophe itself.
 *
 * Reference: https://owasp.org/www-community/attacks/CSV_Injection
 */
const CSV_FORMULA_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * Encode a single value as a CSV field. Handles three threat classes:
 *
 * 1. Formula injection — string values whose first character would be parsed
 *    as the start of a formula are prefixed with `'`.
 * 2. Quote breakage — embedded double quotes are doubled per RFC 4180.
 * 3. Delimiter / newline breakage — strings are always wrapped in double
 *    quotes so that commas, newlines, and carriage returns in the value do
 *    not corrupt the row structure.
 *
 * Numbers and booleans are emitted without quoting because they cannot
 * themselves trigger formula interpretation (Excel parses `-10` as the
 * number -10, not as the formula `=-10`). `null` / `undefined` become the
 * empty string.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';

  // Non-string scalars pass through untouched — they cannot carry injection.
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  let str = typeof value === 'string' ? value : String(value);

  // OWASP defence: neutralise a leading formula-trigger character.
  if (str.length > 0 && CSV_FORMULA_PREFIXES.has(str[0] as string)) {
    str = `'${str}`;
  }

  // RFC 4180: double embedded quotes, then wrap the whole field in quotes.
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Convert an array of records to CSV format. Header row uses the keys of
 * the first record as-is (they come from trusted code paths — validated
 * metric names and schema column names — and would complicate round-tripping
 * if they were quoted). Data values are escaped via `escapeCsvField`.
 */
export function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0] || {});
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((header) => escapeCsvField(row[header])).join(',')
    ),
  ];

  return csvRows.join('\n');
}
