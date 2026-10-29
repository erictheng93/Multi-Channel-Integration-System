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
      <div class="preview">
        <div
          class="preview-mark"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg>
        </div>
        <div class="preview-text">
          <div class="preview-name">
            {{ localSettings.systemName || '尚未命名' }}
          </div>
          <div class="preview-sub">
            系統名稱預覽
          </div>
        </div>
      </div>
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
        :hint="`目前時間 ${timezoneNow}`"
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

/** The clock in the selected zone, read once per render of the selection (no timers). */
const timezoneNow = computed(() => {
  try {
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone: localSettings.timezone || 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
      .format(new Date())
      .replace(/\//g, '-')
  } catch {
    return '—'
  }
})

function handleSave() {
  emit('save')
}
</script>

<style scoped>
.general-form {
  display: grid;
  gap: 22px;
}

.preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 22px;
}

.preview-mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  background: linear-gradient(160deg, #3d9bff, #0060df);
}

.preview-mark svg {
  width: 24px;
  height: 24px;
  fill: #fff;
}

.preview-text {
  min-width: 0;
}

.preview-name {
  overflow: hidden;
  font: 600 16px var(--ui-font-display);
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-sub {
  font-size: 13px;
  color: var(--ui-muted);
}

.preview + :deep(.srow)::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  left: 22px;
  height: 0.5px;
  background: var(--ui-sep);
}
</style>
