<!--
  AdvancedSettingsForm.vue

  Advanced system configuration: message handling, caching and feature switches.
  Saved through the page-head 儲存變更 button (submit button pointing at this form by id).
-->

<template>
  <form
    :id="SETTINGS_FORM_ID"
    class="advanced-form"
    @submit.prevent="handleSave"
  >
    <SettingsGroup :title="t('systemSettings.advanced.messaging')">
      <SettingsRow
        :label="t('systemSettings.advanced.messageQueueSize')"
        :hint="t('systemSettings.advanced.messageQueueSizeHint')"
        for-id="messageQueueSize"
      >
        <input
          id="messageQueueSize"
          v-model.number="localSettings.messageQueueSize"
          type="number"
          class="ui-input"
          min="10"
          max="1000"
          step="10"
          required
        >
      </SettingsRow>
      <SettingsRow
        :label="t('systemSettings.advanced.messageTimeout')"
        :hint="t('systemSettings.advanced.messageTimeoutHint')"
        for-id="messageTimeout"
      >
        <input
          id="messageTimeout"
          v-model.number="messageTimeoutSeconds"
          type="number"
          class="ui-input"
          min="1"
          max="300"
          step="1"
          required
        >
      </SettingsRow>
      <SettingsRow
        :label="t('systemSettings.advanced.recallWindow.label')"
        :hint="t('systemSettings.advanced.recallWindow.hint')"
        for-id="recallWindowSeconds"
      >
        <select
          id="recallWindowSeconds"
          v-model.number="localSettings.recallWindowSeconds"
          class="ui-select"
        >
          <option
            v-for="option in recallWindowOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup :title="t('systemSettings.advanced.caching')">
      <SettingsRow
        :label="t('systemSettings.advanced.cacheExpiry')"
        :hint="t('systemSettings.advanced.cacheExpiryHint')"
        for-id="cacheExpiry"
      >
        <input
          id="cacheExpiry"
          v-model.number="cacheExpiryMinutes"
          type="number"
          class="ui-input"
          min="1"
          max="1440"
          step="1"
          required
        >
      </SettingsRow>
      <SettingsRow
        :label="t('systemSettings.advanced.sessionExpiry')"
        :hint="t('systemSettings.advanced.sessionExpiryHint')"
        for-id="sessionExpiry"
      >
        <input
          id="sessionExpiry"
          v-model.number="sessionExpiryHours"
          type="number"
          class="ui-input"
          min="1"
          max="168"
          step="1"
          required
        >
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup :title="t('systemSettings.advanced.features')">
      <SettingsRow
        v-for="toggle in toggles"
        :key="toggle.key"
        :label="t(`systemSettings.advanced.${toggle.key}`)"
        :hint="t(`systemSettings.advanced.${toggle.key}Hint`)"
        end
      >
        <button
          type="button"
          class="ui-switch"
          role="switch"
          :aria-checked="localSettings[toggle.key]"
          :aria-label="t(`systemSettings.advanced.${toggle.key}`)"
          @click="localSettings[toggle.key] = !localSettings[toggle.key]"
        />
      </SettingsRow>
    </SettingsGroup>
  </form>
</template>

<script setup lang="ts">
import { reactive, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AdvancedSettings } from '@/types/system-settings'
import SettingsGroup from './SettingsGroup.vue'
import SettingsRow from './SettingsRow.vue'
import { SETTINGS_FORM_ID } from './settings-pages'

// Props
interface Props {
  settings: AdvancedSettings
  saving: boolean
}

const props = defineProps<Props>()

// Events
const emit = defineEmits<{
  save: [settings: AdvancedSettings]
  'update:settings': [settings: AdvancedSettings]
}>()

// Composables
const { t } = useI18n()

// 撤回窗口選項（值需與後端 RECALL_WINDOW_ALLOWED_VALUES 一致）
const recallWindowOptions = computed(() => [
  { value: 0, label: t('systemSettings.advanced.recallWindow.off') },
  { value: 5, label: t('systemSettings.advanced.recallWindow.s5') },
  { value: 10, label: t('systemSettings.advanced.recallWindow.s10') },
  { value: 15, label: t('systemSettings.advanced.recallWindow.s15') },
  { value: 30, label: t('systemSettings.advanced.recallWindow.s30') },
  { value: 60, label: t('systemSettings.advanced.recallWindow.m1') },
  { value: 120, label: t('systemSettings.advanced.recallWindow.m2') },
  { value: 300, label: t('systemSettings.advanced.recallWindow.m5') }
])

const toggles = [
  { key: 'enableRateLimit' },
  { key: 'enableLogging' },
  { key: 'enableMetrics' }
] as const

// Local state
const localSettings = reactive<AdvancedSettings>({
  messageQueueSize: 100,
  messageTimeout: 30000,
  cacheExpiry: 3600,
  sessionExpiry: 86400,
  enableRateLimit: true,
  enableLogging: true,
  enableMetrics: true,
  recallWindowSeconds: 0
})

const messageTimeoutSeconds = computed({
  get: () => localSettings.messageTimeout / 1000,
  set: (value: number) => {
    localSettings.messageTimeout = value * 1000
  }
})

const cacheExpiryMinutes = computed({
  get: () => localSettings.cacheExpiry / 60,
  set: (value: number) => {
    localSettings.cacheExpiry = value * 60
  }
})

const sessionExpiryHours = computed({
  get: () => localSettings.sessionExpiry / 3600,
  set: (value: number) => {
    localSettings.sessionExpiry = value * 3600
  }
})

// Watch for prop changes
watch(
  () => props.settings,
  (newSettings) => {
    Object.assign(localSettings, newSettings)
  },
  { immediate: true, deep: true }
)

// Local -> parent, so the page can tell whether anything changed (save stays disabled until then)
watch(
  localSettings,
  (next) => {
    emit('update:settings', { ...next })
  },
  { deep: true }
)

// Methods
function handleSave() {
  // Pass the local edits out — the parent controller merges them before
  // persisting (the prop object is a clone; edits don't flow back on their own)
  emit('save', { ...localSettings })
}
</script>

<style scoped>
.advanced-form {
  display: grid;
  gap: 22px;
}
</style>
