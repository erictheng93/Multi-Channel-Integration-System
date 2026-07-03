<template>
  <div
    v-if="open"
    class="modal-backdrop"
    role="presentation"
    @click.self="$emit('close')"
  >
    <section
      class="detail-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-detail-title"
    >
      <header class="modal-header">
        <div>
          <h2 id="broadcast-detail-title">
            收件人明細
          </h2>
          <p v-if="broadcast">
            {{ broadcast.title }}
          </p>
        </div>
        <button
          class="btn btn-ghost btn-sm"
          type="button"
          @click="$emit('close')"
        >
          關閉
        </button>
      </header>

      <div
        class="filters"
        aria-label="狀態篩選"
      >
        <button
          v-for="option in statusOptions"
          :key="option.value || 'all'"
          type="button"
          class="filter-chip"
          :class="{ active: modelValue === option.value }"
          @click="$emit('update:modelValue', option.value)"
        >
          {{ option.label }}
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
        <div class="recipient-list">
          <article
            v-for="recipient in recipients.items"
            :key="recipient.id"
            class="recipient-row"
          >
            <div>
              <strong>{{ recipient.customerDisplayName || recipient.platformUserId }}</strong>
              <small>{{ recipient.platform }} · {{ recipient.platformUserId }}</small>
            </div>
            <div class="recipient-status">
              <span
                class="status-pill"
                :data-status="recipient.status"
              >{{ recipient.status }}</span>
              <small v-if="recipient.errorReason">{{ reasonLabel(recipient.errorReason) }}</small>
            </div>
          </article>
        </div>

        <nav
          v-if="recipients.totalPages > 1"
          class="pagination"
          aria-label="收件人明細分頁"
        >
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="recipients.page <= 1"
            data-testid="recipients-prev-page"
            @click="$emit('page-change', recipients.page - 1)"
          >
            上一頁
          </button>
          <span>第 {{ recipients.page }} / {{ recipients.totalPages }} 頁，共 {{ recipients.total }} 筆</span>
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
import type {
  BroadcastRecord,
  BroadcastRecipientErrorReason,
  BroadcastRecipientListResult,
  BroadcastRecipientStatus
} from '@/api/broadcasts'

defineProps<{
  open: boolean
  broadcast: BroadcastRecord | null
  recipients: BroadcastRecipientListResult | null
  modelValue?: BroadcastRecipientStatus
}>()

defineEmits<{
  close: []
  'update:modelValue': [value?: BroadcastRecipientStatus]
  'page-change': [page: number]
}>()

const statusOptions: Array<{ label: string; value?: BroadcastRecipientStatus }> = [
  { label: '全部' },
  { label: '成功', value: 'sent' },
  { label: '失敗', value: 'failed' },
  { label: '略過', value: 'skipped' }
]

function reasonLabel(reason: BroadcastRecipientErrorReason): string {
  switch (reason) {
    case 'platform_not_supported_phase1':
      return 'Phase 1 不支援此平台'
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
  padding: var(--space-4);
  background: rgba(0, 0, 0, 0.28);
}

.detail-modal {
  width: min(760px, 100%);
  max-height: min(760px, 90vh);
  overflow: auto;
  background: #fff;
  border-radius: 18px;
  padding: var(--space-6);
  box-shadow: var(--shadow-lg);
}

.modal-header,
.recipient-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.modal-header h2 {
  margin: 0;
}

.modal-header p,
.recipient-row small,
.recipient-status small {
  color: var(--gray-500);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-5) 0;
}

.filter-chip {
  border: 0;
  border-radius: 999px;
  background: #f2f2f7;
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

.filter-chip.active {
  background: var(--primary-100);
  color: var(--primary-700);
  font-weight: 700;
}

.state {
  padding: var(--space-8);
  text-align: center;
  color: var(--gray-500);
}

.recipient-list {
  display: grid;
  gap: var(--space-3);
}

.recipient-section {
  display: grid;
  gap: var(--space-4);
}

.recipient-row {
  padding: var(--space-4);
  border-radius: 14px;
  background: #f2f2f7;
}

.recipient-row strong,
.recipient-row small {
  display: block;
}

.recipient-status {
  display: grid;
  justify-items: end;
  gap: var(--space-1);
}

.status-pill {
  border-radius: 999px;
  padding: var(--space-1) var(--space-3);
  background: #fff;
  font-weight: 700;
}

.status-pill[data-status='failed'],
.status-pill[data-status='skipped'] {
  color: #ff3b30;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  color: var(--gray-500);
  font-size: var(--text-sm);
}
</style>
