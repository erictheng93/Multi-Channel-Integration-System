<!--
  CacheManager.vue

  System maintenance and cache management component
  Handles cache clearing, health checks, and system restart
-->

<template>
  <div class="cache-manager">
    <div class="manager-header">
      <div>
        <h3 class="manager-title">
          {{ t('systemSettings.system.maintenance.title') }}
        </h3>
        <p class="manager-description">
          {{ t('systemSettings.system.maintenance.description') }}
        </p>
      </div>
    </div>

    <div class="maintenance-section">
      <h4 class="section-title">
        {{ t('systemSettings.system.maintenance.cacheTitle') }}
      </h4>
      <p class="section-description">
        {{ t('systemSettings.system.maintenance.cacheDescription') }}
      </p>

      <div class="cache-actions">
        <button
          class="cache-button"
          :disabled="processing"
          @click="handleClearCache('all')"
        >
          <span class="cache-icon">🗑️</span>
          <span class="cache-label">{{ t('systemSettings.system.maintenance.clearAll') }}</span>
        </button>

        <button
          class="cache-button"
          :disabled="processing"
          @click="handleClearCache('conversations')"
        >
          <span class="cache-icon">💬</span>
          <span class="cache-label">{{ t('systemSettings.system.maintenance.clearConversations') }}</span>
        </button>

        <button
          class="cache-button"
          :disabled="processing"
          @click="handleClearCache('messages')"
        >
          <span class="cache-icon">✉️</span>
          <span class="cache-label">{{ t('systemSettings.system.maintenance.clearMessages') }}</span>
        </button>

        <button
          class="cache-button"
          :disabled="processing"
          @click="handleClearCache('sessions')"
        >
          <span class="cache-icon">🔑</span>
          <span class="cache-label">{{ t('systemSettings.system.maintenance.clearSessions') }}</span>
        </button>
      </div>
    </div>

    <div class="maintenance-section">
      <h4 class="section-title">
        {{ t('systemSettings.system.maintenance.systemTitle') }}
      </h4>
      <p class="section-description">
        {{ t('systemSettings.system.maintenance.systemDescription') }}
      </p>

      <div class="system-actions">
        <button
          class="action-button health-button"
          :disabled="processing"
          @click="handleHealthCheck"
        >
          <span
            v-if="processing"
            class="spinner"
          />
          <span
            v-else
            class="action-icon"
          >🏥</span>
          <span class="action-label">{{ t('systemSettings.system.maintenance.healthCheck') }}</span>
        </button>

        <button
          class="action-button restart-button"
          :disabled="processing"
          @click="handleRestart"
        >
          <span
            v-if="processing"
            class="spinner"
          />
          <span
            v-else
            class="action-icon"
          >🔄</span>
          <span class="action-label">{{ t('systemSettings.system.maintenance.restart') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CacheType } from '@/types/system-settings'

// Props
interface Props {
  processing: boolean
}

defineProps<Props>()

// Events
const emit = defineEmits<{
  'clear-cache': [type: CacheType]
  'health-check': []
  restart: []
}>()

// Composables
const { t } = useI18n()

// Methods
function handleClearCache(type: CacheType) {
  emit('clear-cache', type)
}

function handleHealthCheck() {
  emit('health-check')
}

function handleRestart() {
  emit('restart')
}
</script>

<style scoped>
.cache-manager {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.manager-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.manager-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 0.25rem 0;
}

.manager-description {
  font-size: 0.875rem;
  color: #718096;
  margin: 0;
}

.maintenance-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.maintenance-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 0.25rem 0;
}

.section-description {
  font-size: 0.8125rem;
  color: #718096;
  margin: 0 0 1rem 0;
}

.cache-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
}

.cache-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.cache-button:hover:not(:disabled) {
  background: #edf2f7;
  border-color: #cbd5e0;
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.cache-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cache-icon {
  font-size: 1.5rem;
}

.cache-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #2d3748;
  text-align: center;
}

.system-actions {
  display: flex;
  gap: 1rem;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}

.health-button {
  background: #48bb78;
  color: white;
}

.health-button:hover:not(:disabled) {
  background: #38a169;
}

.restart-button {
  background: #f56565;
  color: white;
}

.restart-button:hover:not(:disabled) {
  background: #e53e3e;
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-icon {
  font-size: 1.25rem;
}

.action-label {
  flex: 1;
  text-align: center;
}

.spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid #ffffff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .cache-actions {
    grid-template-columns: repeat(2, 1fr);
  }

  .system-actions {
    flex-direction: column;
  }
}
</style>
