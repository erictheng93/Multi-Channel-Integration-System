<template>
  <div class="timeline-item">
    <div
      class="timeline-item__icon"
      :class="[iconStyle.bgClass, iconStyle.colorClass]"
    >
      <component
        :is="iconStyle.icon"
        :size="18"
      />
    </div>
    <div class="timeline-item__content">
      <div class="timeline-item__header">
        <span class="timeline-item__user">{{ activity.userName }}</span>
        <span
          class="timeline-item__role"
          :class="getRoleBadgeClasses(activity.userRole)"
          :aria-label="getRoleLabel(activity.userRole)"
        >{{ getRoleLabel(activity.userRole) }}</span>
        <span class="timeline-item__time">{{ formatTime(activity.createdAt) }}</span>
        <div class="timeline-item__restore-zone">
          <button
            v-if="restoreState.kind === 'eligible'"
            class="btn btn-secondary btn-sm"
            data-test="restore-button"
            :disabled="restoring"
            @click.stop="openRestoreModal"
          >
            還原
          </button>
          <span
            v-else-if="restoreState.kind === 'expired'"
            class="timeline-item__restore-hint"
            data-test="restore-expired"
          >
            已過期
          </span>
          <span
            v-else-if="restoreState.kind === 'irreversible'"
            class="timeline-item__restore-hint"
            data-test="restore-irreversible"
          >
            不可還原
          </span>
          <span
            v-else-if="restoreState.kind === 'already-restored'"
            class="timeline-item__restore-hint"
            data-test="restore-done"
          >
            已還原
          </span>
        </div>
      </div>
      <div class="timeline-item__description">
        {{ getActivityDescription(activity) }}
      </div>
      <button
        v-if="formattedDetails.length > 0"
        class="timeline-item__details-toggle"
        :aria-expanded="detailsExpanded"
        @click="detailsExpanded = !detailsExpanded"
      >
        {{ detailsExpanded ? '隱藏詳情' : '查看詳情' }}
      </button>
      <ActivityDetailPanel
        :entries="formattedDetails"
        :show="detailsExpanded"
      />
    </div>
    <RestoreConfirmModal
      :open="modalOpen"
      :activity="activity"
      :mid-changes="conflictMidChanges"
      :loading="restoring"
      @confirm="onConfirmRestore"
      @cancel="closeRestoreModal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { isIrreversibleDetails, isReversibleDetails, type ActivityLog } from '@/api/activities'
import { useAuthStore } from '@/stores/auth'
import { ROLES } from '@/constants/roles'
import { isActivityRestoreEnabled } from '@/config/runtime'
import { useRestoreActivity } from '@/composables/useRestoreActivity'
import type { MidChange, RestoreState } from './types'
import { getActionIconStyle, formatActivityDetails, getActivityDescription, getRoleLabel, getRoleBadgeClasses } from './utils'
import ActivityDetailPanel from './ActivityDetailPanel.vue'
import RestoreConfirmModal from './RestoreConfirmModal.vue'

const props = defineProps<{
  activity: ActivityLog
}>()

const emit = defineEmits<{
  (_e: 'restored', _activityId: number): void
}>()

const detailsExpanded = ref(false)
const modalOpen = ref(false)
const conflictMidChanges = ref<MidChange[] | null>(null)
const nowMs = ref(Date.now())
let nowInterval: ReturnType<typeof setInterval> | null = null

const auth = useAuthStore()
const {
  isRestoring: restoring,
  isOptimisticallyRestored,
  attemptRestore,
} = useRestoreActivity()

const iconStyle = computed(() => getActionIconStyle(props.activity.action))

const formattedDetails = computed(() =>
  formatActivityDetails(props.activity.details ?? null, props.activity.action)
)

const restoreState = computed<RestoreState>(() => {
  if (!isActivityRestoreEnabled()) {return { kind: 'hidden' }}

  const details = props.activity.details
  if (isIrreversibleDetails(details)) {
    return { kind: 'irreversible', reason: details.irreversibleReason }
  }
  if (!isReversibleDetails(details)) {return { kind: 'hidden' }}

  if (isOptimisticallyRestored(props.activity.id)) {
    return { kind: 'already-restored', byActivityId: details.restoredByActivityId ?? props.activity.id }
  }

  if (typeof details.restoredByActivityId === 'number' && details.restoredByActivityId > 0) {
    return { kind: 'already-restored', byActivityId: details.restoredByActivityId }
  }

  const expiresAt = new Date(details.restorePolicy.expiresAt).getTime()
  if (!Number.isFinite(expiresAt) || nowMs.value >= expiresAt) {
    return { kind: 'expired' }
  }

  const callerId = auth.currentAgent?.id
  const callerRole = auth.currentAgent?.role
  const isAdmin = callerRole === ROLES.ADMIN
  const isOriginalActor = callerId === props.activity.userId
  const requiresAdmin = details.restorePolicy.requiresAdmin

  if (isAdmin || (isOriginalActor && !requiresAdmin)) {
    return {
      kind: 'eligible',
      expiresAt: details.restorePolicy.expiresAt,
      requiresAdmin,
    }
  }

  return { kind: 'hidden' }
})

function openRestoreModal() {
  conflictMidChanges.value = null
  modalOpen.value = true
}

function closeRestoreModal() {
  modalOpen.value = false
}

async function onConfirmRestore(payload: { force: boolean }) {
  const outcome = await attemptRestore(props.activity.id, payload.force)

  if (outcome.kind === 'success') {
    modalOpen.value = false
    emit('restored', props.activity.id)
    return
  }

  if (outcome.kind === 'conflict') {
    conflictMidChanges.value = outcome.midChanges
    return
  }

  if (outcome.kind === 'in-progress') {
    window.setTimeout(() => {
      onConfirmRestore(payload)
    }, outcome.retryAfterMs)
    return
  }

  modalOpen.value = false
}

function formatTime(isoString: string): string {
  const now = new Date()
  const date = new Date(isoString)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHrs = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffSec < 60) {
    return '剛剛'
  }
  if (diffMin < 60) {
    return `${diffMin} 分鐘前`
  }
  if (diffHrs < 24) {
    return `${diffHrs} 小時前`
  }
  if (diffDays < 30) {
    return `${diffDays} 天前`
  }
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

onMounted(() => {
  nowInterval = setInterval(() => {
    nowMs.value = Date.now()
  }, 60_000)
})

onUnmounted(() => {
  if (nowInterval !== null) {
    clearInterval(nowInterval)
  }
})
</script>

<style scoped>
.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
  transition: background-color 200ms ease-out;
}

.timeline-item:hover {
  background-color: #F2F2F7;
}

.timeline-item__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.timeline-item__content {
  flex: 1;
  min-width: 0;
}

.timeline-item__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.timeline-item__user {
  font-size: 14px;
  font-weight: 600;
  color: #1C1C1E;
}

.timeline-item__role {
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 500;
}

.timeline-item__time {
  font-size: 12px;
  color: #8E8E93;
  margin-left: auto;
}

.timeline-item__restore-zone {
  flex-shrink: 0;
}

.timeline-item__restore-hint {
  padding: 2px 8px;
  color: #8E8E93;
  font-size: 12px;
  white-space: nowrap;
}

.timeline-item__description {
  font-size: 14px;
  color: #1C1C1E;
}

.timeline-item__details-toggle {
  display: inline-block;
  margin-top: 6px;
  font-size: 12px;
  color: #007AFF;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.timeline-item__details-toggle:hover {
  text-decoration: underline;
}
</style>
