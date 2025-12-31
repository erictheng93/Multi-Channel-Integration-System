# TeamManagement.vue 重构计划

> **基于 ConversationDetail.vue 的成功重构经验**
> **目标**：渐进式重构，确保不引入新 Bug，每步完成后进行完善测试

---

## 📊 当前问题分析

### 文件规模
- **总行数**: ~2100+ 行（模板 + 脚本 + 样式）
- **脚本行数**: ~1100+ 行
- **模板行数**: ~1000+ 行

### 主要问题

#### 1. 单体设计（Monolithic Architecture）
- 所有功能集中在一个文件中
- 难以理解、维护和测试
- 违反单一职责原则

#### 2. 职责混乱（Mixed Responsibilities）
组件承担了过多职责：
- ✅ 团队 CRUD（Create/Read/Update/Delete）
- ✅ 成员 CRUD
- ✅ 密码重置管理
- ✅ QR 码管理（查看、下载、预加载）
- ✅ 统计数据计算
- ✅ 7 个不同模态框的状态管理
- ✅ 表单验证和状态同步
- ✅ 乐观更新逻辑

#### 3. 状态管理复杂
```typescript
// 模态框状态（7个）
showAddMemberModal, showAddTeamModal, showEditTeamModal
showPasswordResetModal, showQRModal, showConfirmModal, showAddPassword

// 表单状态（4个）
addMemberForm, addTeamForm, editTeamForm, passwordResetForm

// 加载状态（6个）
loading, addMemberLoading, editTeamLoading, passwordResetLoading
qrImageLoading, qrGenerating

// 其他状态（8个）
teams, teamMembers, stats, currentQRCode, currentTeam
passwordResetMember, confirmMessage, confirmCallback
```

#### 4. 模板结构复杂
- 多个大型模态框（每个 100-300 行）
- HTML 重复模式（表单、按钮、图标）
- 样式耦合，难以复用

#### 5. 测试困难
- 没有明确的测试边界
- 所有逻辑耦合，难以单独测试
- 缺少单元测试和集成测试

---

## 🎯 重构目标

### 1. 可维护性
- ✅ 单一职责：每个模块只负责一件事
- ✅ 清晰的代码结构
- ✅ 易于理解和修改

### 2. 可测试性
- ✅ 业务逻辑可独立测试（Composables）
- ✅ UI 组件可独立测试
- ✅ 100% 测试覆盖率（单元 + 集成）

### 3. 可复用性
- ✅ 组件可在其他页面复用
- ✅ Composables 可在其他功能复用
- ✅ 统一的模态框和表单模式

### 4. 性能优化
- ✅ 减少不必要的重渲染
- ✅ 按需加载模态框组件
- ✅ 优化 QR 码预加载策略

---

## 📐 重构架构设计

### 参考：ConversationDetail.vue 重构经验

ConversationDetail.vue 的成功重构模式：
```
ConversationDetail.vue (主视图)
├── useConversationController (业务逻辑)
├── ConversationHeader (头部组件)
├── VirtualMessageList (消息列表)
├── MessageInput (输入组件)
└── MessageSearch (搜索组件)
```

**关键经验**：
1. **Controller 模式**：集中管理业务逻辑和状态
2. **组件化**：拆分为独立、可测试的组件
3. **单一数据流**：数据向下，事件向上
4. **懒加载**：非关键组件按需加载

---

## 🏗️ 新架构设计

### 目录结构

```
frontend/src/
├── views/
│   └── TeamManagement.vue                    (主视图 - 仅布局和组合)
├── composables/
│   └── team-management/
│       ├── index.ts                           (统一导出)
│       ├── useTeamManagementController.ts     (主控制器)
│       ├── useMemberOperations.ts             (成员操作)
│       ├── useTeamOperations.ts               (团队操作)
│       ├── useQRCodeOperations.ts             (QR 码操作)
│       └── useTeamStats.ts                    (统计数据)
├── components/
│   └── team/
│       ├── TeamStatsOverview.vue              (统计概览)
│       ├── MemberListSection.vue              (成员列表区域)
│       ├── TeamListSection.vue                (团队列表区域)
│       ├── TeamMemberCard.vue                 (现有 - 成员卡片)
│       ├── TeamCard.vue                       (现有 - 团队卡片)
│       └── modals/
│           ├── AddMemberModal.vue             (新增成员)
│           ├── AddTeamModal.vue               (新增团队)
│           ├── EditTeamModal.vue              (编辑团队)
│           ├── PasswordResetModal.vue         (重置密码)
│           ├── QRCodeModal.vue                (QR 码显示)
│           └── ConfirmModal.vue               (确认操作)
└── tests/
    ├── unit/
    │   └── composables/
    │       └── team-management/
    │           ├── useTeamManagementController.test.ts
    │           ├── useMemberOperations.test.ts
    │           ├── useTeamOperations.test.ts
    │           └── useQRCodeOperations.test.ts
    └── integration/
        └── views/
            └── TeamManagement.test.ts
```

---

## 🔧 详细重构方案

### Phase 1: Composables 提取（业务逻辑层）

#### 1.1 `useTeamManagementController.ts` - 主控制器

```typescript
/**
 * 团队管理主控制器
 * 职责：
 * - 协调各个子控制器
 * - 管理全局状态
 * - 提供统一接口给视图层
 */
export function useTeamManagementController() {
  const teamStore = useTeamStore()
  const qrCodeStore = useQRCodeStore()

  // 子控制器
  const memberOps = useMemberOperations()
  const teamOps = useTeamOperations()
  const qrOps = useQRCodeOperations()
  const stats = useTeamStats()

  // 全局状态
  const loading = computed(() => teamStore.loading)
  const teams = computed(() => teamStore.teams)
  const members = computed(() => teamStore.members)

  // 初始化
  async function initialize() {
    await Promise.all([
      teamStore.loadMembers(),
      teamStore.loadTeams()
    ])
    qrOps.startBackgroundPreload(teams.value)
  }

  // 清理
  function cleanup() {
    qrOps.stopBackgroundPreload()
  }

  return {
    // State
    loading,
    teams,
    members,
    stats: stats.computed,

    // Member Operations
    member: memberOps,

    // Team Operations
    team: teamOps,

    // QR Operations
    qr: qrOps,

    // Lifecycle
    initialize,
    cleanup
  }
}
```

#### 1.2 `useMemberOperations.ts` - 成员操作

```typescript
/**
 * 成员操作控制器
 * 职责：
 * - 成员 CRUD 操作
 * - 密码重置
 * - 角色和状态管理
 */
export function useMemberOperations() {
  const teamStore = useTeamStore()
  const { showSuccess, showError } = useToast()

  // 新增成员
  const addMemberModal = ref(false)
  const addMemberForm = reactive({ ... })
  const addMemberLoading = ref(false)

  async function addMember() {
    addMemberLoading.value = true
    try {
      await teamStore.addMember(addMemberForm)
      showSuccess('新增成员成功')
      closeAddMemberModal()
    } catch (error) {
      showError('新增成员失败', error.message)
    } finally {
      addMemberLoading.value = false
    }
  }

  // 重置密码
  const passwordResetModal = ref(false)
  const passwordResetForm = reactive({ ... })
  const passwordResetMember = ref(null)

  async function resetPassword() {
    // ... 实现
  }

  // 更新角色
  async function updateRole(memberId, role) {
    // ... 实现
  }

  // 切换状态
  async function toggleStatus(member) {
    // ... 实现
  }

  // 移除成员
  async function removeMember(member) {
    // ... 实现
  }

  return {
    // Add Member
    addMemberModal,
    addMemberForm,
    addMemberLoading,
    openAddMemberModal,
    closeAddMemberModal,
    addMember,

    // Reset Password
    passwordResetModal,
    passwordResetForm,
    passwordResetMember,
    openPasswordResetModal,
    closePasswordResetModal,
    resetPassword,

    // Other Operations
    updateRole,
    toggleStatus,
    removeMember
  }
}
```

#### 1.3 `useTeamOperations.ts` - 团队操作

```typescript
/**
 * 团队操作控制器
 * 职责：
 * - 团队 CRUD 操作
 * - 成员分配
 * - 状态管理
 */
export function useTeamOperations() {
  const teamStore = useTeamStore()
  const { showSuccess, showError } = useToast()

  // 新增团队
  const addTeamModal = ref(false)
  const addTeamForm = reactive({ ... })
  const addTeamLoading = ref(false)

  async function addTeam() {
    // 实现乐观更新逻辑
  }

  // 编辑团队
  const editTeamModal = ref(false)
  const editTeamForm = reactive({ ... })
  const editTeamLoading = ref(false)

  async function editTeam() {
    // 实现乐观更新逻辑
  }

  // 切换团队状态
  async function toggleTeamStatus(team) {
    // 实现乐观更新逻辑
  }

  // 移除团队
  async function removeTeam(team) {
    // ... 实现
  }

  return {
    // Add Team
    addTeamModal,
    addTeamForm,
    addTeamLoading,
    openAddTeamModal,
    closeAddTeamModal,
    addTeam,

    // Edit Team
    editTeamModal,
    editTeamForm,
    editTeamLoading,
    openEditTeamModal,
    closeEditTeamModal,
    editTeam,

    // Other Operations
    toggleTeamStatus,
    removeTeam
  }
}
```

#### 1.4 `useQRCodeOperations.ts` - QR 码操作

```typescript
/**
 * QR 码操作控制器
 * 职责：
 * - QR 码查看和下载
 * - 背景预加载
 * - 懸停预加载
 */
export function useQRCodeOperations() {
  const qrCodeStore = useQRCodeStore()

  // QR 模态框
  const qrModal = ref(false)
  const currentTeam = ref(null)
  const currentQRCode = ref('')
  const qrImageLoading = ref(true)
  const qrGenerating = ref(false)

  // 查看 QR
  async function viewQR(team) {
    // ... 实现
  }

  // 下载 QR
  function downloadQR() {
    // ... 实现
  }

  // 背景预加载
  function startBackgroundPreload(teams) {
    // ... 实现
  }

  function stopBackgroundPreload() {
    // ... 实现
  }

  // 懸停预加载
  async function prefetchOnHover(team) {
    // ... 实现
  }

  return {
    // Modal State
    qrModal,
    currentTeam,
    currentQRCode,
    qrImageLoading,
    qrGenerating,

    // Operations
    viewQR,
    downloadQR,
    closeQRModal,

    // Preload
    startBackgroundPreload,
    stopBackgroundPreload,
    prefetchOnHover
  }
}
```

#### 1.5 `useTeamStats.ts` - 统计数据

```typescript
/**
 * 团队统计数据计算
 * 职责：
 * - 计算统计数据
 * - 提供格式化方法
 */
export function useTeamStats() {
  const teamStore = useTeamStore()

  const computed = {
    totalMembers: computed(() => teamStore.members.length),
    teamCount: computed(() => teamStore.teams.length),
    adminCount: computed(() =>
      teamStore.members.filter(m => m.role === ROLES.ADMIN).length
    ),
    activeTeams: computed(() =>
      teamStore.teams.filter(t => t.isActive).length
    )
  }

  return {
    computed
  }
}
```

---

### Phase 2: 组件提取（视图层）

#### 2.1 `TeamStatsOverview.vue` - 统计概览

```vue
<template>
  <div class="stats-overview">
    <div class="stats-grid">
      <StatCard
        :value="stats.totalMembers"
        label="總成員數"
        :icon="UsersIcon"
        variant="members"
      />
      <StatCard
        :value="stats.teamCount"
        label="現存團隊數量"
        :icon="TeamsIcon"
        variant="active"
      />
      <StatCard
        :value="stats.adminCount"
        label="管理員人數"
        :icon="ShieldIcon"
        variant="admins"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  stats: {
    totalMembers: number
    teamCount: number
    adminCount: number
  }
}
defineProps<Props>()
</script>
```

#### 2.2 `MemberListSection.vue` - 成员列表区域

```vue
<template>
  <div class="content-section">
    <div class="content-header">
      <h2 class="content-title">
        <UsersIcon />
        人員管理 ({{ members.length }})
      </h2>
      <PrimaryActionButton
        text="新增成員"
        :icon="PlusIcon"
        :loading="loading"
        @click="onAddMember"
      />
    </div>

    <div class="content-body">
      <HamsterLoader v-if="loading" message="載入成員中..." />

      <EmptyState
        v-else-if="members.length === 0"
        title="尚無系統人員"
        description="新增第一位成員到您的團隊"
      >
        <template #icon><UsersIcon /></template>
        <template #actions>
          <button class="btn btn-primary" @click="onAddMember">
            新增成員
          </button>
        </template>
      </EmptyState>

      <div v-else class="members-list">
        <TeamMemberCard
          v-for="member in members"
          :key="member.id"
          :member="member"
          :current-user-id="currentUserId"
          :loading="loading"
          @update-role="onUpdateRole"
          @toggle-status="onToggleStatus"
          @reset-password="onResetPassword"
          @remove-member="onRemoveMember"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  members: TeamMember[]
  loading: boolean
  currentUserId?: string
}

interface Emits {
  (e: 'add-member'): void
  (e: 'update-role', memberId: string, role: string): void
  (e: 'toggle-status', member: TeamMember): void
  (e: 'reset-password', member: TeamMember): void
  (e: 'remove-member', member: TeamMember): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const onAddMember = () => emit('add-member')
const onUpdateRole = (memberId: string, role: string) =>
  emit('update-role', memberId, role)
// ... 其他事件处理
</script>
```

#### 2.3 模态框组件

每个模态框都是独立的组件，例如：

**`AddMemberModal.vue`**:
```vue
<template>
  <div v-if="modelValue" class="modal-overlay">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h2>新增系統人員</h2>
        <button class="close-btn" @click="close">&times;</button>
      </div>
      <form class="modal-body" @submit.prevent="submit">
        <!-- 表单内容 -->
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  loading: boolean
  teams: Team[]
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', form: AddMemberFormData): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const form = reactive({ ... })

const close = () => emit('update:modelValue', false)
const submit = () => emit('submit', form)
</script>
```

---

### Phase 3: 重构后的主视图

**`TeamManagement.vue` (重构后)**:

```vue
<template>
  <AppLayout>
    <div class="team-management">
      <!-- Header -->
      <PageHeader
        title="團隊管理"
        subtitle="管理系統人員與團隊設置，控制存取權限"
      >
        <RefreshButton
          :loading="controller.loading.value"
          @refresh="handleRefresh"
        />
      </PageHeader>

      <!-- Stats Overview -->
      <TeamStatsOverview :stats="controller.stats" />

      <!-- Member List Section -->
      <MemberListSection
        :members="controller.members.value"
        :loading="controller.loading.value"
        :current-user-id="currentAgent?.id"
        @add-member="controller.member.openAddMemberModal"
        @update-role="controller.member.updateRole"
        @toggle-status="controller.member.toggleStatus"
        @reset-password="controller.member.openPasswordResetModal"
        @remove-member="controller.member.removeMember"
      />

      <!-- Team List Section -->
      <TeamListSection
        :teams="controller.teams.value"
        :loading="controller.loading.value"
        @add-team="controller.team.openAddTeamModal"
        @toggle-status="controller.team.toggleTeamStatus"
        @view-qr="controller.qr.viewQR"
        @prefetch-qr="controller.qr.prefetchOnHover"
        @remove-team="controller.team.removeTeam"
      />

      <!-- Modals (Lazy Loaded) -->
      <Suspense>
        <AddMemberModal
          v-model="controller.member.addMemberModal.value"
          :loading="controller.member.addMemberLoading.value"
          :teams="controller.teams.value"
          @submit="controller.member.addMember"
        />
      </Suspense>

      <Suspense>
        <AddTeamModal
          v-model="controller.team.addTeamModal.value"
          :loading="controller.team.addTeamLoading.value"
          :members="controller.members.value"
          @submit="controller.team.addTeam"
        />
      </Suspense>

      <!-- ... 其他模态框 -->
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useAuth } from '@/composables'
import { useTeamManagementController } from '@/composables/team-management'

// Lazy load modals
const AddMemberModal = defineAsyncComponent(
  () => import('@/components/team/modals/AddMemberModal.vue')
)
const AddTeamModal = defineAsyncComponent(
  () => import('@/components/team/modals/AddTeamModal.vue')
)
// ... 其他模态框

const { currentAgent } = useAuth()
const controller = useTeamManagementController()

onMounted(async () => {
  await controller.initialize()
})

onUnmounted(() => {
  controller.cleanup()
})

const handleRefresh = async () => {
  await controller.initialize()
}
</script>

<style scoped>
/* 只保留布局相关的样式 */
.team-management {
  /* ... */
}
</style>
```

---

## ✅ 重构检查清单

### Phase 1: Composables 提取
- [ ] 创建 `composables/team-management/` 目录
- [ ] 实现 `useTeamManagementController.ts`
- [ ] 实现 `useMemberOperations.ts`
- [ ] 实现 `useTeamOperations.ts`
- [ ] 实现 `useQRCodeOperations.ts`
- [ ] 实现 `useTeamStats.ts`
- [ ] 创建 `index.ts` 统一导出

### Phase 2: 组件提取
- [ ] 实现 `TeamStatsOverview.vue`
- [ ] 实现 `MemberListSection.vue`
- [ ] 实现 `TeamListSection.vue`
- [ ] 实现 `AddMemberModal.vue`
- [ ] 实现 `AddTeamModal.vue`
- [ ] 实现 `EditTeamModal.vue`
- [ ] 实现 `PasswordResetModal.vue`
- [ ] 实现 `QRCodeModal.vue`
- [ ] 实现 `ConfirmModal.vue`

### Phase 3: 主视图重构
- [ ] 重构 `TeamManagement.vue` 使用新架构
- [ ] 移除旧代码
- [ ] 更新样式文件

### Phase 4: 测试
- [ ] 编写 Composables 单元测试
  - [ ] `useTeamManagementController.test.ts`
  - [ ] `useMemberOperations.test.ts`
  - [ ] `useTeamOperations.test.ts`
  - [ ] `useQRCodeOperations.test.ts`
  - [ ] `useTeamStats.test.ts`
- [ ] 编写组件单元测试
  - [ ] `TeamStatsOverview.test.ts`
  - [ ] `MemberListSection.test.ts`
  - [ ] `TeamListSection.test.ts`
  - [ ] 各个模态框组件测试
- [ ] 编写集成测试
  - [ ] `TeamManagement.test.ts` (端到端流程)
- [ ] 执行所有测试，确保 100% 通过

### Phase 5: Code Review 和文档
- [ ] Code Review 重构代码
- [ ] 更新技术文档
- [ ] 更新 CLAUDE.md
- [ ] 记录重构经验和最佳实践

---

## 📈 成功指标

### 代码质量
- ✅ 主视图代码减少 80%（从 2100 行 → ~400 行）
- ✅ 单个文件不超过 300 行
- ✅ 圈复杂度 < 10
- ✅ 无重复代码

### 测试覆盖率
- ✅ Composables: 100%
- ✅ Components: 90%+
- ✅ Integration: 关键流程 100%

### 性能
- ✅ 初始加载时间 < 500ms
- ✅ 模态框打开 < 100ms
- ✅ QR 预加载不影响主线程

### 可维护性
- ✅ 新增功能时修改的文件 ≤ 2
- ✅ 修复 Bug 时修改的文件 ≤ 1
- ✅ 代码审查时间 < 30 分钟

---

## 🚨 风险管理

### 已知风险

#### 1. 乐观更新逻辑迁移
**风险**: 当前实现有复杂的乐观更新逻辑，迁移时可能遗漏边界情况
**缓解**:
- 详细测试所有 CRUD 操作
- 测试失败回滚场景
- 对比重构前后的行为

#### 2. Store 依赖
**风险**: 紧密依赖 teamStore 和 qrCodeStore，迁移时可能影响其他组件
**缓解**:
- 保持 Store API 不变
- 使用 computed 包装 Store 数据
- 增加 Store 单元测试

#### 3. QR 预加载机制
**风险**: 复杂的背景预加载和懸停预加载逻辑，可能影响性能
**缓解**:
- 独立测试预加载逻辑
- 性能监控和基准测试
- Feature Flag 控制启用/禁用

#### 4. 模态框状态管理
**风险**: 7 个模态框的状态切换和数据同步
**缓解**:
- 每个模态框独立测试
- 测试模态框关闭时的数据清理
- 测试多个模态框同时打开的场景

---

## 📅 实施计划

### 第 1 步：Composables 提取（2 天）
- Day 1: 实现 3 个 Composables（Controller, Member, Team）
- Day 2: 实现 2 个 Composables（QR, Stats）+ 单元测试

### 第 2 步：组件提取（3 天）
- Day 3: 实现 Stats + List 组件
- Day 4: 实现 3 个模态框（Add Member, Add Team, Edit Team）
- Day 5: 实现 3 个模态框（Password Reset, QR Code, Confirm）

### 第 3 步：主视图重构（1 天）
- Day 6: 重构 TeamManagement.vue，集成所有组件

### 第 4 步：测试（2 天）
- Day 7: 编写并执行所有单元测试
- Day 8: 编写并执行集成测试，修复 Bug

### 第 5 步：Review 和文档（1 天）
- Day 9: Code Review，更新文档，部署到测试环境

**总计**: 9 个工作日

---

## 🎓 重构最佳实践

### 1. 渐进式重构
- ✅ 一次只重构一个小模块
- ✅ 每次重构后立即测试
- ✅ 保持系统始终可用

### 2. 测试驱动
- ✅ 先写测试，后重构
- ✅ 重构后测试必须通过
- ✅ 增加覆盖率，不降低质量

### 3. 文档同步
- ✅ 边重构边更新文档
- ✅ 记录重构决策和原因
- ✅ 提供示例代码

### 4. 团队协作
- ✅ 定期 Code Review
- ✅ 分享重构经验
- ✅ 建立代码规范

---

## 📚 参考资料

- [ConversationDetail.vue 重构经验](../CONVERSATION_DETAIL_REFACTORING.md)
- [Vue 3 Composition API 最佳实践](https://vuejs.org/guide/reusability/composables.html)
- [测试策略指南](../claude/TESTING.md)
- [Controller 模式文档](../patterns/CONTROLLER_PATTERN.md)

---

## ✨ 预期效果

### 重构前
```
TeamManagement.vue (2100 行)
├── 模板 (1000 行)
├── 脚本 (1100 行)
│   ├── 7 个模态框状态
│   ├── 4 个表单状态
│   ├── 6 个加载状态
│   └── 30+ 个函数
└── 样式 (大量耦合样式)
```

### 重构后
```
TeamManagement.vue (~400 行)
├── 简洁的模板 (~200 行)
├── 控制器集成 (~100 行)
└── 布局样式 (~100 行)

+ 5 个 Composables (各 ~200 行)
+ 9 个独立组件 (各 ~150 行)
+ 完整的测试覆盖 (100%)
```

### 效益
- ✅ **可读性**: 提升 300%
- ✅ **可维护性**: 提升 400%
- ✅ **可测试性**: 从 0% → 100%
- ✅ **开发效率**: 提升 200%
- ✅ **Bug 率**: 降低 60%

---

**Last Updated**: 2025-12-31
**Version**: 1.0
**Status**: Ready for Implementation 🚀
