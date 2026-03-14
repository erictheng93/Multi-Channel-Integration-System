<!--
  SettingsHeader.vue

  Page header component for System Settings
  Displays title, subtitle, refresh button, and messages
-->

<template>
  <div class="settings-header">
    <div class="header-content">
      <div class="header-text">
        <h1 class="header-title">
          {{ t('systemSettings.title') }}
        </h1>
        <p class="header-subtitle">
          {{ t('systemSettings.subtitle') }}
        </p>
      </div>
      <button
        class="refresh-button"
        :disabled="loading"
        :title="t('common.refresh')"
        @click="$emit('refresh')"
      >
        <span
          class="refresh-icon"
          :class="{ spinning: loading }"
        >&#x21bb;</span>
        {{ t('common.refresh') }}
      </button>
    </div>

    <div
      v-if="message"
      class="message-banner"
      :class="messageTypeClass"
    >
      <span class="message-icon">{{ messageIcon }}</span>
      <span class="message-text">{{ message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MessageType } from '@/types/system-settings'

// Props
interface Props {
  loading: boolean
  message: string
  messageType: MessageType
}

const props = defineProps<Props>()

// Events
defineEmits<{
  refresh: []
}>()

// Composables
const { t } = useI18n()

// Computed
const messageTypeClass = computed(() => ({
  'message-success': props.messageType === 'success',
  'message-error': props.messageType === 'error',
  'message-info': props.messageType === 'info'
}))

const messageIcon = computed(() => {
  switch (props.messageType) {
    case 'success':
      return ''
    case 'error':
      return ''
    case 'info':
      return ''
    default:
      return ''
  }
})
</script>

<style scoped>
.settings-header {
  margin-bottom: 2rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.header-text {
  flex: 1;
}

.header-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 0.5rem 0;
}

.header-subtitle {
  font-size: 0.95rem;
  color: #718096;
  margin: 0;
}

.refresh-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.refresh-button:hover:not(:disabled) {
  background: #3182ce;
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-icon {
  font-size: 1.25rem;
  display: inline-block;
  transition: transform 0.3s;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.message-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-success {
  background: #c6f6d5;
  color: #22543d;
  border: 1px solid #9ae6b4;
}

.message-error {
  background: #fed7d7;
  color: #742a2a;
  border: 1px solid #fc8181;
}

.message-info {
  background: #bee3f8;
  color: #2c5282;
  border: 1px solid #90cdf4;
}

.message-icon {
  font-size: 1.25rem;
  font-weight: 600;
}

.message-text {
  flex: 1;
}
</style>
