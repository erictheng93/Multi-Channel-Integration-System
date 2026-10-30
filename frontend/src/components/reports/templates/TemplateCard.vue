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

    <!-- What the generator writes into the file: its real fields, drawn as an empty sheet (no sample numbers) -->
    <div
      class="sheet"
      role="img"
      :aria-label="`${template.name}產出的欄位：${contents.map((c) => c.label).join('、')}`"
    >
      <div class="sheet-bar">
        <span class="sheet-file">{ } JSON</span>
        <span class="sheet-range">近 30 天</span>
      </div>
      <div
        v-if="template.type === 'agent_performance'"
        class="sheet-body"
      >
        <div class="sheet-kpi">
          <span class="sheet-k">客服人數</span><i class="sk sk-s" />
        </div>
        <div class="sheet-table">
          <div class="sheet-th">
            <span>客服</span><span>對話</span><span>訊息</span>
          </div>
          <div
            v-for="n in 4"
            :key="n"
            class="sheet-tr"
          >
            <span class="sheet-who"><i class="sk-dot" /><i
              class="sk"
              :style="{ width: `${88 - n * 9}%` }"
            /></span>
            <i class="sk sk-s" />
            <i class="sk sk-s" />
          </div>
        </div>
      </div>
      <div
        v-else
        class="sheet-body"
      >
        <div class="sheet-tiles">
          <div
            v-for="item in contents.slice(0, 3)"
            :key="item.label"
            class="sheet-tile"
          >
            <span class="sheet-k">{{ item.label }}</span><i class="sk sk-m" />
          </div>
        </div>
        <div class="sheet-period">
          <span class="sheet-k">統計期間</span>
          <i
            class="sk"
            style="width: 46%"
          />
        </div>
      </div>
    </div>

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
        </li>
      </ul>
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
import { REPORT_CONTENTS, formatEstimatedTime, getCategoryLabel } from './templateHelpers';

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
</script>

<style scoped>
/* Output preview: a quiet document sheet with the generator's own field labels over skeleton values */
.sheet {
  display: flex;
  flex-direction: column;
  min-height: 300px;
  overflow: hidden;
  border-radius: 16px;
  background: var(--ui-surface-2);
  box-shadow: inset 0 0 0 0.5px var(--ui-sep);
}

.sheet-bar {
  display: flex;
  justify-content: space-between;
  padding: 10px 16px;
  box-shadow: 0 0.5px 0 var(--ui-sep);
  font-size: 13px;
  color: var(--ui-ink-2);
}

.sheet-file {
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.sheet-body {
  display: grid;
  flex: 1;
  align-content: start;
  gap: 14px;
  padding: 16px;
}

.sheet-tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.sheet-tile,
.sheet-kpi {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--ui-surface);
}

.sheet-k {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-ink-2);
}

.sk,
.sk-dot {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: var(--ui-fill-strong);
}

.sk-s {
  width: 44px;
  justify-self: end;
}

.sheet-kpi {
  grid-template-columns: 1fr auto;
  align-items: center;
}

.sheet-tile .sk-m {
  width: 60%;
  height: 16px;
}

.sheet-period {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--ui-surface);
}

.sheet-table {
  overflow: hidden;
  border-radius: 12px;
  background: var(--ui-surface);
}

.sheet-th,
.sheet-tr {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px 64px;
  gap: 12px;
  align-items: center;
  padding: 9px 14px;
}

.sheet-th {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-ink-2);
  box-shadow: 0 0.5px 0 var(--ui-sep);
}

.sheet-th span:not(:first-child) {
  text-align: right;
}

.sheet-tr + .sheet-tr {
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.sheet-who {
  display: flex;
  gap: 10px;
  align-items: center;
}

.sk-dot {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.sheet-who .sk {
  height: 10px;
}

.sheet-tr .sk-s {
  width: 100%;
}

.template-card {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 24px;
}

.tc-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
}

.tpl-ico {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 12px;
  background: var(--section-hue-soft);
  color: var(--section-ink);
}

.tpl-ico svg {
  width: 22px;
  height: 22px;
}

.template-name {
  margin: 0;
  font: 600 19px / 1.25 var(--ui-font-display);
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 24px;
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

.tc-list li:nth-child(-n + 2) {
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
  font-size: 13px;
  line-height: 1.4;
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

  .sheet {
    min-height: 0;
  }

  .tc-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .tc-list li:nth-child(2) {
    box-shadow: 0 -0.5px 0 var(--ui-sep);
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
