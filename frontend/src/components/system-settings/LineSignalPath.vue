<!--
  LineSignalPath.vue
  The signature of the LINE page: the message path drawn as two wires between LINE and this system.
  Wire 1 (incoming): LINE calls the Webhook URL, the request is verified with the Channel Secret.
  Wire 2 (outgoing): this system replies through the Messaging API with the Access Token; the monthly
  quota is the track laid under that wire. Every label is a stored value (credential last4, last test,
  quota snapshot). A wire with its credential missing is dashed grey; a failed test turns the outgoing wire red.
-->

<template>
  <article
    class="ui-lead path"
    aria-label="LINE 訊息路徑"
  >
    <header class="path-head">
      <div class="path-id">
        <h2 class="path-title">
          訊息往返路徑
        </h2>
        <span
          class="ui-pill ui-pill-dot"
          :class="statusTone"
        >{{ statusLabel }}</span>
        <span class="path-test">{{ testMeta }}</span>
      </div>
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="controller.testing.value || controller.saving.value"
        @click="controller.testLineIntegration"
      >
        {{ controller.testing.value ? '測試中...' : '測試連線' }}
      </button>
    </header>

    <div class="path-grid">
      <div class="node node-line">
        <span
          class="node-tile node-tile-line"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
          ><path d="M12 3C6.5 3 2 6.6 2 11c0 3.3 2.7 6.1 6.5 7.4.2.9-.4 2.1-.9 3 2.6-.5 5-2.2 6.5-3.6C19 17 22 14.300 22 11c0-4.400-4.500-8-10-8Z" /></svg>
        </span>
        <div class="node-text">
          <div class="node-name">
            LINE 官方帳號
          </div>
          <div class="node-sub">
            {{ accountLabel }}
          </div>
          <div class="node-sub node-mono">
            Channel ID {{ mask(creds?.channelId) }}
          </div>
        </div>
      </div>

      <div class="wires">
        <section
          class="wire wire-in"
          :class="{ 'is-off': !secretSet }"
          aria-label="收訊"
        >
          <div class="wire-label">
            <span class="wire-dir">收訊</span>
            LINE 呼叫 Webhook
          </div>
          <div class="wire-line">
            <div class="wire-chip wire-url">
              <code
                class="url"
                tabindex="0"
                role="textbox"
                aria-readonly="true"
                aria-label="Webhook 網址"
                :title="webhookUrl"
              ><template
                v-for="part in urlParts"
                :key="part"
              >{{ part }}<wbr></template></code>
              <button
                type="button"
                class="btn btn-secondary btn-sm copy-btn"
                :aria-label="copied ? '已複製' : '複製網址'"
                @click="copy"
              >
                <svg
                  v-if="!copied"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                ><rect
                  x="9"
                  y="9"
                  width="11"
                  height="11"
                  rx="2.5"
                /><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" /></svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                ><path d="M5 12.5 10 17.5 19 7" /></svg>
              </button>
            </div>
          </div>
          <div class="wire-note">
            <span
              class="dot"
              :class="secretSet ? 'dot-ok' : 'dot-off'"
            />
            <span v-if="secretSet">以 Channel Secret <code>{{ mask(creds?.channelSecret) }}</code> 驗證每則請求的簽章</span>
            <span v-else>尚未設定 Channel Secret，收到的請求無法驗證</span>
          </div>
        </section>

        <section
          class="wire wire-out"
          :class="{ 'is-off': !tokenSet, 'is-bad': outBad }"
          aria-label="發送"
        >
          <div class="wire-label">
            <span class="wire-dir">發送</span>
            本系統呼叫 Messaging API
          </div>
          <div class="wire-line">
            <div class="wire-chip">
              <span
                class="dot"
                :class="tokenSet ? (outBad ? 'dot-bad' : 'dot-ok') : 'dot-off'"
              />
              <span class="chip-k">Access Token</span>
              <code>{{ mask(creds?.accessToken) }}</code>
              <span
                v-if="lastTest"
                class="chip-ms"
              >{{ lastTest.latencyMs.toLocaleString() }} ms</span>
            </div>
          </div>
        </section>
      </div>

      <div class="node node-sys">
        <span
          class="node-tile node-tile-sys"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><path d="M21 12a8 8 0 0 1-11.600 7.100L4 20.500l1.400-4.600A8 8 0 1 1 21 12Z" /><path d="M8.500 11.500h7M8.500 14.500h4" /></svg>
        </span>
        <div class="node-text">
          <div class="node-name">
            本系統
          </div>
          <div class="node-sub">
            客服對話與群發
          </div>
        </div>
      </div>
    </div>

    <div class="quota">
      <div
        v-if="quotaLoading"
        class="quota-state"
      >
        載入額度中...
      </div>
      <div
        v-else-if="channels.length === 0"
        class="quota-state"
      >
        {{ quotaFailed ? '無法取得額度資料' : '尚未查詢過本月額度' }}
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="refreshing"
          @click="refresh"
        >
          {{ refreshing ? '查詢中...' : '立即查詢' }}
        </button>
      </div>
      <template v-else>
        <section
          v-for="(channel, index) in channels"
          :key="channel.channelKey"
          class="quota-item"
          :aria-label="channels.length > 1 ? channel.label : undefined"
        >
          <div
            v-if="channels.length > 1"
            class="quota-account"
          >
            {{ channel.label }}
          </div>
          <div class="quota-top">
            <div class="quota-big">
              <span class="quota-label">本月已發送</span>
              {{ channel.used === null ? '尚無數據' : channel.used.toLocaleString() }}<small v-if="channel.limited && channel.limit !== null"> / {{ channel.limit.toLocaleString() }} 則</small><small v-else-if="channel.used !== null"> 則（不限額）</small>
            </div>
            <div
              v-if="index === 0"
              class="quota-meta"
            >
              <span>{{ updatedText }}</span>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="refreshing"
                @click="refresh"
              >
                {{ refreshing ? '查詢中...' : '立即查詢' }}
              </button>
            </div>
          </div>
          <template v-if="channel.limited && channel.limit !== null && channel.used !== null">
            <div
              class="qbar"
              role="progressbar"
              aria-valuemin="0"
              :aria-valuemax="channel.limit"
              :aria-valuenow="Math.min(channel.used, channel.limit)"
              :aria-label="`本月額度已使用 ${percent(channel)}%`"
            >
              <i
                class="seg-used"
                :class="tone(channel)"
                :style="{ width: `${segs(channel).used}%` }"
              />
              <i
                v-if="segs(channel).usable > 0"
                class="seg-usable"
                :style="{ width: `${segs(channel).usable}%` }"
              />
              <i
                v-if="segs(channel).reserve > 0"
                class="seg-reserve"
                :style="{ width: `${segs(channel).reserve}%` }"
              />
            </div>
            <ul class="qlegend">
              <li :class="`q-${tone(channel)}`">
                <span
                  class="sw seg-used"
                  :class="tone(channel)"
                />已發送 <b>{{ percent(channel) }}%</b><template v-if="tone(channel) === 'danger'">
                  · 即將用完
                </template><template v-else-if="tone(channel) === 'warn'">
                  · 額度偏緊
                </template>
              </li>
              <li v-if="channel.usableRemaining !== null">
                <span class="sw seg-usable" />群發還能用 <b>{{ channel.usableRemaining.toLocaleString() }}</b>
              </li>
              <li v-if="channel.reserve !== null && channel.reserve > 0">
                <span class="sw seg-reserve" />留給客服回覆 <b>{{ channel.reserve.toLocaleString() }}</b>
              </li>
            </ul>
          </template>
          <p
            v-if="channel.error"
            class="quota-warn"
          >
            本次查詢失敗（{{ channel.error }}），顯示的是上次成功的數據。
          </p>
        </section>
      </template>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { getBackendUrl } from '@/config/runtime'
import { getLineQuota, refreshLineQuota, type LineQuotaChannel, type LineQuotaSnapshot } from '@/api/broadcasts'
import { useToast } from '@/composables/useToast'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}
const { showError, showSuccess } = useToast()

const line = computed(() => controller.settings.integrations.line)
const lastTest = computed(() => line.value.lastTest)
const creds = computed(() => controller.credentialStatus.value?.line)

const secretSet = computed(() => creds.value?.channelSecret.configured ?? false)
const tokenSet = computed(() => creds.value?.accessToken.configured ?? false)
const outBad = computed(() => lastTest.value?.status === 'error')

function mask(field?: { configured: boolean, last4: string | null }): string {
  return field?.configured ? `••••${field.last4 ?? ''}` : '未設定'
}

const statusLabel = computed(() => {
  if (line.value.status === 'connected') { return '已連線' }
  return line.value.status === 'error' ? '連線異常' : '未連線'
})
const statusTone = computed(() => {
  if (line.value.status === 'connected') { return 'ui-pill-green' }
  return line.value.status === 'error' ? 'ui-pill-red' : 'ui-pill-orange'
})

const TAIPEI = 'Asia/Taipei'
function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TAIPEI }).format(date)
}
function formatAt(iso: string): string {
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
  return test.status === 'success'
    ? `${formatAt(test.testedAt)} 測試成功`
    : `${formatAt(test.testedAt)} 測試失敗${test.message ? `：${test.message}` : ''}`
})

/* webhook */
const webhookUrl = `${getBackendUrl()}/api/webhook`
/** Break points only at slashes, so a narrow screen wraps the path instead of splitting the domain */
const urlParts = webhookUrl.split(/(?=\/)/)
const copied = ref(false)
async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(webhookUrl)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1800)
  } catch {
    copied.value = false
  }
}

/* quota: same source as the broadcast page */
const snapshot = ref<LineQuotaSnapshot | null>(null)
const quotaLoading = ref(true)
const quotaFailed = ref(false)
const refreshing = ref(false)
const channels = computed<LineQuotaChannel[]>(() => snapshot.value?.items ?? [])
const accountLabel = computed(() => {
  const labels = channels.value.map(item => item.label)
  return labels.length > 0 ? labels.join('、') : '尚未取得帳號名稱'
})

onMounted(async () => {
  try {
    snapshot.value = await getLineQuota()
  } catch {
    quotaFailed.value = true
  } finally {
    quotaLoading.value = false
  }
})

// Optimistic UI: the button flips to busy at once and the previous numbers stay on screen
async function refresh(): Promise<void> {
  if (refreshing.value) { return }
  refreshing.value = true
  try {
    const next = await refreshLineQuota()
    snapshot.value = next
    quotaFailed.value = false
    if (next.throttled) { showSuccess('剛剛已更新過，顯示最新數據') }
  } catch (error) {
    showError(error instanceof Error ? error.message : '額度查詢失敗')
  } finally {
    refreshing.value = false
  }
}

const updatedText = computed(() => {
  const at = snapshot.value?.updatedAt
  if (!at) { return '尚無查詢紀錄' }
  return `${formatAt(at)} ${snapshot.value?.source === 'manual' ? '手動查詢' : '每日自動查詢'}`
})

function percent(c: LineQuotaChannel): number {
  if (!c.limit || c.used === null) { return 0 }
  return Math.min(Math.round((c.used / c.limit) * 100), 100)
}
function tone(c: LineQuotaChannel): 'ok' | 'warn' | 'danger' {
  const value = percent(c)
  return value >= 90 ? 'danger' : value >= 70 ? 'warn' : 'ok'
}

/** The month's limit split in three: sent, still usable for broadcasts, kept back for support replies (percent of the limit) */
function segs(c: LineQuotaChannel): { used: number, usable: number, reserve: number } {
  const limit = c.limit ?? 0
  if (limit <= 0 || c.used === null) { return { used: 0, usable: 0, reserve: 0 } }
  const used = Math.min(c.used / limit, 1)
  const reserve = Math.min(Math.max(c.reserve ?? 0, 0) / limit, 1 - used)
  const usable = Math.max(0, 1 - used - reserve)
  return { used: used * 100, usable: usable * 100, reserve: reserve * 100 }
}
</script>

<style scoped>
.path {
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-width: 0;
  padding: 24px 28px 28px;
}

.path-head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.path-id {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: center;
  min-width: 0;
}

.path-title {
  margin: 0;
  font: 600 19px / 1.3 var(--ui-font-display);
  letter-spacing: -0.015em;
}

.path-test {
  font-size: 13px;
  color: var(--ui-muted);
}

/* three columns: LINE | two wires | this system */
.path-grid {
  display: grid;
  grid-template-columns: 196px minmax(0, 1fr) 164px;
  gap: 0;
  align-items: stretch;
}

/* the nodes are tall ports: both wires end on their edges */
.node {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
  justify-content: center;
  padding: 20px;
  border-radius: 20px;
  background: var(--ui-surface-2);
}

.node-tile {
  display: grid;
  flex: none;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
}

.node-tile svg {
  width: 32px;
  height: 32px;
}

.node-line {
  background: var(--ui-surface-2);
}

.node-sys {
  background: var(--ui-surface-2);
}

.node-tile-line {
  background: var(--ui-line);
  color: #fff;
}

.node-tile-sys {
  background: var(--ui-surface);
  color: var(--ui-accent);
}

.node-name {
  font: 600 16px / 1.3 var(--ui-font-display);
}

.node-sub {
  margin-top: 2px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--ui-muted);
  overflow-wrap: anywhere;
}

.node-mono {
  font-family: var(--ui-font-mono);
  font-size: 13px;
}

.wires {
  display: flex;
  flex-direction: column;
  gap: 26px;
  min-width: 0;
  padding: 4px 0;
}

.wire {
  --wire: var(--ui-green);

  min-width: 0;
}

.wire.is-off {
  --wire: var(--ui-faint);
}

.wire.is-bad {
  --wire: var(--ui-red);
}

.wire-label {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--ui-muted);
}

.wire-dir {
  padding: 1px 9px;
  border-radius: 999px;
  background: var(--ui-fill);
  font-weight: 600;
  color: var(--ui-ink-2);
}

/* the wire: a rule with an arrowhead; the chip sits on it */
.wire-line {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 48px;
}

.wire-line::before {
  position: absolute;
  inset: 50% 0 auto;
  height: 3px;
  margin-top: -1.5px;
  border-radius: 2px;
  background: var(--wire);
  content: '';
}

.wire.is-off .wire-line::before {
  background: repeating-linear-gradient(90deg, var(--wire) 0 8px, transparent 8px 14px);
}

.wire-line::after {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  margin-top: -6px;
  border: solid var(--wire);
  border-width: 3px 3px 0 0;
  border-radius: 1px;
  content: '';
}

.wire-in .wire-line::after {
  right: 0;
  transform: rotate(45deg);
}

.wire-out .wire-line::after {
  left: 0;
  transform: rotate(-135deg);
}

.wire-chip {
  position: relative;
  z-index: 1;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  max-width: calc(100% - 44px);
  margin: 0 36px 0 30px;
  padding: 6px 8px 6px 14px;
  border-radius: 999px;
  background: var(--ui-surface);
  box-shadow: 0 0 0 1px var(--wire), var(--ui-shadow-pill);
  font-size: 14px;
}

.wire-out .wire-chip {
  margin-left: auto;
  padding-right: 14px;
}

.chip-k {
  color: var(--ui-muted);
  white-space: nowrap;
}

.chip-ms {
  padding-left: 8px;
  box-shadow: inset 1px 0 0 var(--ui-sep);
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink-2);
}

.wire-chip code,
.wire-note code {
  font: 13.5px var(--ui-font-mono);
  color: var(--ui-ink);
}

.url {
  min-width: 0;
  font: 13.5px / 1.5 var(--ui-font-mono);
  color: var(--ui-ink);
}

.copy-btn {
  display: inline-flex;
  flex: none;
  place-content: center;
  width: 36px;
  min-height: 36px;
  padding: 0;
}

.copy-btn svg {
  width: 17px;
  height: 17px;
}

.wire-note {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
  font-size: 13px;
  color: var(--ui-muted);
}

.dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.dot-ok {
  background: var(--ui-green);
}

.dot-bad {
  background: var(--ui-red);
}

.dot-off {
  background: var(--ui-faint);
}

/* quota: its own band under the path, the width of the whole card, so no wire runs through it */
.quota {
  padding: 16px 20px 18px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
}

.quota-item + .quota-item {
  margin-top: 18px;
  padding-top: 16px;
  box-shadow: inset 0 1px 0 var(--ui-sep);
}

.quota-account {
  margin-bottom: 8px;
  font: 600 14px / 1.3 var(--ui-font-display);
  color: var(--ui-ink);
}

.quota-state {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  font-size: 13.5px;
  color: var(--ui-muted);
}

.quota-top {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: flex-end;
  justify-content: space-between;
}

.quota-big {
  font: 600 34px / 1.1 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
}

.quota-big small {
  font-size: 15px;
  font-weight: 400;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.quota-label {
  display: block;
  margin-bottom: 4px;
  font: 500 13px var(--ui-font-ui);
  letter-spacing: 0;
  color: var(--ui-muted);
}

.quota-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 13px;
  color: var(--ui-muted);
}

.qbar {
  display: flex;
  gap: 3px;
  height: 14px;
  margin: 14px 0 12px;
  overflow: hidden;
  border-radius: 999px;
}

.qbar i {
  display: block;
  min-width: 4px;
  height: 100%;
  border-radius: 4px;
  transition: width 300ms var(--ui-ease);
}

.qbar i:first-child {
  border-radius: 999px 4px 4px 999px;
}

.qbar i:last-child {
  border-radius: 4px 999px 999px 4px;
}

.seg-used {
  background: var(--ui-green);
}

.seg-used.warn {
  background: var(--ui-orange);
}

.seg-used.danger {
  background: var(--ui-red);
}

.seg-usable {
  background: var(--ui-green-soft);
  box-shadow: inset 0 0 0 1.5px var(--ui-green);
}

.seg-reserve {
  background: repeating-linear-gradient(135deg, var(--ui-fill-strong) 0 4px, var(--ui-fill) 4px 8px);
}

.qlegend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 22px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13.5px;
  color: var(--ui-ink-2);
  font-variant-numeric: tabular-nums;
}

.qlegend li {
  display: flex;
  gap: 7px;
  align-items: center;
}

.qlegend b {
  font-weight: 700;
  color: var(--ui-ink);
}

.qlegend .sw {
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 4px;
}

.q-warn {
  color: var(--ui-orange-ink);
  font-weight: 600;
}

.q-danger {
  color: var(--ui-red-ink);
  font-weight: 600;
}

.quota-warn {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--ui-orange-ink);
}

@media (max-width: 1024px) {
  .path-grid {
    grid-template-columns: 160px minmax(0, 1fr) 130px;
  }

  .node {
    padding: 16px;
  }
}

/* phone: LINE on top, this system at the bottom, the two wires run vertically between them */
@media (max-width: 768px) {
  .path {
    gap: 18px;
    padding: 20px 18px 22px;
  }

  .path-head {
    flex-wrap: wrap;
  }

  .path-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .node {
    flex-direction: row;
    gap: 14px;
    align-items: center;
    padding: 12px 14px;
  }

  .node-tile {
    width: 44px;
    height: 44px;
    border-radius: 14px;
  }

  .node-tile svg {
    width: 24px;
    height: 24px;
  }

  .wires {
    gap: 18px;
    padding: 18px 0 18px 4px;
  }

  .wire {
    position: relative;
    padding-left: 34px;
  }

  .wire::before {
    position: absolute;
    inset: 2px auto 2px 16px;
    width: 3px;
    border-radius: 2px;
    background: var(--wire);
    content: '';
  }

  .wire-in::before {
    top: -18px;
  }

  .wire-out::before {
    bottom: -18px;
  }

  .wire.is-off::before {
    background: repeating-linear-gradient(180deg, var(--wire) 0 8px, transparent 8px 14px);
  }

  .wire::after {
    position: absolute;
    left: 12.5px;
    width: 10px;
    height: 10px;
    border: solid var(--wire);
    border-width: 3px 3px 0 0;
    content: '';
  }

  .wire-in::after {
    bottom: 5px;
    transform: rotate(135deg);
  }

  .wire-out::after {
    top: 5px;
    transform: rotate(-45deg);
  }

  .wire-line {
    min-height: 0;
  }

  .wire-line::before,
  .wire-line::after {
    display: none;
  }

  .wire-chip,
  .wire-out .wire-chip {
    max-width: 100%;
    margin: 0;
    padding: 6px 8px 6px 14px;
    border-radius: var(--ui-r-inner);
    box-shadow: 0 0 0 1px var(--wire);
  }

  .wire-out .wire-chip {
    padding: 8px 14px;
  }

  .copy-btn {
    width: 44px;
    min-height: 44px;
  }

  .url {
    font-size: 13px;
  }

  .quota-big {
    font-size: 30px;
  }

  .quota-meta {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
