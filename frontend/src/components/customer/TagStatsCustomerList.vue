<template>
  <div class="tag-stats-customer-list">
    <HamsterLoader
      v-if="loading"
      message="載入客戶列表中..."
    />

    <div
      v-else-if="error"
      class="error-state"
    >
      <svg
        class="error-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <p class="error-message">
        {{ error }}
      </p>
    </div>

    <div
      v-else-if="customers.length === 0"
      class="empty-stats"
    >
      <svg
        class="empty-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      <p class="empty-message">
        尚無客戶使用此標籤
      </p>
      <p class="empty-description">
        為客戶添加此標籤後，列表將會顯示在這裡
      </p>
    </div>

    <div
      v-else
      class="customers-list"
    >
      <div
        v-for="customer in customers"
        :key="customer.id"
        class="customer-row"
      >
        <div class="customer-avatar">
          <img
            v-if="customer.avatar_url"
            :src="customer.avatar_url"
            :alt="customer.display_name"
          >
          <div
            v-else
            class="avatar-placeholder"
          >
            {{ customer.display_name.charAt(0).toUpperCase() }}
          </div>
        </div>
        <div class="customer-info">
          <div class="customer-name">
            {{ customer.display_name }}
          </div>
          <div class="customer-meta">
            <span
              class="platform-badge"
              :class="customer.platform"
            >
              {{ customer.platform === 'line' ? 'LINE' : 'Facebook' }}
            </span>
            <span class="meta-separator">•</span>
            <span class="assigned-date">
              標記於 {{ formatDate(customer.assigned_at) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="pagination && pagination.totalPages > 1"
        class="pagination"
      >
        <button
          class="pagination-btn"
          :disabled="pagination.page === 1"
          @click="$emit('page-change', pagination!.page - 1)"
        >
          上一頁
        </button>
        <span class="pagination-info">
          第 {{ pagination.page }} / {{ pagination.totalPages }} 頁
        </span>
        <button
          class="pagination-btn"
          :disabled="pagination.page === pagination.totalPages"
          @click="$emit('page-change', pagination!.page + 1)"
        >
          下一頁
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TagCustomer } from '@/api/tags'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'

defineProps<{
  loading: boolean
  error: string | null
  customers: TagCustomer[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  } | null
}>()

defineEmits<{
  'page-change': [page: number]
}>()

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}
</script>

<style scoped>
.error-state {
  text-align: center;
  padding: var(--space-12) var(--space-6);
}

.error-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto var(--space-4);
  color: var(--danger-500);
}

.error-message {
  margin: 0;
  font-size: 0.875rem;
  color: var(--gray-700);
}

.empty-stats {
  text-align: center;
  padding: var(--space-12) var(--space-6);
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto var(--space-4);
  color: var(--gray-300);
}

.empty-message {
  margin: 0 0 var(--space-2) 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-700);
}

.empty-description {
  margin: 0;
  font-size: 0.875rem;
  color: var(--gray-500);
}

.customers-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.customer-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.customer-row:hover {
  border-color: var(--gray-300);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.customer-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--gray-100);
}

.customer-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  font-weight: 700;
  font-size: 1.25rem;
}

.customer-info {
  flex: 1;
  min-width: 0;
}

.customer-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: var(--space-1);
}

.customer-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.8125rem;
  color: var(--gray-600);
}

.platform-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 600;
}

.platform-badge.line {
  background: #06C755;
  color: white;
}

.platform-badge.facebook {
  background: #1877F2;
  color: white;
}

.meta-separator {
  color: var(--gray-400);
}

.assigned-date {
  color: var(--gray-500);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-4);
  margin-top: var(--space-4);
}

.pagination-btn {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-lg);
  background: white;
  color: var(--gray-700);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pagination-btn:hover:not(:disabled) {
  background: var(--gray-50);
  border-color: var(--gray-400);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 500;
}
</style>
