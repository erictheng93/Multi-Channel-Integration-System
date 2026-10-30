<template>
  <section class="ui-card step-card report-type-selector">
    <div class="ui-card-head">
      <span
        class="step-n"
        :class="{ done: !!selectedType }"
      >1</span>
      <div>
        <h3 class="ui-card-title">
          報表類型
        </h3>
        <p class="ui-card-sub">
          {{ selectedType ? '已選：' + selectedLabel : '選擇要產生的報表' }}
        </p>
      </div>
    </div>
    <div
      class="type-options"
      role="radiogroup"
      aria-label="報表類型"
    >
      <button
        v-for="(option, index) in typeOptions"
        :key="option.value"
        type="button"
        role="radio"
        class="type-tile"
        :class="[option.value, { selected: selectedType === option.value }]"
        :aria-checked="selectedType === option.value"
        :tabindex="selectedType === option.value || (selectedType === null && index === 0) ? 0 : -1"
        @click="$emit('select', option.value)"
        @keydown="onKey($event, index)"
      >
        <span
          class="type-ico"
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
            <template v-if="option.value === 'conversation_summary'">
              <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
            </template>
            <template v-else-if="option.value === 'agent_performance'">
              <circle
                cx="9"
                cy="8"
                r="4"
              /><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 11l2 2 4-4" />
            </template>
            <template v-else>
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            </template>
          </svg>
        </span>
        <span class="type-info">
          <span class="type-name">{{ option.label }}</span>
          <span class="type-desc">{{ option.description }}</span>
        </span>
        <span
          class="radio"
          aria-hidden="true"
        >
          <svg
            v-if="selectedType === option.value"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><path d="m5 12 5 5 9-10" /></svg>
        </span>
      </button>
    </div>
    <p
      v-if="error"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ReportsAPI from '@/api/reports';
import type { ReportType } from '@/types/reports';

interface Props {
  selectedType: ReportType | null;
  error?: string;
}

const props = withDefaults(defineProps<Props>(), {
  error: undefined
});

const emit = defineEmits<{
  select: [type: ReportType];
}>();

// Only the types the backend can actually generate
const typeOptions = computed(() => ReportsAPI.getGeneratableOptions().types);

const selectedLabel = computed(
  () => typeOptions.value.find(option => option.value === props.selectedType)?.label ?? ''
);


// Arrow keys move the selection like a native radio group
function onKey(event: KeyboardEvent, index: number) {
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  if (!keys.includes(event.key)) { return; }
  event.preventDefault();
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
  const list = typeOptions.value;
  const next = list[(index + step + list.length) % list.length];
  if (next) {
    emit('select', next.value);
    const tiles = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role="radio"]');
    tiles?.[list.indexOf(next)]?.focus();
  }
}
</script>

<style scoped>
.step-card .ui-card-head {
  align-items: center;
}

.step-n {
  display: grid;
  flex: none;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  background: var(--ui-ink);
  font: 700 15px / 1 var(--ui-font-display);
  color: #fff;
}

/* A satisfied step turns brand blue and keeps its number: a tick means finished work, and nothing is finished before the report exists */
.step-n.done {
  background: var(--ui-accent);
  color: #fff;
}

.type-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-items: stretch;
  padding: 4px 22px 20px;
}

.type-tile {
  --hue: var(--ui-accent);
  --hue-soft: var(--ui-accent-soft);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'ico radio'
    'info info';
  gap: 14px 12px;
  align-items: start;
  min-width: 0;
  padding: 16px;
  border: 0;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface);
  box-shadow: inset 0 0 0 1px var(--ui-field-edge);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background var(--ui-dur) var(--ui-ease),
    box-shadow var(--ui-dur) var(--ui-ease);
}

.type-tile.agent_performance {
  --hue: var(--ui-green-ink);
  --hue-soft: var(--ui-green-soft);
}

.type-tile.message_statistics {
  --hue: var(--ui-indigo-ink);
  --hue-soft: var(--ui-indigo-soft);
}

.type-tile:hover:not(.selected) {
  background: var(--ui-surface-2);
}

.type-tile.selected {
  background: var(--ui-sel-tint);
  box-shadow: var(--ui-sel-ring);
}

.type-tile:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.type-ico {
  display: grid;
  grid-area: ico;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 14px;
  background: var(--hue-soft);
  color: var(--hue);
}

.selected .type-ico {
  background: var(--hue);
  color: #fff;
}

.type-ico svg {
  width: 24px;
  height: 24px;
}

.type-info {
  display: grid;
  grid-area: info;
  gap: 2px;
  min-width: 0;
}

.type-name {
  font: 600 17px / 1.25 var(--ui-font-display);
}

.type-desc {
  font-size: 13px;
  line-height: 1.4;
  color: var(--ui-ink-2);
}

.radio {
  display: grid;
  grid-area: radio;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--ui-field-edge);
  color: #fff;
}

.radio svg {
  width: 13px;
  height: 13px;
}

.selected .radio {
  background: var(--hue);
  box-shadow: none;
}

.error-message {
  margin: 0;
  padding: 0 22px 16px;
  font-size: 13px;
  color: var(--ui-red-ink);
}

@media (max-width: 1280px) {
  .type-options {
    grid-template-columns: minmax(0, 1fr);
  }

  .type-tile {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas: 'ico info radio';
    align-items: center;
  }
}

@media (max-width: 768px) {
  .type-options {
    padding: 4px 16px 16px;
  }

  .type-tile {
    padding: 12px;
  }
}
</style>
