<template>
  <Modal
    :show="visible"
    :title="modalTitle"
    size="sm"
    :close-on-overlay="true"
    @close="handleClose"
  >
    <!-- Icon -->
    <div
      class="duplicate-icon-wrapper"
      :class="iconThemeClass"
    >
      <component :is="iconComponent" />
    </div>

    <!-- Member Info Card -->
    <div
      v-if="member"
      class="member-card"
    >
      <div
        class="member-avatar"
        :style="{ background: avatarColor }"
      >
        {{ avatarInitials }}
      </div>
      <div class="member-info">
        <div class="member-name">
          {{ member.displayName }}
        </div>
        <div class="member-email">
          {{ member.email }}
        </div>
        <div class="member-meta">
          <span>{{ roleLabel }}</span>
          <span
            v-if="member.teamName"
            class="meta-separator"
          >{{ member.teamName }}</span>
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
  if (!props.member) {return ''}
  const raw = props.status === 'active'
    ? props.member.lastLoginAt
    : props.member.deletedAt
  if (!raw) {return props.status === 'active' ? '從未登入' : '未知'}
  return new Date(raw).toLocaleDateString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  })
})

const avatarInitials = computed(() => {
  if (!props.member?.displayName) {return '?'}
  return props.member.displayName.slice(0, 1).toUpperCase()
})

const avatarColor = computed(() => {
  if (!props.member?.displayName) {return '#E5E7EB'}
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
