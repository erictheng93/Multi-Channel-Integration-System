<!--
  SettingsLineQuota.vue

  LINE monthly message quota on the LINE settings page. Same source as the broadcast page
  (GET /broadcasts/line-quota, POST .../refresh); one block per channel the server reports.
-->

<template>
  <section
    aria-label="LINE 訊息額度"
    :class="{ 'is-bare': bare }"
  >
    <h2
      v-if="!bare"
      class="ui-group-label"
    >
      LINE 訊息額度
    </h2>
    <div :class="bare ? 'bare-box' : 'ui-group'">
      <div class="ui-card-head">
        <div>
          <h3 class="ui-card-title">
            本月已發送
          </h3>
          <div class="ui-card-sub">
            {{ updatedText }}
          </div>
        </div>
        <div class="ui-card-end">
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
        class="quota-list"
      >
        <li
          v-for="channel in items"
          :key="channel.channelKey"
          class="quota"
        >
          <div class="quota-name">
            {{ channel.label }}
          </div>
          <div class="quota-top">
            <div class="quota-big">
              {{ usedText(channel) }}<small v-if="channel.limited && channel.limit !== null">/ {{ channel.limit.toLocaleString() }} 則</small><small v-else-if="channel.used !== null">則（不限額）</small>
            </div>
            <div
              v-if="channel.limited && channel.remaining !== null"
              class="quota-rest"
            >
              剩餘 <b>{{ channel.remaining.toLocaleString() }}</b> 則
            </div>
          </div>
          <template v-if="channel.limited && channel.limit !== null && channel.used !== null">
            <div
              class="qbar"
              role="progressbar"
              aria-valuemin="0"
              :aria-valuemax="channel.limit"
              :aria-valuenow="Math.min(channel.used, channel.limit)"
              :aria-label="`${channel.label} 已使用 ${percent(channel)}%`"
            >
              <i
                class="seg-used"
                :class="tone(channel)"
                :style="{ width: `${segments(channel).used}%` }"
              />
              <i
                v-if="segments(channel).usable > 0"
                class="seg-usable"
                :style="{ width: `${segments(channel).usable}%` }"
              />
              <i
                v-if="segments(channel).reserve > 0"
                class="seg-reserve"
                :style="{ width: `${segments(channel).reserve}%` }"
              />
            </div>
            <ul class="qlegend">
              <li :class="`q-${tone(channel)}`">
                <span
                  class="sw seg-used"
                  :class="tone(channel)"
                />已發送<b>{{ channel.used.toLocaleString() }}</b>
                <small>{{ percent(channel) }}%{{ tone(channel) === 'danger' ? ' · 即將用完' : tone(channel) === 'warn' ? ' · 額度偏緊' : '' }}</small>
              </li>
              <li v-if="channel.usableRemaining !== null">
                <span class="sw seg-usable" />群發還能用<b>{{ channel.usableRemaining.toLocaleString() }}</b>
              </li>
              <li v-if="channel.reserve !== null && channel.reserve > 0">
                <span class="sw seg-reserve" />留給客服回覆<b>{{ channel.reserve.toLocaleString() }}</b>
              </li>
            </ul>
          </template>
          <p
            v-if="channel.error"
            class="quota-warn"
          >
            本次查詢失敗（{{ channel.error }}），顯示的是上次成功的數據。
          </p>
        </li>
      </ul>
    </div>
    <p
      v-if="!bare"
      class="ui-group-foot"
    >
      額度依 LINE 官方帳號方案計算。
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import {
  getLineQuota,
  refreshLineQuota,
  type LineQuotaChannel,
  type LineQuotaSnapshot
} from '@/api/broadcasts'

defineProps<{
  /** Rendered inside a lead card: no group chrome, no label, no footnote */
  bare?: boolean
}>()
const emit = defineEmits<{ snapshot: [items: LineQuotaChannel[]] }>()

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
    emit('snapshot', snapshot.value.items)
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
  }
})

// Optimistic UI: the button flips to busy at once and the previous numbers stay on screen;
// a failed refresh leaves them untouched.
async function refresh() {
  if (refreshing.value) {
    return
  }
  refreshing.value = true
  try {
    const next = await refreshLineQuota()
    snapshot.value = next
    emit('snapshot', next.items)
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

function percent(channel: LineQuotaChannel): number {
  if (!channel.limit || channel.used === null) {
    return 0
  }
  return Math.min(Math.round((channel.used / channel.limit) * 100), 100)
}

/** The month's limit split in three: sent, still usable for broadcasts, kept back for support replies (percent of the limit) */
function segments(channel: LineQuotaChannel): { used: number, usable: number, reserve: number } {
  const limit = channel.limit ?? 0
  if (limit <= 0 || channel.used === null) {
    return { used: 0, usable: 0, reserve: 0 }
  }
  const used = Math.min(channel.used / limit, 1)
  const reserve = Math.min(Math.max(channel.reserve ?? 0, 0) / limit, 1 - used)
  const usable = Math.max(0, 1 - used - reserve)
  return { used: used * 100, usable: usable * 100, reserve: reserve * 100 }
}

function tone(channel: LineQuotaChannel): 'ok' | 'warn' | 'danger' {
  const value = percent(channel)
  if (value >= 90) {
    return 'danger'
  }
  return value >= 70 ? 'warn' : 'ok'
}

function usedText(channel: LineQuotaChannel): string {
  return channel.used === null ? '尚無數據' : channel.used.toLocaleString()
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
.is-bare :deep(.ui-card-head) {
  padding: 0 0 14px;
}

.is-bare .state {
  padding: 12px 0;
  text-align: left;
}

.is-bare .quota {
  padding: 0;
}

.is-bare .quota-name {
  font-size: 14px;
}

/* the legend below already splits what is left into usable and kept back */
.is-bare .quota-rest {
  display: none;
}

.is-bare .quota-big {
  font-size: 40px;
}

.is-bare .quota-big small {
  font-size: 17px;
}

.is-bare .qbar {
  display: flex;
  gap: 3px;
  height: 14px;
  margin: 16px 0 12px;
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
  margin-left: 2px;
  font-weight: 700;
  color: var(--ui-ink);
}

.qlegend small {
  font-size: 13px;
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
</style>
