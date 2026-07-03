# Auto-Reply Conversation Timestamp Follow-Up

**Status:** Open
**Date:** 2026-05-26
**Scope:** `src/modules/auto-reply/services/auto-reply-engine.ts`

## Problem

`saveAutoReplyMessage()` inserts a system message into `messages`, but it does not update
`conversations.lastMessageAt` or `conversations.updatedAt`.

Other message creation paths update these fields after saving a message, for example:

- `src/modules/integrations/services/webhook-conversation-service.ts`
- `src/modules/conversations/services/message-service.ts`
- `src/modules/integrations/handlers/line-follow-handler.ts` for the default welcome fallback

This can make auto-reply messages exist in the message history while the conversation list ordering
or last active state remains stale.

## Proposed Fix

Update `saveAutoReplyMessage()` so the saved message timestamp is also written to the conversation:

- Insert the auto-reply message using a single `timestamp = nowISO()`.
- Update `conversations.lastMessageAt` and `conversations.updatedAt` to the same timestamp.
- Keep the current non-fatal error behavior owned by the caller.

## Acceptance Criteria

- Auto-reply keyword/fallback success updates `conversations.lastMessageAt`.
- Auto-reply welcome success updates `conversations.lastMessageAt`.
- Unit tests cover the message insert and conversation update using the same timestamp.
- Existing auto-reply tests continue to pass.

## Notes

Historical graph impact for `saveAutoReplyMessage` on 2026-05-26 was LOW risk:

- Direct callers: `evaluate`, `evaluateWelcome`
- Affected flows: `processLineMessage`, `processLineFollowEvent`
