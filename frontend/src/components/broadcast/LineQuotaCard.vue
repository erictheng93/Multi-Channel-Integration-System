<template>
  <section
    class="ui-card quota-card"
    aria-labelledby="line-quota-title"
  >
    <div class="ui-card-head">
      <div>
        <h2
          id="line-quota-title"
          class="ui-card-title"
        >
          LINE 訊息額度
        </h2>
        <p class="ui-card-sub">
          {{ updatedText }}
        </p>
      </div>
      <div class="ui-card-end">
        <button
          class="btn btn-secondary btn-sm"
          type="button"
          :disabled="refreshing"
          @click="refresh"
        >
          {{ refreshing ? '查詢中...' : '立即查詢' }}
        </button>
      </div>
    </div>

    <div
      v-if="loading"
      class="state"
    >
      載入額度中...
    </div>
    <div
      v-else-if="loadFailed && items.length === 0"
      class="state"
    >
      無法取得額度資料，請點「立即查詢」重試。
    </div>
    <div
      v-else-if="items.length === 0"
      class="state"
    >
      尚未查詢過額度，或尚未設定 LINE 頻道。
    </div>
    <ul
      v-else
      class="channel-list"
    >
      <li
        v-for="channel in items"
        :key="channel.channelKey"
        class="channel"
      >
        <div class="channel-head">
          <strong>{{ channel.label }}</strong>
        </div>
        <div
          class="channel-body"
          :class="{ 'has-lead': hasLead(channel) }"
        >
          <UiLeadMetric
            v-if="hasLead(channel)"
            class="quota-lead"
            label="可用於群發"
            :value="leadValue(channel)"
            unit="則"
            :meaning="leadMeaning(channel)"
            :tone="isShort(channel) ? 'orange' : 'accent'"
            :ratio="usedRatio(channel)"
          />
          <div class="channel-main">
            <div class="big-row">
              <span
                v-if="channel.used === null || !channel.limited || channel.limit === null"
                class="figures"
              >{{ figuresText(channel) }}</span>
              <template v-else>
                <span class="big">{{ channel.used.toLocaleString() }}</span>
                <span class="of figures">{{ ` / ${channel.limit.toLocaleString()}` }}</span>
                <span class="unit">則本月</span>
              </template>
              <span class="rule">LINE 額度每月重置，以收件人計，每位每則算 1</span>
            </div>

            <template v-if="channel.limited && channel.limit !== null && channel.used !== null">
              <div
                class="bar"
                role="progressbar"
                aria-valuemin="0"
                :aria-valuemax="channel.limit"
                :aria-valuenow="Math.min(channel.used, channel.limit)"
                :aria-label="`${channel.label} 已使用 ${percent(channel)}%`"
              >
                <span
                  class="bar-fill"
                  :class="tone(channel)"
                  :style="{ width: `${percent(channel)}%` }"
                />
                <span
                  v-if="pendingPercent(channel) > 0"
                  class="bar-pending"
                  :style="{ width: `${pendingPercent(channel)}%` }"
                />
                <span
                  v-if="reservePercent(channel) > 0"
                  class="bar-reserve"
                  :style="{ width: `${reservePercent(channel)}%` }"
                />
              </div>

              <div class="stats">
                <div class="stat ui-well">
                  <span class="stat-label"><i
                    class="dot used"
                    :class="tone(channel)"
                  />已使用</span>
                  <b>{{ channel.used.toLocaleString() }}<small>{{ percent(channel) }}%</small></b>
                </div>
                <div class="stat ui-well">
                  <span class="stat-label"><i class="dot pend" />本次預計消耗</span>
                  <b>{{ pendingFor(channel) > 0 ? pendingFor(channel).toLocaleString() : '—' }}</b>
                </div>
                <div class="stat ui-well">
                  <span class="stat-label"><i class="dot keep" />保留給客服回覆</span>
                  <b>{{ fmt(channel.reserve) }}</b>
                </div>
                <div
                  class="stat ui-well"
                  :class="{ 'is-short': isShort(channel) }"
                >
                  <span class="stat-label"><i class="dot free" />發送後可用</span>
                  <b>{{ afterSend(channel) === null ? '不限' : Math.max(afterSend(channel) ?? 0, 0).toLocaleString() }}</b>
                </div>
              </div>
              <p
                class="remain"
                :class="{ 'is-short': isShort(channel) }"
              >
                {{ remainText(channel) }}
              </p>
            </template>
          </div>
        </div>

        <p
          v-if="channel.error"
          class="warn"
        >
          本次查詢失敗（{{ channel.error }}），顯示的是上次成功的數據。
        </p>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import UiLeadMetric from '@/components/ui/UiLeadMetric.vue'
import { useToast } from '@/composables/useToast'
import {
  getLineQuota,
  refreshLineQuota,
  type LineQuotaChannel,
  type LineQuotaSnapshot
} from '@/api/broadcasts'

const props = defineProps<{
  /** Recipients the current preview would send, keyed by channelKey (preview.tokenGroups) */
  pending?: Record<string, number>
}>()

const { showError, showSuccess } = useToast()

const snapshot = ref<LineQuotaSnapshot | null>(null)
const loading = ref(true)
const loadFailed = ref(false)
const refreshing = ref(false)

const items = computed(() => snapshot.value?.items ?? [])

const updatedText = computed(() => {
  const at = snapshot.value?.updatedAt
  if (!at) {
    return '尚無查詢紀錄'
  }
  const source = snapshot.value?.source === 'manual' ? '手動查詢' : '每日自動查詢'
  return `更新於 ${formatTime(at)}（${source}）`
})

onMounted(async () => {
  try {
    snapshot.value = await getLineQuota()
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
  }
})

// Optimistic UI: the button flips to its busy state immediately and the previous numbers stay on
// screen; a failed refresh simply leaves them untouched.
async function refresh() {
  if (refreshing.value) {
    return
  }
  refreshing.value = true
  try {
    const next = await refreshLineQuota()
    snapshot.value = next
    loadFailed.value = false
    if (next.throttled) {
      showSuccess('剛剛已更新過，顯示最新數據')
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : '額度查詢失敗')
  } finally {
    refreshing.value = false
  }
}

/** Only the first channel carries the page's lead metric */
function hasLead(channel: LineQuotaChannel): boolean {
  return channel.channelKey === items.value[0]?.channelKey
    && channel.limited && channel.limit !== null && channel.used !== null
}

/** Quota still usable for broadcasts after the reserve (null = unlimited) */
function leadValue(channel: LineQuotaChannel): number | string | null {
  if (channel.usableRemaining === null) {
    return '不限'
  }
  return Math.max(channel.usableRemaining, 0)
}

/** Share of the monthly quota already used (the disc's arc) */
function usedRatio(channel: LineQuotaChannel): number | null {
  if (!channel.limit || channel.used === null) {
    return null
  }
  return Math.min(1, channel.used / channel.limit)
}

function leadMeaning(channel: LineQuotaChannel): string {
  return channel.reserve ? '本月還能群發，已預留客服回覆額度' : '本月還能群發的則數'
}

function pendingFor(channel: LineQuotaChannel): number {
  return props.pending?.[channel.channelKey] ?? 0
}

/** Width of the hatched "this broadcast" segment, capped to what is left of the bar */
function pendingPercent(channel: LineQuotaChannel): number {
  if (!channel.limit || channel.used === null) {
    return 0
  }
  const raw = (pendingFor(channel) / channel.limit) * 100
  return Math.max(0, Math.min(raw, 100 - percent(channel)))
}

/** Width of the reserved-for-replies segment: what is left after used and this send */
function reservePercent(channel: LineQuotaChannel): number {
  if (!channel.limit || channel.used === null || !channel.reserve) {
    return 0
  }
  const raw = (channel.reserve / channel.limit) * 100
  return Math.max(0, Math.min(raw, 100 - percent(channel) - pendingPercent(channel)))
}

/** usableRemaining minus this broadcast; null when the channel has no cap */
function afterSend(channel: LineQuotaChannel): number | null {
  if (channel.usableRemaining === null) {
    return null
  }
  return channel.usableRemaining - pendingFor(channel)
}

function isShort(channel: LineQuotaChannel): boolean {
  const after = afterSend(channel)
  return after !== null && after < 0
}

/** One sentence built in script so no template whitespace lands before full-width punctuation */
function remainText(channel: LineQuotaChannel): string {
  let text = `剩餘 ${(channel.remaining ?? 0).toLocaleString()} 則`
  if (channel.reserve) {
    text += `，其中 ${channel.reserve.toLocaleString()} 則保留給客服回覆`
  }
  if (isShort(channel)) {
    text += `。本次發送將超出可用額度 ${Math.abs(afterSend(channel) ?? 0).toLocaleString()} 則，可能無法發送。`
  }
  return text
}

function fmt(value: number | null): string {
  return value === null ? '—' : value.toLocaleString()
}

function percent(channel: LineQuotaChannel): number {
  if (!channel.limit || channel.used === null) {
    return 0
  }
  return Math.min(Math.round((channel.used / channel.limit) * 100), 100)
}

function tone(channel: LineQuotaChannel): 'ok' | 'warn' | 'danger' {
  const value = percent(channel)
  if (value >= 90) {
    return 'danger'
  }
  return value >= 70 ? 'warn' : 'ok'
}

function figuresText(channel: LineQuotaChannel): string {
  if (channel.used === null) {
    return '尚無數據'
  }
  if (!channel.limited || channel.limit === null) {
    return `已用 ${channel.used.toLocaleString()}（不限額）`
  }
  return `${channel.used.toLocaleString()} / ${channel.limit.toLocaleString()}`
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}
</script>

<style scoped>
.quota-card {
  padding-bottom: 18px;
}

.quota-card .ui-card-head {
  padding-bottom: 4px;
}

.state {
  padding: 20px 22px 8px;
  font-size: 13.5px;
  color: var(--ui-muted);
}

.channel-list {
  margin: 0;
  padding: 0 22px;
  list-style: none;
}

.channel + .channel {
  margin-top: 18px;
  padding-top: 16px;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.channel-body.has-lead {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 22px;
  align-items: stretch;
  margin-top: 8px;
}

.quota-lead {
  border-radius: var(--ui-r-inner);
}

.channel-main {
  min-width: 0;
}

.has-lead .big {
  font-size: 24px;
}

.has-lead .big-row {
  margin-top: 0;
}

.channel-head strong {
  font-size: 13px;
  color: var(--ui-ink-2);
}

.big-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  margin: 6px 0 12px;
}

.big {
  font: 600 38px / 1 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.of,
.unit {
  font-size: 15px;
  color: var(--ui-muted);
}

.figures {
  font-size: 15px;
  color: var(--ui-ink-2);
  font-variant-numeric: tabular-nums;
}

.rule {
  margin-left: auto;
  font-size: 13px;
  color: var(--ui-muted);
}

.bar {
  display: flex;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill-strong);
}

.bar-fill {
  display: block;
  height: 100%;
  background: var(--ui-accent);
}

.bar-fill.warn {
  background: var(--ui-orange);
}

.bar-fill.danger {
  background: var(--ui-red);
}

.bar-pending {
  display: block;
  height: 100%;
  background: repeating-linear-gradient(
    135deg,
    var(--ui-orange) 0 4px,
    color-mix(in srgb, var(--ui-orange) 45%, var(--ui-surface)) 4px 8px
  );
}

.bar-reserve {
  display: block;
  height: 100%;
  background: var(--ui-indigo);
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.stat {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
}

.stat-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--ui-muted);
}

.stat b {
  font: 600 20px var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.stat b small {
  margin-left: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.used {
  background: var(--ui-accent);
}

.dot.used.warn {
  background: var(--ui-orange);
}

.dot.used.danger {
  background: var(--ui-red);
}

.dot.pend {
  background: var(--ui-orange);
}

.dot.keep {
  background: var(--ui-indigo);
}

.dot.free {
  background: var(--ui-fill-strong);
  box-shadow: inset 0 0 0 1px var(--ui-sep);
}

.stat.is-short {
  background: var(--ui-orange-soft);
}

.stat.is-short b {
  color: var(--ui-orange-ink);
}

.remain {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.remain.is-short {
  color: var(--ui-orange-ink);
}

.warn {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--ui-orange-ink);
}

@media (max-width: 1024px) {
  .channel-body.has-lead {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  .quota-lead {
    min-height: 168px;
  }
}

@media (max-width: 768px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .rule {
    width: 100%;
    margin-left: 0;
  }
  .big {
    font-size: 32px;
  }
}
</style>
