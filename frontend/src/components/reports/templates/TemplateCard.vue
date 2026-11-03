<!-- One ready-made template as a selectable card: a small paper thumbnail drawn from the template's latest real report
     (donut of conversation states / bars of agent messages), its name, what it is, and the one figure it opens with.
     The output preview and the actions live in the parent. -->
<template>
  <button
    type="button"
    class="tpl-row"
    :class="{ 'is-on': selected }"
    role="radio"
    :aria-checked="selected"
    @click="$emit('select', template)"
  >
    <span
      class="tpl-paper"
      aria-hidden="true"
    >
      <svg
        v-if="!sheet.isAgents"
        viewBox="0 0 48 48"
      >
        <circle
          class="bg"
          cx="24"
          cy="24"
          r="16"
        />
        <circle
          v-for="seg in segments"
          :key="seg.tone"
          class="seg"
          :class="seg.tone"
          cx="24"
          cy="24"
          r="16"
          :stroke-dasharray="seg.dash"
          :stroke-dashoffset="seg.offset"
        />
      </svg>
      <svg
        v-else
        viewBox="0 0 48 48"
      >
        <rect
          v-for="(bar, i) in miniBars"
          :key="i"
          class="bar"
          :class="{ ghost: !sheet.live }"
          x="6"
          :y="7 + i * 9"
          rx="2"
          height="5"
          :width="bar"
        />
      </svg>
    </span>
    <span class="tpl-main">
      <b class="tpl-name">{{ template.name }}</b>
      <span class="tpl-desc">{{ template.description }}</span>
      <span class="tpl-fig">{{ figure }}</span>
    </span>
    <i
      class="radio"
      aria-hidden="true"
    />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ReportTemplate } from '@/types/reports';
import type { LatestReport } from './latestReport';
import { readSheet } from './sheetData';

const props = defineProps<{
  template: ReportTemplate;
  selected: boolean;
  state: LatestReport | null;
}>();

defineEmits<{
  select: [template: ReportTemplate];
}>();

const sheet = computed(() => readSheet(props.template.type, props.state));

const CIRC = 2 * Math.PI * 16;
const segments = computed(() => {
  const { parts, total } = sheet.value;
  const visible = parts.filter(p => p.value > 0);
  let acc = 0;
  return visible.map(p => {
    const len = (p.value / total) * CIRC;
    const seg = { tone: p.tone, dash: `${Math.max(0.5, len - 1.2)} ${CIRC}`, offset: -acc };
    acc += len;
    return seg;
  });
});

// four bars on one scale, widest = full width
const miniBars = computed(() => {
  const list = sheet.value.live ? sheet.value.agents.slice(0, 4) : [{ name: '', value: 4 }, { name: '', value: 3 }, { name: '', value: 2 }];
  const max = Math.max(1, ...list.map(a => a.value));
  return list.map(a => Math.max(3, Math.round((a.value / max) * 36)));
});

const figure = computed(() => {
  const s = sheet.value;
  if (!s.live) { return '尚無樣本數值'; }
  return s.isAgents
    ? `${s.agents.length} 位客服 ・ ${s.agentSum.toLocaleString('en-US')} 則訊息`
    : `${s.total.toLocaleString('en-US')} 個對話 ・ ${s.parts[1]?.value ?? 0} 已結案`;
});
</script>

<style scoped>
.tpl-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  width: 100%;
  padding: 14px 16px;
  border: 0;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface);
  color: var(--ui-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.tpl-row:hover {
  background: var(--ui-fill);
}

.tpl-row.is-on {
  background: var(--ui-sel-tint);
  box-shadow: inset 0 0 0 2px var(--ui-accent);
}

.tpl-row:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

/* a sheet of paper, portrait, with the template's own mini chart */
.tpl-paper {
  display: grid;
  width: 48px;
  height: 58px;
  place-items: center;
  border-radius: 8px;
  background: var(--ui-surface);
  box-shadow: 0 0 0 0.5px var(--ui-field-edge), 0 2px 6px rgba(0, 0, 0, 0.08);
}

.tpl-paper svg {
  width: 38px;
  height: 38px;
}

.tpl-paper circle {
  fill: none;
  stroke-width: 7;
  transform: rotate(-90deg);
  transform-origin: 24px 24px;
}

.tpl-paper .bg {
  stroke: var(--ui-fill);
}

.tpl-paper .seg {
  stroke: var(--ui-blue);
}

.tpl-paper .seg.green {
  stroke: var(--ui-green);
}

.tpl-paper .seg.grey {
  stroke: var(--ui-fill-strong);
}

.tpl-paper .bar {
  fill: var(--ui-blue);
}

.tpl-paper .bar.ghost {
  fill: var(--ui-fill);
}

.tpl-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.tpl-name {
  font: 600 17px / 1.3 var(--ui-font-display);
}

.tpl-desc {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.tpl-fig {
  margin-top: 2px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-muted);
}

.radio {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--ui-field-edge);
  transition: box-shadow var(--ui-dur) var(--ui-ease);
}

.is-on .radio {
  box-shadow: inset 0 0 0 6px var(--ui-accent);
}

/* phone: a two-way switch, name + figure under a small paper */
@media (max-width: 768px) {
  .tpl-row {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 10px;
    padding: 10px 12px;
  }

  .tpl-paper {
    width: 34px;
    height: 42px;
  }

  .tpl-paper svg {
    width: 26px;
    height: 26px;
  }

  .tpl-row .radio,
  .tpl-desc {
    display: none;
  }

  .tpl-name {
    font-size: 15px;
  }
}
</style>
