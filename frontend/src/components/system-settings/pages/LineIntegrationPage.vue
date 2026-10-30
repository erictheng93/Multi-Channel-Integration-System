<!--
  LineIntegrationPage.vue
  Connection summary, message quota and credentials for the LINE official account.
  Desktop: two columns that end together (status + credentials | quota + webhook), danger zone full width last.
  Phone: one column in reading order, danger zone always the last block.
-->

<template>
  <div class="line-page">
    <RingLead
      class="lead"
      kicker="連線狀態"
      :value="statusLabel"
      :meaning="testMeta"
    >
      <span
        v-if="lastTest"
        class="ui-pill ui-pill-dot lead-pill"
        :class="lastTest.status === 'success' ? 'ui-pill-green' : 'ui-pill-red'"
      >{{ lastTest.status === 'success' ? '測試成功' : '測試失敗' }}</span>
      <p
        v-if="lastTest && lastTest.status === 'error' && lastTest.message"
        class="lead-error"
      >
        {{ lastTest.message }}
      </p>
      <template #visual>
        <SettingsLineQuota bare />
      </template>
      <template #actions>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="controller.testing.value || controller.saving.value"
          @click="controller.testLineIntegration"
        >
          {{ controller.testing.value ? '測試中...' : '測試連線' }}
        </button>
      </template>
    </RingLead>

    <div class="col col-a">
      <LineIntegrationForm
        class="item-cred"
        :settings="controller.settings.integrations.line"
        :credentials="controller.credentialStatus.value?.line"
        :saving="controller.saving.value"
        :testing="controller.testing.value"
        @save="controller.saveLineSettings"
        @update:settings="(data) => Object.assign(controller.settings.integrations.line, data)"
      />
    </div>
    <div class="col col-b">
      <aside
        class="item-webhook"
        aria-label="Webhook 設定"
      >
        <LineSetupGuide />
      </aside>
    </div>
    <LineDangerZone
      v-if="hasStoredCredentials"
      class="item-danger"
      :disabled="controller.saving.value || controller.testing.value"
      @clear="controller.clearLineCredentials"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { LineIntegrationForm } from '@/components/system-settings'
import LineDangerZone from '@/components/system-settings/LineDangerZone.vue'
import LineSetupGuide from '@/components/system-settings/LineSetupGuide.vue'
import SettingsLineQuota from '@/components/system-settings/SettingsLineQuota.vue'
import RingLead from '@/components/lead/RingLead.vue'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}

const line = computed(() => controller.settings.integrations.line)
const lastTest = computed(() => line.value.lastTest)

const credentialFields = computed(() => {
  const creds = controller.credentialStatus.value?.line
  return creds ? Object.values(creds) : []
})

const hasStoredCredentials = computed(() => credentialFields.value.some(field => field.configured))

const statusLabel = computed(() => {
  if (line.value.status === 'connected') { return '已連線' }
  return line.value.status === 'error' ? '連線異常' : '未連線'
})

const TAIPEI = 'Asia/Taipei'

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TAIPEI }).format(date)
}

function formatTestedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) { return iso }
  const time = new Intl.DateTimeFormat('zh-TW', { timeZone: TAIPEI, hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
  if (dayKey(date) === dayKey(new Date())) { return `今天 ${time}` }
  const day = new Intl.DateTimeFormat('zh-TW', { timeZone: TAIPEI, month: '2-digit', day: '2-digit' }).format(date)
  return `${day} ${time}`
}

const testMeta = computed(() => {
  const test = lastTest.value
  if (!test) { return '尚未測試連線' }
  return `${formatTestedAt(test.testedAt)} · 回應 ${test.latencyMs.toLocaleString()} ms`
})

</script>

<style scoped>
.line-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 420px);
  gap: 22px;
  align-items: start;
  min-width: 0;
}

.lead {
  grid-column: 1 / -1;
}

.lead-pill {
  margin-top: 12px;
}

.lead-error {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--ui-red-ink);
}

.col {
  display: contents;
}

.item-webhook {
  min-width: 0;
}

.item-danger {
  grid-column: 1 / -1;
}

@media (max-width: 1024px) {
  .line-page {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
