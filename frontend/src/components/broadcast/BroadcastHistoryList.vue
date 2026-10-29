<template>
  <section
    class="ui-card history-card"
    aria-labelledby="broadcast-history-title"
  >
    <div class="ui-card-head">
      <div>
        <h2
          id="broadcast-history-title"
          class="ui-card-title"
        >
          群發紀錄
        </h2>
        <p
          v-if="pagination && pagination.total > 0"
          class="ui-card-sub"
        >
          共 {{ pagination.total }} 筆，選擇一筆查看收件人明細
        </p>
      </div>
      <div class="ui-card-end">
        <button
          class="btn btn-secondary btn-sm"
          type="button"
          @click="$emit('refresh')"
        >
          重新整理
        </button>
      </div>
    </div>

    <div
      v-if="loading"
      class="state"
    >
      載入群發紀錄中...
    </div>
    <div
      v-else-if="broadcasts.length === 0"
      class="ui-empty"
    >
      <div class="ui-empty-art">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        ><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
      </div>
      <h3>尚未建立群發</h3>
      <p>建立第一則群發後，結果會顯示在這裡。</p>
    </div>
    <div
      v-else
      class="table-wrap"
    >
      <div class="ui-table-wrap">
        <table class="ui-table">
          <thead>
            <tr>
              <th>活動</th>
              <th>狀態</th>
              <th>結果</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="broadcast in broadcasts"
              :key="broadcast.id"
              :class="{ 'is-selected': broadcast.id === selectedId }"
            >
              <td class="col-title">
                <strong class="title-line">
                  <span class="title-text">{{ broadcast.title }}</span>
                  <span
                    v-if="broadcast.contentType === 'mixed'"
                    class="ui-pill ui-pill-blue mixed-pill"
                  >圖文</span>
                </strong>
                <small>{{ broadcast.content || '（僅圖片）' }}</small>
              </td>
              <td class="col-status">
                <span
                  class="ui-pill ui-pill-dot status-pill"
                  :class="statusClass(broadcast.status)"
                  :data-status="broadcast.status"
                >{{ statusLabel(broadcast.status) }}</span>
                <small class="when">{{ formatDate(broadcast.sentAt || broadcast.createdAt) }}</small>
              </td>
              <td class="col-result">
                <template v-if="broadcast.totalRecipients > 0">
                  <div
                    class="result-bar"
                    aria-hidden="true"
                  >
                    <i
                      class="seg-ok"
                      :style="{ width: share(broadcast.sentCount, broadcast) }"
                    />
                    <i
                      class="seg-fail"
                      :style="{ width: share(broadcast.failedCount, broadcast) }"
                    />
                    <i
                      class="seg-skip"
                      :style="{ width: share(broadcast.skippedCount, broadcast) }"
                    />
                  </div>
                  <small class="result-text">
                    {{ broadcast.totalRecipients }} 人 · 成功 <b>{{ broadcast.sentCount }}</b> ·
                    失敗 <b :class="{ 'is-bad': broadcast.failedCount > 0 }">{{ broadcast.failedCount }}</b> ·
                    略過 <b>{{ broadcast.skippedCount }}</b>
                  </small>
                </template>
                <small
                  v-else
                  class="result-text"
                >尚未發送</small>
              </td>
              <td class="col-act">
                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  @click="$emit('select', broadcast.id)"
                >
                  明細
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav
        v-if="pagination && pagination.totalPages > 1"
        class="pagination"
        aria-label="群發紀錄分頁"
      >
        <span>第 {{ pagination.page }} / {{ pagination.totalPages }} 頁，共 {{ pagination.total }} 筆</span>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="pagination.page <= 1"
          data-testid="history-prev-page"
          @click="$emit('page-change', pagination.page - 1)"
        >
          上一頁
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="pagination.page >= pagination.totalPages"
          data-testid="history-next-page"
          @click="$emit('page-change', pagination.page + 1)"
        >
          下一頁
        </button>
      </nav>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { BroadcastRecord, BroadcastStatus } from '@/api/broadcasts'

defineProps<{
  broadcasts: BroadcastRecord[]
  loading: boolean
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  } | null
  /** Row whose recipient detail is open */
  selectedId?: string | null
}>()

defineEmits<{
  refresh: []
  select: [id: string]
  'page-change': [page: number]
}>()

function statusLabel(status: BroadcastStatus): string {
  switch (status) {
    case 'draft':
      return '草稿'
    case 'sending':
      return '發送中'
    case 'completed':
      return '完成'
    case 'partial_failed':
      return '部分失敗'
    case 'failed':
      return '失敗'
  }
}

function statusClass(status: BroadcastStatus): string {
  switch (status) {
    case 'completed':
      return 'ui-pill-green'
    case 'partial_failed':
    case 'sending':
      return 'ui-pill-orange'
    case 'failed':
      return 'ui-pill-red'
    default:
      return ''
  }
}

function share(count: number, broadcast: BroadcastRecord): string {
  if (broadcast.totalRecipients <= 0 || count <= 0) {return '0%'}
  return `${(count / broadcast.totalRecipients) * 100}%`
}

function formatDate(value: string | null): string {
  if (!value) {return '-'}
  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value))
}
</script>

<style scoped>
.state {
  padding: 24px 22px 28px;
  font-size: 13.5px;
  color: var(--ui-muted);
}

.table-wrap {
  padding-bottom: 6px;
}

.ui-table td {
  vertical-align: top;
}

.ui-table tbody tr.is-selected {
  background: var(--ui-sel-tint);
}

.col-title {
  min-width: 190px;
  max-width: 280px;
}

.title-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-title small {
  display: block;
  max-width: 100%;
  margin-top: 2px;
  overflow: hidden;
  font-size: 12.5px;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-status {
  white-space: nowrap;
}

.when {
  display: block;
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.col-result {
  min-width: 190px;
}

.result-bar {
  display: flex;
  height: 6px;
  margin-top: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.result-bar i {
  display: block;
  height: 100%;
}

.seg-ok {
  background: var(--ui-green);
}

.seg-fail {
  background: var(--ui-red);
}

.seg-skip {
  background: var(--ui-faint);
}

.result-text {
  display: block;
  white-space: nowrap;
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.result-text b {
  color: var(--ui-ink);
}

.result-text b.is-bad {
  color: var(--ui-red-ink);
}

.col-act {
  text-align: right;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px 8px;
  font-size: 12.5px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.pagination span {
  margin-right: auto;
}

@media (max-width: 768px) {
  .pagination .btn {
    min-height: 44px;
  }
}
</style>
