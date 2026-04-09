/**
 * Unit tests for src/enterprise/analytics-reports.ts
 *
 * Focus: SQL injection hardening via allowlist validation.
 *
 * These tests exercise the pure builder / validator functions without
 * touching a database — the vulnerability lived in the SQL construction
 * layer, so that is where the test coverage belongs.
 *
 * Reference: CVE-2026-39356 (drizzle-orm) + internal defence-in-depth
 * against `sql.raw()` misuse. See the module header comment for background.
 */

import { describe, it, expect } from 'vitest';
import {
  ALLOWED_GROUP_BY_FIELDS,
  ALLOWED_METRIC_NAMES,
  InvalidReportConfigError,
  buildDrizzleSelectFields,
  buildGroupByExpressions,
  convertToCSV,
  escapeCsvField,
  validateGroupByField,
  validateMetricName,
  validateReportConfig,
} from '@backend/enterprise/analytics-reports';

// ----------------------------------------------------------------------------
// validateMetricName
// ----------------------------------------------------------------------------

describe('validateMetricName', () => {
  it.each(ALLOWED_METRIC_NAMES)('accepts allowlisted metric %s', (name) => {
    expect(() => validateMetricName(name)).not.toThrow();
  });

  it.each(['tag_platform', 'tag_team_id', 'tag_ABC_123', 'tag_a'])(
    'accepts well-formed tag metric %s',
    (name) => {
      expect(() => validateMetricName(name)).not.toThrow();
    }
  );

  it('rejects unknown metric names', () => {
    expect(() => validateMetricName('drop_table')).toThrowError(InvalidReportConfigError);
    expect(() => validateMetricName('')).toThrowError(InvalidReportConfigError);
    expect(() => validateMetricName('COUNT')).toThrowError(InvalidReportConfigError); // case-sensitive
  });

  it('rejects tag metrics with unsafe characters', () => {
    const injectionAttempts = [
      "tag_id'; DROP TABLE users; --",
      'tag_id"',
      'tag_id`',
      'tag_id;',
      'tag_id OR 1=1',
      'tag_',           // empty tag name
      'tag_x.y',        // path traversal via JSON path separator
      'tag_x y',        // whitespace
      'tag_' + 'a'.repeat(65), // exceeds length cap
    ];
    for (const attempt of injectionAttempts) {
      expect(() => validateMetricName(attempt)).toThrowError(InvalidReportConfigError);
    }
  });
});

// ----------------------------------------------------------------------------
// validateGroupByField
// ----------------------------------------------------------------------------

describe('validateGroupByField', () => {
  it.each(ALLOWED_GROUP_BY_FIELDS)('accepts allowlisted field %s', (field) => {
    expect(() => validateGroupByField(field)).not.toThrow();
  });

  it('rejects unknown fields', () => {
    expect(() => validateGroupByField('user_id')).toThrowError(InvalidReportConfigError);
    expect(() => validateGroupByField('')).toThrowError(InvalidReportConfigError);
  });

  it('rejects SQL injection payloads', () => {
    const injectionAttempts = [
      "id; DROP TABLE users; --",
      '1=1',
      'metrics.id UNION SELECT',
      '(SELECT 1)',
      'team_id, (SELECT password FROM users)',
    ];
    for (const attempt of injectionAttempts) {
      expect(() => validateGroupByField(attempt)).toThrowError(InvalidReportConfigError);
    }
  });
});

// ----------------------------------------------------------------------------
// validateReportConfig (aggregate)
// ----------------------------------------------------------------------------

describe('validateReportConfig', () => {
  it('accepts fully valid config', () => {
    expect(() =>
      validateReportConfig(['count', 'tag_source'], ['team_id', 'platform'])
    ).not.toThrow();
  });

  it('rejects if any metric is invalid', () => {
    expect(() =>
      validateReportConfig(['count', 'bogus'], ['team_id'])
    ).toThrowError(InvalidReportConfigError);
  });

  it('rejects if any group-by field is invalid', () => {
    expect(() =>
      validateReportConfig(['count'], ['team_id', 'bogus'])
    ).toThrowError(InvalidReportConfigError);
  });

  it('accepts empty arrays', () => {
    expect(() => validateReportConfig([], [])).not.toThrow();
  });
});

// ----------------------------------------------------------------------------
// buildDrizzleSelectFields
// ----------------------------------------------------------------------------

describe('buildDrizzleSelectFields', () => {
  it('builds select map for standard metrics', () => {
    const fields = buildDrizzleSelectFields(
      ['count', 'avg_value', 'sum_value', 'metric_name', 'metric_value', 'timestamp'],
      []
    );
    expect(Object.keys(fields).sort()).toEqual(
      ['avgValue', 'count', 'metricName', 'metricValue', 'sumValue', 'timestamp'].sort()
    );
  });

  it('builds select entries for tag_* metrics', () => {
    const fields = buildDrizzleSelectFields(['tag_platform', 'tag_team_id'], []);
    expect(Object.keys(fields)).toContain('tag_platform');
    expect(Object.keys(fields)).toContain('tag_team_id');
  });

  it('adds group-by projection columns when groupBy has entries', () => {
    const fields = buildDrizzleSelectFields([], ['team_id', 'platform']);
    expect(Object.keys(fields)).toContain('teamId');
    expect(Object.keys(fields)).toContain('platform');
  });

  it('falls back to default columns when nothing is selected', () => {
    const fields = buildDrizzleSelectFields([], []);
    expect(Object.keys(fields).sort()).toEqual(
      ['metricName', 'metricValue', 'tags', 'timestamp'].sort()
    );
  });

  it('rejects injection payload in metric name', () => {
    expect(() =>
      buildDrizzleSelectFields(["count'; DROP TABLE metrics; --"], [])
    ).toThrowError(InvalidReportConfigError);
  });

  it('rejects injection payload in group-by field', () => {
    expect(() =>
      buildDrizzleSelectFields(['count'], ['team_id; DROP TABLE metrics'])
    ).toThrowError(InvalidReportConfigError);
  });

  it('rejects malformed tag metric name', () => {
    expect(() =>
      buildDrizzleSelectFields(['tag_foo\'--'], [])
    ).toThrowError(InvalidReportConfigError);
  });
});

// ----------------------------------------------------------------------------
// buildGroupByExpressions
// ----------------------------------------------------------------------------

describe('buildGroupByExpressions', () => {
  it('builds expressions for allowlisted fields', () => {
    const exprs = buildGroupByExpressions(['team_id', 'platform', 'metric_name']);
    expect(exprs).toHaveLength(3);
    // Each entry should be a Drizzle SQL expression object, not a raw string.
    for (const e of exprs) {
      expect(typeof e).toBe('object');
      expect(e).not.toBeNull();
    }
  });

  it('returns empty array for empty input', () => {
    expect(buildGroupByExpressions([])).toEqual([]);
  });

  it('rejects unknown field', () => {
    expect(() => buildGroupByExpressions(['unknown'])).toThrowError(InvalidReportConfigError);
  });

  it('rejects injection payload', () => {
    expect(() =>
      buildGroupByExpressions(['team_id) UNION SELECT * FROM users --'])
    ).toThrowError(InvalidReportConfigError);
  });
});

// ----------------------------------------------------------------------------
// escapeCsvField — low-level RFC 4180 + OWASP CSV injection defence
// ----------------------------------------------------------------------------

describe('escapeCsvField', () => {
  it('returns empty string for null and undefined', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('stringifies numbers and booleans without quoting', () => {
    expect(escapeCsvField(0)).toBe('0');
    expect(escapeCsvField(42)).toBe('42');
    expect(escapeCsvField(-10)).toBe('-10'); // safe: number, not a formula
    expect(escapeCsvField(3.14)).toBe('3.14');
    expect(escapeCsvField(true)).toBe('true');
    expect(escapeCsvField(false)).toBe('false');
  });

  it('stringifies bigints without quoting', () => {
    // Use string constructor — passing the numeric literal through `number`
    // first would lose precision above Number.MAX_SAFE_INTEGER.
    expect(escapeCsvField(BigInt('9007199254740993'))).toBe('9007199254740993');
  });

  it('wraps plain string values in double quotes', () => {
    expect(escapeCsvField('alice')).toBe('"alice"');
    expect(escapeCsvField('')).toBe('""');
  });

  it('doubles embedded double quotes per RFC 4180', () => {
    expect(escapeCsvField('she said "hi"')).toBe('"she said ""hi"""');
    expect(escapeCsvField('"')).toBe('""""');
  });

  it('preserves commas inside quoted fields', () => {
    expect(escapeCsvField('a,b,c')).toBe('"a,b,c"');
  });

  it('preserves newlines and carriage returns inside quoted fields', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    // Leading 'c' is not a formula trigger, so no apostrophe is prepended.
    // The embedded \r survives untouched inside the quoted field.
    expect(escapeCsvField('cr\rlf')).toBe('"cr\rlf"');
  });

  it('prefixes formula-trigger leading characters with an apostrophe', () => {
    // OWASP CSV injection defence. Each of these would be evaluated as a
    // formula by Excel/Sheets if written to the cell unchanged.
    const payloads: Array<[string, string]> = [
      ['=SUM(A1:A10)', `"'=SUM(A1:A10)"`],
      ['=HYPERLINK("http://evil/","x")', `"'=HYPERLINK(""http://evil/"",""x"")"`],
      ['+1+1', `"'+1+1"`],
      ['-10-10', `"'-10-10"`],
      ['@cmd', `"'@cmd"`],
      ['\tTAB-led', `"'\tTAB-led"`],
      ['\rCR-led', `"'\rCR-led"`],
    ];
    for (const [input, expected] of payloads) {
      expect(escapeCsvField(input)).toBe(expected);
    }
  });

  it('does NOT prefix strings that only contain a leading space or letter', () => {
    expect(escapeCsvField(' leading space')).toBe('" leading space"');
    expect(escapeCsvField('alice')).toBe('"alice"');
  });

  it('coerces non-primitive objects to strings safely', () => {
    // Object.toString -> "[object Object]" — has no formula chars but does
    // have bracket/space chars that don't need special handling.
    expect(escapeCsvField({ a: 1 })).toBe('"[object Object]"');
  });
});

// ----------------------------------------------------------------------------
// convertToCSV (row-assembly + header handling)
// ----------------------------------------------------------------------------

describe('convertToCSV', () => {
  it('returns empty string for empty array', () => {
    expect(convertToCSV([])).toBe('');
  });

  it('emits header row and data rows', () => {
    const csv = convertToCSV([
      { name: 'alice', count: 10 },
      { name: 'bob', count: 20 },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('name,count');
    expect(lines[1]).toBe('"alice",10');
    expect(lines[2]).toBe('"bob",20');
  });

  it('renders null/undefined values as empty strings', () => {
    const csv = convertToCSV([{ a: null, b: undefined, c: 0 }]);
    // null/undefined -> '', 0 stays as '0'
    expect(csv.split('\n')[1]).toBe(',,0');
  });

  it('neutralises formula-injection payloads in data rows', () => {
    const csv = convertToCSV([
      { user: '=cmd|"/c calc"!A1', action: 'click' },
    ]);
    const lines = csv.split('\n');
    // Header passes through unchanged (trusted object keys).
    expect(lines[0]).toBe('user,action');
    // Payload is wrapped, quotes doubled, and prefixed with apostrophe.
    expect(lines[1]).toBe(`"'=cmd|""/c calc""!A1","click"`);
  });

  it('keeps delimiters inside quoted string fields', () => {
    const csv = convertToCSV([{ description: 'hello, world', tally: 3 }]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('"hello, world",3');
  });
});
