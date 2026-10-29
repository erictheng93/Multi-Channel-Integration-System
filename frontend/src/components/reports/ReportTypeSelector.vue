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
        v-for="option in typeOptions"
        :key="option.value"
        type="button"
        role="radio"
        class="type-option"
        :class="{ selected: selectedType === option.value }"
        :aria-checked="selectedType === option.value"
        @click="$emit('select', option.value)"
      >
        <span
          class="radio"
          aria-hidden="true"
        />
        <span class="type-info">
          <span class="type-name">{{ option.label }}</span>
          <span class="type-desc">{{ option.description }}</span>
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

defineEmits<{
  select: [type: ReportType];
}>();

// Only the types the backend can actually generate
const typeOptions = computed(() => ReportsAPI.getGeneratableOptions().types);

const selectedLabel = computed(
  () => typeOptions.value.find(option => option.value === props.selectedType)?.label ?? ''
);
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
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ui-muted);
}

.step-n.done {
  background: var(--ui-accent);
  color: #fff;
}

.type-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 4px 22px 20px;
}

.type-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border: 0;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
  box-shadow: inset 0 0 0 0.5px var(--ui-sep);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background var(--ui-dur) var(--ui-ease),
    box-shadow var(--ui-dur) var(--ui-ease);
}

.type-option.selected {
  background: color-mix(in srgb, var(--ui-accent-soft) 60%, var(--ui-surface));
  box-shadow: var(--ui-sel-ring);
}

.radio {
  flex: none;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--ui-faint);
}

.selected .radio {
  background: radial-gradient(circle, #fff 0 30%, var(--ui-accent) 32%);
  box-shadow: none;
}

.type-info {
  display: grid;
  gap: 2px;
}

.type-name {
  font-size: 14px;
  font-weight: 600;
}

.type-desc {
  font-size: 12.5px;
  color: var(--ui-muted);
}

.error-message {
  margin: 0;
  padding: 0 22px 16px;
  font-size: 12.5px;
  color: var(--ui-red-ink);
}

@media (max-width: 768px) {
  .type-options {
    grid-template-columns: 1fr;
    padding: 4px 16px 16px;
  }
}
</style>
