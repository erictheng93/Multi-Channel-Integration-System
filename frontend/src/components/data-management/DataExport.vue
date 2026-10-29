<!-- 匯出對話記錄 - 資料管理子頁面 -->
<!-- Pick a format here; the existing ExportDialog collects date, customer and agent filters -->

<template>
  <div class="ui-page data-export">
    <UiPageHead
      title="匯出對話"
      :subtitle="`選擇檔案格式後開始匯出，單次最多 ${EXPORT_LIMIT.toLocaleString()} 筆。`"
    />

    <section class="export-grid">
      <article class="ui-card choose">
        <div class="ui-card-head">
          <div>
            <h2 class="ui-card-title">
              檔案格式
            </h2>
            <div class="ui-card-sub">
              日期、客戶與客服人員的篩選在下一步設定
            </div>
          </div>
        </div>

        <div
          class="fmt-list"
          role="radiogroup"
          aria-label="匯出格式"
        >
          <button
            v-for="format in formats"
            :key="format.id"
            type="button"
            class="fmt-row"
            :class="{ 'is-selected': selectedFormat === format.id }"
            role="radio"
            :aria-checked="selectedFormat === format.id"
            @click="selectFormat(format.id)"
          >
            <span
              class="fmt-ico"
              :class="format.tone"
              aria-hidden="true"
            >{{ format.icon }}</span>
            <span class="fmt-text">
              <b>{{ format.name }}<small>{{ format.tagline }}</small></b>
              <span class="fmt-use">{{ format.usecases.join('、') }}</span>
            </span>
            <i
              class="radio"
              aria-hidden="true"
            />
          </button>
        </div>

        <div class="choose-foot">
          <span class="choose-note">
            未設定篩選時匯出全部記錄，最多 {{ EXPORT_LIMIT.toLocaleString() }} 筆，超出部分會被截斷。
          </span>
          <button
            type="button"
            class="btn btn-primary"
            @click="openExportDialog"
          >
            <DownloadIcon :size="16" />
            開始匯出 {{ selectedName }}
          </button>
        </div>
      </article>

      <aside class="ui-card next">
        <div class="ui-card-head">
          <div>
            <h2 class="ui-card-title">
              接下來
            </h2>
            <div class="ui-card-sub">
              三個步驟完成匯出
            </div>
          </div>
        </div>
        <ol class="steps">
          <li
            v-for="(step, i) in steps"
            :key="step.title"
            class="step"
          >
            <span
              class="step-n"
              aria-hidden="true"
            >{{ i + 1 }}</span>
            <span class="step-t">
              <b>{{ step.title }}</b>
              <span>{{ step.text }}</span>
            </span>
          </li>
        </ol>
      </aside>
    </section>

    <UiActionBar
      class="export-actions"
      label="匯出"
    >
      <button
        type="button"
        class="btn btn-primary"
        @click="openExportDialog"
      >
        <DownloadIcon :size="16" />
        開始匯出 {{ selectedName }}
      </button>
    </UiActionBar>

    <!-- ExportDialog Modal (reuse existing component) -->
    <ExportDialog
      :show="showExportDialog"
      :initial-format="selectedFormat"
      @close="showExportDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
import { computed, ref } from 'vue'
import UiActionBar from '@/components/ui/UiActionBar.vue'
import { DownloadIcon } from '@/components/icons'
import ExportDialog from '@/components/conversation/ExportDialog.vue'

type FormatId = 'json' | 'csv' | 'txt' | 'pdf'

/** Server-side cap per export (see the backend export handler); the dialog warns about it too. */
const EXPORT_LIMIT = 5000

const showExportDialog = ref(false)
const selectedFormat = ref<FormatId>('json')

const formats = [
  {
    id: 'json' as const,
    name: 'JSON',
    tagline: '結構化資料',
    icon: '{ }',
    tone: 'blue',
    description: '完整的結構化資料格式，包含所有欄位和中繼資訊，適合程式化處理和資料分析。',
    usecases: ['API 整合', '資料分析', '系統備份']
  },
  {
    id: 'csv' as const,
    name: 'CSV',
    tagline: '試算表格式',
    icon: 'CSV',
    tone: 'green',
    description: '以逗號分隔的表格格式，可直接在 Excel 或 Google Sheets 中開啟和分析。',
    usecases: ['Excel 報表', '統計分析', '團隊共享']
  },
  {
    id: 'txt' as const,
    name: 'TXT',
    tagline: '純文字聊天記錄',
    icon: 'TXT',
    tone: 'lavender',
    description: '人類可讀的純文字格式，按對話分組，每則訊息包含時間和發送者。',
    usecases: ['直接閱讀', '品質審查', '列印備份']
  },
  {
    id: 'pdf' as const,
    name: 'PDF',
    tagline: '可攜式報告',
    icon: 'PDF',
    tone: 'red',
    description: '專業排版的可攜式文件，完整支援中文，適合列印、存檔和對外分享。',
    usecases: ['列印報告', '正式存檔', '對外分享']
  }
]

const steps = [
  { title: '選擇格式', text: '挑選要下載的檔案格式' },
  { title: '設定範圍', text: '在匯出視窗指定日期、客戶，或只匯出某位客服送出的訊息' },
  { title: '下載檔案', text: '確認後產生檔案並下載到本機' }
]

const selectedName = computed(() => formats.find(f => f.id === selectedFormat.value)?.name ?? '')

function openExportDialog() {
  showExportDialog.value = true
}

function selectFormat(format: FormatId) {
  selectedFormat.value = format
}
</script>

<style scoped>
.export-grid {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: 16px;
  align-items: stretch;
}

.choose {
  display: flex;
  flex-direction: column;
}

.fmt-list {
  display: grid;
  padding: 0 12px;
}

.fmt-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 64px;
  padding: 10px 10px;
  border: 0;
  border-radius: var(--ui-r-inner);
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.fmt-row:hover {
  background: color-mix(in srgb, var(--ui-fill) 55%, transparent);
}

.fmt-row:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.fmt-row.is-selected {
  background: var(--ui-sel-tint);
  box-shadow: var(--ui-sel-ring);
}

.fmt-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  font: 600 12px var(--ui-font-mono);
}

.fmt-ico.blue {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.fmt-ico.green {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.fmt-ico.lavender {
  background: var(--ui-p-lavender);
  color: var(--ui-p-lavender-ink);
}

.fmt-ico.red {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.fmt-text {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.fmt-text b {
  font: 600 15px / 1.3 var(--ui-font-display);
  letter-spacing: -0.01em;
}

.fmt-text b small {
  margin-left: 8px;
  font: 500 13px var(--ui-font-ui);
  letter-spacing: 0;
  color: var(--ui-muted);
}

.fmt-use {
  overflow: hidden;
  font-size: 13px;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radio {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--ui-faint);
  transition: box-shadow var(--ui-dur) var(--ui-ease);
}

.is-selected .radio {
  box-shadow: inset 0 0 0 6px var(--ui-accent);
}

.choose-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  margin-top: auto;
  padding: 16px 22px 20px;
}

.choose-note {
  flex: 1 1 240px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ui-muted);
}

.steps {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0 22px 20px;
  list-style: none;
}

.step {
  display: flex;
  gap: 14px;
  padding: 10px 0;
}

.step-n {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ui-accent-soft);
  font: 600 13px var(--ui-font-display);
  color: var(--ui-accent);
}

.step-t {
  display: grid;
  gap: 2px;
}

.step-t b {
  font-size: 14px;
}

.step-t span {
  font-size: 13px;
  line-height: 1.5;
  color: var(--ui-muted);
}

/* The card footer carries the CTA on larger screens; phones get the sticky action bar */
.export-actions {
  display: none;
}

@media (max-width: 1280px) {
  .export-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .choose-foot {
    display: none;
  }

  .export-actions {
    display: flex;
  }

  .fmt-list {
    padding: 0 8px 12px;
  }

  .steps {
    padding: 0 16px 16px;
  }
}
</style>
