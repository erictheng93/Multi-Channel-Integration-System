<template>
  <article class="ui-card template-card">
    <header class="tc-head">
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
      <div class="tc-title">
        <h2 class="template-name">
          {{ template.name }}
        </h2>
        <p class="template-description">
          {{ template.description }}
        </p>
      </div>
      <span class="ui-tag category-badge">{{ getCategoryLabel(template.category) }}</span>
    </header>

    <section
      class="tc-contents"
      :aria-label="`${template.name}的報表內容`"
    >
      <h3 class="tc-h">
        報表內容
      </h3>
      <ul class="tc-list">
        <li
          v-for="item in contents"
          :key="item.label"
        >
          <span class="tc-text">
            <b>{{ item.label }}</b>
            <span>{{ item.hint }}</span>
          </span>
          <code>{{ item.field }}</code>
        </li>
      </ul>
      <div
        v-if="shape"
        class="tc-shape"
        role="group"
        :aria-label="`${template.name}的輸出欄位`"
      >
        <span class="tc-shape-h">輸出欄位</span>
        <div class="tc-cols">
          <code
            v-for="column in shape.columns"
            :key="column"
          >{{ column }}</code>
        </div>
        <span class="tc-shape-row">{{ shape.row }}</span>
      </div>
    </section>

    <dl class="tc-meta">
      <div>
        <dt>預設範圍</dt>
        <dd>近 30 天</dd>
      </div>
      <div>
        <dt>輸出格式</dt>
        <dd>JSON</dd>
      </div>
      <div v-if="template.presetOptions.maxRecords">
        <dt>筆數上限</dt>
        <dd>{{ template.presetOptions.maxRecords.toLocaleString('en-US') }}</dd>
      </div>
      <div v-if="template.estimatedTime">
        <dt>預估時間</dt>
        <dd>約 {{ formatEstimatedTime(template.estimatedTime) }}</dd>
      </div>
    </dl>

    <footer class="tc-foot">
      <button
        type="button"
        class="btn btn-ghost"
        :disabled="generating"
        @click="$emit('customize', template)"
      >
        調整後產生
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="generating"
        @click="$emit('use', template)"
      >
        {{ generating ? '產生中...' : '直接產生' }}
      </button>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ReportTemplate } from '@/types/reports';
import { REPORT_CONTENTS, REPORT_OUTPUT_SHAPES, formatEstimatedTime, getCategoryLabel } from './templateHelpers';

const props = withDefaults(defineProps<{
  template: ReportTemplate;
  generating?: boolean;
}>(), {
  generating: false
});

defineEmits<{
  use: [template: ReportTemplate];
  customize: [template: ReportTemplate];
}>();

const contents = computed(() => REPORT_CONTENTS[props.template.type] ?? []);
const shape = computed(() => REPORT_OUTPUT_SHAPES[props.template.type] ?? null);
</script>

<style scoped>
.template-card {
  display: flex;
  flex-direction: column;
  gap: 26px;
  padding: 28px;
}

.tc-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
}

.tpl-ico {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 15px;
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.tpl-ico svg {
  width: 24px;
  height: 24px;
}

.template-name {
  margin: 0;
  font: 600 20px / 1.25 var(--ui-font-display);
  letter-spacing: -0.01em;
}

.template-description {
  margin: 4px 0 0;
  font-size: 13.5px;
  line-height: 1.45;
  color: var(--ui-muted);
}

.category-badge {
  background: var(--ui-p-sky);
  color: var(--ui-p-sky-ink);
  font-weight: 600;
}

.tc-h {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.tc-contents {
  flex: 1;
}

.tc-list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tc-list li {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.tc-list li:first-child {
  box-shadow: none;
}

.tc-text {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.tc-text b {
  font-size: 14px;
  font-weight: 600;
}

.tc-text span {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--ui-muted);
}

.tc-list code,
.tc-cols code {
  flex: none;
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--ui-fill);
  font: 12px / 1.5 var(--ui-font-mono);
  color: var(--ui-ink-2);
  overflow-wrap: anywhere;
}

/* A mini table header: the columns the report writes, and what one row stands for */
.tc-shape {
  display: grid;
  gap: 8px;
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
}

.tc-shape-h {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.tc-cols {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tc-cols code {
  background: var(--ui-surface);
  box-shadow: 0 0 0 0.5px var(--ui-sep);
}

.tc-shape-row {
  font-size: 12.5px;
  color: var(--ui-muted);
}

.tc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 28px;
  margin: 0;
  padding-top: 16px;
  border-top: 0.5px solid var(--ui-sep);
}

.tc-meta dt {
  font-size: 12px;
  color: var(--ui-muted);
}

.tc-meta dd {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.tc-foot {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .template-card {
    gap: 16px;
    padding: 18px;
  }

  .tc-head {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .category-badge {
    grid-column: 1 / -1;
    grid-row: 1;
    justify-self: start;
  }

  .tc-list li {
    flex-wrap: wrap;
    gap: 4px 12px;
  }

  .tc-foot .btn {
    flex: 1;
    justify-content: center;
  }
}
</style>
