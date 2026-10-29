<template>
  <button
    type="button"
    class="ui-card template-card"
    :class="{ selected: isSelected, unsupported: !supported }"
    :aria-pressed="isSelected"
    :aria-disabled="!supported"
    :disabled="!supported"
    @click="$emit('select', template)"
  >
    <span class="card-top">
      <span
        class="tpl-ico"
        :class="template.category"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
      </span>
      <span class="template-name">{{ template.name }}</span>
    </span>
    <span class="template-description">{{ template.description }}</span>
    <span class="card-foot">
      <span
        class="ui-tag category-badge"
        :class="template.category"
      >{{ getCategoryLabel(template.category) }}</span>
      <span
        v-if="isSelected"
        class="ui-pill ui-pill-blue"
      >已選取</span>
      <span
        v-if="!supported"
        class="ui-pill"
      >尚未支援</span>
    </span>
  </button>
</template>

<script setup lang="ts">
import type { ReportTemplate } from '@/types/reports';
import { getCategoryLabel } from './templateHelpers';

withDefaults(defineProps<{
  template: ReportTemplate;
  isSelected: boolean;
  /** False when the backend cannot generate this template's report type */
  supported?: boolean;
}>(), {
  supported: true
});

defineEmits<{
  select: [template: ReportTemplate];
}>();
</script>

<style scoped>
.template-card {
  display: grid;
  gap: 10px;
  width: 100%;
  padding: 16px;
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    box-shadow var(--ui-dur) var(--ui-ease),
    transform var(--ui-dur) var(--ui-ease);
}

.template-card:hover:not(:disabled) {
  box-shadow: var(--ui-shadow-raised);
  transform: translateY(-1px);
}

.template-card.selected {
  background: color-mix(in srgb, var(--ui-accent-soft) 60%, var(--ui-surface));
  box-shadow: var(--ui-sel-ring), var(--ui-shadow-raised);
}

.template-card.unsupported {
  cursor: not-allowed;
}

.template-card.unsupported .card-top,
.template-card.unsupported .template-description {
  opacity: 0.55;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.tpl-ico {
  display: grid;
  flex: none;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 11px;
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.tpl-ico svg {
  width: 18px;
  height: 18px;
}

.tpl-ico.enterprise {
  background: var(--ui-indigo-soft);
  color: var(--ui-indigo);
}

.tpl-ico.business_intelligence {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.tpl-ico.advanced_analytics {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.template-name {
  overflow: hidden;
  font: 600 15px var(--ui-font-display);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-description {
  min-height: 38px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-muted);
}

.card-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.category-badge.enterprise {
  background: var(--ui-p-lavender);
  color: var(--ui-p-lavender-ink);
}

.category-badge.basic {
  background: var(--ui-p-sky);
  color: var(--ui-p-sky-ink);
}

.category-badge.business_intelligence {
  background: var(--ui-p-mint);
  color: var(--ui-p-mint-ink);
}

.category-badge.advanced_analytics {
  background: var(--ui-p-peach);
  color: var(--ui-p-peach-ink);
}
</style>
