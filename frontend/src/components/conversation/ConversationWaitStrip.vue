<template>
  <button
    v-if="wait"
    type="button"
    class="wait-strip"
    :aria-label="`客戶已等 ${wait.text}，${wait.count} 則來訊未回，開啟客戶資訊`"
    @click="$emit('open')"
  >
    <span
      class="ws-dot"
      aria-hidden="true"
    />
    <span class="ws-main">客戶在等回覆</span>
    <span class="ws-time">已等 {{ wait.text }}</span>
    <span class="ws-count">{{ wait.count }} 則未回</span>
    <svg
      class="ws-chev"
      viewBox="0 0 24 24"
      aria-hidden="true"
    ><path d="m9 6 6 6-6 6" /></svg>
  </button>
</template>

<script setup lang="ts">
/**
 * The wait, in the thread, where the rail is not shown (tablet and phone): the trailing run of customer messages
 * nobody has answered yet, on an open conversation. Tapping it opens the customer sheet with the round history.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { withoutSignOffs } from '@/utils/waiting-messages'

const props = defineProps<{
  messages: ReadonlyArray<{ senderType?: string; content?: string; messageType?: string; createdAt?: string | number | Date; timestamp?: number | Date }>
  closed?: boolean
}>()

defineEmits<{ open: [] }>()

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 30_000) })
onBeforeUnmount(() => { if (timer) { clearInterval(timer) } })

const timeOf = (m: { createdAt?: string | number | Date; timestamp?: number | Date }): number => {
  const raw = m.timestamp ?? m.createdAt
  const t = raw === undefined ? NaN : new Date(raw).getTime()
  return t
}

const wait = computed(() => {
  if (props.closed) { return null }
  const spoken = withoutSignOffs(props.messages
    .filter(m => (m.senderType === 'customer' || m.senderType === 'agent') && Number.isFinite(timeOf(m)))
    .sort((a, b) => timeOf(a) - timeOf(b)))
  let count = 0
  for (let i = spoken.length - 1; i >= 0 && spoken[i]?.senderType === 'customer'; i--) { count += 1 }
  if (count === 0) { return null }
  const started = timeOf(spoken[spoken.length - count] as (typeof spoken)[number])
  const minutes = Math.max(0, Math.round((now.value - started) / 60000))
  let text = '< 1 分'
  if (minutes >= 1440) { text = `${Math.floor(minutes / 1440)} 天` } else if (minutes >= 60) { text = minutes % 60 === 0 ? `${minutes / 60} 小時` : `${Math.floor(minutes / 60)} 小時 ${minutes % 60} 分` } else if (minutes >= 1) { text = `${minutes} 分` }
  return { text, count }
})
</script>

<style scoped>
.wait-strip {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  min-height: 44px;
  padding: 0 16px;
  border: 0;
  background: var(--ui-orange-soft);
  box-shadow: inset 0 -0.5px 0 var(--ui-sep);
  color: var(--ui-orange-ink);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.ws-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentcolor;
}

.ws-main {
  font-weight: 700;
}

.ws-time {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.ws-count {
  margin-left: auto;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.ws-chev {
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.wait-strip:focus-visible {
  outline: 2px solid var(--ui-orange-ink);
  outline-offset: -2px;
}

/* the rail carries this on a wide screen */
@media (min-width: 1281px) {
  .wait-strip {
    display: none;
  }
}

@media (max-width: 480px) {
  .ws-count {
    display: none;
  }

  .ws-time {
    margin-left: auto;
  }
}
</style>
