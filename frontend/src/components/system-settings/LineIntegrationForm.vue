<!--
  LineIntegrationForm.vue

  LINE integration configuration form component
  Manages LINE OA credentials and connection testing
-->

<template>
  <div class="line-integration-form">
    <div class="form-header">
      <div>
        <h3 class="integration-title">
          {{ t('systemSettings.integrations.line.title') }}
        </h3>
        <p class="integration-description">
          {{ t('systemSettings.integrations.line.description') }}
        </p>
      </div>
      <div
        class="status-badge"
        :class="statusClass"
      >
        <span class="status-dot" />
        {{ statusText }}
      </div>
    </div>

    <form
      class="integration-form"
      @submit.prevent="handleSave"
    >
      <div class="form-group">
        <label
          for="lineChannelId"
          class="form-label"
        >
          {{ t('systemSettings.integrations.line.channelId') }}
        </label>
        <input
          id="lineChannelId"
          v-model="localSettings.channelId"
          type="text"
          class="form-input"
          :placeholder="t('systemSettings.integrations.line.channelIdPlaceholder')"
          required
        >
      </div>

      <div class="form-group">
        <label
          for="lineChannelSecret"
          class="form-label"
        >
          {{ t('systemSettings.integrations.line.channelSecret') }}
        </label>
        <input
          id="lineChannelSecret"
          v-model="localSettings.channelSecret"
          type="text"
          class="form-input"
          :placeholder="t('systemSettings.integrations.line.channelSecretPlaceholder')"
          required
        >
      </div>

      <div class="form-group">
        <label
          for="lineAccessToken"
          class="form-label"
        >
          {{ t('systemSettings.integrations.line.accessToken') }}
        </label>
        <textarea
          id="lineAccessToken"
          v-model="localSettings.accessToken"
          class="form-textarea"
          rows="3"
          :placeholder="t('systemSettings.integrations.line.accessTokenPlaceholder')"
          required
        />
      </div>

      <div class="form-actions">
        <button
          type="button"
          class="btn-secondary"
          :disabled="testing || saving"
          @click="handleTest"
        >
          <span
            v-if="testing"
            class="spinner"
          />
          {{ testing ? t('common.testing') : t('common.testConnection') }}
        </button>

        <button
          type="button"
          class="btn-danger"
          :disabled="saving || testing"
          @click="handleClear"
        >
          {{ t('common.clearCredentials') }}
        </button>

        <button
          type="submit"
          class="btn-primary"
          :disabled="saving || testing"
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
import { reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LineIntegration } from '@/types/system-settings'

// Props
interface Props {
  settings: LineIntegration
  saving: boolean
  testing: boolean
}

const props = defineProps<Props>()

// Events
const emit = defineEmits<{
  save: []
  test: []
  clear: []
  'update:settings': [value: LineIntegration]
}>()

// Composables
const { t } = useI18n()

// Local state
const localSettings = reactive<LineIntegration>({
  channelId: '',
  channelSecret: '',
  accessToken: '',
  status: 'disconnected'
})

// Watch for prop changes (parent → child)
watch(
  () => props.settings,
  (newSettings) => {
    Object.assign(localSettings, newSettings)
  },
  { immediate: true, deep: true }
)

// Sync local changes back to parent (child → parent)
watch(
  localSettings,
  (newVal) => {
    emit('update:settings', { ...newVal })
  },
  { deep: true }
)

// Computed
const statusClass = computed(() => ({
  'status-connected': props.settings.status === 'connected',
  'status-disconnected': props.settings.status === 'disconnected',
  'status-error': props.settings.status === 'error'
}))

const statusText = computed(() => {
  switch (props.settings.status) {
    case 'connected':
      return t('systemSettings.integrations.status.connected')
    case 'disconnected':
      return t('systemSettings.integrations.status.disconnected')
    case 'error':
      return t('systemSettings.integrations.status.error')
    default:
      return t('systemSettings.integrations.status.disconnected')
  }
})

// Methods
function handleSave() {
  emit('save')
}

function handleTest() {
  emit('test')
}

function handleClear() {
  emit('clear')
}
</script>

<style scoped>
.line-integration-form {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.integration-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 0.25rem 0;
}

.integration-description {
  font-size: 0.875rem;
  color: #718096;
  margin: 0;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
}

.status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
}

.status-connected {
  background: #c6f6d5;
  color: #22543d;
}

.status-connected .status-dot {
  background: #38a169;
}

.status-disconnected {
  background: #e2e8f0;
  color: #4a5568;
}

.status-disconnected .status-dot {
  background: #a0aec0;
}

.status-error {
  background: #fed7d7;
  color: #742a2a;
}

.status-error .status-dot {
  background: #e53e3e;
}

.integration-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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

.form-input,
.form-textarea {
  padding: 0.625rem 0.875rem;
  border: 1px solid #cbd5e0;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
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
