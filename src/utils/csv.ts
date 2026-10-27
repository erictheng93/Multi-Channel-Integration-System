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
