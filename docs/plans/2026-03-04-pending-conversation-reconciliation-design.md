# Pending Conversation API Reconciliation

**Date:** 2026-03-04
**Status:** Approved

## Problem

When a LINE user scans a QR code, two conversations appear in the UI:
1. A `pending-xxx` conversation (LIFF pre-notification via WebSocket)
2. A real conversation with DB ID (created by follow webhook)

The WebSocket-based reconciliation (Layer 1) is unreliable — when the follow webhook broadcast doesn't reach the frontend, both conversations coexist until the next background sync (up to 30 seconds).

## Solution

Add a **proactive follow-up poll** (Layer 2) that triggers `pollConversations()` 5 seconds after a pending conversation is added. Since `updateConversationsIncrementally` replaces the entire conversation list with API data, pending conversations (which don't exist in the DB) are naturally removed.

## 4-Layer Defense

1. **WebSocket Reconciliation** (existing, 0-100ms) — best-effort instant reconcile
2. **Proactive Follow-up Poll** (NEW, 5s) — guaranteed API-based reconcile
3. **Background Sync** (existing, 30s) — regular interval sync
4. **Stale TTL Cleanup** (existing, 60s) — last resort removal

## Changes

### 1. `frontend/src/stores/conversations/backgroundSync.ts`
- Add `schedulePendingReconciliation()` — debounced 5s delayed poll
- Export for use by realtimeHandler

### 2. `frontend/src/stores/conversations/realtimeHandler.ts`
- After adding a pending conversation, call `schedulePendingReconciliation()`

## Risk

Extremely low — only frontend changes, no backend/DB changes. The poll is debounced to avoid API spam.
