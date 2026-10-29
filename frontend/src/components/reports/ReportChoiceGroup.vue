<!--
  ReportChoiceGroup.vue

  The one choice-tile pattern of the report generator (type, time range, format): a radiogroup
  of tiles with a radio dot, a name and an optional description.
-->
<template>
  <div
    class="choice-group"
    :class="{ 'is-compact': compact }"
    role="radiogroup"
    :style="columns ? { '--choice-cols': columns } : undefined"
    :aria-label="label"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="choice-tile"
      :class="{ selected: modelValue === option.value }"
      :aria-checked="modelValue === option.value"
      :tabindex="modelValue === option.value || (modelValue === null && option === options[0]) ? 0 : -1"
      @click="$emit('update:modelValue', option.value)"
      @keydown="onKey($event, option.value)"
    >
      <span
        class="radio"
        aria-hidden="true"
      />
      <span class="choice-info">
        <span class="choice-name">{{ option.label }}</span>
        <span
          v-if="option.description"
          class="choice-desc"
        >{{ option.description }}</span>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
export interface ChoiceOption {
  value: string
  label: string
  description?: string
}

const props = withDefaults(defineProps<{
  modelValue: string | null
  options: ChoiceOption[]
  label: string
  /** Name-only tiles in a denser grid (time ranges) */
  compact?: boolean
  /** Fixed column count on desktop (default 2, or auto-fill when compact) */
  columns?: number
}>(), {
  compact: false,
  columns: undefined
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Arrow keys move the selection like a native radio group
function onKey(event: KeyboardEvent, current: string) {
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
  if (!keys.includes(event.key)) { return }
  event.preventDefault()
  const index = props.options.findIndex(option => option.value === current)
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
  const next = props.options[(index + step + props.options.length) % props.options.length]
  if (next) {
    emit('update:modelValue', next.value)
    const group = (event.currentTarget as HTMLElement).parentElement
    const tiles = group?.querySelectorAll<HTMLElement>('[role="radio"]')
    tiles?.[props.options.indexOf(next)]?.focus()
  }
}
</script>

<style scoped>
.choice-group {
  display: grid;
  grid-template-columns: repeat(var(--choice-cols, 2), minmax(0, 1fr));
  gap: 10px;
}

.choice-group.is-compact {
  gap: 8px;
}

.choice-tile {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
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

.is-compact .choice-tile {
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
}

.choice-tile:hover:not(.selected) {
  background: var(--ui-fill);
}

.choice-tile.selected {
  background: color-mix(in srgb, var(--ui-accent-soft) 60%, var(--ui-surface));
  box-shadow: var(--ui-sel-ring);
}

.radio {
  flex: none;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--ui-muted);
}

.is-compact .radio {
  width: 16px;
  height: 16px;
  margin-top: 0;
}

.selected .radio {
  background: radial-gradient(circle, #fff 0 30%, var(--ui-accent) 32%);
  box-shadow: none;
}

.choice-info {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.choice-name {
  font-size: 14px;
  font-weight: 600;
}

.is-compact .choice-name {
  font-size: 13px;
  font-weight: 500;
}

.is-compact .selected .choice-name {
  font-weight: 600;
}

.choice-desc {
  font-size: 13px;
  color: var(--ui-muted);
}

@media (max-width: 768px) {
  .choice-group {
    grid-template-columns: 1fr;
  }

  .choice-group.is-compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
