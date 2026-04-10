# Duplicate Member Detection Modal

**Date:** 2026-04-10
**Status:** Approved

## Problem

When adding a system member, if an agent with the same email already exists (active or soft-deleted), the user gets a generic 409 error toast with no actionable context. For soft-deleted members, there is no way to reactivate them through the UI.

## Solution

Proactive email check on blur with a dedicated `DuplicateMemberModal` that adapts to two states:

- **Active member:** Informational — shows who owns the email, directs user to edit from member list.
- **Soft-deleted member:** Actionable — shows old member info, offers to reactivate and pre-fill the form.

## Backend: Check Email Endpoint

### `GET /api/teams/members/check-email?email=xxx`

Auth: `jwtAuth + requireManagerOrAdmin()`

**Responses:**

```jsonc
// No conflict
{ "exists": false }

// Active member
{
  "exists": true,
  "status": "active",
  "member": {
    "id": "agent-xxx",
    "displayName": "...",
    "email": "...",
    "role": "agent",
    "teamName": "...",       // null if no team
    "lastLoginAt": "...",    // null if never logged in
    "createdAt": "..."
  }
}

// Soft-deleted member
{
  "exists": true,
  "status": "deleted",
  "member": {
    "id": "agent-xxx",
    "displayName": "...",
    "email": "...",
    "role": "agent",
    "teamName": "...",
    "lastLoginAt": "...",
    "deletedAt": "..."
  }
}
```

**Implementation:**
- Handler: `members.ts` — new `GET /check-email` route
- Service: `member-service.ts` — new `checkEmailExists(email)` method
- Single query joining `agents` LEFT JOIN `agent_teams` (isPrimary) LEFT JOIN `teams` to resolve `teamName`
- No `deletedAt` filter — intentionally returns both active and deleted matches

## Frontend: Component Architecture

```
AddMemberModal.vue
    |
    |  email @blur
    |  ---------->  useMemberOperations.ts
    |                   |
    |                   |  GET /check-email (debounced 300ms)
    |                   |
    |                   |  if exists:
    |                   v
    |              DuplicateMemberModal.vue
    |                   |
    |                   +-- active  -> info-only ("我知道了" button)
    |                   |
    |                   +-- deleted -> "重新啟用人員" button
    |                        |
    |                        v
    |              Pre-fill form with old data
    |              User reviews -> submits normally
```

## DuplicateMemberModal States

### State A: Active Member (info theme)

- Icon: info circle, blue tint background (`#DBEAFE`)
- Title: "此 Email 已有對應的系統人員"
- Member card: avatar initials + name, email, role, team, last login
- Body: "如需修改此人員資料，請至成員列表進行編輯。"
- Actions: single "我知道了" button (blue)
- On close: clear email field, refocus it

### State B: Soft-Deleted Member (warning theme)

- Icon: warning triangle, amber tint background (`#FEF3C7`)
- Title: "偵測到先前已刪除的系統人員使用此 Email"
- Member card: avatar initials + name, email, role, team, deleted date
- Body: "是否要重新啟用此人員？確認後將以目前表單資料覆蓋原有設定。"
- Actions: "取消" (secondary) + "重新啟用人員" (amber primary)
- On reactivate: pre-fill form (name, role, teamId), user adjusts and submits
- On cancel: clear email field, refocus it

### Visual Specs

- Base: reuses `Modal.vue` (size `sm`)
- Member card: `bg-[#F9FAFB]`, `rounded-xl`, shadow only (no hard border)
- Avatar: initials from displayName, pastel circle background
- Animation: same as ConfirmDialog (scale 0.9 -> 1, 250ms cubic-bezier)
- Typography: title `text-lg font-semibold #1C1C1E`, body `text-sm #8E8E93`

## Pre-fill Logic (Reactivation)

On "重新啟用人員" click:
1. Pre-fill `name` from `member.displayName`
2. Pre-fill `role` from `member.role`
3. Pre-fill `team` if old team still exists and is active, otherwise empty
4. Password always blank (required fresh for security)
5. Set hidden `reactivatingId` flag — backend `addMember()` already handles soft-delete reactivation via the existing fix

## Edge Cases

| Case | Handling |
|------|----------|
| Network error on check-email | Silently ignore; submit catches conflicts as fallback |
| Rapid blur/focus cycling | 300ms debounce prevents API spam |
| User pastes email | `@input` + `@blur` both trigger check |
| Old team was deleted | Pre-fill team as empty, user picks new one |
| Cancel previous in-flight | Abort controller cancels stale requests |

## Files

### Create
- `frontend/src/components/team/DuplicateMemberModal.vue`

### Modify
- `src/modules/teams/handlers/members.ts` — add `GET /check-email`
- `src/modules/teams/services/member-service.ts` — add `checkEmailExists()`
- `frontend/src/api/team.ts` — add `checkEmail()` API call
- `frontend/src/composables/team-management/useMemberOperations.ts` — email blur handler + pre-fill logic
- `frontend/src/components/team/AddMemberModal.vue` — emit blur on email field
