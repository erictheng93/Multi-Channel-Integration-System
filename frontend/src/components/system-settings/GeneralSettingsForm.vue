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
        hint="最多 40 字元"
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
        hint="右側顯示所選時區的目前時間"
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
      <template #note>
        介面語言：繁體中文（目前僅支援）
      </template>
    </SettingsGroup>
  </form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
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

function handleSave() {
  emit('save')
}
</script>

<style scoped>
.general-form {
  display: grid;
  gap: 22px;
}
</style>
