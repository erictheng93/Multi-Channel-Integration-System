<!--
  IntegrationStatusCard.vue

  Connection summary on top of an integration page: platform tile, status pill and the
  persisted result of the last connection test (time, latency, failure message).
-->

<template>
  <article class="ui-card conn-card">
    <div
      class="tile"
      :class="platform"
      aria-hidden="true"
    >
      <svg
        v-if="platform === 'line'"
        viewBox="0 0 24 24"
      ><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg>
      <svg
        v-else
        viewBox="0 0 24 24"
      ><path d="m22 2-7 20-4-9-9-4Z" /></svg>
    </div>
    <div class="conn-main">
      <div class="conn-name">
        {{ title }}
        <span
          class="ui-pill ui-pill-dot"
          :class="pill.className"
        >{{ pill.label }}</span>
      </div>
      <div class="conn-meta">
        {{ metaText }}
      </div>
      <div
        v-if="lastTest && lastTest.status === 'error' && lastTest.message"
        class="conn-error"
      >
        {{ lastTest.message }}
      </div>
    </div>
    <button
      v-if="testable"
      type="button"
      class="btn btn-secondary conn-test"
      :disabled="testing || disabled"
      @click="emit('test')"
    >
      <svg
        class="conn-test-ico"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      ><path d="M5 12.5 10 17.5 19 7" /></svg>
      {{ testing ? '測試中...' : '測試連線' }}
    </button>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IntegrationLastTest, IntegrationStatus } from '@/types/system-settings'

interface Props {
  platform: 'line' | 'facebook'
  title: string
  status: IntegrationStatus
  lastTest?: IntegrationLastTest | null
  /** Show the 測試連線 button inside the card */
  testable?: boolean
  testing?: boolean
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ test: [] }>()

const pill = computed(() => {
  if (props.status === 'connected') {
    return { label: '已連線', className: 'ui-pill-green' }
  }
  if (props.status === 'error') {
    return { label: '連線異常', className: 'ui-pill-red' }
  }
  return { label: '未連線', className: '' }
})

const TAIPEI = 'Asia/Taipei'

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TAIPEI }).format(date)
}

function formatTestedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  const time = new Intl.DateTimeFormat('zh-TW', {
    timeZone: TAIPEI,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
  if (dayKey(date) === dayKey(new Date())) {
    return `今天 ${time}`
  }
  const day = new Intl.DateTimeFormat('zh-TW', {
    timeZone: TAIPEI,
    month: '2-digit',
    day: '2-digit'
  }).format(date)
  return `${day} ${time}`
}

const metaText = computed(() => {
  const test = props.lastTest
  if (!test) {
    return '尚未測試連線'
  }
  const result = test.status === 'success' ? '上次測試' : '上次測試失敗'
  return `${result} ${formatTestedAt(test.testedAt)} · 回應 ${test.latencyMs.toLocaleString()} ms`
})
</script>

<style scoped>
.conn-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding: 18px 22px;
}

.tile {
  display: grid;
  flex: none;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 14px;
}

.tile.line {
  background: var(--ui-line);
}

.tile.facebook {
  background: var(--ui-messenger);
}

.tile svg {
  width: 26px;
  height: 26px;
  fill: #fff;
}

.conn-main {
  flex: 1;
  min-width: 200px;
}

.conn-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font: 600 17px var(--ui-font-display);
  letter-spacing: -0.015em;
}

.conn-meta {
  margin-top: 2px;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.conn-test-ico {
  width: 16px;
  height: 16px;
}

@media (max-width: 768px) {
  .conn-test {
    width: 100%;
  }
}

.conn-error {
  margin-top: 4px;
  font-size: 13px;
  color: var(--ui-red-ink);
}
</style>
