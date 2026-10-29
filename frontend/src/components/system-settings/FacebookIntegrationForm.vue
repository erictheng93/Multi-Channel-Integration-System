<!--
  FacebookIntegrationForm.vue

  Facebook Messenger credentials plus the danger zone. Test and save live in the page head
  (the save button submits this form by id). Stored values are never shown: only 已設定 ••••last4.
-->

<template>
  <form
    :id="SETTINGS_FORM_ID"
    class="integration-form"
    @submit.prevent="handleSave"
  >
    <SettingsGroup title="Messenger 憑證">
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
    >
      <SettingsRow
        label="清除已儲存的憑證"
        hint="清除後無法收發 Messenger 訊息，直到重新填入憑證。"
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
import type { FacebookIntegration } from '@/types/system-settings'
import CredentialRow from './CredentialRow.vue'
import SettingsGroup from './SettingsGroup.vue'
import SettingsRow from './SettingsRow.vue'
import { SETTINGS_FORM_ID } from './settings-pages'

interface Props {
  settings: FacebookIntegration
  /** Server-reported credential state (configured / last4) */
  credentials?: Record<'appId' | 'appSecret' | 'pageId' | 'pageToken', MaskedCredential>
  saving: boolean
  testing: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  save: []
  clear: []
  'update:settings': [value: FacebookIntegration]
}>()

const FIELDS = [
  { id: 'facebookAppId', key: 'appId', label: 'App ID', hint: 'Meta for Developers 應用程式編號', secret: false, placeholder: '輸入 Facebook App ID' },
  { id: 'facebookAppSecret', key: 'appSecret', label: 'App Secret', hint: '用於驗證 Webhook 簽章，已加密儲存', secret: true, placeholder: '輸入 Facebook App Secret' },
  { id: 'facebookPageId', key: 'pageId', label: 'Page ID', hint: '接收訊息的粉絲專頁編號', secret: false, placeholder: '輸入 Facebook Page ID' },
  { id: 'facebookPageToken', key: 'pageToken', label: 'Page Token', hint: '粉絲專頁存取權杖，用於回覆訊息', secret: true, placeholder: '輸入 Facebook Page Token' }
] as const

const localSettings = reactive<FacebookIntegration>({
  appId: '',
  appSecret: '',
  pageId: '',
  pageToken: '',
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
