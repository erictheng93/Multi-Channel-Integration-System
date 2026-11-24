// Detect SQLite / D1 UNIQUE constraint violations.
//
// D1 reports them as "D1_ERROR: UNIQUE constraint failed: <table>.<column>: SQLITE_CONSTRAINT"
// (SQLite itself: "UNIQUE constraint failed: <table>.<column>"), for UNIQUE columns and UNIQUE
// indexes alike. Drizzle (0.45+) does not rethrow that error: it wraps it in a DrizzleQueryError
// whose own message is "Failed query: ..." and keeps the driver error as `cause`. So a check on
// the top-level message alone never matches a Drizzle query; walk the cause chain instead.

const UNIQUE_FAILED = 'UNIQUE constraint failed';
const MAX_CAUSE_DEPTH = 5;

/**
 * True when `error` (or an error in its `cause` chain) is a UNIQUE constraint violation.
 * With `target` ("table.column", e.g. "conversations.customer_id"), only a violation naming
 * that column matches, so an unrelated unique key (such as the primary key) is not mistaken
 * for it.
 */
export function isUniqueConstraintError(error: unknown, target?: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current instanceof Error; depth++) {
    const { message } = current;
    const at = message.indexOf(UNIQUE_FAILED);
    if (at !== -1) {
      if (!target) return true;
      // The failing columns follow the marker, e.g. ": conversations.customer_id: SQLITE_CONSTRAINT".
      const columns = message.slice(at + UNIQUE_FAILED.length).split(/[:,]/).map(part => part.trim());
      if (columns.includes(target)) return true;
    }
    current = current.cause;
  }
  return false;
}
