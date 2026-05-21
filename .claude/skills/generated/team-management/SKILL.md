---
name: team-management
description: "Skill for the Team-management area of Multi-Channel-Integration-System. 39 symbols across 19 files."
---

# Team-management

39 symbols | 19 files | Cohesion: 82%

## When to Use

- Working with code in `frontend/`
- Understanding how useTeamAssignment, useMemberEditForm, useMemberOperations work
- Modifying team-management-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/composables/team-management/useMemberOperations.ts` | useMemberOperations, closePasswordResetModal, resetPasswordResetForm, closeBulkEditModal, resetBulkEditForm |
| `frontend/src/composables/team-management/useMemberTeams.ts` | useMemberTeams, setStatus, addToTeam, removeFromTeam, setPrimaryTeam |
| `frontend/src/composables/team-management/useMemberEditForm.ts` | useMemberEditForm, rollbackToSnapshot, executeBackgroundSave, saveChanges |
| `frontend/src/composables/team-management/useTeamOperations.ts` | useTeamOperations, closeAddTeamModal, resetAddTeamForm, submitAddTeam |
| `frontend/src/composables/team-management/useBulkMemberEdit.ts` | useBulkMemberEdit, isMemberDirty, isMemberValid, saveAllChanges |
| `frontend/src/composables/team-management/useSelectMemberToTeam.ts` | useSelectMemberToTeam, closeModal, submitAddMembers |
| `frontend/src/composables/team-management/useTeamManagementController.ts` | initialize, refresh |
| `frontend/src/composables/conversation/useTeamAssignment.ts` | useTeamAssignment |
| `frontend/src/composables/team-management/useQRCodeDownloader.ts` | useQRCodeDownloader |
| `frontend/src/composables/team-management/useTeamForm.ts` | useTeamForm |

## Entry Points

Start here when exploring this area:

- **`useTeamAssignment`** (Function) — `frontend/src/composables/conversation/useTeamAssignment.ts:20`
- **`useMemberEditForm`** (Function) — `frontend/src/composables/team-management/useMemberEditForm.ts:168`
- **`useMemberOperations`** (Function) — `frontend/src/composables/team-management/useMemberOperations.ts:122`
- **`useMemberTeams`** (Function) — `frontend/src/composables/team-management/useMemberTeams.ts:53`
- **`useQRCodeDownloader`** (Function) — `frontend/src/composables/team-management/useQRCodeDownloader.ts:54`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `QRPreloadService` | Class | `frontend/src/services/qrPreloadService.ts` | 87 |
| `useTeamAssignment` | Function | `frontend/src/composables/conversation/useTeamAssignment.ts` | 20 |
| `useMemberEditForm` | Function | `frontend/src/composables/team-management/useMemberEditForm.ts` | 168 |
| `useMemberOperations` | Function | `frontend/src/composables/team-management/useMemberOperations.ts` | 122 |
| `useMemberTeams` | Function | `frontend/src/composables/team-management/useMemberTeams.ts` | 53 |
| `useQRCodeDownloader` | Function | `frontend/src/composables/team-management/useQRCodeDownloader.ts` | 54 |
| `useSelectMemberToTeam` | Function | `frontend/src/composables/team-management/useSelectMemberToTeam.ts` | 78 |
| `useTeamForm` | Function | `frontend/src/composables/team-management/useTeamForm.ts` | 59 |
| `useTeamOperations` | Function | `frontend/src/composables/team-management/useTeamOperations.ts` | 106 |
| `useConfirmDialog` | Function | `frontend/src/composables/useConfirmDialog.ts` | 314 |
| `useI18n` | Function | `frontend/src/composables/useI18n.ts` | 9 |
| `useSystemSettingsController` | Function | `frontend/src/composables/useSystemSettingsController.ts` | 30 |
| `useToast` | Function | `frontend/src/composables/useToast.ts` | 122 |
| `usePermissions` | Function | `frontend/src/services/permissionService.ts` | 311 |
| `useBulkMemberEdit` | Function | `frontend/src/composables/team-management/useBulkMemberEdit.ts` | 154 |
| `rollbackToSnapshot` | Function | `frontend/src/composables/team-management/useMemberEditForm.ts` | 529 |
| `executeBackgroundSave` | Function | `frontend/src/composables/team-management/useMemberEditForm.ts` | 569 |
| `saveChanges` | Function | `frontend/src/composables/team-management/useMemberEditForm.ts` | 734 |
| `useTeamStore` | Function | `frontend/src/stores/team.ts` | 19 |
| `setStatus` | Function | `frontend/src/composables/team-management/useMemberTeams.ts` | 64 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 2 calls |
| Conversation | 1 calls |
| Conversations | 1 calls |

## How to Explore

1. `gitnexus_context({name: "useTeamAssignment"})` — see callers and callees
2. `gitnexus_query({query: "team-management"})` — find related execution flows
3. Read key files listed above for implementation details
