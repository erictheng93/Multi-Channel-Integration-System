<!-- One ready-made template as a selectable row; the output preview and the actions live in the parent -->
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
      class="tpl-ico"
      :class="template.type"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          v-if="template.type === 'agent_performance'"
          d="M4 20V10M10 20V4M16 20v-7M22 20H2"
        />
        <path
          v-else
          d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z"
        />
      </svg>
    </span>
    <span class="tpl-main">
      <b class="tpl-name">{{ template.name }}</b>
      <span class="tpl-desc">{{ template.description }}</span>
      <span class="tpl-meta">{{ meta }}</span>
      <span
        v-if="contents.length"
        class="tpl-has"
      >包含 {{ contents.map(item => item.label).join('、') }}</span>
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
import { formatEstimatedTime, REPORT_CONTENTS } from './templateHelpers';

const props = defineProps<{
  template: ReportTemplate;
  selected: boolean;
}>();

defineEmits<{
  select: [template: ReportTemplate];
}>();

const contents = computed(() => REPORT_CONTENTS[props.template.type] ?? []);

const meta = computed(() => {
  const parts = ['近 30 天', 'JSON'];
  if (props.template.estimatedTime) {
    parts.push(`約 ${formatEstimatedTime(props.template.estimatedTime)}`);
  }
  return parts.join(' ・ ');
});
</script>

<style scoped>
.tpl-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  width: 100%;
  padding: 16px 18px;
  border: 0;
  border-radius: var(--ui-r-inner);
  background: transparent;
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

.tpl-ico {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: var(--ui-fill);
  color: var(--ui-ink-2);
}

.is-on .tpl-ico {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.tpl-ico svg {
  width: 20px;
  height: 20px;
}

.tpl-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.tpl-name {
  font: 600 16px / 1.3 var(--ui-font-display);
}

.tpl-desc {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.tpl-meta {
  margin-top: 2px;
  font-size: 13px;
  color: var(--ui-muted);
}

.tpl-has {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-ink-2);
}

@media (max-width: 768px) {
  .tpl-has {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
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
</style>
