<!--
  LineIntegrationForm.vue

  LINE Messaging API credentials (the danger zone is LineDangerZone, placed last by the page). Test and save live in the page head
  (the save button submits this form by id). Stored values are never shown: only 已設定 ••••last4.
-->

<template>
  <form
    :id="SETTINGS_FORM_ID"
    class="integration-form"
    @submit.prevent="handleSave"
  >
    <SettingsGroup title="Messaging API 憑證">
      <CredentialRow
        v-for="field in FIELDS"
        :key="field.key"
        v-model="localSettings[field.key]"
        :label="field.label"
        :hint="field.hint"
        :input-id="field.id"
        :configured="credentials?.[field.key]?.configured ?? false"
        :last4="credentials?.[field.key]?.last4 ?? null"
        :secret="field.secret"
        :placeholder="field.placeholder"
        :icon="field.icon"
        :disabled="saving || testing"
      />
      <template #note>
        更換憑證後請按「測試連線」確認新憑證可用，再儲存變更。
      </template>
    </SettingsGroup>
  </form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { MaskedCredential } from '@shared/api-contracts/system'
import type { LineIntegration } from '@/types/system-settings'
import CredentialRow from './CredentialRow.vue'
import SettingsGroup from './SettingsGroup.vue'
import { SETTINGS_FORM_ID } from './settings-pages'

interface Props {
  settings: LineIntegration
  /** Server-reported credential state (configured / last4) */
  credentials?: Record<'channelId' | 'channelSecret' | 'accessToken', MaskedCredential>
  saving: boolean
  testing: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  save: []
  'update:settings': [value: LineIntegration]
}>()

const FIELDS = [
  { id: 'lineChannelId', key: 'channelId', label: 'Channel ID', hint: 'Basic settings 分頁，頻道的識別碼', secret: false, placeholder: '輸入 LINE Channel ID', icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8 11h4M8 15h8"/>' },
  { id: 'lineChannelSecret', key: 'channelSecret', label: 'Channel Secret', hint: 'Basic settings 分頁，驗證 Webhook 簽章用', secret: true, placeholder: '輸入 LINE Channel Secret', icon: '<path d="M12 3 4 6v6c0 4.4 3.4 8 8 9 4.6-1 8-4.6 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>' },
  { id: 'lineAccessToken', key: 'accessToken', label: 'Access Token', hint: 'Messaging API 分頁，長效 Channel access token', secret: true, placeholder: '輸入 LINE Access Token', icon: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>' }
] as const

const localSettings = reactive<LineIntegration>({
  channelId: '',
  channelSecret: '',
  accessToken: '',
  status: 'disconnected'
})

// Parent -> local
watch(
  () => props.settings,
  (next) => {
    Object.assign(localSettings, next)
  },
  { immediate: true, deep: true }
)

// Local -> parent
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
.integration-form {
  display: grid;
  gap: 22px;
}
</style>
