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
        :class="{ selected: selectedType === option.value }"
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
        <i
          class="radio"
          aria-hidden="true"
        />
        <ul
          v-if="selectedType === option.value && contentsOf(option.value).length"
          class="type-has"
          :aria-label="`${option.label}會包含`"
        >
          <li
            v-for="item in contentsOf(option.value)"
            :key="item.label"
          >
            {{ item.label }}
          </li>
        </ul>
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
import { REPORT_CONTENTS } from './templates/templateHelpers';
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

const contentsOf = (type: ReportType) => REPORT_CONTENTS[type] ?? [];

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
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 50%;
  background: var(--ui-fill);
  font-size: 13px;
  font-weight: 700;
  color: var(--ui-muted);
}

.step-n.done {
  background: var(--ui-accent);
  font-size: 0;
  color: #fff;
}

.step-n.done::after {
  font-size: 13px;
  content: '\2713';
}

.type-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-items: start;
  padding: 4px 22px 20px;
}

.type-tile {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 4px 12px;
  align-items: start;
  min-width: 0;
  padding: 14px;
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

.type-tile:hover:not(.selected) {
  background: var(--ui-surface-2);
}

.type-tile.selected {
  background: color-mix(in srgb, var(--ui-accent-soft) 60%, var(--ui-surface));
  box-shadow: var(--ui-sel-ring);
}

.type-tile:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.type-ico {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 11px;
  background: var(--ui-fill);
  color: var(--ui-ink-2);
}

.selected .type-ico {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.type-ico svg {
  width: 20px;
  height: 20px;
}

.type-info {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.type-name {
  font-size: 15px;
  font-weight: 600;
}

.type-desc {
  font-size: 13px;
  color: var(--ui-muted);
}

.radio {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--ui-muted);
}

.selected .radio {
  background: radial-gradient(circle, #fff 0 30%, var(--ui-accent) 32%);
  box-shadow: none;
}

.type-has {
  display: flex;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  gap: 6px;
  margin: 8px 0 0;
  padding: 10px 0 0;
  list-style: none;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.type-has li {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--ui-surface);
  font-size: 13px;
  color: var(--ui-ink-2);
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
}

@media (max-width: 768px) {
  .type-options {
    padding: 4px 16px 16px;
  }

  .type-tile {
    padding: 12px;
  }

  .type-desc {
    display: none;
  }

  .type-tile:not(.selected) .type-info {
    align-self: center;
  }
}
</style>
