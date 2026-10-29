<!--
  LineIntegrationForm.vue

  LINE Messaging API credentials plus the danger zone. Test and save live in the page head
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
        :disabled="saving || testing"
      />
      <template #note>
        更換憑證後請按「測試連線」確認新憑證可用，再儲存變更。
      </template>
    </SettingsGroup>

    <SettingsGroup
      v-if="hasStoredCredentials"
      title="危險操作"
      danger
    >
      <SettingsRow
        label="清除已儲存的憑證"
        hint="清除後無法收發 LINE 訊息，直到重新填入憑證。"
        danger
        end
      >
        <button
          type="button"
          class="btn btn-danger"
          :disabled="saving || testing"
          @click="handleClear"
        >
          清除憑證
        </button>
      </SettingsRow>
    </SettingsGroup>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { MaskedCredential } from '@shared/api-contracts/system'
import type { LineIntegration } from '@/types/system-settings'
import CredentialRow from './CredentialRow.vue'
import SettingsGroup from './SettingsGroup.vue'
import SettingsRow from './SettingsRow.vue'
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
  clear: []
  'update:settings': [value: LineIntegration]
}>()

const FIELDS = [
  { id: 'lineChannelId', key: 'channelId', label: 'Channel ID', hint: 'LINE Developers 主控台的 Channel ID', secret: false, placeholder: '輸入 LINE Channel ID' },
  { id: 'lineChannelSecret', key: 'channelSecret', label: 'Channel Secret', hint: '用於驗證 Webhook 簽章，已加密儲存', secret: true, placeholder: '輸入 LINE Channel Secret' },
  { id: 'lineAccessToken', key: 'accessToken', label: 'Access Token', hint: '長效 Channel access token，用於回覆與推播', secret: true, placeholder: '輸入 LINE Access Token' }
] as const

const localSettings = reactive<LineIntegration>({
  channelId: '',
  channelSecret: '',
  accessToken: '',
  status: 'disconnected'
})

const hasStoredCredentials = computed(() =>
  FIELDS.some(field => props.credentials?.[field.key]?.configured)
)

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

function handleClear() {
  emit('clear')
}
</script>

<style scoped>
.integration-form {
  display: grid;
  gap: 22px;
}
</style>
