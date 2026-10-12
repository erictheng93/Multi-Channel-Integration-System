<template>
  <section
    class="quota-card"
    aria-labelledby="line-quota-title"
  >
    <div class="section-heading">
      <div>
        <h2 id="line-quota-title">
          LINE 訊息額度
        </h2>
        <p class="meta">
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
        <div class="channel-head">
          <strong>{{ channel.label }}</strong>
          <span class="figures">{{ figuresText(channel) }}</span>
        </div>

        <div
          v-if="channel.limited && channel.limit !== null && channel.used !== null"
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
import { useToast } from '@/composables/useToast'
import {
  getLineQuota,
  refreshLineQuota,
  type LineQuotaChannel,
  type LineQuotaSnapshot
} from '@/api/broadcasts'

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
  return `${channel.used.toLocaleString()} / ${channel.limit.toLocaleString()}，剩餘 ${(channel.remaining ?? 0).toLocaleString()}`
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
  background: #fff;
  border-radius: 16px;
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.section-heading h2 {
  margin: 0;
  font-size: var(--text-xl);
  color: #1c1c1e;
}

.meta {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  color: #8e8e93;
}

.state {
  padding: var(--space-6);
  color: #8e8e93;
  text-align: center;
}

.channel-list {
  list-style: none;
  margin: var(--space-4) 0 0;
  padding: 0;
  display: grid;
  gap: var(--space-4);
}

.channel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  color: #1c1c1e;
}

.figures {
  font-size: var(--text-sm);
  color: #8e8e93;
  font-variant-numeric: tabular-nums;
}

.bar {
  margin-top: var(--space-2);
  height: 10px;
  border-radius: 9999px;
  background: #f2f2f7;
  overflow: hidden;
}

.bar-fill {
  display: block;
  height: 100%;
  border-radius: 9999px;
  transition: width 300ms ease-out;
}

.bar-fill.ok {
  background: #007aff;
}

.bar-fill.warn {
  background: #ff9500;
}

.bar-fill.danger {
  background: #ff3b30;
}

.warn {
  margin: var(--space-2) 0 0;
  font-size: var(--text-sm);
  color: #ff9500;
}

@media (prefers-reduced-motion: reduce) {
  .bar-fill {
    transition: none;
  }
}
</style>
