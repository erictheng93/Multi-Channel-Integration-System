<template>
  <div
    v-if="open"
    class="modal-backdrop"
    :class="{ 'is-inline': inline }"
    role="presentation"
    @click.self="!inline && $emit('close')"
  >
    <section
      class="ui-card detail-modal"
      :role="inline ? 'region' : 'dialog'"
      :aria-modal="inline ? undefined : 'true'"
      aria-labelledby="broadcast-detail-title"
    >
      <header class="ui-card-head modal-header">
        <div class="head-main">
          <h2
            id="broadcast-detail-title"
            class="ui-card-title"
          >
            收件人明細
          </h2>
          <p
            v-if="broadcast"
            class="ui-card-sub"
          >
            {{ broadcast.title }} · {{ formatDate(broadcast.sentAt || broadcast.createdAt) }}
          </p>
        </div>
        <button
          v-if="!inline"
          class="btn btn-ghost btn-sm"
          type="button"
          @click="$emit('close')"
        >
          關閉
        </button>
      </header>

      <div
        v-if="broadcast?.attachments?.length"
        class="attachment-strip"
        aria-label="群發圖片"
      >
        <a
          v-for="item in broadcast.attachments"
          :key="item.attachmentId"
          :href="item.fileUrl"
          target="_blank"
          rel="noopener"
        >
          <img
            :src="item.previewUrl"
            :alt="`群發圖片 ${item.position + 1}`"
            loading="lazy"
          >
        </a>
      </div>

      <div
        class="filters"
        aria-label="狀態篩選"
      >
        <button
          v-for="option in statusOptions"
          :key="option.value || 'all'"
          type="button"
          class="ui-chip filter-chip"
          :class="{ active: modelValue === option.value, 'is-on': modelValue === option.value }"
          @click="$emit('update:modelValue', option.value)"
        >
          {{ option.label }}
          <span
            v-if="option.count !== null"
            class="chip-n"
          >{{ option.count }}</span>
        </button>
      </div>

      <div
        v-if="!recipients"
        class="state"
      >
        載入收件人...
      </div>
      <div
        v-else-if="recipients.items.length === 0"
        class="state"
      >
        沒有符合條件的收件人。
      </div>
      <div
        v-else
        class="recipient-section"
      >
        <ul class="ui-list recipient-list">
          <li
            v-for="recipient in recipients.items"
            :key="recipient.id"
            class="ui-row recipient-row"
          >
            <span class="avatar">
              <img
                v-if="recipient.customerAvatarUrl"
                :src="recipient.customerAvatarUrl"
                alt=""
              >
              <template v-else>{{ initial(recipient) }}</template>
            </span>
            <div class="ui-row-main">
              <div class="ui-row-title">
                {{ recipient.customerDisplayName || shortId(recipient.platformUserId) }}
              </div>
              <div class="ui-row-sub">
                {{ platformLabel(recipient.platform) }} · {{ shortId(recipient.platformUserId) }}
              </div>
              <div
                v-if="recipient.errorReason"
                class="reason"
              >
                {{ reasonLabel(recipient.errorReason) }}
              </div>
            </div>
            <span
              class="ui-pill ui-pill-dot status-pill"
              :class="recipientClass(recipient.status)"
              :data-status="recipient.status"
            >{{ recipientLabel(recipient.status) }}</span>
          </li>
        </ul>

        <nav
          v-if="recipients.totalPages > 1"
          class="pagination"
          aria-label="收件人明細分頁"
        >
          <span>第 {{ recipients.page }} / {{ recipients.totalPages }} 頁，共 {{ recipients.total }} 筆</span>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="recipients.page <= 1"
            data-testid="recipients-prev-page"
            @click="$emit('page-change', recipients.page - 1)"
          >
            上一頁
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="recipients.page >= recipients.totalPages"
            data-testid="recipients-next-page"
            @click="$emit('page-change', recipients.page + 1)"
          >
            下一頁
          </button>
        </nav>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type {
  BroadcastRecipientDetail,
  BroadcastRecipientErrorReason,
  BroadcastRecipientListResult,
  BroadcastRecipientStatus,
  BroadcastRecord
} from '@/api/broadcasts'

const props = defineProps<{
  open: boolean
  broadcast: BroadcastRecord | null
  recipients: BroadcastRecipientListResult | null
  modelValue?: BroadcastRecipientStatus
  /** Render in place as a side card instead of an overlay dialog */
  inline?: boolean
}>()

defineEmits<{
  close: []
  'update:modelValue': [value?: BroadcastRecipientStatus]
  'page-change': [page: number]
}>()

// Tab counts come from the broadcast record; a "processing" tab appears only while recipients are pending.
const statusOptions = computed<Array<{ label: string; value?: BroadcastRecipientStatus; count: number | null }>>(() => {
  const b = props.broadcast
  const pending = b ? Math.max(b.totalRecipients - b.sentCount - b.failedCount - b.skippedCount, 0) : 0
  const options: Array<{ label: string; value?: BroadcastRecipientStatus; count: number | null }> = [
    { label: '全部', count: b ? b.totalRecipients : null },
    { label: '成功', value: 'sent', count: b ? b.sentCount : null },
    { label: '失敗', value: 'failed', count: b ? b.failedCount : null },
    { label: '略過', value: 'skipped', count: b ? b.skippedCount : null }
  ]
  if (pending > 0) {
    options.push({ label: '處理中', value: 'pending', count: pending })
  }
  return options
})

function recipientLabel(status: BroadcastRecipientStatus): string {
  switch (status) {
    case 'sent':
      return '成功'
    case 'failed':
      return '失敗'
    case 'skipped':
      return '略過'
    case 'pending':
      return '處理中'
  }
}

function recipientClass(status: BroadcastRecipientStatus): string {
  switch (status) {
    case 'sent':
      return 'ui-pill-green'
    case 'failed':
      return 'ui-pill-red'
    case 'pending':
      return 'ui-pill-orange'
    default:
      return ''
  }
}

function platformLabel(platform: string): string {
  return platform === 'line' ? 'LINE' : platform === 'facebook' ? 'Facebook' : platform
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 5)}…${id.slice(-4)}` : id
}

function initial(recipient: BroadcastRecipientDetail): string {
  return (recipient.customerDisplayName || recipient.platformUserId).charAt(0).toUpperCase() || '?'
}

function formatDate(value: string | null): string {
  if (!value) {return ''}
  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value))
}

function reasonLabel(reason: BroadcastRecipientErrorReason): string {
  switch (reason) {
    case 'platform_not_supported_phase1':
      return '此平台本期不支援群發'
    case 'no_channel_credentials':
      return '缺少渠道憑證'
    case 'line_api_failed':
      return 'LINE API 發送失敗'
    case 'quota_insufficient':
      return 'LINE 配額不足'
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / 0.4);
}

.modal-backdrop.is-inline {
  position: static;
  z-index: auto;
  display: block;
  padding: 0;
  background: none;
}

.detail-modal {
  width: min(560px, 100%);
  max-height: min(760px, 90vh);
  max-height: min(760px, 90dvh);
  overflow: auto;
  box-shadow: var(--ui-shadow-raised);
}

.is-inline .detail-modal {
  width: 100%;
  max-height: none;
  overflow: visible;
  box-shadow: var(--ui-shadow-card);
}

.head-main {
  min-width: 0;
  flex: 1;
}

.attachment-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 2px 22px 8px;
}

.attachment-strip img {
  display: block;
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 22px 10px;
}

.chip-n {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-muted);
}

/* On the selected (dark) chip the count follows the chip's light text */
.ui-chip.is-on .chip-n,
.ui-chip[aria-pressed="true"] .chip-n {
  color: inherit;
  opacity: 0.8;
}


.state {
  padding: 24px 22px 28px;
  font-size: 13.5px;
  color: var(--ui-muted);
}

.avatar {
  display: grid;
  flex: none;
  width: 38px;
  height: 38px;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--ui-fill-strong);
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reason {
  font-size: 13px;
  color: var(--ui-red-ink);
}

.pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px 14px;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.pagination span {
  margin-right: auto;
}

@media (max-width: 768px) {
  .modal-backdrop:not(.is-inline) {
    place-items: end stretch;
    padding: 0;
  }
  .modal-backdrop:not(.is-inline) .detail-modal {
    width: 100%;
    border-radius: var(--ui-r-card) var(--ui-r-card) 0 0;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .pagination .btn {
    min-height: 44px;
  }
}
</style>
