<!--
  SettingsLineQuota.vue

  LINE monthly message quota on the LINE settings page. Same source as the broadcast page
  (GET /broadcasts/line-quota, POST .../refresh); one block per channel the server reports.
-->

<template>
  <SettingsGroup title="LINE 訊息額度">
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
              :class="tone(channel)"
              :style="{ width: `${percent(channel)}%` }"
            />
          </div>
          <div class="qscale">
            <span>0</span><span>{{ channel.limit.toLocaleString() }}</span>
          </div>
        </template>
        <p
          v-if="channel.error"
          class="quota-warn"
        >
          本次查詢失敗（{{ channel.error }}），顯示的是上次成功的數據。
        </p>
      </li>
    </ul>
    <template #note>
      額度依 LINE 官方帳號方案計算。
    </template>
  </SettingsGroup>
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
import SettingsGroup from './SettingsGroup.vue'

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
.state {
  padding: 20px 22px 28px;
  text-align: center;
  color: var(--ui-muted);
}

.quota-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.quota {
  padding: 4px 22px 20px;
}

.quota-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.quota-top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  margin-top: 6px;
}

.quota-big {
  font: 600 34px / 1 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.quota-big small {
  margin-left: 4px;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.quota-rest {
  margin-left: auto;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.quota-rest b {
  font-weight: 600;
  color: var(--ui-ink);
}

.qbar {
  height: 8px;
  margin: 14px 0 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.qbar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ui-green);
  transition: width 300ms var(--ui-ease);
}

.qbar i.warn {
  background: var(--ui-orange);
}

.qbar i.danger {
  background: var(--ui-red);
}

.qscale {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.quota-warn {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--ui-orange-ink);
}
</style>
