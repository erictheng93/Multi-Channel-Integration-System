<!--
  ChannelBalance.vue
  Signature of the channels page: a diverging board. One row per channel; customer messages of the last
  24 h grow to the left of a shared axis, agent replies to the right, both on one scale, so the reply gap
  of every channel (and a channel that gets traffic nobody answers) shows at a glance. Webhook health sits
  at the end of the row. Real counters only: a disabled channel is named, not charted.
-->
<template>
  <article
    class="ui-lead bal"
    aria-label="近 24 小時各頻道訊息量"
  >
    <header class="bal-head">
      <div class="bal-title">
        <h2>近 24 小時訊息</h2>
        <div
          class="bal-total"
          :class="{ none: total === null }"
        >
          {{ total === null ? '—' : fmt(total) }}<small v-if="total !== null">則</small>
        </div>
      </div>
      <ul
        v-if="total !== null"
        class="bal-legend"
        aria-label="圖例"
      >
        <li><i class="in" />客戶來訊 <b>{{ fmt(inN) }}</b><span>{{ pct(inN) }}%</span></li>
        <li><i class="out" />客服發送 <b>{{ fmt(outN) }}</b><span>{{ pct(outN) }}%</span></li>
      </ul>
      <p
        v-else
        class="bal-none"
      >
        沒有啟用中的頻道提供訊息量
      </p>
    </header>

    <ul
      class="bal-rows"
      aria-label="各頻道訊息量"
    >
      <li
        class="bal-axis"
        aria-hidden="true"
      >
        <span class="bal-scale">兩側同一比例，軌道 = {{ fmt(max) }} 則</span>
        <span class="bal-axis-l">客戶來訊</span>
        <span class="bal-axis-r">客服發送</span>
        <span />
      </li>
      <li
        v-for="row in rows"
        :key="row.key"
        class="bal-row"
        :class="{ off: row.off }"
      >
        <div class="bal-id">
          <span
            class="bal-tile"
            :class="`tile-${row.platform}`"
            aria-hidden="true"
          />
          <div class="bal-id-text">
            <div class="bal-name">
              {{ row.label }}
            </div>
            <div class="bal-sub">
              {{ row.off ? '已停用' : row.lastAt }}
            </div>
          </div>
        </div>
        <template v-if="!row.off">
          <div
            class="bal-side is-in"
            :aria-label="`客戶來訊 ${fmt(row.inN)} 則`"
          >
            <span class="bal-num"><span class="bal-lbl">客戶來訊</span><b>{{ fmt(row.inN) }}</b><small>累計 {{ fmt(row.inTotal) }}</small></span>
            <span class="bal-track"><i
              class="bal-bar in"
              :style="{ '--r': ratio(row.inN) }"
            /></span>
          </div>
          <div
            class="bal-side is-out"
            :aria-label="`客服發送 ${fmt(row.outN)} 則`"
          >
            <span class="bal-track"><i
              class="bal-bar out"
              :style="{ '--r': ratio(row.outN) }"
            /></span>
            <span class="bal-num"><span class="bal-lbl">客服發送</span><b>{{ fmt(row.outN) }}</b><small>累計 {{ fmt(row.outTotal) }}</small></span>
          </div>
        </template>
        <div
          v-else
          class="bal-side bal-off"
        >
          已停用，不計入訊息量
        </div>
        <span
          class="bal-health ui-pill ui-pill-dot"
          :class="row.off ? 'is-calm' : row.problem ? 'ui-pill-orange' : 'ui-pill-green'"
        >{{ row.off ? '已停用' : row.problem ? '需注意' : '無異常' }}</span>
      </li>
    </ul>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface BalanceRow {
  key: string
  label: string
  platform: string
  off: boolean
  inN: number
  outN: number
  inTotal: number
  outTotal: number
  /** "最後活動 21 分鐘前" */
  lastAt: string
  /** Webhook failure records in the last 24 h */
  problem: boolean
}

const props = defineProps<{
  rows: BalanceRow[]
  /** 24 h total over the active channels; null when none reports */
  total: number | null
  inN: number
  outN: number
}>()

const number = new Intl.NumberFormat('zh-TW')
const fmt = (n: number): string => number.format(n)
const pct = (n: number): number => (props.total ? Math.round((n / props.total) * 100) : 0)

/** One scale for every bar: the biggest single side among the rows */
const max = computed(() => Math.max(1, ...props.rows.filter(r => !r.off).flatMap(r => [r.inN, r.outN])))
const ratio = (n: number): number => (n === 0 ? 0 : Math.max(0.02, n / max.value))
</script>

<style scoped>
.bal {
  display: grid;
  gap: 18px;
  padding: 24px 28px 22px;
}

.bal-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  align-items: flex-end;
  justify-content: space-between;
}

.bal-title h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.bal-total {
  font: 600 40px / 1.1 var(--ui-font-display);
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
}

.bal-total small {
  margin-left: 6px;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.bal-total.none {
  color: var(--ui-muted);
}

.bal-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 22px;
  margin: 0;
  padding: 0 0 6px;
  list-style: none;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.bal-legend li {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  font-variant-numeric: tabular-nums;
}

.bal-legend b {
  font-weight: 700;
  color: var(--ui-ink);
}

.bal-legend span {
  color: var(--ui-muted);
}

.bal-legend i,
.bal-bar.in,
.bal-bar.out {
  display: block;
}

.bal-legend i {
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
  box-shadow: inset 0 0 0 1.5px var(--ui-blue);
}

.bal-none {
  margin: 0;
  font-size: 14px;
  color: var(--ui-muted);
}

/* rows: identity | in (grows left) | out (grows right) | health */
.bal-rows {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bal-axis,
.bal-row {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr) minmax(0, 1fr) 84px;
  gap: 0 0;
  align-items: center;
}

.bal-axis {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}

.bal-axis-l {
  padding-right: 14px;
  text-align: right;
}

.bal-axis-r {
  padding-left: 14px;
}

.bal-row {
  padding: 12px 0;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.bal-id {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.bal-tile {
  flex: none;
  width: 12px;
  height: 36px;
  border-radius: 6px;
  background: var(--ui-faint);
}

.bal-tile.tile-line {
  background: var(--ui-line);
}

.bal-tile.tile-facebook {
  background: var(--ui-messenger);
}

.bal-name {
  font: 600 15px / 1.3 var(--ui-font-ui);
}

.bal-sub {
  font-size: 13px;
  color: var(--ui-muted);
}

.bal-side {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
  min-height: 44px;
}

/* the axis: a hairline down the middle of each row */
.bal-side.is-in {
  justify-content: flex-end;
  padding-right: 14px;
  box-shadow: inset -1px 0 0 var(--ui-fill-strong);
}

.bal-side.is-out {
  padding-left: 14px;
}

.bal-track {
  display: flex;
  flex: 1;
  min-width: 0;
  height: 22px;
  border-radius: 8px;
  background: var(--ui-fill);
}

.is-in .bal-track {
  justify-content: flex-end;
}

.bal-bar {
  flex: none;
  width: calc(100% * var(--r));
  height: 22px;
}

.is-in .bal-bar {
  border-radius: 8px 3px 3px 8px;
}

.is-out .bal-bar {
  border-radius: 3px 8px 8px 3px;
}

.bal-num {
  display: grid;
  flex: none;
  min-width: 78px;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
}

.is-in .bal-num {
  text-align: right;
}

.bal-num b {
  font: 600 18px var(--ui-font-display);
}

.bal-num small {
  font-size: 13px;
  color: var(--ui-muted);
}

.bal-health {
  justify-self: end;
}

.bal-health.is-calm {
  background: var(--ui-fill);
  color: var(--ui-ink-2);
}

.bal-health.is-calm::before {
  background: var(--ui-muted);
}

.bal-row.off .bal-name {
  color: var(--ui-muted);
}

/* a disabled channel keeps the grid: one empty track across both sides, named */
.bal-off {
  grid-column: 2 / 4;
  justify-content: center;
  min-height: 22px;
  height: 22px;
  align-self: center;
  border-radius: 8px;
  background: var(--ui-fill);
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.bal-lbl {
  display: none;
}

.bal-scale {
  font-weight: 500;
}

@media (max-width: 1024px) {
  .bal-axis,
  .bal-row {
    grid-template-columns: 190px minmax(0, 1fr) minmax(0, 1fr) 80px;
  }
}

/* phone: identity and health on one line, then one full-width bar per side (same scale, both grow rightwards) */
@media (max-width: 768px) {
  .bal {
    padding: 20px 16px 14px;
  }

  .bal-total {
    font-size: 34px;
  }

  .bal-axis {
    grid-template-columns: minmax(0, 1fr);
  }

  .bal-axis > :not(.bal-scale) {
    display: none;
  }

  .bal-row {
    position: relative;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'id'
      'in'
      'out';
    gap: 8px 0;
    padding: 14px 0 12px;
  }

  .bal-id {
    grid-area: id;
    padding-right: 84px;
  }

  .bal-health {
    position: absolute;
    top: 14px;
    right: 0;
  }

  .bal-side {
    min-height: 0;
  }

  .bal-side.is-in {
    grid-area: in;
    justify-content: flex-start;
    padding-right: 0;
    box-shadow: none;
  }

  .bal-side.is-out {
    grid-area: out;
    flex-direction: row-reverse;
    padding-left: 0;
  }

  .is-in .bal-track {
    justify-content: flex-start;
  }

  .is-in .bal-bar {
    border-radius: 3px 8px 8px 3px;
  }

  .bal-off {
    grid-area: in / in / out / out;
    height: 28px;
  }

  .bal-track,
  .bal-bar {
    height: 20px;
  }

  .bal-num {
    grid-template-columns: auto auto;
    grid-template-areas:
      'l n'
      'l t';
    align-items: center;
    column-gap: 8px;
    min-width: 132px;
    text-align: left;
  }

  .is-in .bal-num {
    text-align: left;
  }

  .bal-lbl {
    display: block;
    grid-area: l;
    min-width: 56px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ui-ink-2);
  }

  .bal-num b {
    grid-area: n;
    font-size: 17px;
  }

  .bal-num small {
    grid-area: t;
  }
}
</style>
