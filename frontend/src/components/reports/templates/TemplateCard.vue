<template>
  <article
    class="ui-card template-card"
    :class="{ selected: isSelected }"
  >
    <button
      type="button"
      class="card-body"
      :aria-pressed="isSelected"
      :aria-label="`${template.name}，查看詳情`"
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
      <span class="template-meta">
        <span v-if="template.presetOptions.chartType">{{ getChartTypeLabel(template.presetOptions.chartType) }}</span>
        <span v-if="template.presetOptions.maxRecords">最多 {{ template.presetOptions.maxRecords.toLocaleString() }} 筆</span>
        <span v-if="template.estimatedTime">約 {{ formatEstimatedTime(template.estimatedTime) }}</span>
      </span>
    </button>
    <span class="card-foot">
      <span
        class="ui-tag category-badge"
        :class="template.category"
      >{{ getCategoryLabel(template.category) }}</span>
      <button
        type="button"
        class="btn btn-primary btn-sm use-btn"
        :disabled="generating"
        @click="$emit('use', template)"
      >
        {{ generating ? '產生中...' : '使用' }}
      </button>
    </span>
  </article>
</template>

<script setup lang="ts">
import type { ReportTemplate } from '@/types/reports';
import { formatEstimatedTime, getCategoryLabel, getChartTypeLabel } from './templateHelpers';

withDefaults(defineProps<{
  template: ReportTemplate;
  isSelected: boolean;
  generating?: boolean;
}>(), {
  generating: false
});

defineEmits<{
  select: [template: ReportTemplate];
  use: [template: ReportTemplate];
}>();
</script>

<style scoped>
.template-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  transition:
    box-shadow var(--ui-dur) var(--ui-ease),
    background-color var(--ui-dur) var(--ui-ease);
}

.template-card:hover {
  box-shadow: var(--ui-shadow-raised);
}

.template-card.selected {
  background: color-mix(in srgb, var(--ui-accent-soft) 60%, var(--ui-surface));
  box-shadow: var(--ui-shadow-raised);
}

.card-body {
  display: grid;
  gap: 10px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
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
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-muted);
}

.template-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 0;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.template-meta span + span::before {
  margin: 0 8px;
  content: '·';
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
