// The single definition of "this customer message starts a wait" (migration 0072).
//
// A customer message normally starts (or keeps) a wait for a human reply. Two kinds of
// message are sign-offs and do NOT start one when the conversation already has a human
// agent reply before them:
//   - a sticker
//   - a text that, trimmed and lower-cased with trailing punctuation removed, is exactly
//     one of SIGN_OFF_PHRASES (thanks and nothing else)
// 好 / 好的 / OK / 收到 are deliberately NOT sign-offs: they can mean "yes, go ahead".
// A first contact (no earlier human reply) always counts, sticker or not.
//
// These SQL fragments are used by migration 0072 (triggers and backfill, generated from
// them and verified by tests), the nightly heal (awaiting-service.ts) and the tests.

/** Explicit thanks list. Lower-case; compared against LOWER(TRIM(content)) minus trailing punctuation. */
export const SIGN_OFF_PHRASES = [
  '謝謝', '謝謝你', '謝謝您', '感謝', '感謝您', '多謝', '3q', 'thx', 'thanks', 'thank you', '謝啦', '感恩'
] as const;

/** Characters that may follow a sign-off text (！!～~。.). */
export const SIGN_OFF_TRAILING_PUNCTUATION = '！!～~。.';

/** The accepted-human-reply predicate for a message alias (same definition as migration 0070). */
export function humanReplySql(alias: string): string {
  return `${alias}.sender_type = 'agent'
    AND ${alias}.deleted_at IS NULL
    AND COALESCE(${alias}.is_recalled, 0) = 0
    AND COALESCE(${alias}.is_sent, 1) = 1
    AND (${alias}.metadata IS NULL OR ${alias}.metadata NOT LIKE '%"broadcastId"%')`;
}

/** True when the customer message `alias` is, by itself, a sign-off (sticker or thanks text). */
export function signOffSql(alias: string): string {
  const list = SIGN_OFF_PHRASES.map(p => `'${p}'`).join(', ');
  return `(${alias}.message_type = 'sticker'
    OR (${alias}.message_type = 'text'
        AND TRIM(RTRIM(LOWER(TRIM(${alias}.content)), '${SIGN_OFF_TRAILING_PUNCTUATION}')) IN (${list})))`;
}

/**
 * True when the customer message `alias` counts toward a wait: everything except a sign-off
 * that comes after an accepted human reply in the same conversation.
 */
export function startsWaitSql(alias: string): string {
  return `NOT (${signOffSql(alias)}
    AND EXISTS (
      SELECT 1 FROM messages hr
      WHERE hr.conversation_id = ${alias}.conversation_id
        AND ${humanReplySql('hr')}
        AND hr.created_at < ${alias}.created_at
    ))`;
}

/** "No human agent ever replied" for the conversation row aliased `convAlias` (an id column reference). */
export function neverRepliedSql(convIdRef: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM messages nr
    WHERE nr.conversation_id = ${convIdRef}
      AND ${humanReplySql('nr')}
  )`;
}

/**
 * The wait marker for a conversation: the EARLIEST non-deleted customer message after the last accepted
 * human reply that is not a sign-off (see startsWaitSql). NULL when nothing is unanswered.
 * `convIdRef` is the SQL reference to the conversation id (a column or NEW.conversation_id).
 */
export function awaitingExpression(convIdRef: string): string {
  return `(
  SELECT MIN(cm.created_at)
  FROM messages cm
  WHERE cm.conversation_id = ${convIdRef}
    AND cm.sender_type = 'customer'
    AND cm.deleted_at IS NULL
    AND cm.created_at > COALESCE((
      SELECT MAX(am.created_at)
      FROM messages am
      WHERE am.conversation_id = ${convIdRef}
        AND ${humanReplySql('am')}
    ), '')
    AND ${startsWaitSql('cm')}
)`;
}
