// Unit tests for src/utils/sql-like.ts
//
// These tests lock in two behaviours:
//   1. escapeLikePattern() neutralises every SQL LIKE meta-character
//      (%, _, and the backslash escape character itself).
//   2. likeEscaped() emits a drizzle SQL fragment with the ESCAPE '\'
//      clause so the escaped pattern is interpreted literally by SQLite.

import { describe, test, expect } from 'vitest';
import { escapeLikePattern, likeEscaped } from '@/utils/sql-like';

// Minimal column stub — drizzle's sql template only needs something that
// stringifies into the SQL chunks array. We don't need a real Drizzle
// Column here; the fragment's `.queryChunks` is what we inspect.
const fakeColumn = { getSQL: () => ({ queryChunks: ['"tags"."name"'] }) } as never;

describe('escapeLikePattern', () => {
  test('returns the input unchanged when it contains no wildcards', () => {
    expect(escapeLikePattern('plain search')).toBe('plain search');
  });

  test('escapes percent signs', () => {
    expect(escapeLikePattern('50%')).toBe('50\\%');
    expect(escapeLikePattern('%vip%')).toBe('\\%vip\\%');
  });

  test('escapes underscores', () => {
    expect(escapeLikePattern('foo_bar')).toBe('foo\\_bar');
  });

  test('escapes the backslash itself so the pattern round-trips', () => {
    // If we did not escape `\`, the caller could not pass a literal
    // backslash through the ESCAPE clause.
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
  });

  test('escapes every meta-character in a mixed input', () => {
    expect(escapeLikePattern('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
  });

  test('handles empty string without crashing', () => {
    expect(escapeLikePattern('')).toBe('');
  });
});

describe('likeEscaped', () => {
  test('produces an SQL fragment that includes ESCAPE \'\\\'', () => {
    const frag = likeEscaped(fakeColumn, 'vip');
    // drizzle's SQL fragments expose the literal chunks via toQuery(); we
    // inspect the raw SQL string built by the template tag.
    const text = JSON.stringify(frag);
    expect(text).toContain("ESCAPE '\\\\'");
  });

  test('wraps the (escaped) search with % for contains matching', () => {
    const frag = likeEscaped(fakeColumn, '50%');
    // The bound parameter should be `%50\%%` — the outer `%` are the
    // wildcards, and the inner `\%` is the escaped literal percent.
    const params = (frag as unknown as { queryChunks: unknown[] }).queryChunks
      .map((c) => JSON.stringify(c))
      .join('');
    expect(params).toContain('%50\\\\%%');
  });
});
