<template>
  <div
    class="timeline-item"
    :class="{ 'is-clickable': formattedDetails.length > 0, 'is-open': detailsExpanded }"
    @click="onRowClick"
  >
    <div
      class="timeline-item__icon"
      :class="[iconStyle.bgClass, iconStyle.colorClass]"
      :data-system-actor="systemActor || undefined"
    >
      <component
        :is="iconStyle.icon"
        :size="18"
      />
    </div>
    <div class="timeline-item__content">
      <div class="timeline-item__header">
        <span class="timeline-item__user">{{ getActorName(activity) }}</span>
        <span
          v-if="!systemActor"
          class="timeline-item__role ui-pill"
          :class="activity.userRole === 'admin' ? 'ui-pill-blue' : 'ui-pill-green'"
          :aria-label="getRoleLabel(activity.userRole)"
        >{{ getRoleLabel(activity.userRole) }}</span>
        <time
          class="timeline-item__time"
          :datetime="activity.createdAt"
          :title="fullTime"
        >{{ formatTime(activity.createdAt) }}</time>
        <div class="timeline-item__restore-zone">
          <span
            v-if="restoreState.kind === 'eligible'"
            class="ui-pill ui-pill-green"
            data-test="restore-eligible"
          >可還原</span>
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
            class="ui-pill"
            data-test="restore-expired"
          >
            已過期
          </span>
          <span
            v-else-if="restoreState.kind === 'irreversible'"
            class="ui-pill"
            data-test="restore-irreversible"
          >
            不可還原
          </span>
          <span
            v-else-if="restoreState.kind === 'already-restored'"
            class="ui-pill ui-pill-green ui-pill-dot"
            data-test="restore-done"
          >
            已還原
          </span>
          <button
            v-if="formattedDetails.length > 0"
            class="timeline-item__details-toggle"
            type="button"
            :aria-expanded="detailsExpanded"
            :aria-label="detailsExpanded ? '隱藏詳情' : '查看詳情'"
            @click.stop="detailsExpanded = !detailsExpanded"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </div>
      </div>
      <div class="timeline-item__description">
        {{ getActivityDescription(activity) }}
      </div>
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
import { getActionIconStyle, formatActivityDetails, getActivityDescription, getRoleLabel, getActorName, isSystemActor } from './utils'
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

const systemActor = computed(() => isSystemActor(props.activity))
// The tile is tinted by the kind of action (message, assignment, close, settings, team, account);
// system-initiated rows stay neutral so automation never reads as a person's action.
const iconStyle = computed(() => {
  const style = getActionIconStyle(props.activity.action)
  return systemActor.value
    ? { ...style, bgClass: 'bg-[var(--ui-fill)]', colorClass: 'text-[var(--ui-muted)]' }
    : style
})

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

  const callerRole = auth.currentAgent?.role
  const isAdmin = callerRole === ROLES.ADMIN
  const requiresAdmin = details.restorePolicy.requiresAdmin

  // Server authorizes restore on the caller's CURRENT role: admin only
  if (isAdmin) {
    return {
      kind: 'eligible',
      expiresAt: details.restorePolicy.expiresAt,
      requiresAdmin,
    }
  }

  return { kind: 'hidden' }
})

/** The whole row opens the details; real controls inside it keep their own behaviour. */
function onRowClick(event: MouseEvent) {
  if (formattedDetails.value.length === 0) {return}
  if ((event.target as HTMLElement).closest('button, a, input, select')) {return}
  detailsExpanded.value = !detailsExpanded.value
}

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

const fullTime = computed(() => new Date(props.activity.createdAt).toLocaleString('zh-TW'))

/** The timeline is grouped by day, so the time of day is the useful part. */
function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 14px;
  padding: 16px 22px;
  transition: background-color var(--ui-dur) var(--ui-ease);
}

.timeline-item:hover {
  background-color: color-mix(in srgb, var(--ui-fill) 40%, transparent);
}

.timeline-item__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
}

.timeline-item__content {
  min-width: 0;
}

.timeline-item__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.timeline-item__user {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--ui-ink);
}

.timeline-item__role {
  flex-shrink: 0;
}

.timeline-item__time {
  font-size: 13px;
  color: var(--ui-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.timeline-item__restore-zone {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
  margin-left: auto;
}

.timeline-item__description {
  margin-top: 4px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-ink-2);
  word-break: break-word;
}

.timeline-item__details-toggle {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--ui-muted);
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}
.timeline-item__details-toggle:hover {
  background: var(--ui-fill);
}
.timeline-item__details-toggle svg {
  width: 16px;
  height: 16px;
  transition: transform var(--ui-dur) var(--ui-ease);
}
.timeline-item.is-open .timeline-item__details-toggle svg {
  transform: rotate(180deg);
}
.timeline-item.is-clickable {
  cursor: pointer;
}

@media (max-width: 768px) {
  .timeline-item {
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 12px;
    padding: 14px 16px;
  }
  .timeline-item__icon {
    width: 34px;
    height: 34px;
    border-radius: 11px;
  }
  /* Status stays at the right of the name line */
  .timeline-item__restore-zone {
    gap: 6px;
  }
  /* The 還原 button already says "restorable"; the chip would wrap the name line */
  .timeline-item__restore-zone [data-test='restore-eligible'] {
    display: none;
  }
}
</style>
