<!--
  GeneralSettingsForm.vue

  General system settings: identity and region. Saved through the page-head 儲存變更 button
  (a submit button pointing at this form by id).
-->

<template>
  <form
    :id="SETTINGS_FORM_ID"
    class="general-form"
    @submit.prevent="handleSave"
  >
    <SettingsGroup title="系統識別">
      <SettingsRow
        label="系統名稱"
        :hint="`顯示在側邊欄與登入頁，${localSettings.systemName.length} / 40 字`"
        for-id="systemName"
      >
        <input
          id="systemName"
          v-model="localSettings.systemName"
          type="text"
          class="ui-input"
          maxlength="40"
          :placeholder="t('systemSettings.general.systemNamePlaceholder')"
          required
        >
      </SettingsRow>
      <SettingsRow
        label="聯絡信箱"
        hint="系統管理員的聯絡窗口"
        for-id="contactEmail"
      >
        <input
          id="contactEmail"
          v-model="localSettings.contactEmail"
          type="email"
          class="ui-input"
          :placeholder="t('systemSettings.general.contactEmailPlaceholder')"
          required
        >
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup title="地區與語言">
      <SettingsRow
        label="時區"
        :hint="`用於顯示時間與報表日期，現在 ${clock.time}`"
        for-id="timezone"
      >
        <select
          id="timezone"
          v-model="localSettings.timezone"
          class="ui-select"
          required
        >
          <option
            v-for="zone in TIMEZONES"
            :key="zone.value"
            :value="zone.value"
          >
            {{ zone.label }}
          </option>
        </select>
      </SettingsRow>
      <SettingsRow
        class="lang-row"
        label="介面語言"
        hint="目前僅提供繁體中文"
        for-id="language"
      >
        <select
          id="language"
          class="ui-select"
        >
          <option value="zh-TW">
            繁體中文
          </option>
        </select>
      </SettingsRow>
    </SettingsGroup>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GeneralSettings } from '@/types/system-settings'
import SettingsGroup from './SettingsGroup.vue'
import SettingsRow from './SettingsRow.vue'
import { SETTINGS_FORM_ID } from './settings-pages'

interface Props {
  settings: GeneralSettings
  saving: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  save: []
  'update:settings': [value: GeneralSettings]
}>()

const { t } = useI18n()

const TIMEZONES = [
  { value: 'Asia/Taipei', label: 'Asia/Taipei (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong Kong (UTC+8)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
  { value: 'UTC', label: 'UTC (UTC+0)' }
]

const localSettings = reactive<GeneralSettings>({
  systemName: '',
  contactEmail: '',
  timezone: '',
  language: ''
})

// Parent -> local
watch(
  () => props.settings,
  (next) => {
    Object.assign(localSettings, next)
  },
  { immediate: true, deep: true }
)

// Local -> parent, so the controller saves what the user typed
watch(
  localSettings,
  (next) => {
    emit('update:settings', { ...next })
  },
  { deep: true }
)

/** The chosen zone's wall time (read once per selection, no ticking timer) */
const clock = computed(() => {
  const timeZone = localSettings.timezone || 'Asia/Taipei'
  try {
    const now = new Date()
    return {
      time: new Intl.DateTimeFormat('zh-TW', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now),
    }
  } catch {
    return { time: '--:--' }
  }
})

function handleSave() {
  emit('save')
}
</script>

<style scoped>
.general-form {
  display: grid;
  gap: 20px;
  align-items: stretch;
  min-width: 0;
}

/* fields sit flat on the white card; the 1px boundary stays (WCAG 1.4.11) */
.general-form :deep(.ui-input),
.general-form :deep(.ui-select) {
  background-color: var(--ui-surface);
}

/* both cards share the column's leftover height: rows spread evenly so no card ends in blank space */
.general-form :deep(.settings-group:last-child .ui-card),
.general-form :deep(.settings-group:first-child .ui-card) {
  display: flex;
  flex-direction: column;
}

.general-form :deep(.srow) {
  flex: 1;
}
</style>
