<!--
  SystemHealthPage.vue
  Health check page: displays system health status with per-component results
-->

<template>
  <div class="health-page">
    <div class="health-header">
      <h3 class="health-title">
        {{ t('systemSettings.systemManagement.system.title') }}
      </h3>
      <p class="health-description">
        {{ t('systemSettings.systemManagement.system.description') }}
      </p>
    </div>

    <!-- Component Results List -->
    <ul
      v-if="controller.healthCheckResults.value.length > 0"
      class="health-results"
    >
      <li
        v-for="item in controller.healthCheckResults.value"
        :key="item.name"
        class="health-result-item"
      >
        <span :class="['status-dot', `status-${item.status}`]" />
        <span class="result-name">{{ item.name }}</span>
        <span :class="['result-status', `text-${item.status}`]">
          {{ statusLabel(item.status) }}
        </span>
        <span
          v-if="item.responseTime != null"
          class="result-time"
        >
          {{ item.responseTime }}ms
        </span>
      </li>
    </ul>

    <!-- Overall Status -->
    <div
      v-if="controller.healthOverall.value"
      class="health-overall"
    >
      <span :class="['overall-badge', `badge-${controller.healthOverall.value.status}`]">
        {{ overallLabel(controller.healthOverall.value.status) }}
      </span>
      <span class="overall-message">{{ controller.healthOverall.value.message }}</span>
    </div>

    <div class="health-action">
      <button
        class="health-button"
        :disabled="controller.processing.value"
        @click="controller.healthCheck"
      >
        <span
          v-if="controller.processing.value"
          class="spinner"
        />
        <span
          v-else
          class="action-icon"
        >🏥</span>
        <span class="action-label">{{ t('systemSettings.systemManagement.system.healthCheck') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'

const { t } = useI18n()

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}

function statusLabel(status: string): string {
  switch (status) {
    case 'healthy': return '正常'
    case 'warning': return '警告'
    case 'critical': return '異常'
    default: return '未知'
  }
}

function overallLabel(status: string): string {
  switch (status) {
    case 'healthy': return '系統正常'
    case 'warning': return '部分降級'
    case 'critical': return '系統異常'
    default: return '未知狀態'
  }
}
</script>

<style scoped>
.health-page {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.health-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.health-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 0.25rem 0;
}

.health-description {
  font-size: 0.875rem;
  color: #718096;
  margin: 0;
}

/* Results List */
.health-results {
  list-style: none;
  padding: 0;
  margin: 0 0 1.25rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.health-result-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #f7fafc;
  border-radius: 0.375rem;
  border: 1px solid #e2e8f0;
}

.status-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-healthy { background: #48bb78; }
.status-warning { background: #ecc94b; }
.status-critical { background: #f56565; }
.status-unknown { background: #a0aec0; }

.result-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #2d3748;
  flex: 1;
}

.result-status {
  font-size: 0.8125rem;
  font-weight: 600;
}

.text-healthy { color: #38a169; }
.text-warning { color: #d69e2e; }
.text-critical { color: #e53e3e; }
.text-unknown { color: #718096; }

.result-time {
  font-size: 0.75rem;
  color: #a0aec0;
  font-variant-numeric: tabular-nums;
  min-width: 3.5rem;
  text-align: right;
}

/* Overall Status */
.health-overall {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
}

.overall-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  white-space: nowrap;
}

.badge-healthy { background: #c6f6d5; color: #276749; }
.badge-warning { background: #fefcbf; color: #975a16; }
.badge-critical { background: #fed7d7; color: #9b2c2c; }

.overall-message {
  font-size: 0.8125rem;
  color: #4a5568;
}

/* Action Button */
.health-action {
  display: flex;
}

.health-button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: #48bb78;
  color: white;
}

.health-button:hover:not(:disabled) {
  background: #38a169;
}

.health-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-icon {
  font-size: 1.125rem;
}

.action-label {
  text-align: center;
}

.spinner {
  width: 1.125rem;
  height: 1.125rem;
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
</style>
