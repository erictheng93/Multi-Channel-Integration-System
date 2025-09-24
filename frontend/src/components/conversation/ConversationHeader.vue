<template>
  <!-- Extracted Header Component - Simplified -->
  <div class="conversation-header">
    <div class="header-left">
      <button
        class="back-button"
        @click="$emit('back')"
      >
        <ArrowLeftIcon />
        返回列表
      </button>

      <div class="conversation-info">
        <div class="customer-details">
          <div class="customer-avatar">
            {{ customerInitials }}
          </div>
          <div class="customer-meta">
            <h1 class="customer-name">
              {{ conversation?.customer?.name || '載入中...' }}
            </h1>
            <div class="customer-badges">
              <PlatformBadge
                v-if="conversation"
                :platform="conversation.platform || 'unknown'"
                show-icon
              />
              <StatusBadge
                v-if="conversation"
                :status="conversation.status"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="header-actions">
      <button
        v-if="conversation?.status !== 'closed'"
        class="close-conversation-btn"
        :disabled="closing"
        @click="$emit('close')"
      >
        <XCircleIcon />
        <span>{{ closing ? '結束中...' : '結束對話' }}</span>
      </button>

      <button
        class="btn btn-secondary"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        <RefreshIcon :spinning="loading" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeftIcon, XCircleIcon, RefreshIcon } from '@/components/icons'
import PlatformBadge from '../ui/PlatformBadge.vue'
import StatusBadge from '../ui/StatusBadge.vue'
import type { Conversation } from '@/types'

interface Props {
  conversation?: Conversation
  loading?: boolean
  closing?: boolean
}

const props = defineProps<Props>()

defineEmits<{
  back: []
  close: []
  refresh: []
}>()

const customerInitials = computed(() => {
  const name = props.conversation?.customer?.name
  if (!name) {return '?'}
  return name.slice(0, 2).toUpperCase()
})
</script>

<style scoped>
.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--background-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  background: var(--background-color);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.back-button:hover {
  background: var(--hover-color);
}

.customer-details {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.customer-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
}

.customer-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.customer-badges {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.close-conversation-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--danger-color);
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.close-conversation-btn:hover:not(:disabled) {
  background: var(--danger-color-hover);
}

.close-conversation-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  background: var(--background-color);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover:not(:disabled) {
  background: var(--hover-color);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>