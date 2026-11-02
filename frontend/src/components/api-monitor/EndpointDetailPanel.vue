<template>
  <div class="detail">
    <div class="detail-in">
      <div class="dstats">
        <div>
          <div class="k">
            P50
          </div>
          <div class="v">
            {{ endpoint.p50ResponseTime }}<small>ms</small>
          </div>
        </div>
        <div>
          <div class="k">
            平均
          </div>
          <div class="v">
            {{ endpoint.avgResponseTime }}<small>ms</small>
          </div>
        </div>
        <div>
          <div class="k">
            P95
          </div>
          <div
            class="v"
            :class="p95Class"
          >
            {{ endpoint.responseTime }}<small>ms</small>
          </div>
        </div>
        <div>
          <div class="k">
            錯誤數
          </div>
          <div
            class="v"
            :class="{ bad: endpoint.errorCount > 0 }"
          >
            {{ endpoint.errorCount.toLocaleString() }}<small>/ {{ endpoint.requestCount.toLocaleString() }}</small>
          </div>
        </div>
      </div>

      <div
        v-if="codes.length > 0"
        class="codes"
      >
        <div class="h">
          狀態碼分布（近 1 小時）
        </div>
        <div
          v-for="code in codes"
          :key="code.code"
          class="code"
        >
          <span class="mono">{{ code.code }}</span>
          <div class="bar4">
            <i
              :class="code.tone"
              :style="{ width: code.pct + '%' }"
            />
          </div>
          <span class="n">{{ code.count.toLocaleString() }}</span>
        </div>
      </div>

      <div class="dfoot">
        最後檢查 {{ lastCheckText }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ApiEndpoint } from '@/types/api-monitor'

const props = defineProps<{
  endpoint: ApiEndpoint
}>()

const p95Class = computed(() => {
  if (props.endpoint.responseTime >= 1000) { return 'bad' }
  return props.endpoint.responseTime >= 400 ? 'warn' : ''
})

/** Real per-status-code request counts from the metrics query. */
const codes = computed(() => {
  const entries = Object.entries(props.endpoint.statusCodes ?? {})
  const total = entries.reduce((sum, [, count]) => sum + count, 0)
  return entries
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([code, count]) => ({
      code,
      count,
      pct: total > 0 ? Math.max(2, (count / total) * 100) : 0,
      tone: Number(code) < 300 ? 'ok' : Number(code) < 500 ? 'mid' : 'bad',
    }))
})

const lastCheckText = computed(() => {
  const date = new Date(props.endpoint.lastCheck)
  if (Number.isNaN(date.getTime())) { return '—' }
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
})
</script>

<style scoped>
.detail {
  padding: 0 22px 16px;
}

.detail-in {
  padding: 16px 18px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
}

.dstats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.k {
  font-size: 13px;
  color: var(--ui-muted);
}

.v {
  font: 600 20px var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.v small {
  margin-left: 2px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.v.warn {
  color: var(--ui-orange-ink);
}

.v.bad {
  color: var(--ui-red-ink);
}

.codes {
  margin-top: 16px;
}

.codes .h {
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--ui-muted);
}

.code {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 56px;
  gap: 12px;
  align-items: center;
  padding: 3px 0;
  font-size: 13px;
}

.mono {
  font: 600 13px var(--ui-font-mono);
}

.n {
  text-align: right;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.bar4 {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.bar4 i {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.bar4 i.ok {
  background: var(--ui-green);
}

.bar4 i.mid {
  background: var(--ui-orange);
}

.bar4 i.bad {
  background: var(--ui-red);
}

.dfoot {
  margin-top: 14px;
  font-size: 13px;
  color: var(--ui-muted);
}

@media (max-width: 768px) {
  .detail {
    padding: 0 16px 16px;
  }

  .dstats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
