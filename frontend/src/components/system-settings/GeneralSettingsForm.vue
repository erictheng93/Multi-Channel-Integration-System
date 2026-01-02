<!--
  GeneralSettingsForm.vue

  General system settings form component
  Manages basic system configuration
-->

<template>
  <div class="general-settings-form">
    <h2 class="form-title">{{ t('systemSettings.general.title') }}</h2>
    <p class="form-description">{{ t('systemSettings.general.description') }}</p>

    <form @submit.prevent="handleSave" class="settings-form">
      <div class="form-group">
        <label for="systemName" class="form-label">
          {{ t('systemSettings.general.systemName') }}
        </label>
        <input
          id="systemName"
          v-model="localSettings.systemName"
          type="text"
          class="form-input"
          :placeholder="t('systemSettings.general.systemNamePlaceholder')"
          required
        />
      </div>

      <div class="form-group">
        <label for="contactEmail" class="form-label">
          {{ t('systemSettings.general.contactEmail') }}
        </label>
        <input
          id="contactEmail"
          v-model="localSettings.contactEmail"
          type="email"
          class="form-input"
          :placeholder="t('systemSettings.general.contactEmailPlaceholder')"
          required
        />
      </div>

      <div class="form-group">
        <label for="timezone" class="form-label">
          {{ t('systemSettings.general.timezone') }}
        </label>
        <select
          id="timezone"
          v-model="localSettings.timezone"
          class="form-select"
          required
        >
          <option value="Asia/Taipei">Asia/Taipei (UTC+8)</option>
          <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
          <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
          <option value="Asia/Hong_Kong">Asia/Hong Kong (UTC+8)</option>
          <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
          <option value="UTC">UTC (UTC+0)</option>
        </select>
      </div>

      <div class="form-group">
        <label for="language" class="form-label">
          {{ t('systemSettings.general.language') }}
        </label>
        <select
          id="language"
          v-model="localSettings.language"
          class="form-select"
          required
        >
          <option value="zh-TW">繁體中文</option>
          <option value="zh-CN">简体中文</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
        </select>
      </div>

      <div class="form-actions">
        <button
          type="submit"
          class="btn-primary"
          :disabled="saving"
        >
          <span v-if="saving" class="spinner"></span>
          {{ saving ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GeneralSettings } from '@/types/system-settings'

// Props
interface Props {
  settings: GeneralSettings
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
const localSettings = reactive<GeneralSettings>({
  systemName: '',
  contactEmail: '',
  timezone: '',
  language: ''
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
.general-settings-form {
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
.form-select {
  padding: 0.625rem 0.875rem;
  border: 1px solid #cbd5e0;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
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
