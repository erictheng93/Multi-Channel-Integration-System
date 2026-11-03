<!--
  ChannelBalance.vue
  Signature of the channels page: the last 24 h as one split bar. The whole bar is every message of the
  active channels; the left share is what customers sent, the right share what agents answered, so the
  reply gap reads as one proportion. Per-channel numbers live on each channel's own card below (same
  colours, one shared scale), so nothing is said twice. Real counters only.
-->
<template>
  <article
    class="ui-lead bal"
    aria-label="近 24 小時訊息量"
  >
    <div class="bal-title">
      <h2>近 24 小時訊息</h2>
      <div
        class="bal-total"
        :class="{ none: total === null }"
      >
        {{ total === null ? '—' : fmt(total) }}<small v-if="total !== null">則</small>
      </div>
    </div>
    <div
      v-if="total !== null && total > 0"
      class="bal-split"
    >
      <div class="bal-keys">
        <span class="bal-key"><i class="in" />客戶來訊 <b>{{ fmt(inN) }}</b><span>{{ pct(inN) }}%</span></span>
        <span class="bal-key"><i class="out" />客服發送 <b>{{ fmt(outN) }}</b><span>{{ pct(outN) }}%</span></span>
      </div>
      <div
        class="bal-bar"
        role="img"
        :aria-label="`客戶來訊 ${fmt(inN)} 則，客服發送 ${fmt(outN)} 則`"
      >
        <i
          class="in"
          :style="{ flexGrow: inN }"
        />
        <i
          class="out"
          :style="{ flexGrow: outN }"
        />
      </div>
    </div>
    <p
      v-else
      class="bal-none"
    >
      {{ total === null ? '沒有啟用中的頻道提供訊息量' : '近 24 小時沒有訊息' }}
    </p>
  </article>
</template>

<script setup lang="ts">
const props = defineProps<{
  /** 24 h total over the active channels; null when none reports */
  total: number | null
  inN: number
  outN: number
}>()

const number = new Intl.NumberFormat('zh-TW')
const fmt = (n: number): string => number.format(n)
const pct = (n: number): number => (props.total ? Math.round((n / props.total) * 100) : 0)
</script>

<style scoped>
.bal {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 20px 56px;
  align-items: center;
  padding: 24px 28px;
}

.bal-title h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.bal-total {
  font: 600 44px / 1.1 var(--ui-font-display);
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
}

.bal-total small {
  margin-left: 6px;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-ink-2);
}

.bal-total.none {
  color: var(--ui-muted);
}

.bal-split {
  display: grid;
  gap: 10px;
}

.bal-keys {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 24px;
  justify-content: space-between;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.bal-key {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  font-variant-numeric: tabular-nums;
}

.bal-key b {
  font-weight: 700;
  color: var(--ui-ink);
}

.bal-key span {
  color: var(--ui-ink-2);
}

.bal-key i {
  width: 12px;
  height: 12px;
  border-radius: 4px;
}

/* one hue: customer messages are the solid blue, agent replies its light tint, so the pair reads as one conversation */
.in {
  background: var(--ui-blue);
}

.out {
  background: color-mix(in srgb, var(--ui-blue) 38%, var(--ui-surface));
}

.bal-bar {
  display: flex;
  gap: 3px;
  height: 22px;
}

.bal-bar i {
  flex-basis: 0;
  min-width: 6px;
}

.bal-bar i:first-child {
  border-radius: 999px 4px 4px 999px;
}

.bal-bar i:last-child {
  border-radius: 4px 999px 999px 4px;
}

.bal-none {
  margin: 0;
  font-size: 14px;
  color: var(--ui-ink-2);
}

@media (max-width: 768px) {
  .bal {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
    padding: 20px 18px;
  }

  .bal-total {
    font-size: 38px;
  }
}
</style>
