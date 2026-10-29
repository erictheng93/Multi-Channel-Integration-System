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
              選好格式後，在匯出視窗再設定日期、客戶與客服人員的篩選
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
              <code class="fmt-preview">{{ format.preview }}</code>
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

      <aside
        class="ui-card scope"
        aria-label="匯出內容"
      >
        <div class="ui-card-head">
          <div>
            <h2 class="ui-card-title">
              匯出內容
            </h2>
            <div class="ui-card-sub">
              {{ selectedName }} 檔案會包含
            </div>
          </div>
        </div>
        <div class="scope-body">
          <h3 class="scope-h">
            欄位
          </h3>
          <ul class="scope-list">
            <li
              v-for="item in selectedFields"
              :key="item"
            >
              {{ item }}
            </li>
          </ul>

          <h3 class="scope-h">
            範圍
          </h3>
          <ul class="scope-list">
            <li>你有權限查看的對話中的訊息</li>
            <li>不含已收回的訊息</li>
            <li>依時間由新到舊，最多 {{ EXPORT_LIMIT.toLocaleString() }} 筆</li>
          </ul>
          <div class="cap">
            <span class="cap-num">{{ EXPORT_LIMIT.toLocaleString() }}</span>
            <span class="cap-text">筆 / 單次匯出上限<br>超出部分會被截斷</span>
          </div>
        </div>
      </aside>
    </section>

    <section
      class="ui-card filters"
      aria-label="匯出前可篩選"
    >
      <h2 class="filters-title">
        匯出前可篩選
      </h2>
      <ul class="filters-list">
        <li
          v-for="f in filterOptions"
          :key="f.name"
        >
          <b>{{ f.name }}</b>
          <span>{{ f.hint }}</span>
        </li>
      </ul>
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
    fields: ['訊息編號、對話編號', '寄件者類型與名稱', '訊息內容與類型', '傳送時間、傳送狀態、建立時間', '附加資料（metadata）', '匯出資訊：時間、匯出者、篩選條件'],
    usecases: ['API 整合', '資料分析', '系統備份'],
    preview: '{ id, conversationId, senderType, senderName, content, messageType, sentAt, … }'
  },
  {
    id: 'csv' as const,
    name: 'CSV',
    tagline: '試算表格式',
    icon: 'CSV',
    tone: 'green',
    fields: ['訊息編號、對話編號', '寄件者類型與名稱', '訊息內容與類型', '傳送時間、傳送狀態、建立時間'],
    usecases: ['Excel 報表', '統計分析', '團隊共享'],
    preview: 'Message ID, Conversation ID, Sender Type, Sender Name, Content, …'
  },
  {
    id: 'txt' as const,
    name: 'TXT',
    tagline: '純文字聊天記錄',
    icon: 'TXT',
    tone: 'lavender',
    fields: ['檔頭：匯出時間、總筆數、使用的篩選條件', '依對話分組，組內依時間由舊到新', '每則一行：[時間] 寄件者: 內容'],
    usecases: ['直接閱讀', '品質審查', '列印備份'],
    preview: '[時間] 寄件者: 內容'
  },
  {
    id: 'pdf' as const,
    name: 'PDF',
    tagline: '可攜式報告',
    icon: 'PDF',
    tone: 'red',
    fields: ['在瀏覽器內依 JSON 資料排版產生', '標題與匯出資訊、使用的篩選條件', '依對話分組的訊息內容'],
    usecases: ['列印報告', '正式存檔', '對外分享'],
    preview: '標題 · 匯出資訊 · 依對話分組的訊息'
  }
]

const filterOptions = [
  { name: '日期範圍', hint: '只匯出起訖日期之間的訊息' },
  { name: '客戶', hint: '只匯出指定客戶的對話' },
  { name: '客服人員', hint: '只匯出指定客服發送的訊息' }
]

const selectedFields = computed(() => formats.find(f => f.id === selectedFormat.value)?.fields ?? [])
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
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}

.choose {
  display: flex;
  flex-direction: column;
}

.scope {
  display: flex;
  flex-direction: column;
}

.scope-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  padding: 0 22px 22px;
}

.scope-h {
  margin: 12px 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.scope-h:first-child {
  margin-top: 0;
}

.scope-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.scope-list li {
  position: relative;
  padding-left: 14px;
  font-size: 13.5px;
  line-height: 1.45;
  text-wrap: pretty;
  color: var(--ui-ink);
}

.scope-list li::before {
  position: absolute;
  top: 0.6em;
  left: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--ui-faint);
  content: '';
}

.fmt-list {
  display: grid;
  gap: 10px;
  padding: 0 22px 6px;
}

.fmt-preview {
  display: block;
  margin-top: 8px;
  padding: 8px 10px;
  overflow: hidden;
  border-radius: 10px;
  background: color-mix(in srgb, var(--ui-ink) 5%, transparent);
  font: 12px / 1.45 var(--ui-font-mono);
  color: var(--ui-ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cap {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-top: auto;
  padding: 16px 18px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-accent-soft);
}

.cap-num {
  font: 600 32px / 1 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-accent-ink, var(--ui-accent));
}

.cap-text {
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-ink-2);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 32px;
  padding: 20px 22px;
}

.filters-title {
  margin: 0;
  font: 600 var(--ui-t-title) / 1.25 var(--ui-font-display);
}

.filters-list {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 12px 32px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.filters-list li {
  display: grid;
  gap: 2px;
}

.filters-list b {
  font-size: 14px;
}

.filters-list span {
  font-size: 13px;
  color: var(--ui-muted);
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
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-card), inset 0 0 0 1px color-mix(in srgb, var(--ui-ink) 10%, transparent);
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.fmt-row:hover {
  box-shadow: var(--ui-shadow-raised), inset 0 0 0 1px color-mix(in srgb, var(--ui-ink) 14%, transparent);
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

/* The card footer carries the CTA on larger screens; phones get the sticky action bar */
.export-actions {
  display: none;
}

/* Wide screens: the four formats are tiles across the card, not a list beside an empty panel */
@media (min-width: 769px) {
  .export-grid {
    grid-template-columns: minmax(0, 1fr) 340px;
  }

  .fmt-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 4px 22px 6px;
  }

  .fmt-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    min-height: 210px;
    padding: 20px;
  }

  .fmt-ico {
    width: 44px;
    height: 44px;
  }

  .fmt-text {
    flex: none;
    width: 100%;
  }

  .fmt-text b small {
    display: block;
    margin: 2px 0 6px;
  }

  .fmt-use {
    white-space: normal;
  }

  .radio {
    position: absolute;
    top: 18px;
    right: 18px;
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
    padding: 0 16px 18px;
  }

  .scope-body {
    padding: 0 18px 18px;
  }

  /* Short page: the bar rides the bottom of the viewport rather than floating under the cards */
  .data-export {
    min-height: calc(100dvh - 120px);
  }

  .export-actions {
    margin-top: auto;
  }

  .filters {
    flex-direction: column;
    align-items: flex-start;
  }

  .filters-list {
    flex-direction: column;
  }
}
</style>
