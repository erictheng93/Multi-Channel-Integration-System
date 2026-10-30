<template>
  <section
    class="ui-lead quota-lead"
    aria-labelledby="line-quota-title"
  >
    <div class="quota-head">
      <div>
        <h2
          id="line-quota-title"
          class="quota-title"
        >
          LINE 訊息額度
        </h2>
        <p class="quota-sub">
          {{ updatedText }}
        </p>
      </div>
      <button
        class="btn btn-secondary btn-sm"
        type="button"
        :disabled="refreshing"
        @click="refresh"
      >
        {{ refreshing ? '查詢中...' : '立即查詢' }}
      </button>
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
        <div
          class="channel-body"
          :class="{ 'has-lead': hasLead(channel) }"
        >
          <div class="channel-main">
            <div
              v-if="!hasLead(channel)"
              class="channel-name"
            >
              {{ channel.label }}
            </div>
            <template v-if="hasLead(channel)">
              <div class="lead-kicker">
                {{ channel.label }}<span class="kicker-sep"> ・ </span>可用於群發
              </div>
              <div
                class="lead-num"
                :class="{ 'is-short': isShort(channel) }"
              >
                {{ leadValue(channel) }}<small>則</small>
              </div>
              <div class="lead-meaning">
                {{ leadMeaning(channel) }}
              </div>
            </template>

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

              <dl class="stats">
                <div class="stat">
                  <dt><i class="dot pend" />本次預計消耗</dt>
                  <dd>{{ pendingFor(channel) > 0 ? pendingFor(channel).toLocaleString() : '—' }}</dd>
                </div>
                <div
                  class="stat"
                  :class="{ 'is-short': isShort(channel) }"
                >
                  <dt><i class="dot free" />發送後可用</dt>
                  <dd>{{ afterSend(channel) === null ? '不限' : Math.max(afterSend(channel) ?? 0, 0).toLocaleString() }}</dd>
                </div>
              </dl>
              <p
                class="remain"
                :class="{ 'is-short': isShort(channel) }"
              >
                {{ remainText(channel) }}
              </p>
            </template>
          </div>

          <div
            v-if="hasLead(channel)"
            class="channel-rings"
          >
            <ServiceRings
              :summary="`${channel.label} 本月額度`"
              :rings="ringsFor(channel)"
              :size="164"
            />
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
import ServiceRings, { type ServiceRing } from '@/components/ui/ServiceRings.vue'
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
function leadValue(channel: LineQuotaChannel): string {
  if (channel.usableRemaining === null) {
    return '不限'
  }
  return Math.max(channel.usableRemaining, 0).toLocaleString()
}

/**
 * The quota as real shares of the monthly limit: still usable for broadcasts, already used,
 * kept back for agent replies. Only a channel with a cap and a reading gets rings.
 */
function ringsFor(channel: LineQuotaChannel): ServiceRing[] {
  if (!channel.limit || channel.used === null) {
    return []
  }
  const level = tone(channel)
  const rings: ServiceRing[] = []
  if (channel.usableRemaining !== null) {
    rings.push({ label: '可用於群發', value: Math.max(channel.usableRemaining, 0), total: channel.limit, of: '則', hue: 'var(--ui-green)' })
  }
  rings.push({
    label: '已使用',
    value: channel.used,
    total: channel.limit,
    of: '則',
    hue: level === 'danger' ? 'var(--ui-red)' : level === 'warn' ? 'var(--ui-orange)' : 'var(--ui-blue)'
  })
  if (channel.reserve) {
    rings.push({ label: '保留給客服回覆', value: channel.reserve, total: channel.limit, of: '則', hue: 'var(--ui-indigo)' })
  }
  return rings
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
.quota-lead {
  padding: 24px 36px 26px;
}

.quota-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.quota-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--section-ink);
}

.quota-sub {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.state {
  padding: 18px 0 4px;
  font-size: 14px;
  color: var(--ui-muted);
}

.channel-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.channel {
  margin-top: 14px;
}

.channel + .channel {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 0.5px solid var(--ui-sep);
}

.channel-body.has-lead {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 24px 44px;
  align-items: center;
}

.channel-main {
  min-width: 0;
}

.channel-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.lead-kicker {
  margin-top: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.lead-num {
  margin-top: 2px;
  font: 600 56px / 1.05 var(--ui-font-display);
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.lead-num.is-short {
  color: var(--ui-orange-ink);
}

.lead-num small {
  margin-left: 6px;
  font-size: 22px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.kicker-sep {
  color: var(--ui-faint);
}

.lead-meaning {
  margin-top: 4px;
  font-size: 15px;
  color: var(--ui-ink-2);
}

.channel-rings {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.channel-rings::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: -22px;
  width: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.big-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  margin: 18px 0 8px;
}

.has-lead .big-row {
  margin-top: 16px;
}

.big {
  font: 600 20px / 1.2 var(--ui-font-display);
  letter-spacing: -0.02em;
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
  flex-basis: 100%;
  font-size: 13px;
  color: var(--ui-muted);
}

.bar {
  display: flex;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill-strong);
}

.bar-fill {
  display: block;
  height: 100%;
  background: var(--ui-blue);
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
  display: flex;
  flex-wrap: wrap;
  gap: 6px 32px;
  margin: 14px 0 0;
}

.stat {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.stat dt {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--ui-muted);
}

.stat dd {
  margin: 0;
  font: 600 17px var(--ui-font-display);
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}

.stat.is-short dd {
  color: var(--ui-orange-ink);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.pend {
  background: var(--ui-orange);
}

.dot.free {
  background: var(--ui-fill-strong);
  box-shadow: inset 0 0 0 1px var(--ui-sep);
}

.remain {
  margin: 8px 0 0;
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
    gap: 20px;
  }

  .channel-rings {
    justify-content: flex-start;
  }

  .channel-rings::before {
    display: none;
  }
}

@media (max-width: 768px) {
  .quota-lead {
    padding: 20px;
  }

  .lead-num {
    font-size: 48px;
  }
}
</style>
