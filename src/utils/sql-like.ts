// SQL LIKE helpers
// ----------------------------------------------------------------------------
// Drizzle's `like()` binds the pattern as a parameter (so no SQL injection),
// but SQL `%` and `_` inside the bound value retain their wildcard semantics.
// That means a user search for "50%" matches anything containing "50",
// not just the literal string "50%".
//
// To match the literal characters, we escape them with `\` and pair the
// emitted SQL with an `ESCAPE '\'` clause. Drizzle's `like()` does not emit
// the ESCAPE clause, so callers should use `likeEscaped()` (below) when they
// need literal matching of user-supplied strings.

import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

/**
 * Escape the SQL LIKE wildcard characters (`%`, `_`) and the escape
 * character itself (`\`) inside a user-supplied search fragment.
 *
 * The caller is still responsible for wrapping the result in `%...%`
 * (or whatever anchoring they want) and for emitting `ESCAPE '\'` in
 * the final SQL. Use `likeEscaped()` to do both at once.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

/**
 * Build a drizzle SQL fragment of the form:
 *   <column> LIKE <pattern> ESCAPE '\'
 *
 * `rawSearch` is the untrusted user input; it will be escaped and wrapped
 * with `%...%` on both sides for a contains-match. Use the lower-level
 * `escapeLikePattern()` if you need prefix/suffix-only matching.
 */
export function likeEscaped(column: SQLWrapper, rawSearch: string): SQL {
  const pattern = `%${escapeLikePattern(rawSearch)}%`;
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}
