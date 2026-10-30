<!--
  LineIntegrationPage.vue
  Connection summary, message quota and credentials for the LINE official account.
  Desktop: two columns that end together (status + credentials | quota + webhook), danger zone full width last.
  Phone: one column in reading order, danger zone always the last block.
-->

<template>
  <div class="line-page">
    <article
      class="ui-lead hero"
      aria-label="LINE 連線與額度"
    >
      <div class="hero-col hero-conn">
        <div class="hero-head">
          <div>
            <h2 class="hero-title">
              連線狀態
            </h2>
            <div class="hero-sub">
              LINE Messaging API
            </div>
          </div>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="controller.testing.value || controller.saving.value"
            @click="controller.testLineIntegration"
          >
            {{ controller.testing.value ? '測試中...' : '測試連線' }}
          </button>
        </div>
        <div class="hero-bigrow">
          <div class="hero-big">
            {{ statusLabel }}
          </div>
          <span
            v-if="lastTest"
            class="ui-pill ui-pill-dot"
            :class="lastTest.status === 'success' ? 'ui-pill-green' : 'ui-pill-red'"
          >{{ lastTest.status === 'success' ? '測試成功' : '測試失敗' }}</span>
        </div>
        <dl
          v-if="lastTest"
          class="hero-stats"
        >
          <div>
            <dt>最近測試</dt>
            <dd>{{ formatTestedAt(lastTest.testedAt) }}</dd>
          </div>
          <div>
            <dt>回應時間</dt>
            <dd>{{ lastTest.latencyMs.toLocaleString() }} ms</dd>
          </div>
        </dl>
        <p
          v-else
          class="hero-sub hero-none"
        >
          {{ testMeta }}
        </p>
        <p
          v-if="lastTest && lastTest.status === 'error' && lastTest.message"
          class="lead-error"
        >
          {{ lastTest.message }}
        </p>
      </div>
      <div class="hero-col hero-quota">
        <SettingsLineQuota bare />
      </div>
    </article>

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
  grid-template-columns: minmax(0, 1fr) minmax(0, 460px);
  gap: 22px;
  align-items: stretch;
  min-width: 0;
}

.hero {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 24px 0;
  padding: 24px 0;
}

.hero-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0 32px;
}

.hero-quota {
  border-left: 0.5px solid var(--ui-sep);
}

/* both columns open with the same header row (title + sub on the left, one small action on the right) */
.hero-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 14px;
}

.hero-title {
  margin: 0;
  font: 600 17px / 1.3 var(--ui-font-display);
  letter-spacing: -0.01em;
}

.hero-sub {
  margin-top: 2px;
  font-size: 13px;
  color: var(--ui-muted);
}

.hero-bigrow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: center;
}

.hero-big {
  font: 600 40px / 1 var(--ui-font-display);
  letter-spacing: -0.03em;
  color: var(--ui-ink);
}

.hero-stats {
  display: flex;
  gap: 28px;
  margin: 18px 0 0;
}

.hero-stats dt {
  font-size: 13px;
  color: var(--ui-muted);
}

.hero-stats dd {
  margin: 2px 0 0;
  font: 600 17px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

.hero-none {
  margin-top: 14px;
}

.hero-foot {
  margin-top: 14px;
}

.hero-foot:empty {
  display: none;
}

.lead-error {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--ui-red-ink);
}

.col {
  display: contents;
}

.item-webhook,
.item-cred {
  display: flex;
  flex-direction: column;
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

@media (max-width: 768px) {
  .hero {
    grid-template-columns: minmax(0, 1fr);
    padding: 20px 0;
  }

  .hero-col {
    padding: 0 20px;
  }

  .hero-quota {
    padding-top: 20px;
    border-top: 0.5px solid var(--ui-sep);
    border-left: 0;
  }
}
</style>
