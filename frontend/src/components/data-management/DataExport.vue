<!-- 匯出對話記錄 - 資料管理子頁面 -->
<!-- Pick a format here; the existing ExportDialog collects date, customer and agent filters -->

<template>
  <div class="data-export">
    <header class="ui-page-head">
      <div>
        <div class="ui-eyebrow">
          資料
        </div>
        <h1 class="ui-page-title page-title">
          匯出對話
        </h1>
        <p class="ui-page-sub page-subtitle">
          選擇檔案格式，按「開始匯出」後在視窗設定日期、客戶與客服；單次最多匯出 {{ EXPORT_LIMIT.toLocaleString() }} 筆，用於備份、分析或歸檔。
        </p>
        <DataSubnav />
      </div>
      <div class="ui-page-actions header-actions">
        <button
          type="button"
          class="btn btn-primary"
          @click="openExportDialog"
        >
          <DownloadIcon :size="16" />
          開始匯出
        </button>
      </div>
    </header>

    <section class="bento">
      <div
        class="fmt-grid"
        role="radiogroup"
        aria-label="匯出格式"
      >
        <button
          v-for="format in formats"
          :key="format.id"
          type="button"
          class="ui-card format-card"
          :class="{ 'is-selected': selectedFormat === format.id }"
          role="radio"
          :aria-checked="selectedFormat === format.id"
          @click="selectFormat(format.id)"
        >
          <div class="fmt-top">
            <span
              class="fmt-ico"
              :class="format.tone"
              aria-hidden="true"
            >{{ format.icon }}</span>
            <h3 class="format-name">
              {{ format.name }}<small>{{ format.tagline }}</small>
            </h3>
            <i
              class="radio"
              aria-hidden="true"
            />
          </div>
          <p class="format-description">
            {{ format.description }}
          </p>
          <div class="use">
            <span>適用</span>{{ format.usecases.join('、') }}
          </div>
        </button>
      </div>

      <aside class="ui-card features">
        <div class="ui-card-head">
          <div>
            <h2 class="ui-card-title section-title">
              匯出視窗可設定
            </h2>
            <div class="ui-card-sub">
              按「開始匯出」後開啟
            </div>
          </div>
        </div>
        <div
          v-for="feature in features"
          :key="feature.title"
          class="feat feature-item"
        >
          <span
            class="ic"
            :class="feature.tone"
            aria-hidden="true"
          >
            <!-- eslint-disable vue/no-v-html -->
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              v-html="feature.icon"
            />
            <!-- eslint-enable vue/no-v-html -->
          </span>
          <div>
            <b>{{ feature.title }}</b>
            <span>{{ feature.text }}</span>
          </div>
        </div>
        <div class="note">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><circle
            cx="12"
            cy="12"
            r="9"
          /><path d="M12 8v5M12 16.5v.5" /></svg>
          <span>未設定任何篩選時會匯出全部記錄，系統最多匯出 {{ EXPORT_LIMIT.toLocaleString() }} 筆，超出部分將被截斷。</span>
        </div>
      </aside>
    </section>

    <!-- ExportDialog Modal (reuse existing component) -->
    <ExportDialog
      :show="showExportDialog"
      :initial-format="selectedFormat"
      @close="showExportDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { DownloadIcon } from '@/components/icons'
import ExportDialog from '@/components/conversation/ExportDialog.vue'
import DataSubnav from '@/components/data-management/DataSubnav.vue'

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

// Inner SVG markup is static (never user input)
const features = [
  {
    title: '日期範圍',
    text: '指定起訖時間，只匯出特定時間段的對話',
    tone: 'blue',
    icon: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'
  },
  {
    title: '客戶',
    text: '篩選特定客戶的對話，快速找到需要的記錄',
    tone: 'green',
    icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
  },
  {
    title: '客服人員',
    text: '依客服篩選，只匯出該客服送出的訊息，用於績效評估或品質審查',
    tone: 'indigo',
    icon: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 12 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9"/>'
  }
]

function openExportDialog() {
  showExportDialog.value = true
}

function selectFormat(format: FormatId) {
  selectedFormat.value = format
}
</script>

<style scoped>
.data-export {
  display: grid;
  gap: 20px;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
}

.bento {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.fmt-grid {
  display: grid;
  grid-column: span 8;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.features {
  grid-column: span 4;
}

.format-card {
  display: grid;
  gap: 12px;
  width: 100%;
  padding: 20px 22px;
  border: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    box-shadow var(--ui-dur) var(--ui-ease),
    background var(--ui-dur) var(--ui-ease);
}

.format-card:hover {
  box-shadow: var(--ui-shadow-raised);
}

.format-card:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.format-card.is-selected {
  background: var(--ui-sel-tint);
  box-shadow: var(--ui-sel-ring), var(--ui-shadow-raised);
}

.fmt-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.fmt-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  font: 600 13px var(--ui-font-mono);
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

.format-name {
  margin: 0;
  font: 600 16px / 1.3 var(--ui-font-display);
  letter-spacing: -0.01em;
}

.format-name small {
  display: block;
  margin-top: 1px;
  font: 500 12.5px var(--ui-font-ui);
  letter-spacing: 0;
  color: var(--ui-muted);
}

.radio {
  flex: none;
  width: 20px;
  height: 20px;
  margin-left: auto;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--ui-faint);
  transition: box-shadow var(--ui-dur) var(--ui-ease);
}

.is-selected .radio {
  box-shadow: inset 0 0 0 6px var(--ui-accent);
}

.format-description {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ui-muted);
}

.use {
  display: flex;
  gap: 8px;
  font-size: 12.5px;
  color: var(--ui-ink-2);
}

.use span {
  flex: none;
  color: var(--ui-muted);
}

.feat {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 12px 22px;
}

.feat + .feat::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  left: 62px;
  height: 0.5px;
  background: var(--ui-sep);
}

.feat .ic {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-top: 1px;
  border-radius: 9px;
}

.feat .ic svg {
  width: 15px;
  height: 15px;
}

.feat .ic.blue {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.feat .ic.green {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.feat .ic.indigo {
  background: var(--ui-indigo-soft);
  color: var(--ui-indigo);
}

.feat b {
  display: block;
  font-size: 14px;
}

.feat span {
  font-size: 13px;
  color: var(--ui-muted);
}

.note {
  display: flex;
  gap: 10px;
  margin: 8px 22px 20px;
  padding: 12px 14px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-orange-soft);
  font-size: 13px;
  color: var(--ui-orange-ink);
}

.note svg {
  flex: none;
  width: 16px;
  height: 16px;
  margin-top: 2px;
}

@media (max-width: 1280px) {
  .fmt-grid,
  .features {
    grid-column: span 12;
  }
}

@media (max-width: 768px) {
  .fmt-grid {
    grid-template-columns: 1fr;
  }

  .feat {
    padding: 12px 16px;
  }

  .feat + .feat::before {
    left: 56px;
  }

  .note {
    margin: 8px 16px 18px;
  }
}
</style>
