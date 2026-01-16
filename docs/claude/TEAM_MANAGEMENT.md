# Team Management System

This document details the enterprise team management system, including the dual role architecture, multi-team support, and dynamic sorting capabilities.

## Dual Role Architecture

The system uses a **dual role architecture** separating system-level and team-level permissions:

```
┌─────────────────────────────────────────────────────────────────┐
│                    DUAL ROLE ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   SYSTEM ROLES      │    │        TEAM ROLES               │ │
│  │   (Global Access)   │    │        (Team-Scoped)            │ │
│  ├─────────────────────┤    ├─────────────────────────────────┤ │
│  │                     │    │                                 │ │
│  │  ┌───────────────┐  │    │  ┌───────────────────────────┐  │ │
│  │  │    ADMIN      │  │    │  │      SUPERVISOR           │  │ │
│  │  │ (Full Access) │  │    │  │  • Update team settings   │  │ │
│  │  └───────┬───────┘  │    │  │  • Manage QR codes        │  │ │
│  │          │          │    │  │  • All Lead permissions   │  │ │
│  │          ▼          │    │  └─────────────┬─────────────┘  │ │
│  │  ┌───────────────┐  │    │                │                │ │
│  │  │    AGENT      │  │    │                ▼                │ │
│  │  │ (Team-Scoped) │  │    │  ┌───────────────────────────┐  │ │
│  │  └───────────────┘  │    │  │         LEAD              │  │ │
│  │                     │    │  │  • Add/remove members     │  │ │
│  └─────────────────────┘    │  │  • Update member roles    │  │ │
│                             │  │  • All Member permissions │  │ │
│                             │  └─────────────┬─────────────┘  │ │
│                             │                │                │ │
│                             │                ▼                │ │
│                             │  ┌───────────────────────────┐  │ │
│                             │  │        MEMBER             │  │ │
│                             │  │  • View team info         │  │ │
│                             │  │  • View member list       │  │ │
│                             │  │  • View team statistics   │  │ │
│                             │  └───────────────────────────┘  │ │
│                             │                                 │ │
│                             └─────────────────────────────────┘ │
│                                                                 │
│  Note: Admin users bypass all team role checks                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### System Roles (Global)

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access, bypasses all team role checks |
| **Agent** | Team-scoped access, requires team role for team operations |

### Team Roles (Per-Team)

| Role | Level | Permissions |
|------|-------|-------------|
| **Member** | 1 | View team, members, statistics |
| **Lead** | 2 | + Add/update/remove members |
| **Supervisor** | 3 | + Update team settings, manage QR codes |

## Multi-Team Support

Agents can belong to **multiple teams** with different roles in each team.

### JWT Caching (Phase 1)

JWT tokens now cache team permissions for 50% reduction in database queries:

```typescript
// JWT Payload Structure
{
  sub: "agent-uuid",
  role: "agent",
  teamId: "primary-team-uuid",
  // NEW: Multi-team cache
  allowedTeamIds: ["team-1", "team-2", "team-3"],
  teamRoles: {
    "team-1": "supervisor",
    "team-2": "lead",
    "team-3": "member"
  }
}
```

### Key Functions

```typescript
// Backend (src/utils/auth.ts)
hasTeamRole(userPayload, teamId, requiredRole)  // Check role hierarchy
canPerformTeamOperation(userPayload, teamId, operation)  // Check operation permission

// Frontend (stores/auth.ts)
authStore.canAccessTeam(teamId)      // Check team membership
authStore.getTeamRole(teamId)        // Get role in team
authStore.switchTeam(teamId)         // Switch active team context
```

### Team-Scoped WebSocket Broadcasts

Security enhancement ensuring agents only receive data from their teams:

```
┌─────────────────────────────────────────────────────────────────┐
│               TEAM-SCOPED WEBSOCKET BROADCAST                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Event: conversation_assigned                                   │
│                                                                 │
│  ┌─────────────────┐                                            │
│  │ MessageBroadcast│─────────┬──────────────────────────────────│
│  │   Durable Object│         │                                  │
│  └─────────────────┘         │                                  │
│                              ▼                                  │
│                    ┌─────────────────┐                          │
│                    │ /broadcast-to-  │                          │
│                    │ teams-and-admins│                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│            ┌────────────────┼────────────────┐                  │
│            ▼                ▼                ▼                  │
│     ┌────────────┐   ┌────────────┐   ┌────────────┐            │
│     │   Admin    │   │  Team A    │   │  Team B    │            │
│     │  Agents    │   │  Agents    │   │  Agents    │            │
│     │  (ALL)     │   │  (Team A)  │   │  (Team B)  │            │
│     └────────────┘   └────────────┘   └────────────┘            │
│          ✓               ✓                 ✗                    │
│     Receives all     Receives only    Does NOT receive         │
│       events        Team A events      Team A events            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Dynamic Sorting System

The team management UI features a flexible sorting system with both field-based and custom ordering.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SORTING SYSTEM ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    useListSorting.ts                        ││
│  │                  (Core Sorting Logic)                       ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │                                                             ││
│  │  useListSorting<T>()                useSortMode()           ││
│  │  ├─ sortField (reactive)            ├─ mode: 'auto'|'custom'││
│  │  ├─ sortOrder: 'asc'|'desc'         ├─ customOrder: string[]││
│  │  ├─ toggleOrder()                   ├─ applyCustomOrder()   ││
│  │  ├─ resetToDefault()                └─ saveCustomOrder()    ││
│  │  └─ sortItems(items[])                                      ││
│  │                                                             ││
│  │  Pre-configured Hooks:                                      ││
│  │  ├─ useMemberListSorting()                                  ││
│  │  └─ useTeamListSorting()                                    ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    UI Components                            ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │                                                             ││
│  │  SortDropdown.vue                                           ││
│  │  ├─ Field selection dropdown                                ││
│  │  ├─ Order toggle (↑/↓) within options                       ││
│  │  ├─ Reset button when in custom mode                        ││
│  │  └─ Visual indicator for custom mode                        ││
│  │                                                             ││
│  │  Drag-and-Drop (vue-draggable-plus)                         ││
│  │  ├─ Entire card is draggable                                ││
│  │  ├─ Auto-switches to custom mode on drag                    ││
│  │  └─ Persists order to localStorage                          ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    localStorage                             ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │                                                             ││
│  │  team-members-sort-field: "name"                            ││
│  │  team-members-sort-order: "asc"                             ││
│  │  team-members-sort-mode: "custom"                           ││
│  │  team-members-custom-order: ["id1","id2","id3"]             ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Sort Fields

**Member List:**
| Field | Label | Description |
|-------|-------|-------------|
| `name` | 名稱 | Agent display name |
| `email` | 電子郵件 | Agent email address |
| `roleInTeam` | 團隊角色 | Team role (member/lead/supervisor) |
| `joinedAt` | 加入時間 | Date joined team |

**Team List:**
| Field | Label | Description |
|-------|-------|-------------|
| `name` | 名稱 | Team name |
| `memberCount` | 成員數 | Number of team members |
| `createdAt` | 建立時間 | Team creation date |

### Usage Example

```vue
<script setup lang="ts">
import { useMemberListSorting, useSortMode } from '@/composables/useListSorting'

// Field-based sorting
const { sortField, sortOrder, toggleOrder, sortItems } = useMemberListSorting()

// Custom order mode
const { mode, customOrder, applyCustomOrder } = useSortMode('team-members')

// Apply sorting
const sortedMembers = computed(() => {
  if (mode.value === 'custom') {
    return applyCustomOrder(members.value)
  }
  return sortItems(members.value)
})
</script>

<template>
  <SortDropdown
    :fields="sortFields"
    :current-field="sortField"
    :current-order="sortOrder"
    :is-custom-mode="mode === 'custom'"
    @field-change="sortField = $event"
    @order-toggle="toggleOrder"
    @reset="mode = 'auto'"
  />

  <VueDraggable v-model="members" @end="saveCustomOrder">
    <MemberCard v-for="member in sortedMembers" :key="member.id" />
  </VueDraggable>
</template>
```

## Member Deletion

When deleting a team member, the system performs comprehensive foreign key cleanup:

```
┌─────────────────────────────────────────────────────────────────┐
│                 MEMBER DELETION CLEANUP                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DELETE member ──────────────────────────────────────────────── │
│         │                                                       │
│         ├─── notifications ──────────► DELETE all               │
│         │                                                       │
│         ├─── messageRecallLogs ──────► SET userId='deleted-user'│
│         │                                                       │
│         ├─── fileAttachments ────────► SET uploadedBy=null      │
│         │                                                       │
│         ├─── tags ───────────────────► SET createdBy='deleted'  │
│         │                                                       │
│         ├─── customerTags ───────────► SET assignedBy='deleted' │
│         │                                                       │
│         ├─── conversationTags ───────► SET assignedBy='deleted' │
│         │                                                       │
│         ├─── conversationTransfers ──► SET fields to null       │
│         │                                                       │
│         ├─── activities ─────────────► SET userId='deleted-user'│
│         │                                                       │
│         └─── agent_teams ────────────► DELETE (after all above) │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints with Team Role Protection

### Protected by `lead` role:
- `PUT /api/teams/:id/members/:agentId` - Update member role
- `DELETE /api/teams/:id/members/:agentId` - Remove member
- `POST /api/teams/:id/members` - Add member

### Protected by `supervisor` role:
- `PUT /api/teams/:id` - Update team settings
- `POST /api/teams/:id/qr-code` - Generate QR code
- `PUT /api/teams/:id/qr-codes/:qrCodeId/deactivate` - Deactivate QR code

## Key Files

| File | Purpose |
|------|---------|
| `src/middleware/auth.ts` | `requireTeamRole()`, `requireTeamPermission()` middleware |
| `src/utils/auth.ts` | `TEAM_ROLE_HIERARCHY`, `TEAM_PERMISSIONS`, helper functions |
| `src/modules/teams/services/member-service.ts` | Member CRUD with FK cleanup |
| `frontend/src/composables/useListSorting.ts` | Sorting composable with drag-and-drop |
| `frontend/src/components/ui/SortDropdown.vue` | Sort field/order selector UI |
| `frontend/src/components/team/MemberListSection.vue` | Member list with sorting |
| `frontend/src/components/team/TeamListSection.vue` | Team list with sorting |

---

**Navigation:** [Back to INDEX](INDEX.md) | [Back to CLAUDE.md](../../CLAUDE.md)
