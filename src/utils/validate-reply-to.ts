// Centralized replyToMessageId validation utility
// Prevents orphan message references by verifying existence before insert
//
// WHY THIS EXISTS:
// replyToMessageId is a self-referencing FK on the messages table, but D1 (SQLite)
// does not reliably enforce foreign keys (PRAGMA foreign_keys = OFF by default).
// The schema declares this as "app-level FK" (schema.ts:129-130). This utility
// is the single enforcement point for all code paths that insert messages.

import { eq, and } from 'drizzle-orm';
import { messages } from '../db/schema';
import { createDbClient } from '../db/drizzle-factory';

export interface ReplyToValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a replyToMessageId references an existing message.
 *
 * Checks:
 * 1. UUID format (basic sanity)
 * 2. Message exists in the database
 * 3. (Optional) Message belongs to the same conversation
 *
 * @param db - D1Database instance
 * @param replyToMessageId - The message ID to validate (null/undefined = skip)
 * @param conversationId - If provided, also enforces same-conversation constraint
 * @returns ReplyToValidationResult with valid flag and optional error message
 */
export async function validateReplyToMessageId(
  db: D1Database,
  replyToMessageId: string | null | undefined,
  conversationId?: string
): Promise<ReplyToValidationResult> {
  // Null/undefined means no reply — always valid
  if (!replyToMessageId) {
    return { valid: true };
  }

  // Basic UUID format check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // Also accept msg_ prefixed IDs (used by some code paths)
  const msgPrefixRegex = /^msg_\d+_[a-z0-9]+$/;

  if (!uuidRegex.test(replyToMessageId) && !msgPrefixRegex.test(replyToMessageId)) {
    return {
      valid: false,
      error: 'replyToMessageId must be a valid message ID format'
    };
  }

  // Existence check — the critical validation
  try {
    const drizzleDb = createDbClient(db);

    const conditions = [eq(messages.id, replyToMessageId)];

    // If conversationId provided, enforce same-conversation constraint
    if (conversationId) {
      conditions.push(eq(messages.conversationId, conversationId));
    }

    const referencedMessage = await drizzleDb
      .select({ id: messages.id })
      .from(messages)
      .where(and(...conditions))
      .get();

    if (!referencedMessage) {
      const scopeMsg = conversationId
        ? ' in this conversation'
        : '';
      return {
        valid: false,
        error: `Referenced message (replyToMessageId: ${replyToMessageId}) does not exist${scopeMsg}`
      };
    }

    return { valid: true };
  } catch (error) {
    // On DB error, fail open with a warning log rather than blocking the insert.
    // This prevents a validation-layer DB issue from breaking all message sends.
    console.warn(
      `[validateReplyToMessageId] DB check failed for ${replyToMessageId}, allowing insert:`,
      error
    );
    return { valid: true };
  }
}
