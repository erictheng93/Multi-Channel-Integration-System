<!--
  AdvancedSettingsForm.vue

  Advanced system configuration form component
  Manages advanced settings like queue size, timeouts, and feature toggles
-->

<template>
  <div class="advanced-settings-form">
    <h2 class="form-title">
      {{ t('systemSettings.advanced.title') }}
    </h2>
    <p class="form-description">
      {{ t('systemSettings.advanced.description') }}
    </p>

    <form
      class="settings-form"
      @submit.prevent="handleSave"
    >
      <div class="settings-section">
        <h3 class="section-title">
          {{ t('systemSettings.advanced.messaging') }}
        </h3>

        <div class="form-group">
          <label
            for="messageQueueSize"
            class="form-label"
          >
            {{ t('systemSettings.advanced.messageQueueSize') }}
          </label>
          <input
            id="messageQueueSize"
            v-model.number="localSettings.messageQueueSize"
            type="number"
            class="form-input"
            min="10"
            max="1000"
            step="10"
            required
          >
          <p class="form-hint">
            {{ t('systemSettings.advanced.messageQueueSizeHint') }}
          </p>
        </div>

        <div class="form-group">
          <label
            for="messageTimeout"
            class="form-label"
          >
            {{ t('systemSettings.advanced.messageTimeout') }}
          </label>
          <input
            id="messageTimeout"
            v-model.number="localSettings.messageTimeout"
            type="number"
            class="form-input"
            min="1000"
            max="60000"
            step="1000"
            required
          >
          <p class="form-hint">
            {{ t('systemSettings.advanced.messageTimeoutHint') }}
          </p>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="section-title">
          {{ t('systemSettings.advanced.caching') }}
        </h3>

        <div class="form-group">
          <label
            for="cacheExpiry"
            class="form-label"
          >
            {{ t('systemSettings.advanced.cacheExpiry') }}
          </label>
          <input
            id="cacheExpiry"
            v-model.number="localSettings.cacheExpiry"
            type="number"
            class="form-input"
            min="60"
            max="86400"
            step="60"
            required
          >
          <p class="form-hint">
            {{ t('systemSettings.advanced.cacheExpiryHint') }}
          </p>
        </div>

        <div class="form-group">
          <label
            for="sessionExpiry"
            class="form-label"
          >
            {{ t('systemSettings.advanced.sessionExpiry') }}
          </label>
          <input
            id="sessionExpiry"
            v-model.number="localSettings.sessionExpiry"
            type="number"
            class="form-input"
            min="300"
            max="86400"
            step="300"
            required
          >
          <p class="form-hint">
            {{ t('systemSettings.advanced.sessionExpiryHint') }}
          </p>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="section-title">
          {{ t('systemSettings.advanced.features') }}
        </h3>

        <div class="form-group-toggle">
          <label class="toggle-label">
            <input
              v-model="localSettings.enableRateLimit"
              type="checkbox"
              class="toggle-input"
            >
            <span class="toggle-slider" />
            <span class="toggle-text">{{ t('systemSettings.advanced.enableRateLimit') }}</span>
          </label>
          <p class="form-hint">
            {{ t('systemSettings.advanced.enableRateLimitHint') }}
          </p>
        </div>

        <div class="form-group-toggle">
          <label class="toggle-label">
            <input
              v-model="localSettings.enableLogging"
              type="checkbox"
              class="toggle-input"
            >
            <span class="toggle-slider" />
            <span class="toggle-text">{{ t('systemSettings.advanced.enableLogging') }}</span>
          </label>
          <p class="form-hint">
            {{ t('systemSettings.advanced.enableLoggingHint') }}
          </p>
        </div>

        <div class="form-group-toggle">
          <label class="toggle-label">
            <input
              v-model="localSettings.enableMetrics"
              type="checkbox"
              class="toggle-input"
            >
            <span class="toggle-slider" />
            <span class="toggle-text">{{ t('systemSettings.advanced.enableMetrics') }}</span>
          </label>
          <p class="form-hint">
            {{ t('systemSettings.advanced.enableMetricsHint') }}
          </p>
        </div>
      </div>

      <div class="form-actions">
        <button
          type="submit"
          class="btn-primary"
          :disabled="saving"
        >
          <span
            v-if="saving"
            class="spinner"
          />
          {{ saving ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AdvancedSettings } from '@/types/system-settings'

// Props
interface Props {
  settings: AdvancedSettings
  saving: boolean
}

const props = defineProps<Props>()

// Events
const emit = defineEmits<{
  save: []
}>()

// Composables
const { t } = useI18n()

// Local state
const localSettings = reactive<AdvancedSettings>({
  messageQueueSize: 100,
  messageTimeout: 5000,
  cacheExpiry: 3600,
  sessionExpiry: 7200,
  enableRateLimit: true,
  enableLogging: true,
  enableMetrics: true
})

// Watch for prop changes
watch(
  () => props.settings,
  (newSettings) => {
    Object.assign(localSettings, newSettings)
  },
  { immediate: true, deep: true }
)

// Methods
function handleSave() {
  emit('save')
}
</script>

<style scoped>
.advanced-settings-form {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.form-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 0.5rem 0;
}

.form-description {
  font-size: 0.875rem;
  color: #718096;
  margin: 0 0 1.5rem 0;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.settings-section:last-of-type {
  border-bottom: none;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #2d3748;
}

.form-input {
  padding: 0.625rem 0.875rem;
  border: 1px solid #cbd5e0;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.form-hint {
  font-size: 0.8125rem;
  color: #a0aec0;
  margin: 0;
}

.form-group-toggle {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background: #cbd5e0;
  border-radius: 12px;
  transition: background-color 0.2s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  top: 3px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle-input:checked + .toggle-slider {
  background: #4299e1;
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.toggle-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: #2d3748;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.5rem;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #3182ce;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 1rem;
  height: 1rem;
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
