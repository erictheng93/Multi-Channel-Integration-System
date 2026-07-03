<template>
  <section
    class="history-card"
    aria-labelledby="broadcast-history-title"
  >
    <div class="section-heading">
      <h2 id="broadcast-history-title">
        群發紀錄
      </h2>
      <button
        class="btn btn-secondary btn-sm"
        type="button"
        @click="$emit('refresh')"
      >
        重新整理
      </button>
    </div>

    <div
      v-if="loading"
      class="state"
    >
      載入群發紀錄中...
    </div>
    <div
      v-else-if="broadcasts.length === 0"
      class="state"
    >
      尚未建立群發。
    </div>
    <div
      v-else
      class="table-wrap"
    >
      <table>
        <thead>
          <tr>
            <th>活動</th>
            <th>狀態</th>
            <th>收件人</th>
            <th>成功</th>
            <th>失敗</th>
            <th>略過</th>
            <th>發送時間</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="broadcast in broadcasts"
            :key="broadcast.id"
          >
            <td>
              <strong>{{ broadcast.title }}</strong>
              <small>{{ broadcast.content }}</small>
            </td>
            <td>
              <span
                class="status-pill"
                :data-status="broadcast.status"
              >{{ statusLabel(broadcast.status) }}</span>
            </td>
            <td>{{ broadcast.totalRecipients }}</td>
            <td>{{ broadcast.sentCount }}</td>
            <td>{{ broadcast.failedCount }}</td>
            <td>{{ broadcast.skippedCount }}</td>
            <td>{{ formatDate(broadcast.sentAt || broadcast.createdAt) }}</td>
            <td>
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

      <nav
        v-if="pagination && pagination.totalPages > 1"
        class="pagination"
        aria-label="群發紀錄分頁"
      >
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="pagination.page <= 1"
          data-testid="history-prev-page"
          @click="$emit('page-change', pagination.page - 1)"
        >
          上一頁
        </button>
        <span>第 {{ pagination.page }} / {{ pagination.totalPages }} 頁，共 {{ pagination.total }} 筆</span>
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

function formatDate(value: string | null): string {
  if (!value) {return '-'}
  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}
</script>

<style scoped>
.history-card {
  background: #fff;
  border-radius: 16px;
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.section-heading h2 {
  margin: 0;
  font-size: var(--text-xl);
}

.state {
  padding: var(--space-8);
  color: var(--gray-500);
  text-align: center;
}

.table-wrap {
  overflow-x: auto;
  margin-top: var(--space-4);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: var(--space-3);
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid #f2f2f7;
}

th {
  color: var(--gray-500);
  font-size: var(--text-sm);
  font-weight: 600;
}

td small {
  display: block;
  max-width: 28rem;
  color: var(--gray-500);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-pill {
  display: inline-flex;
  padding: var(--space-1) var(--space-3);
  border-radius: 999px;
  background: #f2f2f7;
  font-size: var(--text-sm);
  font-weight: 600;
}

.status-pill[data-status='completed'] {
  color: #1f7a4d;
}

.status-pill[data-status='partial_failed'],
.status-pill[data-status='failed'] {
  color: #ff3b30;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-4);
  color: var(--gray-500);
  font-size: var(--text-sm);
}
</style>
