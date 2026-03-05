<!--
  SystemHealthPage.vue
  Health check page: injects controller, displays system health status
-->

<template>
  <div class="health-page">
    <div class="health-header">
      <h3 class="health-title">
        {{ t('systemSettings.system.maintenance.systemTitle') }}
      </h3>
      <p class="health-description">
        {{ t('systemSettings.system.maintenance.systemDescription') }}
      </p>
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
        <span class="action-label">{{ t('systemSettings.system.maintenance.healthCheck') }}</span>
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

.health-action {
  display: flex;
}

.health-button {
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
  background: #48bb78;
  color: white;
  flex: 1;
  max-width: 300px;
}

.health-button:hover:not(:disabled) {
  background: #38a169;
}

.health-button:disabled {
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
</style>
