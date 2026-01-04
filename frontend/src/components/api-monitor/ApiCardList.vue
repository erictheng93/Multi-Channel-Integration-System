<template>
  <div class="api-card-list-container">
    <div class="list-header">
      <h2 class="list-title">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect
            width="20"
            height="14"
            x="2"
            y="3"
            rx="2"
          />
          <line
            x1="8"
            y1="21"
            x2="16"
            y2="21"
          />
          <line
            x1="12"
            y1="17"
            x2="12"
            y2="21"
          />
          <path d="M7 13h5l2-4 2 4h1" />
        </svg>
        API 端點監控 ({{ apis.length }})
      </h2>
    </div>

    <div class="list-body">
      <ApiEmptyState
        v-if="apis.length === 0"
        title="未找到匹配的API"
        message="請調整篩選條件或搜索關鍵詞"
      />

      <div
        v-else
        class="api-grid"
      >
        <ApiCard
          v-for="api in apis"
          :key="api.id"
          :api="api"
          :expanded="expandedCard === api.id"
          @toggle="$emit('card-click', api.id)"
          @test="$emit('test', $event)"
          @view-logs="$emit('view-logs', $event)"
          @view-docs="$emit('view-docs', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiEndpoint } from '@/types/api-monitor'
import ApiCard from './ApiCard.vue'
import ApiEmptyState from './ApiEmptyState.vue'

interface Props {
  apis: ApiEndpoint[]
  expandedCard: string | null
}

interface Emits {
  (_e: 'card-click', _id: string): void
  (_e: 'test', _api: ApiEndpoint): void
  (_e: 'view-logs', _api: ApiEndpoint): void
  (_e: 'view-docs', _api: ApiEndpoint): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<style scoped>
.api-card-list-container {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.list-header {
  padding: 2rem;
  border-bottom: 1px solid #f1f5f9;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.list-title {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.list-title svg {
  color: #667eea;
}

.list-body {
  padding: 2rem;
}

.api-grid {
  display: grid;
  gap: 16px;
}

/* Responsive */
@media (max-width: 768px) {
  .list-header {
    padding: 1.5rem;
  }

  .list-title {
    font-size: 1.25rem;
  }

  .list-body {
    padding: 1rem;
  }

  .api-grid {
    gap: 12px;
  }
}
</style>
