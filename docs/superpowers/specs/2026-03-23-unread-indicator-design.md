# Unread Message Indicator Design

**Date:** 2026-03-23
**Status:** Approved
**Scope:** ConversationDesktopTable.vue + ConversationMobileCards.vue + ConversationCard.vue

## Problem

The desktop table view (`ConversationDesktopTable.vue`) has no visual indicator for unread messages. The card view (`ConversationCard.vue`) uses a red count badge that doesn't match LINE OA's familiar green dot pattern. Users need a consistent, instantly recognizable unread indicator across both views.

## Design Decision

**Option A: Green Dot + Bold Text (LINE Style)** — chosen for familiarity with LINE OA's native indicator and alignment with the Apple-Native Soft Minimalism design system.

## Existing Infrastructure

The data model already supports unread tracking:

- `Conversation.unreadCount: number` in `shared/types/entities.ts`
- `hasUnreadMessages` computed in `ConversationCard.vue` (checks `unreadCount > 0`)
- API layer maps `unreadCount` from backend response in `frontend/src/api/conversations.ts`
- Pinia store tracks `unreadConversations` computed and `stats.unreadCount`

No backend or data model changes are needed — this is a frontend-only visual change.

## Design Specification

### Shared Visual Tokens

| Element | Unread | Read |
|---------|--------|------|
| Green dot | 9-12px circle, `#34C759`, `box-shadow: 0 0 6px rgba(52,199,89,0.4)` | Hidden |
| Customer name weight | `font-weight: 700` | `font-weight: 500` (table) / `600` (card, unchanged) |
| Last message weight | `font-weight: 600`, color `#1C1C1E` | `font-weight: 400`, color `#555` (table) / `rgba(60,60,67,0.6)` (card) |

### Desktop Table View (`ConversationDesktopTable.vue`)

**Changes to template:**
- Add green dot (9px) before customer name in the customer cell
- Conditionally apply `has-unread` class to `<tr>`

**Changes to styles:**
- `.conversation-row.has-unread` — background: `#F8FAFF`
- `.conversation-row.has-unread .customer-name` — font-weight: `700`, color: `#1C1C1E`
- `.conversation-row.has-unread .last-message` — font-weight: `600`, color: `#1C1C1E`
- `.unread-dot` — 9px green circle with glow shadow
- Invisible spacer (same width) for read rows to maintain alignment

**Accessibility:**
- Add `<span class="sr-only">` with unread text (e.g., "未讀") next to the green dot for screen readers
- Keep existing `Transition` animation pattern (scale-pop, 250ms) for dot appearance

### Mobile Cards View (`ConversationMobileCards.vue`)

Apply the same green dot + bold text pattern as the desktop table to maintain consistency in the team conversations view on mobile.

### Card View (`ConversationCard.vue`)

**Changes to template:**
- Replace `<div class="unread-badge">{{ formattedUnreadCount }}</div>` with green dot element

**Changes to styles:**
- `.unread-badge` — change from red count badge to 12px green circle with glow
- `.has-unread` background — change from red-tinted to green-tinted: `linear-gradient(135deg, rgba(52,199,89,0.06) 0%, var(--apple-bg) 50%)`

**Removed:** `formattedUnreadCount` display (count badge replaced by dot)

## Files to Modify

1. `frontend/src/components/conversations/ConversationDesktopTable.vue` — add unread dot + conditional styling
2. `frontend/src/components/conversations/ConversationMobileCards.vue` — add unread dot + conditional styling (mobile counterpart)
3. `frontend/src/components/conversation/ConversationCard.vue` — replace red badge with green dot, update background tint
4. `frontend/tests/unit/components/conversation/ConversationCard.test.ts` — update tests for badge-to-dot change
5. `frontend/tests/unit/components/conversations/ConversationDesktopTable.test.ts` — add tests for new unread dot

## Out of Scope

- Backend unread count calculation changes
- Unread filter button in conversation filters
- Mark-as-read API integration
- WebSocket real-time unread count updates (already wired)
