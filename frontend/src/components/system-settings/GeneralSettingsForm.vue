<!--
  GeneralSettingsForm.vue

  General system settings: name, contact and language. The time zone select lives in the day ribbon above
  (it is attached to this form by id), so a change anywhere counts as one dirty form. Saved through the
  floating 儲存變更 bar (a submit button pointing at this form by id).
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
        :hint="`系統的顯示名稱，${localSettings.systemName.length} / 40 字`"
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
      <SettingsRow
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
  min-width: 0;
}

/* fields sit flat on the white card; the 1px boundary stays (WCAG 1.4.11) */
.general-form :deep(.ui-input),
.general-form :deep(.ui-select) {
  background-color: var(--ui-surface);
}

/* controls stay a readable width so hints keep one line */
.general-form :deep(.srow-c) {
  width: min(300px, 100%);
}

@media (max-width: 768px) {
  .general-form :deep(.srow-c) {
    width: 100%;
  }
}

/* the card takes the column's height and its rows share it, so it ends level with the list beside it */
.general-form :deep(.settings-group) {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.general-form :deep(.ui-card) {
  display: flex;
  flex-direction: column;
}

.general-form :deep(.srow) {
  flex: 1;
}
</style>
