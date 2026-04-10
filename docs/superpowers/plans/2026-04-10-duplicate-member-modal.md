# Duplicate Member Detection Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When adding a system member, proactively detect duplicate emails on blur and show a context-rich modal — blocking re-add for active members, offering reactivation for soft-deleted members.

**Architecture:** New `GET /check-email` backend endpoint returns member status (active/deleted/not-found). Frontend composable calls it on email blur (debounced 300ms). A dedicated `DuplicateMemberModal.vue` renders two states: info-only for active duplicates, reactivation prompt for soft-deleted. On reactivation, form pre-fills with old member data and submits through the existing `addMember` flow (backend already handles soft-delete reactivation).

**Tech Stack:** Hono handler, Drizzle ORM query, Vue 3 Composition API, existing Modal.vue base component

**Spec:** `docs/superpowers/specs/2026-04-10-duplicate-member-modal-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/modules/teams/handlers/members.ts` | Add `GET /check-email` route |
| Modify | `src/modules/teams/services/member-service.ts` | Add `checkEmailExists()` method |
| Modify | `src/modules/teams/types/member-types.ts` | Add `CheckEmailResponse` type |
| Modify | `frontend/src/api/team.ts` | Add `checkEmail()` API call |
| Create | `frontend/src/components/team/DuplicateMemberModal.vue` | Two-state duplicate detection modal |
| Modify | `frontend/src/components/team/AddMemberModal.vue` | Emit `email-blur` event |
| Modify | `frontend/src/composables/team-management/useMemberOperations.ts` | Email check logic, pre-fill, modal state |

---

### Task 1: Backend — `checkEmailExists()` service method

**Files:**
- Modify: `src/modules/teams/types/member-types.ts`
- Modify: `src/modules/teams/services/member-service.ts`

- [ ] **Step 1: Add `CheckEmailResponse` type**

In `src/modules/teams/types/member-types.ts`, add at the end of the file:

```typescript
export interface CheckEmailMemberInfo {
  id: string;
  displayName: string;
  email: string;
  role: 'admin' | 'agent';
  teamName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface CheckEmailResponse {
  exists: boolean;
  status?: 'active' | 'deleted';
  member?: CheckEmailMemberInfo;
}
```

- [ ] **Step 2: Add `checkEmailExists()` to `MemberService`**

In `src/modules/teams/services/member-service.ts`, add this method to the `MemberService` class (before the `memberExists` method around line 797):

```typescript
  /**
   * Check if an email is already in use by an active or soft-deleted agent.
   * Returns member info for UI display.
   */
  async checkEmailExists(email: string): Promise<CheckEmailResponse> {
    const [result] = await this.db
      .select({
        id: agents.id,
        displayName: agents.displayName,
        email: agents.email,
        role: agents.role,
        teamName: teams.name,
        lastLoginAt: agents.lastLoginAt,
        createdAt: agents.createdAt,
        deletedAt: agents.deletedAt
      })
      .from(agents)
      .leftJoin(agentTeams, and(eq(agentTeams.agentId, agents.id), eq(agentTeams.isPrimary, true)))
      .leftJoin(teams, eq(agentTeams.teamId, teams.id))
      .where(eq(agents.email, email))
      .limit(1);

    if (!result) {
      return { exists: false };
    }

    return {
      exists: true,
      status: result.deletedAt ? 'deleted' : 'active',
      member: {
        id: result.id,
        displayName: result.displayName,
        email: result.email,
        role: result.role as 'admin' | 'agent',
        teamName: result.teamName,
        lastLoginAt: result.lastLoginAt,
        createdAt: result.createdAt,
        deletedAt: result.deletedAt
      }
    };
  }
```

Note: `teams` and `agentTeams` are already imported in `member-service.ts`. `CheckEmailResponse` and `CheckEmailMemberInfo` must be imported from `../types/member-types`.

- [ ] **Step 3: Verify build passes**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/modules/teams/types/member-types.ts src/modules/teams/services/member-service.ts
git commit -m "feat(members): add checkEmailExists service method"
```

---

### Task 2: Backend — `GET /check-email` handler

**Files:**
- Modify: `src/modules/teams/handlers/members.ts`

- [ ] **Step 1: Add the route handler**

In `src/modules/teams/handlers/members.ts`, add this route **before** the existing `POST /` handler (around line 39, right after the `GET /` handler ends at line 110). This ensures it gets matched before any catch-all patterns.

```typescript
/**
 * Check if email already exists (active or soft-deleted)
 * GET /api/teams/members/check-email?email=xxx
 */
membersHandler.get('/check-email', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const email = c.req.query('email');

    if (!email) {
      return c.json({
        success: false,
        error: 'Email query parameter is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const memberService = new MemberService(c.env.DB);
    const result = await memberService.checkEmailExists(email);

    return c.json({
      success: true,
      data: result,
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});
```

The `nowISO` import is already available in the file (from `@/utils/timestamp`).

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/modules/teams/handlers/members.ts
git commit -m "feat(members): add GET /check-email endpoint"
```

---

### Task 3: Frontend — API client `checkEmail()`

**Files:**
- Modify: `frontend/src/api/team.ts`

- [ ] **Step 1: Add `checkEmail` method to `teamApi`**

In `frontend/src/api/team.ts`, add this method inside the `teamApi` object, right after the `getMembers` method (after line 14):

```typescript
  // Check if email already exists (for duplicate detection)
  checkEmail: async (email: string): Promise<ApiResponse<{
    exists: boolean;
    status?: 'active' | 'deleted';
    member?: {
      id: string;
      displayName: string;
      email: string;
      role: 'admin' | 'agent';
      teamName: string | null;
      lastLoginAt: string | null;
      createdAt: string;
      deletedAt: string | null;
    };
  }>> => {
    return apiClient.get(`/teams/members/check-email?email=${encodeURIComponent(email)}`)
  },
```

- [ ] **Step 2: Verify frontend build**

Run from `frontend/`: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/team.ts
git commit -m "feat(members): add checkEmail API client method"
```

---

### Task 4: Frontend — `DuplicateMemberModal.vue`

**Files:**
- Create: `frontend/src/components/team/DuplicateMemberModal.vue`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/team/DuplicateMemberModal.vue`:

```vue
<template>
  <Modal
    :show="visible"
    :title="modalTitle"
    size="sm"
    :close-on-overlay="true"
    @close="handleClose"
  >
    <!-- Icon -->
    <div class="duplicate-icon-wrapper" :class="iconThemeClass">
      <component :is="iconComponent" />
    </div>

    <!-- Member Info Card -->
    <div v-if="member" class="member-card">
      <div class="member-avatar" :style="{ background: avatarColor }">
        {{ avatarInitials }}
      </div>
      <div class="member-info">
        <div class="member-name">{{ member.displayName }}</div>
        <div class="member-email">{{ member.email }}</div>
        <div class="member-meta">
          <span>{{ roleLabel }}</span>
          <span v-if="member.teamName" class="meta-separator">{{ member.teamName }}</span>
        </div>
        <div class="member-date">
          {{ dateLabel }}: {{ formattedDate }}
        </div>
      </div>
    </div>

    <!-- Description -->
    <p class="duplicate-description">
      {{ description }}
    </p>

    <!-- Footer Actions -->
    <template #footer>
      <template v-if="status === 'active'">
        <button
          type="button"
          class="btn btn-primary btn-info-theme"
          @click="handleClose"
        >
          我知道了
        </button>
      </template>
      <template v-else>
        <button
          type="button"
          class="btn btn-secondary"
          @click="handleClose"
        >
          取消
        </button>
        <button
          type="button"
          class="btn btn-primary btn-warning-theme"
          @click="handleReactivate"
        >
          重新啟用人員
        </button>
      </template>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Modal from '@/components/ui/Modal.vue'

export interface DuplicateMemberInfo {
  id: string
  displayName: string
  email: string
  role: 'admin' | 'agent'
  teamName: string | null
  lastLoginAt: string | null
  createdAt: string
  deletedAt: string | null
}

interface Props {
  visible: boolean
  status: 'active' | 'deleted'
  member: DuplicateMemberInfo | null
}

interface Emits {
  (_e: 'close'): void
  (_e: 'reactivate', _member: DuplicateMemberInfo): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// --- Computed ---

const modalTitle = computed(() =>
  props.status === 'active'
    ? '此 Email 已有對應的系統人員'
    : '偵測到先前已刪除的系統人員'
)

const description = computed(() =>
  props.status === 'active'
    ? '如需修改此人員資料，請至成員列表進行編輯。'
    : '是否要重新啟用此人員？確認後將以目前表單資料覆蓋原有設定。'
)

const iconThemeClass = computed(() =>
  props.status === 'active' ? 'icon-info' : 'icon-warning'
)

const roleLabel = computed(() =>
  props.member?.role === 'admin' ? '管理員' : '客服人員'
)

const dateLabel = computed(() =>
  props.status === 'active' ? '最後登入' : '刪除時間'
)

const formattedDate = computed(() => {
  if (!props.member) return ''
  const raw = props.status === 'active'
    ? props.member.lastLoginAt
    : props.member.deletedAt
  if (!raw) return props.status === 'active' ? '從未登入' : '未知'
  return new Date(raw).toLocaleDateString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  })
})

const avatarInitials = computed(() => {
  if (!props.member?.displayName) return '?'
  return props.member.displayName.slice(0, 1).toUpperCase()
})

const avatarColor = computed(() => {
  if (!props.member?.displayName) return '#E5E7EB'
  const charCode = props.member.displayName.charCodeAt(0)
  const colors = [
    '#DBEAFE', '#DCF5E7', '#FEF3C7', '#FCE7F3',
    '#EDE9FE', '#FFEDD5', '#E0F2FE', '#F3E8FF'
  ]
  return colors[charCode % colors.length]
})

// Icons (inline SVG components matching ConfirmDialog pattern)
const InfoIcon = {
  template: `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M12 16v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `
}

const WarningIcon = {
  template: `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" fill="none"/>
      <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `
}

const iconComponent = computed(() =>
  props.status === 'active' ? InfoIcon : WarningIcon
)

// --- Methods ---

function handleClose() {
  emit('close')
}

function handleReactivate() {
  if (props.member) {
    emit('reactivate', props.member)
  }
}
</script>

<style scoped>
.duplicate-icon-wrapper {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-info {
  background: #DBEAFE;
  color: #2563EB;
}

.icon-warning {
  background: #FEF3C7;
  color: #D97706;
}

.member-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #F9FAFB;
  border-radius: 12px;
  margin-bottom: 16px;
}

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
  color: #374151;
  flex-shrink: 0;
}

.member-info {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.member-name {
  font-weight: 600;
  font-size: 0.9375rem;
  color: #1C1C1E;
  line-height: 1.3;
}

.member-email {
  font-size: 0.8125rem;
  color: #8E8E93;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-meta {
  font-size: 0.8125rem;
  color: #6B7280;
  line-height: 1.4;
  margin-top: 2px;
}

.meta-separator::before {
  content: ' \00B7 ';
}

.member-date {
  font-size: 0.75rem;
  color: #8E8E93;
  margin-top: 2px;
}

.duplicate-description {
  font-size: 0.875rem;
  color: #8E8E93;
  line-height: 1.6;
  margin: 0;
  text-align: center;
}

/* Buttons */
.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-secondary {
  background: #F3F4F6;
  color: #374151;
}

.btn-secondary:hover {
  background: #E5E7EB;
}

.btn-primary {
  color: white;
}

.btn-info-theme {
  background: #2563EB;
  width: 100%;
}

.btn-info-theme:hover {
  background: #1D4ED8;
}

.btn-warning-theme {
  background: #D97706;
}

.btn-warning-theme:hover {
  background: #B45309;
}
</style>
```

- [ ] **Step 2: Verify frontend build**

Run from `frontend/`: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/team/DuplicateMemberModal.vue
git commit -m "feat(members): add DuplicateMemberModal component"
```

---

### Task 5: Frontend — Wire up email blur check in composable and AddMemberModal

**Files:**
- Modify: `frontend/src/composables/team-management/useMemberOperations.ts`
- Modify: `frontend/src/components/team/AddMemberModal.vue`

- [ ] **Step 1: Add email check state and logic to `useMemberOperations.ts`**

At the top of the file, add the `teamApi` import and the `DuplicateMemberInfo` type:

```typescript
import { teamApi } from '@/api/team'
import type { DuplicateMemberInfo } from '@/components/team/DuplicateMemberModal.vue'
```

Add these new fields to the `UseMemberOperationsReturn` interface (inside the `// Add Member Modal` section, after `submitAddMember`):

```typescript
  // Duplicate Detection
  duplicateModalVisible: Ref<boolean>
  duplicateStatus: Ref<'active' | 'deleted'>
  duplicateMember: Ref<DuplicateMemberInfo | null>
  emailCheckLoading: Ref<boolean>
  checkEmailOnBlur: () => Promise<void>
  closeDuplicateModal: () => void
  handleReactivate: (_member: DuplicateMemberInfo) => void
```

Inside the `useMemberOperations()` function, after the `toggleAddPasswordVisibility` function and before `submitAddMember`, add the duplicate detection block:

```typescript
  // ==================== Duplicate Email Detection ====================

  const duplicateModalVisible = ref(false)
  const duplicateStatus = ref<'active' | 'deleted'>('active')
  const duplicateMember = ref<DuplicateMemberInfo | null>(null)
  const emailCheckLoading = ref(false)
  let emailCheckTimer: ReturnType<typeof setTimeout> | null = null
  let emailCheckAbort: AbortController | null = null

  /**
   * Check if email exists on blur (debounced 300ms).
   * Opens DuplicateMemberModal if a match is found.
   */
  async function checkEmailOnBlur() {
    const email = addMemberForm.email.trim()

    // Clear previous timer
    if (emailCheckTimer) {
      clearTimeout(emailCheckTimer)
      emailCheckTimer = null
    }

    // Cancel in-flight request
    if (emailCheckAbort) {
      emailCheckAbort.abort()
      emailCheckAbort = null
    }

    // Skip if empty or invalid format
    if (!email || !email.includes('@')) {
      return
    }

    emailCheckLoading.value = true

    emailCheckTimer = setTimeout(async () => {
      try {
        emailCheckAbort = new AbortController()
        const response = await teamApi.checkEmail(email)

        if (response.success && response.data?.exists && response.data.member) {
          duplicateStatus.value = response.data.status as 'active' | 'deleted'
          duplicateMember.value = response.data.member as DuplicateMemberInfo
          duplicateModalVisible.value = true
        }
      } catch {
        // Silently ignore — submit will catch conflicts as fallback
      } finally {
        emailCheckLoading.value = false
      }
    }, 300)
  }

  /**
   * Close the duplicate member modal.
   * For active duplicates, clear the email field so user picks a different one.
   */
  function closeDuplicateModal() {
    const wasActive = duplicateStatus.value === 'active'
    duplicateModalVisible.value = false
    duplicateMember.value = null

    if (wasActive) {
      addMemberForm.email = ''
    }
  }

  /**
   * Handle reactivation: pre-fill form with old member data.
   */
  function handleReactivate(member: DuplicateMemberInfo) {
    addMemberForm.name = member.displayName
    addMemberForm.role = member.role

    // Pre-fill team if it exists in active teams
    const teamStore = useTeamStore()
    const { teams: teamList } = storeToRefs(teamStore)
    const matchingTeam = teamList.value.find(
      (t) => t.name === member.teamName && t.isActive
    )
    addMemberForm.group = matchingTeam ? String(matchingTeam.id) : ''

    // Password always blank — required fresh
    addMemberForm.password = ''

    duplicateModalVisible.value = false
    duplicateMember.value = null
  }
```

Add the new fields to the return statement (in the `// Add Member Modal` section):

```typescript
    // Duplicate Detection
    duplicateModalVisible,
    duplicateStatus,
    duplicateMember,
    emailCheckLoading,
    checkEmailOnBlur,
    closeDuplicateModal,
    handleReactivate,
```

- [ ] **Step 2: Add `@blur` event to email input in `AddMemberModal.vue`**

In `frontend/src/components/team/AddMemberModal.vue`, add a new prop and emit:

In the `Props` interface, add:
```typescript
  /** Loading state for email duplicate check */
  emailCheckLoading?: boolean
```

In the `Emits` interface, add:
```typescript
  (_e: 'email-blur'): void
```

Replace the email input element (the `<input id="add-member-email" ...>` around line 30) with:

```html
        <div class="email-input-wrapper">
          <input
            id="add-member-email"
            v-model="form.email"
            type="email"
            placeholder="請輸入 Email"
            required
            @blur="emit('email-blur')"
          >
          <span v-if="emailCheckLoading" class="email-check-spinner" />
        </div>
```

Add the corresponding style for the spinner at the end of `<style scoped>`:

```css
/* Email check spinner */
.email-input-wrapper {
  position: relative;
}

.email-input-wrapper input {
  width: 100%;
  padding: 0.75rem;
  padding-right: 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.email-check-spinner {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  border: 2px solid #E5E7EB;
  border-top-color: #6366F1;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
```

Remove the duplicate style for `.form-group input[type="email"]` width/padding/border/border-radius/font-size/transition from the existing CSS block (lines 223-233), since the `.email-input-wrapper input` rule now covers the email field. The other input types (`text`, `password`) keep their existing styles.

- [ ] **Step 3: Wire DuplicateMemberModal into `TeamManagement.vue`**

The parent view is `frontend/src/views/TeamManagement.vue`. It uses a controller pattern: `const controller = useTeamManagementController()`, where `controller.member` is the `UseMemberOperationsReturn`. The new fields are automatically available via `controller.member.*` since we added them to the interface and return statement in Step 1.

1. Add import at top of `<script setup>` (around line 160, alongside existing component imports):
```typescript
import DuplicateMemberModal from '@/components/team/DuplicateMemberModal.vue'
```

2. Add `DuplicateMemberModal` to the template, right after the existing `<AddMemberModal>` block (after line 87):
```html
      <!-- Duplicate Member Detection Modal -->
      <DuplicateMemberModal
        :visible="controller.member.duplicateModalVisible.value"
        :status="controller.member.duplicateStatus.value"
        :member="controller.member.duplicateMember.value"
        @close="controller.member.closeDuplicateModal"
        @reactivate="controller.member.handleReactivate"
      />
```

3. Update the existing `<AddMemberModal>` to pass new props/events (add to the existing block at line 78-87):
```html
      <AddMemberModal
        :visible="controller.member.addMemberModal.value"
        :form="controller.member.addMemberForm"
        :loading="controller.member.addMemberLoading.value"
        :show-password="controller.member.showAddPassword.value"
        :email-check-loading="controller.member.emailCheckLoading.value"
        :teams="teams"
        @close="controller.member.closeAddMemberModal"
        @submit="controller.member.submitAddMember"
        @toggle-password="controller.member.toggleAddPasswordVisibility"
        @email-blur="controller.member.checkEmailOnBlur"
      />
```

- [ ] **Step 4: Verify frontend build**

Run from `frontend/`: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Verify backend build**

Run from root: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/composables/team-management/useMemberOperations.ts \
       frontend/src/components/team/AddMemberModal.vue \
       frontend/src/components/team/DuplicateMemberModal.vue \
       frontend/src/views/TeamManagement.vue
git commit -m "feat(members): wire up duplicate email detection on blur"
```

---

### Task 6: Manual Smoke Test

- [ ] **Step 1: Start dev servers**

Terminal 1 (root): `bun run dev`
Terminal 2 (frontend/): `bun run dev`

- [ ] **Step 2: Test Scenario A — Active member**

1. Open the app, navigate to team management
2. Click "新增系統人員"
3. Type an email that belongs to an existing active member
4. Tab out of the email field
5. Verify: DuplicateMemberModal appears with info theme (blue icon), member card shows name/email/role/team/last login
6. Click "我知道了" — modal closes, email field is cleared

- [ ] **Step 3: Test Scenario B — Soft-deleted member**

1. In the same add-member modal
2. Type an email that belongs to a soft-deleted member
3. Tab out of the email field
4. Verify: DuplicateMemberModal appears with warning theme (amber icon), member card shows name/email/role/team/deleted date
5. Click "重新啟用人員" — modal closes, form pre-fills with old name/role/team
6. Fill in password, click "新增成員"
7. Verify: member is created successfully (reactivated)

- [ ] **Step 4: Test Scenario C — No duplicate**

1. Type a brand new email that doesn't exist
2. Tab out
3. Verify: no modal appears, form continues normally

- [ ] **Step 5: Test edge case — Network error on check**

1. Disconnect network / stop backend
2. Type any email and tab out
3. Verify: no modal, no error toast — silently ignored
4. Fill form and submit — the submit-time 409 check is the fallback

- [ ] **Step 6: Commit final state**

If any adjustments were needed during testing:

```bash
git add -A
git commit -m "fix(members): polish duplicate detection after smoke test"
```
