<!-- 匯出對話記錄 - 資料管理子頁面 -->
<!-- Pick a format here; the existing ExportDialog collects date, customer and agent filters -->

<template>
  <div class="ui-page rl-page data-export">
    <UiPageHead
      title="匯出對話"
      :subtitle="`選擇檔案格式後開始匯出，單次最多 ${EXPORT_LIMIT.toLocaleString()} 筆。`"
    />

    <div class="ex-grid">
      <section
        class="ex-pick"
        aria-label="選擇格式"
      >
        <h2 class="ui-group-label">
          檔案格式
        </h2>
        <div
          class="ui-group ex-list"
          role="radiogroup"
          aria-label="匯出格式"
        >
          <button
            v-for="format in formats"
            :key="format.id"
            type="button"
            class="ex-row"
            :class="{ 'is-on': selectedFormat === format.id }"
            role="radio"
            :aria-checked="selectedFormat === format.id"
            @click="selectFormat(format.id)"
          >
            <span
              class="fmt-ico"
              :class="format.tone"
              aria-hidden="true"
            >{{ format.icon }}</span>
            <span class="ex-main">
              <b class="ex-name">{{ format.name }}<span class="ex-tag">{{ format.tagline }}</span></b>
              <span class="ex-use">{{ format.usecases.join('、') }}</span>
            </span>
            <i
              class="radio"
              aria-hidden="true"
            />
          </button>
        </div>
      </section>

      <section
        class="ui-lead ex-sheet"
        :aria-label="`${selectedName} 檔案內容`"
      >
        <header class="sheet-bar">
          <span class="sheet-file">{{ selectedName }} 檔案內容</span>
          <span class="sheet-unit">{{ selectedUnit }}</span>
        </header>

        <dl class="sheet-rows">
          <div
            v-for="row in selectedRows"
            :key="row.note"
            class="sheet-row"
          >
            <dt v-if="row.key">
              {{ row.key }}
            </dt>
            <dd :class="{ 'is-wide': !row.key }">
              {{ row.note }}
            </dd>
          </div>
        </dl>

        <div class="sheet-scope">
          <div class="scope-fact">
            <span>單次上限</span>
            <b>{{ EXPORT_LIMIT.toLocaleString() }} 筆</b>
          </div>
          <div class="scope-fact">
            <span>範圍</span>
            <b>你有權限查看的對話</b>
          </div>
          <div class="scope-fact">
            <span>排除</span>
            <b>已收回的訊息</b>
          </div>
        </div>

        <div class="sheet-foot">
          <p class="foot-filters">
            <span>匯出時可篩選</span>
            <span
              v-for="f in filterOptions"
              :key="f.name"
              class="ui-chip"
              :title="f.hint"
            >{{ f.name }}</span>
          </p>
          <button
            type="button"
            class="btn btn-primary lead-cta"
            @click="openExportDialog"
          >
            <DownloadIcon :size="16" />
            開始匯出 {{ selectedName }}
          </button>
        </div>
      </section>
    </div>

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

type Row = { key?: string; note: string }

const formats: Array<{
  id: FormatId
  name: string
  tagline: string
  icon: string
  tone: string
  unit: string
  usecases: string[]
  rows: Row[]
}> = [
  {
    id: 'json',
    name: 'JSON',
    tagline: '結構化資料',
    icon: '{ }',
    tone: 'blue',
    unit: '一則訊息一筆物件',
    usecases: ['API 整合', '資料分析', '系統備份'],
    rows: [
      { key: 'id', note: '訊息編號' },
      { key: 'conversationId', note: '對話編號' },
      { key: 'senderType', note: '寄件者類型' },
      { key: 'senderName', note: '寄件者名稱' },
      { key: 'content', note: '訊息內容' },
      { key: 'messageType', note: '訊息類型' },
      { key: 'sentAt', note: '傳送時間' },
      { note: '傳送狀態、建立時間、附加資料（metadata）' },
      { note: '檔頭另含匯出資訊：時間、匯出者、篩選條件' }
    ]
  },
  {
    id: 'csv',
    name: 'CSV',
    tagline: '試算表格式',
    icon: 'CSV',
    tone: 'green',
    unit: '一則訊息一列',
    usecases: ['Excel 報表', '統計分析', '團隊共享'],
    rows: [
      { key: 'Message ID', note: '訊息編號' },
      { key: 'Conversation ID', note: '對話編號' },
      { key: 'Sender Type', note: '寄件者類型' },
      { key: 'Sender Name', note: '寄件者名稱' },
      { key: 'Content', note: '訊息內容' },
      { note: '訊息類型、傳送時間、傳送狀態、建立時間' }
    ]
  },
  {
    id: 'txt',
    name: 'TXT',
    tagline: '純文字聊天記錄',
    icon: 'TXT',
    tone: 'lavender',
    unit: '一則訊息一行',
    usecases: ['直接閱讀', '品質審查', '列印備份'],
    rows: [
      { key: '[時間] 寄件者: 內容', note: '每則訊息一行' },
      { note: '檔頭：匯出時間、總筆數、使用的篩選條件' },
      { note: '依對話分組，組內依時間由舊到新' }
    ]
  },
  {
    id: 'pdf',
    name: 'PDF',
    tagline: '可攜式報告',
    icon: 'PDF',
    tone: 'red',
    unit: '依對話分組排版',
    usecases: ['列印報告', '正式存檔', '對外分享'],
    rows: [
      { note: '標題與匯出資訊' },
      { note: '使用的篩選條件' },
      { note: '依對話分組的訊息內容' },
      { note: '在瀏覽器內依 JSON 資料排版產生' }
    ]
  }
]

const filterOptions = [
  { name: '日期範圍', hint: '只匯出起訖日期之間的訊息' },
  { name: '客戶', hint: '只匯出指定客戶的對話' },
  { name: '客服人員', hint: '只匯出指定客服發送的訊息' }
]

const current = computed(() => formats.find(f => f.id === selectedFormat.value) ?? formats[0])
const selectedRows = computed(() => current.value?.rows ?? [])
const selectedUnit = computed(() => current.value?.unit ?? '')
const selectedName = computed(() => current.value?.name ?? '')

function openExportDialog() {
  showExportDialog.value = true
}

function selectFormat(format: FormatId) {
  selectedFormat.value = format
}
</script>

<style scoped>
.ex-grid {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 20px;
  align-items: start;
}

.ex-pick {
  min-width: 0;
}

.ex-list {
  display: grid;
  gap: 4px;
  padding: 8px;
}

.ex-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  width: 100%;
  padding: 14px 16px;
  border: 0;
  border-radius: var(--ui-r-inner);
  background: transparent;
  color: var(--ui-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.ex-row:hover {
  background: var(--ui-fill);
}

.ex-row.is-on {
  background: var(--ui-sel-tint);
  box-shadow: inset 0 0 0 2px var(--ui-accent);
}

.ex-row:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.ex-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.ex-name {
  font: 600 20px / 1.2 var(--ui-font-display);
  letter-spacing: -0.02em;
}

.ex-tag {
  margin-left: 10px;
  font: 500 14px var(--ui-font-ui);
  letter-spacing: 0;
  color: var(--ui-ink-2);
}

.ex-use {
  font-size: 13px;
  color: var(--ui-muted);
}

.ex-sheet {
  display: grid;
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.sheet-bar {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 20px 28px 14px;
}

.sheet-file {
  font: 700 22px / 1.2 var(--ui-font-display);
  letter-spacing: -0.02em;
}

.sheet-unit {
  align-self: center;
  font-size: 13px;
  color: var(--ui-muted);
}

.sheet-rows {
  display: grid;
  margin: 0 28px;
  padding: 4px 0;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
}

.sheet-row {
  display: grid;
  grid-template-columns: minmax(120px, 190px) minmax(0, 1fr);
  gap: 16px;
  padding: 6px 18px;
  font-size: 14px;
}

.sheet-row dt {
  min-width: 0;
  overflow-wrap: anywhere;
  font: 600 13px / 1.5 var(--ui-font-mono);
  color: var(--ui-ink);
}

.sheet-row dd.is-wide {
  grid-column: 1 / -1;
  color: var(--ui-muted);
}

.sheet-row dd {
  margin: 0;
  color: var(--ui-ink-2);
}

.sheet-scope {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 24px;
  padding: 20px 28px 4px;
}

.scope-fact {
  display: grid;
  gap: 2px;
}

.scope-fact span {
  font-size: 13px;
  color: var(--ui-muted);
}

.scope-fact b {
  font-size: 14px;
  font-weight: 600;
}

.sheet-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
  padding: 16px 28px 20px;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.foot-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 0;
  font-size: 13px;
  color: var(--ui-ink-2);
}

.fmt-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
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

.radio {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--ui-field-edge);
  transition: box-shadow var(--ui-dur) var(--ui-ease);
}

.is-on .radio {
  box-shadow: inset 0 0 0 6px var(--ui-accent);
}

/* The sheet carries the CTA on larger screens; phones get the sticky action bar */
.export-actions {
  display: none;
}

@media (max-width: 1024px) {
  .ex-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .lead-cta,
  .foot-filters {
    display: none;
  }

  .sheet-foot {
    display: none;
  }

  .sheet-bar {
    padding: 18px 20px 12px;
  }

  .sheet-rows {
    margin: 0 20px;
  }

  .sheet-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    padding: 6px 14px;
  }

  .sheet-row dd {
    text-align: right;
  }

  .sheet-row dd.is-wide {
    text-align: left;
  }

  .sheet-scope {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    padding: 16px 20px 20px;
  }

  .scope-fact {
    grid-template-columns: 80px minmax(0, 1fr);
    align-items: baseline;
  }

  .export-actions {
    display: flex;
  }

  /* Short page: the bar rides the bottom of the viewport rather than floating under the cards */
  .data-export {
    min-height: calc(100dvh - 120px);
  }

  .export-actions {
    margin-top: auto;
  }
}
</style>
