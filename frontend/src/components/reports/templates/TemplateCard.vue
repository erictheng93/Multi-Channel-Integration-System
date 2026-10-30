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
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      ><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
    </span>
    <span class="tpl-main">
      <b class="tpl-name">{{ template.name }}</b>
      <span class="tpl-desc">{{ template.description }}</span>
      <span class="tpl-meta">{{ meta }}</span>
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
import { formatEstimatedTime } from './templateHelpers';

const props = defineProps<{
  template: ReportTemplate;
  selected: boolean;
}>();

defineEmits<{
  select: [template: ReportTemplate];
}>();

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
  align-items: start;
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
  background: var(--section-hue-soft);
  color: var(--section-ink);
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

.radio {
  width: 20px;
  height: 20px;
  margin-top: 2px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--ui-field-edge);
  transition: box-shadow var(--ui-dur) var(--ui-ease);
}

.is-on .radio {
  box-shadow: inset 0 0 0 6px var(--ui-accent);
}
</style>
